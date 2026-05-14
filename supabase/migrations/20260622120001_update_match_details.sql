-- Update match details (venue, time, max players, payment method).
-- Only organizer or group admin can update, only for upcoming matches.
-- Venue change automatically triggers notification delivery (existing trigger).

-- =====================================================================
-- 1) update_match_details RPC
-- =====================================================================

create or replace function public.update_match_details(
  p_match_id        uuid,
  p_starts_at       timestamptz,
  p_venue           text,
  p_max_players     int,
  p_payment_method  text,
  p_price_per_person numeric default null,
  p_iban            text default null,
  p_iban_account_name text default null,
  p_payment_note    text default null
) returns public.matches
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_match public.matches;
  v_going_count int;
begin
  -- permission check
  if not public.can_manage_group_match(p_match_id, auth.uid()) then
    perform public.raise_app_error('ERR_NOT_AUTHORIZED');
  end if;

  -- match must exist
  select * into v_match from public.matches where id = p_match_id;
  if not found then
    perform public.raise_app_error('ERR_MATCH_NOT_FOUND');
  end if;

  -- only upcoming matches can be edited
  if v_match.status <> 'upcoming' then
    perform public.raise_app_error('ERR_MATCH_NOT_EDITABLE');
  end if;

  -- starts_at must not be in the past
  if p_starts_at <= now() then
    perform public.raise_app_error('ERR_MATCH_STARTS_AT_PAST');
  end if;

  -- max_players constraints: even, 4-22
  if p_max_players < 4 or p_max_players > 22 or p_max_players % 2 <> 0 then
    perform public.raise_app_error('ERR_MATCH_MAX_PLAYERS_INVALID');
  end if;

  -- max_players cannot be less than current going attendees
  select count(*) into v_going_count
  from public.match_attendees
  where match_id = p_match_id and status = 'going';

  if p_max_players < v_going_count then
    perform public.raise_app_error('ERR_MATCH_MAX_PLAYERS_TOO_LOW');
  end if;

  -- payment_method must be valid
  if p_payment_method not in ('note_only', 'iban', 'cash') then
    perform public.raise_app_error('ERR_PAYMENT_METHOD_INVALID');
  end if;

  -- update the match
  update public.matches set
    starts_at          = p_starts_at,
    venue              = p_venue,
    max_players        = p_max_players,
    payment_method     = p_payment_method,
    price_per_person   = p_price_per_person,
    iban               = case when p_payment_method = 'iban' then p_iban else null end,
    iban_account_name  = case when p_payment_method = 'iban' then p_iban_account_name else null end,
    payment_note       = case when p_payment_method = 'note_only' then p_payment_note else null end,
    updated_at         = now()
  where id = p_match_id
  returning * into v_match;

  return v_match;
end;
$$;

comment on function public.update_match_details(uuid, timestamptz, text, int, text, numeric, text, text, text) is
  'Update match details (venue, time, max_players, payment). Only organizer/group-admin on upcoming matches.';

-- =====================================================================
-- 2) Permissions
-- =====================================================================

revoke execute on function public.update_match_details(uuid, timestamptz, text, int, text, numeric, text, text, text) from public, anon;
grant execute on function public.update_match_details(uuid, timestamptz, text, int, text, numeric, text, text, text) to authenticated;
