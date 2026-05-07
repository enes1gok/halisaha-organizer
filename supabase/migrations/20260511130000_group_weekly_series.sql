-- Weekly recurring group matches: template table + idempotent spawn inside submit_match_result transaction.

-- --- Template (one row per group) ---

create table public.group_weekly_series (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  is_active boolean not null default true,
  weekday_isodow smallint not null,
  local_time time not null,
  timezone text not null default 'Europe/Istanbul',
  venue text not null,
  max_players int not null default 14,
  price_per_person numeric(12, 2),
  iban text,
  default_organizer_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint group_weekly_series_weekday_chk check (
    weekday_isodow >= 1
    and weekday_isodow <= 7
  ),
  constraint group_weekly_series_max_players_chk check (max_players > 0),
  constraint group_weekly_series_venue_nonempty check (char_length(trim(venue)) >= 1),
  constraint group_weekly_series_group_unique unique (group_id)
);

comment on table public.group_weekly_series is 'Haftalık sabit saha/gün/saat şablonu; maç bitince submit_match_result içinde sonraki hafta maçı üretilir.';

create trigger group_weekly_series_set_updated_at
before update on public.group_weekly_series for each row
execute procedure public.set_updated_at();

-- --- Match columns (spawn metadata) ---

alter table public.matches
  add column if not exists series_id uuid references public.group_weekly_series (id) on delete set null;

alter table public.matches
  add column if not exists spawned_from_match_id uuid references public.matches (id) on delete set null;

-- At most one spawned child per finished match (NULL allowed for non-spawned rows).
create unique index if not exists matches_spawned_from_match_id_key on public.matches (spawned_from_match_id);

-- --- Join code helper (aligns with client HS- + 4 alnum) ---

create or replace function public.generate_match_join_code()
returns text
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  att int := 0;
  code text;
  pos int;
begin
  loop
    att := att + 1;
    exit when att > 20;
    code := 'HS-';
    for i in 1..4 loop
      pos := 1 + floor(random() * length(chars))::int;
      code := code || substr(chars, pos, 1);
    end loop;
    if not exists (
      select
        1
      from
        public.matches mm
      where
        mm.join_code = code
    ) then
      return code;
    end if;
  end loop;

  return 'HS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
end;
$$;

-- --- Spawn next weekly match (single code path; idempotent) ---

