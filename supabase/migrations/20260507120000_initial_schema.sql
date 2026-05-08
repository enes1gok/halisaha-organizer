-- Halisaha Organizer: core schema (public)
-- Maps to src/types/domain.ts — normalize nested Match / ScoreResult / Attendee.
-- Idempotent: mevcut uzak DB'lerde db push tekrarlandığında çakışmasın.

create extension if not exists pgcrypto with schema extensions;

-- --- Enums (Postgres names; map to TS at app boundary) ---

do $$ begin
  create type public.player_position as enum ('GK', 'DEF', 'MID', 'FWD');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.preferred_foot as enum ('left', 'right', 'both');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.rsvp_status as enum ('going', 'maybe', 'not_going');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.match_status as enum ('upcoming', 'ongoing', 'finished');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.team_side as enum ('A', 'B');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.stat_line_kind as enum ('goal', 'assist');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.self_report_type as enum ('goal', 'assist');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.self_report_status as enum ('pending', 'approved', 'rejected');
exception
  when duplicate_object then null;
end $$;

-- --- Profiles (1:1 auth.users) ---

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  photo_uri text,
  position public.player_position not null default 'MID',
  preferred_foot public.preferred_foot not null default 'right',
  iban text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'App player profile; id matches auth.users.';

-- --- Matches ---

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  venue text not null,
  organizer_id uuid not null references public.profiles (id) on delete restrict,
  max_players int not null default 14,
  price_per_person numeric(12, 2),
  iban text,
  join_code text not null,
  lineup_locked boolean not null default false,
  self_report_enabled boolean not null default false,
  status public.match_status not null default 'upcoming',
  score_a int,
  score_b int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matches_join_code_nonempty check (length(trim(join_code)) >= 1)
);

create unique index if not exists matches_join_code_key on public.matches (join_code);

create index if not exists matches_organizer_id_idx on public.matches (organizer_id);

create index if not exists matches_starts_at_idx on public.matches (starts_at);

create index if not exists matches_status_idx on public.matches (status);

-- --- RSVP / payment ---

create table if not exists public.match_attendees (
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  status public.rsvp_status not null default 'going',
  paid boolean not null default false,
  primary key (match_id, player_id)
);

create index if not exists match_attendees_player_id_idx on public.match_attendees (player_id);

-- --- Lineup (replaces teamAIds / teamBIds arrays) ---

create table if not exists public.match_team_players (
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  team public.team_side not null,
  primary key (match_id, player_id)
);

create index if not exists match_team_players_match_team_idx on public.match_team_players (match_id, team);

-- --- Goals / assists (ScoreResult.scorers / assists) ---

create table if not exists public.match_stat_lines (
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  kind public.stat_line_kind not null,
  count int not null default 1,
  primary key (match_id, player_id, kind),
  constraint match_stat_lines_count_positive check (count > 0)
);

-- --- Self-reports ---

create table if not exists public.self_report_requests (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  type public.self_report_type not null,
  status public.self_report_status not null default 'pending',
  created_at timestamptz not null default now()
);

create unique index if not exists self_report_one_pending_per_player_type on public.self_report_requests (match_id, player_id, type)
where
  status = 'pending';

create index if not exists self_report_requests_match_id_idx on public.self_report_requests (match_id);

-- --- updated_at ---

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute procedure public.set_updated_at();

drop trigger if exists matches_set_updated_at on public.matches;

create trigger matches_set_updated_at
before update on public.matches
for each row
execute procedure public.set_updated_at();

-- --- Signup → profile row ---

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'display_name',
      split_part(coalesce(new.email, ''), '@', 1),
      'Oyuncu'
    )
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();

-- --- Block lineup edits when locked (align with lockLineup in useAppStore) ---

create or replace function public.enforce_lineup_not_locked()
returns trigger
language plpgsql
as $$
declare
  locked boolean;
  mid uuid := coalesce(new.match_id, old.match_id);
begin
  select m.lineup_locked
  into locked
  from public.matches m
  where m.id = mid;

  if coalesce(locked, false) then
    raise exception 'Kadro kilitli; takım ataması değiştirilemez.';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists match_team_players_lineup_guard on public.match_team_players;

create trigger match_team_players_lineup_guard
before insert
or update
or delete on public.match_team_players for each row
execute procedure public.enforce_lineup_not_locked();
