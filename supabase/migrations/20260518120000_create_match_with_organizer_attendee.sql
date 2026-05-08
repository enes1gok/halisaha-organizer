-- Atomic match creation: organizer row + organizer attendee in one transaction (SECURITY DEFINER).
-- Fixes client-side RLS edge cases and aligns with atomic-mutation-policy.

create or replace function public.create_match_with_organizer_attendee(
  p_starts_at timestamptz,
  p_venue text,
  p_max_players int,
  p_join_code text,
  p_group_id uuid default null,
  p_price_per_person numeric default null,
  p_iban text default null
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  norm_join text := public.normalize_join_code(p_join_code);
  created public.matches;
begin
  if uid is null then
    perform public.raise_app_error('ERR_AUTH_REQUIRED');
  end if;

  perform public.ensure_my_profile();

  if p_group_id is not null and not public.can_view_group(p_group_id, uid) then
    perform public.raise_app_error('ERR_MATCH_CREATE_GROUP_FORBIDDEN');
  end if;

  insert into public.matches (
    starts_at,
    venue,
    organizer_id,
    max_players,
    group_id,
    price_per_person,
    iban,
    join_code
  )
  values (
    p_starts_at,
    trim(p_venue),
    uid,
    p_max_players,
    p_group_id,
    p_price_per_person,
    nullif(trim(coalesce(p_iban, '')), ''),
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
  text
) from public;

grant execute on function public.create_match_with_organizer_attendee(
  timestamptz,
  text,
  int,
  text,
  uuid,
  numeric,
  text
) to authenticated;

revoke execute on function public.create_match_with_organizer_attendee(
  timestamptz,
  text,
  int,
  text,
  uuid,
  numeric,
  text
) from anon;