create or replace function public.spawn_next_weekly_match(p_finished_match_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  m record;
  s record;
  v_tz text;
  v_next_date date;
  v_next timestamptz;
  v_join text;
begin
  select
    mm.id,
    mm.group_id,
    mm.starts_at,
    mm.status
  into
    m
  from
    public.matches mm
  where
    mm.id = p_finished_match_id;

  if m.id is null then
    return;
  end if;

  if m.status is distinct from 'finished'::public.match_status then
    return;
  end if;

  if m.group_id is null then
    return;
  end if;

  select
    gws.*
  into
    s
  from
    public.group_weekly_series gws
  where
    gws.group_id = m.group_id
    and gws.is_active = true
  limit
    1;

  if not found then
    return;
  end if;

  v_tz := nullif(trim(s.timezone), '');

  if v_tz is null then
    v_tz := 'Europe/Istanbul';
  end if;

  v_next_date := (m.starts_at at time zone v_tz)::date + 7;
  v_next := (v_next_date::timestamp + s.local_time) at time zone v_tz;
  v_join := public.generate_match_join_code();

  with ins as (
    insert into public.matches (
      starts_at,
      venue,
      organizer_id,
      max_players,
      price_per_person,
      iban,
      join_code,
      group_id,
      lineup_locked,
      self_report_enabled,
      status,
      series_id,
      spawned_from_match_id
    )
    values (
      v_next,
      trim(s.venue),
      s.default_organizer_id,
      s.max_players,
      s.price_per_person,
      s.iban,
      v_join,
      m.group_id,
      false,
      false,
      'upcoming'::public.match_status,
      s.id,
      p_finished_match_id
    )
    on conflict (spawned_from_match_id) do nothing
    returning
      id,
      organizer_id
  )
  insert into public.match_attendees (match_id, player_id, status, paid)
  select
    ins.id,
    ins.organizer_id,
    'going'::public.rsvp_status,
    false
  from
    ins;
end;
$$;

-- --- Optional backfill: finished group matches missing child (indexed path, LIMIT) ---

create or replace function public.reconcile_weekly_series_matches(p_limit int default 50)
returns int
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r record;
  n int := 0;
begin
  if p_limit < 1 then
    p_limit := 1;
  end if;

  if p_limit > 500 then
    p_limit := 500;
  end if;

  for r in
    select
      m.id
    from
      public.matches m
      inner join public.group_weekly_series s on s.group_id = m.group_id
      and s.is_active = true
    where
      m.status = 'finished'::public.match_status
      and m.group_id is not null
      and m.starts_at > (now() - interval '120 days')
      and not exists (
        select
          1
        from
          public.matches c
        where
          c.spawned_from_match_id = m.id
      )
    order by
      m.starts_at desc
    limit
      p_limit
  loop
    perform public.spawn_next_weekly_match(r.id);
    n := n + 1;
  end loop;

  return n;
end;
$$;

-- --- submit_match_result: keep lineup raters + call spawn (same transaction) ---

create or replace function public.submit_match_result(
  p_match_id uuid,
  p_score_a int,
  p_score_b int,
  p_scorers jsonb default '[]'::jsonb,
  p_assists jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;

  if not (
    public.is_match_organizer(p_match_id, uid)
    or public.match_rating_rater_can_participate(p_match_id, uid)
  ) then
    raise exception 'Yetkisiz işlem';
  end if;

  delete from public.match_stat_lines
  where
    match_id = p_match_id;

  insert into public.match_stat_lines (match_id, player_id, kind, count)
  select
    p_match_id,
    (elem ->> 'player_id')::uuid,
    'goal'::public.stat_line_kind,
    sum(greatest(1, coalesce((elem ->> 'count')::int, 1)))::int
  from
    jsonb_array_elements(coalesce(p_scorers, '[]'::jsonb)) elem
  group by
    p_match_id,
    (elem ->> 'player_id')::uuid;

  insert into public.match_stat_lines (match_id, player_id, kind, count)
  select
    p_match_id,
    (elem ->> 'player_id')::uuid,
    'assist'::public.stat_line_kind,
    sum(greatest(1, coalesce((elem ->> 'count')::int, 1)))::int
  from
    jsonb_array_elements(coalesce(p_assists, '[]'::jsonb)) elem
  group by
    p_match_id,
    (elem ->> 'player_id')::uuid;

  insert into public.match_stat_lines (match_id, player_id, kind, count)
  select
    sr.match_id,
    sr.player_id,
    case
      when sr.type = 'goal'::public.self_report_type then 'goal'::public.stat_line_kind
      else 'assist'::public.stat_line_kind
    end,
    count(*)::int
  from
    public.self_report_requests sr
  where
    sr.match_id = p_match_id
    and sr.status = 'approved'
  group by
    sr.match_id,
    sr.player_id,
    sr.type
  on conflict (match_id, player_id, kind) do update
  set
    count = public.match_stat_lines.count + excluded.count;

  update
    public.matches
  set
    score_a = p_score_a,
    score_b = p_score_b,
    status = 'finished'::public.match_status,
    updated_at = now()
  where
    id = p_match_id;

  perform public.spawn_next_weekly_match(p_match_id);
end;
$$;

-- --- RLS: group_weekly_series ---

alter table public.group_weekly_series enable row level security;

create policy group_weekly_series_select_member on public.group_weekly_series for
select
  to authenticated using (public.can_view_group (group_id, auth.uid()));

create policy group_weekly_series_insert_owner on public.group_weekly_series for insert to authenticated with check (
  exists (
    select
      1
    from
      public.groups g
    where
      g.id = group_id
      and g.owner_id = auth.uid ()
  )
);

create policy group_weekly_series_update_owner on public.group_weekly_series for
update to authenticated using (
  exists (
    select
      1
    from
      public.groups g
    where
      g.id = group_weekly_series.group_id
      and g.owner_id = auth.uid ()
  )
)
with
  check (
    exists (
      select
        1
      from
        public.groups g
      where
        g.id = group_weekly_series.group_id
        and g.owner_id = auth.uid ()
      )
  );

create policy group_weekly_series_delete_owner on public.group_weekly_series for delete to authenticated using (
  exists (
    select
      1
    from
      public.groups g
    where
      g.id = group_weekly_series.group_id
      and g.owner_id = auth.uid ()
  )
);

grant select,
insert,
update,
delete on table public.group_weekly_series to authenticated;

grant execute on function public.generate_match_join_code() to service_role;

grant execute on function public.reconcile_weekly_series_matches(int) to service_role;
