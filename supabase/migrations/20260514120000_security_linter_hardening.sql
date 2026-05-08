-- Security linter: stable search_path on trigger/helpers + REVOKE EXECUTE FROM PUBLIC
-- so anon cannot invoke SECURITY DEFINER RPCs via PostgREST default grants.
-- Re-applies explicit GRANTs matching prior migrations + trigger/service_role needs.

-- ---------------------------------------------------------------------------
-- 1) search_path (lint 0011_function_search_path_mutable)
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.enforce_lineup_not_locked()
returns trigger
language plpgsql
set search_path = public
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

create or replace function public.normalize_join_code(p_code text)
returns text
language sql
immutable
set search_path = public
as $$
  select
    upper(regexp_replace(trim(coalesce(p_code, '')), '[\s-]', '', 'g'));
$$;

create or replace function public.set_push_tokens_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) Strip default PUBLIC execute; restore explicit grants (lint 0028 / RPC surface)
-- ---------------------------------------------------------------------------

revoke execute on function public.cancel_pending_reminders_on_rsvp() from public;
revoke execute on function public.can_view_group(uuid, uuid) from public;
revoke execute on function public.can_view_match(uuid, uuid) from public;
revoke execute on function public.claim_pending_deliveries(integer) from public;
revoke execute on function public.create_group(text) from public;
revoke execute on function public.drain_notification_deliveries() from public;
revoke execute on function public.enqueue_group_match_notifications() from public;
revoke execute on function public.enqueue_group_match_reminders() from public;
revoke execute on function public.ensure_my_profile() from public;
revoke execute on function public.enforce_lineup_not_locked() from public;
revoke execute on function public.generate_match_join_code() from public;
revoke execute on function public.get_match_by_join_code(text) from public;
revoke execute on function public.get_match_detail_for_user(uuid) from public;
revoke execute on function public.get_match_graph_for_user(uuid) from public;
revoke execute on function public.get_match_rating_public_summary(uuid) from public;
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.is_match_organizer(uuid, uuid) from public;
revoke execute on function public.join_group_by_code(text) from public;
revoke execute on function public.join_match_by_join_code(text) from public;
revoke execute on function public.list_visible_match_graphs_for_user() from public;
revoke execute on function public.list_visible_matches_for_user() from public;
revoke execute on function public.match_graph_row(uuid) from public;
revoke execute on function public.match_rating_eligible_player_ids(uuid) from public;
revoke execute on function public.match_rating_rater_can_participate(uuid, uuid) from public;
revoke execute on function public.match_rating_ratee_is_eligible(uuid, uuid) from public;
revoke execute on function public.normalize_join_code(text) from public;
revoke execute on function public.player_leaderboard_stats(text, timestamptz) from public;
revoke execute on function public.player_leaderboard_stats(text, timestamptz, uuid, text) from public;
revoke execute on function public.reconcile_weekly_series_matches(integer) from public;
revoke execute on function public.set_push_tokens_updated_at() from public;
revoke execute on function public.set_updated_at() from public;
revoke execute on function public.spawn_next_weekly_match(uuid) from public;
revoke execute on function public.submit_match_result(uuid, integer, integer, jsonb, jsonb) from public;
revoke execute on function public.upsert_match_motm_vote(uuid, uuid) from public;
revoke execute on function public.upsert_match_peer_ratings(uuid, jsonb) from public;

-- Auth signup trigger (hosted Supabase inserts into auth.users as supabase_auth_admin)
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.handle_new_user() to supabase_auth_admin;
  end if;
end $$;

-- Trigger functions: statement executor must retain EXECUTE
grant execute on function public.set_updated_at() to authenticated;
grant execute on function public.enforce_lineup_not_locked() to authenticated;
grant execute on function public.set_push_tokens_updated_at() to authenticated;
grant execute on function public.enqueue_group_match_notifications() to authenticated;
grant execute on function public.cancel_pending_reminders_on_rsvp() to authenticated;

-- Anon + authenticated (join code preview / normalization)
grant execute on function public.normalize_join_code(text) to anon, authenticated;
grant execute on function public.get_match_by_join_code(text) to anon, authenticated;

