-- Align max_players with app clampEvenMatchMaxPlayers: 4–22, even only.
-- Backfill then tighten CHECK (matches + group_weekly_series).

update public.matches
set max_players = (
  round(least(22, greatest(4, max_players))::numeric / 2) * 2
)::int;

alter table public.matches
  drop constraint if exists matches_max_players_chk;

alter table public.matches
  add constraint matches_max_players_chk check (
    max_players >= 4
    and max_players <= 22
    and max_players % 2 = 0
  );

update public.group_weekly_series
set max_players = (
  round(least(22, greatest(4, max_players))::numeric / 2) * 2
)::int;

alter table public.group_weekly_series
  drop constraint if exists group_weekly_series_max_players_chk;

alter table public.group_weekly_series
  add constraint group_weekly_series_max_players_chk check (
    max_players >= 4
    and max_players <= 22
    and max_players % 2 = 0
  );
