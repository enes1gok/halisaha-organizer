-- Batch match graph reads (fallback when list_visible_match_graphs_for_user is unavailable),
-- consolidated rating drafts for the current user, and a single-round-trip groups bundle.

-- ---------------------------------------------------------------------------
-- 1) list_match_graphs_for_match_ids: one row per visible match (same shape as match_graph_row)
-- ---------------------------------------------------------------------------

create or replace function public.list_match_graphs_for_match_ids(p_match_ids uuid[])
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
  from unnest(coalesce(p_match_ids, array[]::uuid[])) as req(id)
  cross join lateral public.match_graph_row(req.id) as mg;
$$;

revoke execute on function public.list_match_graphs_for_match_ids(uuid[]) from public;
revoke execute on function public.list_match_graphs_for_match_ids(uuid[]) from anon;
grant execute on function public.list_match_graphs_for_match_ids(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) get_my_match_rating_drafts_for_user: peer scores + MOTM pick (current user)
-- ---------------------------------------------------------------------------

create or replace function public.get_my_match_rating_drafts_for_user(p_match_id uuid)
returns table (
  peer_scores jsonb,
  motm_pick uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('ratee_id', r.ratee_id, 'score', r.score))
        from public.match_peer_ratings r
        where r.match_id = p_match_id
          and r.rater_id = auth.uid()
      ),
      '[]'::jsonb
    ) as peer_scores,
    (
      select v.pick_player_id
      from public.match_motm_votes v
      where v.match_id = p_match_id
        and v.voter_id = auth.uid()
      limit 1
    ) as motm_pick
  where public.can_view_match(p_match_id, auth.uid());
$$;

revoke execute on function public.get_my_match_rating_drafts_for_user(uuid) from public;
revoke execute on function public.get_my_match_rating_drafts_for_user(uuid) from anon;
grant execute on function public.get_my_match_rating_drafts_for_user(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) get_my_groups_bundle_for_user: groups + memberships + profiles_public (single round-trip)
-- ---------------------------------------------------------------------------

create or replace function public.get_my_groups_bundle_for_user()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_group_ids uuid[];
  v_result jsonb;
begin
  select coalesce(array_agg(distinct gm.group_id), array[]::uuid[])
  into v_group_ids
  from public.group_members gm
  where gm.player_id = auth.uid();

  if v_group_ids is null or cardinality(v_group_ids) = 0 then
    return jsonb_build_object(
      'groups', '[]'::jsonb,
      'memberships', '[]'::jsonb,
      'profiles', '[]'::jsonb
    );
  end if;

  select jsonb_build_object(
    'groups', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', g.id,
            'name', g.name,
            'owner_id', g.owner_id,
            'join_code', g.join_code,
            'created_at', g.created_at
          )
        )
        from public.groups g
        where g.id = any (v_group_ids)
      ),
      '[]'::jsonb
    ),
    'memberships', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'group_id', gm.group_id,
            'player_id', gm.player_id,
            'role', gm.role,
            'created_at', gm.created_at
          )
        )
        from public.group_members gm
        where gm.group_id = any (v_group_ids)
      ),
      '[]'::jsonb
    ),
    'profiles', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'display_name', p.display_name,
            'photo_uri', p.photo_uri,
            'position', p.position,
            'preferred_foot', p.preferred_foot,
            'weekly_match_streak_effective_weeks', p.weekly_match_streak_effective_weeks,
            'weekly_match_streak_weeks', p.weekly_match_streak_weeks,
            'weekly_match_last_qualifying_week_start', p.weekly_match_last_qualifying_week_start
          )
        )
        from public.profiles_public p
        where p.id in (
          select distinct gm.player_id
          from public.group_members gm
          where gm.group_id = any (v_group_ids)
        )
      ),
      '[]'::jsonb
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.get_my_groups_bundle_for_user() from public;
revoke execute on function public.get_my_groups_bundle_for_user() from anon;
grant execute on function public.get_my_groups_bundle_for_user() to authenticated;
