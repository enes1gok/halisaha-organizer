-- Context-aware notifications:
-- If recipient is active in-app, route to in-app banner and suppress push send.

create table if not exists public.notification_presence (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  app_state text not null check (app_state in ('foreground', 'background')),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists notification_presence_set_updated_at on public.notification_presence;
create trigger notification_presence_set_updated_at
before update on public.notification_presence
for each row execute procedure public.set_updated_at();

create index if not exists notification_presence_active_idx
  on public.notification_presence (app_state, last_seen_at desc)
  where app_state = 'foreground';

alter table public.notification_presence enable row level security;

drop policy if exists notification_presence_select_own on public.notification_presence;
create policy notification_presence_select_own on public.notification_presence
for select to authenticated
using (user_id = auth.uid());

drop policy if exists notification_presence_upsert_own on public.notification_presence;
create policy notification_presence_upsert_own on public.notification_presence
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists notification_presence_update_own on public.notification_presence;
create policy notification_presence_update_own on public.notification_presence
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select, insert, update on table public.notification_presence to authenticated;

create or replace function public.is_user_active_in_app(
  p_user_id uuid,
  p_now timestamptz default now(),
  p_stale_window interval default interval '90 seconds'
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.notification_presence np
    where np.user_id = p_user_id
      and np.app_state = 'foreground'
      and np.last_seen_at >= (p_now - p_stale_window)
  );
$$;

grant execute on function public.is_user_active_in_app(uuid, timestamptz, interval) to service_role;

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_status_check;

alter table public.notification_deliveries
  add constraint notification_deliveries_status_check
  check (status in ('pending', 'sending', 'sent', 'failed', 'in_app'));
