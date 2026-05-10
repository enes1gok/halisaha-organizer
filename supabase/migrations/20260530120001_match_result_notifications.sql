-- Match finished → enqueue match_result push (Maç Sonucu: X–Y); extend claim RPC with scores.

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_type_check;

alter table public.notification_deliveries
  add constraint notification_deliveries_type_check
  check (
    type in (
      'initial',
      'reminder',
      'match_cancelled',
      'venue_change',
      'lineup_published',
      'payment_reminder',
      'post_match_rating_reminder',
      'match_result'
    )
  );

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_reminder_date_chk;

alter table public.notification_deliveries
  add constraint notification_deliveries_reminder_date_chk check (
    (
      type in (
        'initial',
        'match_cancelled',
        'venue_change',
        'lineup_published',
        'match_result'
      )
      and reminder_date is null
    )
    or (type in ('reminder', 'payment_reminder', 'post_match_rating_reminder') and reminder_date is not null)
  );

create unique index if not exists notification_deliveries_unique_match_result
  on public.notification_deliveries (match_id, recipient_id, token)
  where type = 'match_result';

comment on column public.profiles.notification_preferences is
  'JSON: push_enabled, types.group_match_initial|group_match_reminder|group_match_cancelled|group_match_venue_change|group_match_lineup_published|group_match_payment_reminder|group_match_post_match_rating_reminder|group_match_match_result, quiet_hours. Omitted keys default to enabled.';

create or replace function public.notification_delivery_allowed(
  p_prefs jsonb,
  p_delivery_type text
) returns boolean
language sql
stable
as $$
  select case
    when not public.coalesce_notification_pref_bool(p_prefs->'push_enabled', true) then false
    when p_delivery_type = 'initial' then public.coalesce_notification_pref_bool(
      p_prefs->'types'->'group_match_initial',
      true
    )
    when p_delivery_type = 'reminder' then public.coalesce_notification_pref_bool(
      p_prefs->'types'->'group_match_reminder',
      true
    )
    when p_delivery_type = 'match_cancelled' then public.coalesce_notification_pref_bool(
      p_prefs->'types'->'group_match_cancelled',
      true
    )
    when p_delivery_type = 'venue_change' then public.coalesce_notification_pref_bool(
      p_prefs->'types'->'group_match_venue_change',
      true
    )
    when p_delivery_type = 'lineup_published' then public.coalesce_notification_pref_bool(
      p_prefs->'types'->'group_match_lineup_published',
      true
    )
    when p_delivery_type = 'payment_reminder' then public.coalesce_notification_pref_bool(
      p_prefs->'types'->'group_match_payment_reminder',
      true
    )
    when p_delivery_type = 'post_match_rating_reminder' then public.coalesce_notification_pref_bool(
      p_prefs->'types'->'group_match_post_match_rating_reminder',
      true
    )
    when p_delivery_type = 'match_result' then public.coalesce_notification_pref_bool(
      p_prefs->'types'->'group_match_match_result',
      true
    )
    else true
  end;
$$;

comment on function public.notification_delivery_allowed(jsonb, text) is
  'Whether enqueue should create a delivery for this prefs blob and delivery type (includes match_result).';

create or replace function public.handle_match_status_finished_rating_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Istanbul')::date;
begin
  if new.group_id is null then
    return new;
  end if;

  if new.status = 'finished'::public.match_status
     and old.status is distinct from 'finished'::public.match_status then

    insert into public.notification_deliveries
      (match_id, group_id, recipient_id, token, type, reminder_date, scheduled_for)
    select
      new.id,
      new.group_id,
      a.player_id,
      pt.token,
      'match_result',
      null,
      null
    from public.match_attendees a
    join public.push_tokens pt on pt.user_id = a.player_id and pt.is_active = true
    join public.profiles pr on pr.id = a.player_id
    where a.match_id = new.id
      and a.status = 'going'::public.rsvp_status
      and a.player_id <> new.organizer_id
      and public.notification_delivery_allowed(pr.notification_preferences, 'match_result')
    on conflict (match_id, recipient_id, token) where (type = 'match_result') do nothing;

    insert into public.notification_deliveries
      (match_id, group_id, recipient_id, token, type, reminder_date, scheduled_for)
    select
      new.id,
      new.group_id,
      a.player_id,
      pt.token,
      'post_match_rating_reminder',
      v_today,
      now() + interval '15 minutes'
    from public.match_attendees a
    join public.push_tokens pt on pt.user_id = a.player_id and pt.is_active = true
    join public.profiles pr on pr.id = a.player_id
    where a.match_id = new.id
      and a.status = 'going'::public.rsvp_status
      and a.player_id <> new.organizer_id
      and public.notification_delivery_allowed(pr.notification_preferences, 'post_match_rating_reminder')
    on conflict (match_id, recipient_id, token) where (type = 'post_match_rating_reminder') do nothing;
  end if;

  return new;
end;
$$;

drop function if exists public.claim_pending_deliveries(integer);

create function public.claim_pending_deliveries(p_limit int default 50)
returns table (
  delivery_id uuid,
  delivery_token text,
  match_id uuid,
  group_id uuid,
  recipient_id uuid,
  delivery_type text,
  reminder_date date,
  match_starts_at timestamptz,
  match_venue text,
  group_name text,
  organizer_display_name text,
  match_score_a int,
  match_score_b int
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_limit int := greatest(1, least(coalesce(p_limit, 50), 500));
begin
  update public.notification_deliveries
  set status = 'pending', claimed_at = null
  where status = 'sending'
    and claimed_at is not null
    and claimed_at < now() - interval '5 minutes';

  return query
  with claimed as (
    update public.notification_deliveries nd
    set status = 'sending', claimed_at = now()
    where nd.id in (
      select inner_nd.id
      from public.notification_deliveries inner_nd
      where inner_nd.status = 'pending'
        and (inner_nd.scheduled_for is null or inner_nd.scheduled_for <= now())
      order by coalesce(inner_nd.scheduled_for, inner_nd.created_at), inner_nd.created_at
      limit v_limit
      for update skip locked
    )
    returning nd.*
  )
  select
    c.id,
    c.token,
    c.match_id,
    c.group_id,
    c.recipient_id,
    c.type,
    c.reminder_date,
    m.starts_at,
    m.venue,
    g.name,
    op.display_name,
    m.score_a,
    m.score_b
  from claimed c
  left join public.matches m on m.id = c.match_id
  left join public.groups g on g.id = c.group_id
  left join public.profiles op on op.id = m.organizer_id;
end;
$$;

grant execute on function public.claim_pending_deliveries(int) to service_role;

revoke execute on function public.claim_pending_deliveries(integer) from public;
revoke execute on function public.claim_pending_deliveries(integer) from anon;
