-- Match payment method support (note_only / iban / cash) + payment note.

alter table public.matches
  add column if not exists payment_method text,
  add column if not exists iban_account_name text,
  add column if not exists payment_note text;

update public.matches
set payment_method = 'iban'
where payment_method is null;

update public.matches
set payment_method = 'note_only'
where payment_method = 'free';

update public.matches
set payment_note = 'Not eklenmedi.'
where payment_method = 'note_only'
  and nullif(trim(coalesce(payment_note, '')), '') is null;

alter table public.matches
  alter column payment_method set default 'iban',
  alter column payment_method set not null;

alter table public.matches
  drop constraint if exists matches_payment_method_chk,
  drop constraint if exists matches_payment_note_chk;

alter table public.matches
  add constraint matches_payment_method_chk
  check (payment_method in ('note_only', 'iban', 'cash'));

alter table public.matches
  add constraint matches_payment_note_chk
  check (
    (
      payment_method = 'note_only'
      and char_length(trim(coalesce(payment_note, ''))) between 1 and 120
      and iban is null
      and iban_account_name is null
    )
    or
    (
      payment_method <> 'note_only'
      and payment_note is null
    )
  );

drop function if exists public.create_match_with_organizer_attendee(
  timestamptz,
  text,
  int,
  text,
  uuid,
  numeric,
  text
);

create or replace function public.create_match_with_organizer_attendee(
  p_starts_at timestamptz,
  p_venue text,
  p_max_players int,
  p_join_code text,
  p_group_id uuid default null,
  p_price_per_person numeric default null,
  p_iban text default null,
  p_payment_method text default 'iban',
  p_iban_account_name text default null,
  p_payment_note text default null
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  norm_join text := public.normalize_join_code(p_join_code);
  method text := lower(trim(coalesce(p_payment_method, '')));
  norm_iban text := nullif(trim(coalesce(p_iban, '')), '');
  norm_iban_account_name text := nullif(upper(trim(coalesce(p_iban_account_name, ''))), '');
  norm_payment_note text := nullif(trim(coalesce(p_payment_note, '')), '');
  created public.matches;
begin
  if uid is null then
    perform public.raise_app_error('ERR_AUTH_REQUIRED');
  end if;

  perform public.ensure_my_profile();

  if p_group_id is not null and not public.can_view_group(p_group_id, uid) then
    perform public.raise_app_error('ERR_MATCH_CREATE_GROUP_FORBIDDEN');
  end if;

  if method not in ('note_only', 'iban', 'cash') then
    perform public.raise_app_error('ERR_MATCH_PAYMENT_METHOD_INVALID');
  end if;

  if method = 'iban' then
    if norm_iban is null or norm_iban_account_name is null then
      perform public.raise_app_error('ERR_MATCH_PAYMENT_IBAN_REQUIRED');
    end if;
    norm_payment_note := null;
  elsif method = 'note_only' then
    if norm_payment_note is null then
      perform public.raise_app_error('ERR_MATCH_PAYMENT_NOTE_REQUIRED');
    end if;
    if char_length(norm_payment_note) > 120 then
      perform public.raise_app_error('ERR_MATCH_PAYMENT_NOTE_TOO_LONG');
    end if;
    norm_iban := null;
    norm_iban_account_name := null;
  else
    norm_iban := null;
    norm_iban_account_name := null;
    norm_payment_note := null;
  end if;

  insert into public.matches (
    starts_at,
    venue,
    organizer_id,
    max_players,
    group_id,
    price_per_person,
    iban,
    iban_account_name,
    payment_note,
    payment_method,
    join_code
  )
  values (
    p_starts_at,
    trim(p_venue),
    uid,
    p_max_players,
    p_group_id,
    p_price_per_person,
    norm_iban,
    norm_iban_account_name,
    norm_payment_note,
    method,
    norm_join
  )
  returning * into created;

  insert into public.match_attendees (match_id, player_id, status, paid)
  values (created.id, uid, 'going', false);

  return created;
end;
$$;

comment on function public.create_match_with_organizer_attendee(
  timestamptz,
  text,
  int,
  text,
  uuid,
  numeric,
  text,
  text,
  text,
  text
) is
  'Creates an upcoming match as auth.uid() and adds organizer as going attendee (single transaction).';

revoke execute on function public.create_match_with_organizer_attendee(
  timestamptz,
  text,
  int,
  text,
  uuid,
  numeric,
  text,
  text,
  text,
  text
) from public;

grant execute on function public.create_match_with_organizer_attendee(
  timestamptz,
  text,
  int,
  text,
  uuid,
  numeric,
  text,
  text,
  text,
  text
) to authenticated;

revoke execute on function public.create_match_with_organizer_attendee(
  timestamptz,
  text,
  int,
  text,
  uuid,
  numeric,
  text,
  text,
  text,
  text
) from anon;

create or replace function public.get_match_detail_for_user(p_match_id uuid)
returns table (
  id uuid,
  starts_at timestamptz,
  venue text,
  organizer_id uuid,
  max_players int,
  price_per_person numeric,
  iban text,
  iban_account_name text,
  payment_note text,
  payment_method text,
  join_code text,
  lineup_locked boolean,
  self_report_enabled boolean,
  status public.match_status,
  score_a int,
  score_b int,
  group_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id,
    m.starts_at,
    m.venue,
    m.organizer_id,
    m.max_players,
    m.price_per_person,
    m.iban,
    m.iban_account_name,
    m.payment_note,
    m.payment_method,
    m.join_code,
    m.lineup_locked,
    m.self_report_enabled,
    m.status,
    m.score_a,
    m.score_b,
    case
      when m.group_id is not null and public.can_view_group(m.group_id, auth.uid()) then m.group_id
      else null::uuid
    end as group_id,
    m.created_at,
    m.updated_at
  from public.matches m
  where m.id = p_match_id
    and public.can_view_match(m.id, auth.uid());
$$;

create or replace function public.list_visible_matches_for_user()
returns table (
  id uuid,
  starts_at timestamptz,
  venue text,
  organizer_id uuid,
  max_players int,
  price_per_person numeric,
  iban text,
  iban_account_name text,
  payment_note text,
  payment_method text,
  join_code text,
  lineup_locked boolean,
  self_report_enabled boolean,
  status public.match_status,
  score_a int,
  score_b int,
  group_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id,
    m.starts_at,
    m.venue,
    m.organizer_id,
    m.max_players,
    m.price_per_person,
    m.iban,
    m.iban_account_name,
    m.payment_note,
    m.payment_method,
    m.join_code,
    m.lineup_locked,
    m.self_report_enabled,
    m.status,
    m.score_a,
    m.score_b,
    case
      when m.group_id is not null and public.can_view_group(m.group_id, auth.uid()) then m.group_id
      else null::uuid
    end as group_id,
    m.created_at,
    m.updated_at
  from public.matches m
  where public.can_view_match(m.id, auth.uid());
$$;

create or replace function public.match_graph_row(p_match_id uuid)
returns table (
  id uuid,
  starts_at timestamptz,
  venue text,
  organizer_id uuid,
  max_players int,
  price_per_person numeric,
  iban text,
  iban_account_name text,
  payment_note text,
  payment_method text,
  join_code text,
  lineup_locked boolean,
  self_report_enabled boolean,
  status public.match_status,
  score_a int,
  score_b int,
  group_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  attendees jsonb,
  team_players jsonb,
  stat_lines jsonb,
  self_reports jsonb,
  profiles jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id,
    m.starts_at,
    m.venue,
    m.organizer_id,
    m.max_players,
    m.price_per_person,
    m.iban,
    m.iban_account_name,
    m.payment_note,
    m.payment_method,
    m.join_code,
    m.lineup_locked,
    m.self_report_enabled,
    m.status,
    m.score_a,
    m.score_b,
    case
      when m.group_id is not null and public.can_view_group(m.group_id, auth.uid()) then m.group_id
      else null::uuid
    end as group_id,
    m.created_at,
    m.updated_at,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'match_id', a.match_id,
          'player_id', a.player_id,
          'status', a.status,
          'paid', a.paid
        )
      )
      from public.match_attendees a
      where a.match_id = m.id
    ), '[]'::jsonb) as attendees,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'match_id', t.match_id,
          'player_id', t.player_id,
          'team', t.team
        )
      )
      from public.match_team_players t
      where t.match_id = m.id
    ), '[]'::jsonb) as team_players,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'match_id', s.match_id,
          'player_id', s.player_id,
          'kind', s.kind,
          'count', s.count
        )
      )
      from public.match_stat_lines s
      where s.match_id = m.id
    ), '[]'::jsonb) as stat_lines,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', sr.id,
          'match_id', sr.match_id,
          'player_id', sr.player_id,
          'type', sr.type,
          'status', sr.status,
          'created_at', sr.created_at
        )
      )
      from public.self_report_requests sr
      where sr.match_id = m.id
    ), '[]'::jsonb) as self_reports,
    coalesce((
      with profile_ids as (
        select m.organizer_id as player_id
        union
        select a.player_id
        from public.match_attendees a
        where a.match_id = m.id
        union
        select t.player_id
        from public.match_team_players t
        where t.match_id = m.id
        union
        select s.player_id
        from public.match_stat_lines s
        where s.match_id = m.id
        union
        select sr.player_id
        from public.self_report_requests sr
        where sr.match_id = m.id
      )
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'display_name', p.display_name,
          'photo_uri', p.photo_uri,
          'position', p.position,
          'preferred_foot', p.preferred_foot
        )
      )
      from public.profiles_public p
      join profile_ids pid on pid.player_id = p.id
    ), '[]'::jsonb) as profiles
  from public.matches m
  where m.id = p_match_id
    and public.can_view_match(m.id, auth.uid());
