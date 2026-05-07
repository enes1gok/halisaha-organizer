-- Ensure authenticated user has a profiles row (self-heal when trigger missed or row deleted).

create or replace function public.ensure_my_profile ()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid ();
  disp text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from public.profiles p where p.id = uid) then
    return;
  end if;

  select coalesce(
    nullif(trim(coalesce(
      u.raw_user_meta_data ->> 'full_name',
      u.raw_user_meta_data ->> 'name',
      u.raw_user_meta_data ->> 'display_name',
      split_part(coalesce(u.email, ''), '@', 1),
      ''
    )), ''),
    'Oyuncu'
  )
  into disp
  from auth.users u
  where u.id = uid;

  if disp is null or disp = '' then
    disp := 'Oyuncu';
  end if;

  insert into public.profiles (id, display_name)
  values (uid, disp)
  on conflict (id) do nothing;
end;
$$;

comment on function public.ensure_my_profile () is
  'Creates public.profiles row for auth.uid() if missing; safe for authenticated clients to call.';

grant execute on function public.ensure_my_profile () to authenticated;
