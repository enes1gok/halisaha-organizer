-- Groups + group-scoped matches + push token pipeline

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) >= 2),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  join_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (group_id, player_id)
);

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null,
  platform text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  token text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create unique index if not exists notification_deliveries_unique_target
on public.notification_deliveries (match_id, recipient_id, token);

alter table public.matches add column if not exists group_id uuid references public.groups (id) on delete set null;
create index if not exists matches_group_id_starts_at_idx on public.matches (group_id, starts_at);

create index if not exists group_members_group_user_idx on public.group_members (group_id, player_id);

create or replace function public.set_push_tokens_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists push_tokens_set_updated_at on public.push_tokens;
create trigger push_tokens_set_updated_at
before update on public.push_tokens
for each row
execute procedure public.set_push_tokens_updated_at();

create or replace function public.can_view_group(p_group_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.player_id = p_uid
  );
$$;

create or replace function public.can_view_match(p_match_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.matches m
    where m.id = p_match_id
      and (
        m.organizer_id = p_uid
        or exists (
          select 1
          from public.match_attendees a
          where a.match_id = m.id
            and a.player_id = p_uid
        )
        or exists (
          select 1
          from public.match_team_players t
          where t.match_id = m.id
            and t.player_id = p_uid
        )
        or (m.group_id is not null and public.can_view_group(m.group_id, p_uid))
      )
  );
$$;

create or replace function public.create_group(p_name text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  created public.groups;
  code text;
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;

  code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));

  insert into public.groups (name, owner_id, join_code)
  values (trim(p_name), uid, code)
  returning * into created;

  insert into public.group_members (group_id, player_id, role)
  values (created.id, uid, 'owner')
  on conflict do nothing;

  return created;
end;
$$;

create or replace function public.join_group_by_code(p_code text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  target public.groups;
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;

  select * into target
  from public.groups g
  where upper(regexp_replace(trim(g.join_code), '[\s-]', '', 'g')) =
        upper(regexp_replace(trim(coalesce(p_code, '')), '[\s-]', '', 'g'))
  limit 1;

  if target.id is null then
    return null;
  end if;

  insert into public.group_members (group_id, player_id, role)
  values (target.id, uid, 'member')
  on conflict (group_id, player_id) do nothing;

  return target;
end;
$$;

create or replace function public.enqueue_group_match_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.group_id is null then
    return new;
  end if;

  insert into public.notification_deliveries (match_id, group_id, recipient_id, token)
  select
    new.id,
    new.group_id,
    gm.player_id,
    pt.token
  from public.group_members gm
  join public.push_tokens pt on pt.user_id = gm.player_id
  where gm.group_id = new.group_id
    and gm.player_id <> new.organizer_id
    and pt.is_active = true
  on conflict (match_id, recipient_id, token) do nothing;

  return new;
end;
$$;

drop trigger if exists matches_enqueue_group_notifications on public.matches;
create trigger matches_enqueue_group_notifications
after insert on public.matches
for each row
execute procedure public.enqueue_group_match_notifications();

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.push_tokens enable row level security;
alter table public.notification_deliveries enable row level security;

create policy groups_select_member on public.groups
for select to authenticated
using (public.can_view_group(id, auth.uid()));

create policy groups_insert_owner on public.groups
for insert to authenticated
with check (owner_id = auth.uid());

create policy groups_update_owner on public.groups
for update to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy group_members_select_member on public.group_members
for select to authenticated
using (public.can_view_group(group_id, auth.uid()));

create policy group_members_insert_self_or_owner on public.group_members
for insert to authenticated
with check (
  player_id = auth.uid()
  or exists (
    select 1
    from public.groups g
    where g.id = group_id
      and g.owner_id = auth.uid()
  )
);

create policy group_members_delete_self_or_owner on public.group_members
for delete to authenticated
using (
  player_id = auth.uid()
  or exists (
    select 1
    from public.groups g
    where g.id = group_id
      and g.owner_id = auth.uid()
  )
);

create policy push_tokens_select_own on public.push_tokens
for select to authenticated
using (user_id = auth.uid());

create policy push_tokens_insert_own on public.push_tokens
for insert to authenticated
with check (user_id = auth.uid());

create policy push_tokens_update_own on public.push_tokens
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy notification_deliveries_select_own on public.notification_deliveries
for select to authenticated
using (recipient_id = auth.uid());

grant select, insert, update, delete on table public.groups to authenticated;
grant select, insert, delete on table public.group_members to authenticated;
grant select, insert, update on table public.push_tokens to authenticated;
grant select on table public.notification_deliveries to authenticated;
grant execute on function public.can_view_group (uuid, uuid) to authenticated;
grant execute on function public.create_group (text) to authenticated;
grant execute on function public.join_group_by_code (text) to authenticated;
