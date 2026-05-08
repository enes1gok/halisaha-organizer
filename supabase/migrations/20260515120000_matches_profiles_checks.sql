-- Named CHECK constraints for matches/profiles (maps to client translation keys via constraint name).
-- Policy: max_players aligned with app CreateMatchTabScreen (4–22); scores both null or both non-null and >= 0;
-- starts_at upper bound vs created_at catches absurd typos; profiles display_name length cap.

alter table public.matches
  drop constraint if exists matches_max_players_chk;

alter table public.matches
  add constraint matches_max_players_chk check (
    max_players >= 4
    and max_players <= 22
  );

alter table public.matches
  drop constraint if exists matches_scores_consistency_chk;

alter table public.matches
  add constraint matches_scores_consistency_chk check (
    (
      score_a is null
      and score_b is null
    )
    or (
      score_a is not null
      and score_b is not null
      and score_a >= 0
      and score_b >= 0
    )
  );

alter table public.matches
  drop constraint if exists matches_starts_at_upper_chk;

alter table public.matches
  add constraint matches_starts_at_upper_chk check (
    starts_at <= created_at + interval '5 years'
  );

alter table public.profiles
  drop constraint if exists profiles_display_name_len_chk;

alter table public.profiles
  add constraint profiles_display_name_len_chk check (
    char_length(trim(display_name)) <= 80
  );
