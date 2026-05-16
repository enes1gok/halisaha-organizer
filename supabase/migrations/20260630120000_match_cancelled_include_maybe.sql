-- Extend match_cancelled push audience to include 'maybe' attendees.
-- Previously only 'going' attendees were notified; product spec updated to
-- include 'maybe' (belki) so anyone who expressed interest is informed.

create or replace function public.handle_match_status_cancelled_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.group_id is null then
    return new;
  end if;

  if new.status = 'cancelled'::public.match_status
     and old.status is distinct from 'cancelled'::public.match_status then

    delete from public.notification_deliveries
    where match_id = new.id
      and status = 'pending';

    insert into public.notification_deliveries
      (match_id, group_id, recipient_id, token, type)
    select
      new.id,
      new.group_id,
      a.player_id,
      pt.token,
      'match_cancelled'
    from public.match_attendees a
    join public.push_tokens pt on pt.user_id = a.player_id and pt.is_active = true
    join public.profiles pr on pr.id = a.player_id
    where a.match_id = new.id
      and a.status in ('going'::public.rsvp_status, 'maybe'::public.rsvp_status)
      and a.player_id <> new.organizer_id
      and public.notification_delivery_allowed(pr.notification_preferences, 'match_cancelled')
    on conflict (match_id, recipient_id, token) where (type = 'match_cancelled') do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists matches_handle_cancelled_notifications on public.matches;

create trigger matches_handle_cancelled_notifications
after update of status on public.matches
for each row
execute procedure public.handle_match_status_cancelled_notifications();

revoke execute on function public.handle_match_status_cancelled_notifications() from public;
revoke execute on function public.handle_match_status_cancelled_notifications() from anon;
grant execute on function public.handle_match_status_cancelled_notifications() to authenticated;