-- Authenticated RPC surface (matches prior migrations)
grant execute on function public.join_match_by_join_code(text) to authenticated;
grant execute on function public.submit_match_result(uuid, integer, integer, jsonb, jsonb) to authenticated;
grant execute on function public.player_leaderboard_stats(text, timestamptz) to authenticated;
grant execute on function public.player_leaderboard_stats(text, timestamptz, uuid, text) to authenticated;
grant execute on function public.is_match_organizer(uuid, uuid) to authenticated;
grant execute on function public.can_view_match(uuid, uuid) to authenticated;

grant execute on function public.get_match_detail_for_user(uuid) to authenticated;
grant execute on function public.list_visible_matches_for_user() to authenticated;

grant execute on function public.can_view_group(uuid, uuid) to authenticated;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.join_group_by_code(text) to authenticated;

grant execute on function public.ensure_my_profile() to authenticated;

grant execute on function public.list_visible_match_graphs_for_user() to authenticated;
grant execute on function public.get_match_graph_for_user(uuid) to authenticated;

grant execute on function public.match_rating_eligible_player_ids(uuid) to authenticated;
grant execute on function public.match_rating_rater_can_participate(uuid, uuid) to authenticated;
grant execute on function public.match_rating_ratee_is_eligible(uuid, uuid) to authenticated;
grant execute on function public.upsert_match_peer_ratings(uuid, jsonb) to authenticated;
grant execute on function public.upsert_match_motm_vote(uuid, uuid) to authenticated;
grant execute on function public.get_match_rating_public_summary(uuid) to authenticated;

-- Jobs / Edge worker (service_role)
grant execute on function public.enqueue_group_match_reminders() to service_role;
grant execute on function public.claim_pending_deliveries(integer) to service_role;
grant execute on function public.drain_notification_deliveries() to service_role;
grant execute on function public.generate_match_join_code() to service_role;
grant execute on function public.reconcile_weekly_series_matches(integer) to service_role;

-- ---------------------------------------------------------------------------
-- 3) Supabase local seed grants anon EXECUTE on public functions; narrow it (lint 0028).
--     Keep anon only for join-code preview + normalization (grants above).
-- ---------------------------------------------------------------------------

revoke execute on function public.cancel_pending_reminders_on_rsvp() from anon;
revoke execute on function public.can_view_group(uuid, uuid) from anon;
revoke execute on function public.can_view_match(uuid, uuid) from anon;
revoke execute on function public.claim_pending_deliveries(integer) from anon;
revoke execute on function public.create_group(text) from anon;
revoke execute on function public.drain_notification_deliveries() from anon;
revoke execute on function public.enqueue_group_match_notifications() from anon;
revoke execute on function public.enqueue_group_match_reminders() from anon;
revoke execute on function public.ensure_my_profile() from anon;
revoke execute on function public.enforce_lineup_not_locked() from anon;
revoke execute on function public.generate_match_join_code() from anon;
revoke execute on function public.get_match_detail_for_user(uuid) from anon;
revoke execute on function public.get_match_graph_for_user(uuid) from anon;
revoke execute on function public.get_match_rating_public_summary(uuid) from anon;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.is_match_organizer(uuid, uuid) from anon;
revoke execute on function public.join_group_by_code(text) from anon;
revoke execute on function public.join_match_by_join_code(text) from anon;
revoke execute on function public.list_visible_match_graphs_for_user() from anon;
revoke execute on function public.list_visible_matches_for_user() from anon;
revoke execute on function public.match_graph_row(uuid) from anon;
revoke execute on function public.match_rating_eligible_player_ids(uuid) from anon;
revoke execute on function public.match_rating_rater_can_participate(uuid, uuid) from anon;
revoke execute on function public.match_rating_ratee_is_eligible(uuid, uuid) from anon;
revoke execute on function public.player_leaderboard_stats(text, timestamptz) from anon;
revoke execute on function public.player_leaderboard_stats(text, timestamptz, uuid, text) from anon;
revoke execute on function public.reconcile_weekly_series_matches(integer) from anon;
revoke execute on function public.set_push_tokens_updated_at() from anon;
revoke execute on function public.set_updated_at() from anon;
revoke execute on function public.spawn_next_weekly_match(uuid) from anon;
revoke execute on function public.submit_match_result(uuid, integer, integer, jsonb, jsonb) from anon;
revoke execute on function public.upsert_match_motm_vote(uuid, uuid) from anon;
revoke execute on function public.upsert_match_peer_ratings(uuid, jsonb) from anon;
