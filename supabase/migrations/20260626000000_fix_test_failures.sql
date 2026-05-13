-- Fixes for test suite failures.

-- 1. Fix type cast in create_match_with_organizer_attendee
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

  if p_starts_at < now() then
    perform public.raise_app_error('ERR_MATCH_STARTS_AT_PAST');
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
    method::public.match_payment_method,
    norm_join
  )
  returning * into created;

  insert into public.match_attendees (match_id, player_id, status, paid)
  values (created.id, uid, 'going', false);

  return created;
end;
$$;

-- 2. Fix reminder_date check to include roster_full_organizer
alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_reminder_date_chk;

alter table public.notification_deliveries
  add constraint notification_deliveries_reminder_date_chk check (
    (
      type in (
        'initial', 'match_cancelled', 'venue_change', 'lineup_published',
        'match_result', 'roster_full_organizer'
      )
      and reminder_date is null
    )
    or (
      type in (
        'reminder', 'payment_reminder', 'post_match_rating_reminder',
        'streak_at_risk', 'payment_morning_reminder',
        'payment_unpaid_summary_organizer'
      )
      and reminder_date is not null
    )
  );

-- 3. Fix match_group_ctx_chk to allow streak_at_risk with nulls
alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_match_group_ctx_chk;

alter table public.notification_deliveries
  add constraint notification_deliveries_match_group_ctx_chk check (
    (
      type = 'streak_at_risk'
      and match_id is null
      and group_id is null
    )
    or (
      type <> 'streak_at_risk'
      and match_id is not null
      and group_id is not null
    )
  );
