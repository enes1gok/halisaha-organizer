-- Update drain_notification_deliveries to use x-internal-secret header
-- instead of Authorization: Bearer (which requires JWT format, incompatible
-- with new Supabase sb_secret_* API key format).

create or replace function public.drain_notification_deliveries()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url    text;
  v_secret text;
begin
  select value into v_url    from public.app_config where key = 'edge_function_url'  limit 1;
  select value into v_secret from public.app_config where key = 'edge_service_key'   limit 1;

  if v_url is null or btrim(v_url) = '' then
    return;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'x-internal-secret', coalesce(v_secret, ''),
      'Content-Type',      'application/json'
    ),
    body    := jsonb_build_object('mode', 'drain')
  );
end;
$$;

grant execute on function public.drain_notification_deliveries() to service_role;
grant execute on function public.drain_notification_deliveries() to postgres;
grant execute on function public.drain_notification_deliveries() to supabase_admin;
