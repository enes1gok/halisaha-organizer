-- Create app_config table for storing non-secret configuration
-- (Edge Function URL can be public; service key handled separately)

create table if not exists public.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Initial configuration
insert into public.app_config (key, value) values
  ('edge_function_url', 'https://tyrcbiannlfnvxjzxltt.supabase.co/functions/v1/group-match-created')
on conflict (key) do update set
  value = excluded.value,
  updated_at = now();

-- Store service key securely (you must run this manually with real key):
-- insert into public.app_config (key, value) values ('edge_service_key', '<YOUR_SERVICE_ROLE_KEY>');

-- Update drain_notification_deliveries to read from app_config instead of GUC
create or replace function public.drain_notification_deliveries()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_key text;
begin
  -- Read from app_config table instead of GUC variables
  select value into v_url from public.app_config where key = 'edge_function_url' limit 1;
  select value into v_key from public.app_config where key = 'edge_service_key' limit 1;

  if v_url is null or btrim(v_url) = '' then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || coalesce(v_key, ''),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('mode', 'drain')
  );
end;
$$;

-- RLS policy for app_config (public read, no writes)
alter table public.app_config enable row level security;

create policy app_config_public_read on public.app_config
for select using (true);

create policy app_config_no_insert on public.app_config
for insert with check (false);

create policy app_config_no_update on public.app_config
for update with check (false);

create policy app_config_no_delete on public.app_config
for delete using (false);