$$;

create or replace function public.get_match_graph_for_user(p_match_id uuid)
returns table (
  id uuid,
  starts_at timestamptz,
  venue text,
  organizer_id uuid,
  max_players int,
  price_per_person numeric,
  iban text,
  iban_account_name text,
  payment_note text,
  payment_method text,
  join_code text,
  lineup_locked boolean,
  self_report_enabled boolean,
  status public.match_status,
  score_a int,
  score_b int,
  group_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  attendees jsonb,
  team_players jsonb,
  stat_lines jsonb,
  self_reports jsonb,
  profiles jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select * from public.match_graph_row(p_match_id);
$$;

create or replace function public.list_visible_match_graphs_for_user()
returns table (
  id uuid,
  starts_at timestamptz,
  venue text,
  organizer_id uuid,
  max_players int,
  price_per_person numeric,
  iban text,
  iban_account_name text,
  payment_note text,
  payment_method text,
  join_code text,
  lineup_locked boolean,
  self_report_enabled boolean,
  status public.match_status,
  score_a int,
  score_b int,
  group_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  attendees jsonb,
  team_players jsonb,
  stat_lines jsonb,
  self_reports jsonb,
  profiles jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select mg.*
  from public.matches m
  cross join lateral public.match_graph_row(m.id) as mg
  where public.can_view_match(m.id, auth.uid())
  order by mg.starts_at desc, mg.id desc;
$$;
