-- Fix match_peer_ratings CHECK constraint to align with UI band scores (0-100 scale)
-- Root cause: original constraint was `score >= 1 AND score <= 10`, but UI sends 45/60/75/90
-- RPC validation already updated to 0-100 in 20260622120000, but table constraint was never updated

alter table public.match_peer_ratings
  drop constraint match_peer_ratings_score_range;

alter table public.match_peer_ratings
  add constraint match_peer_ratings_score_range
  check (score >= 0 and score <= 100);
