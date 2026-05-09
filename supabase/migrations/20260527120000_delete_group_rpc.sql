-- RPC for explicit group delete semantics (ERR_* tokens vs silent RLS zero-row DELETE).

create or replace function public.delete_group(p_group_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  g_owner uuid;
begin
  if uid is null then
    perform public.raise_app_error('ERR_AUTH_REQUIRED');
  end if;

  select g.owner_id into g_owner
  from public.groups g
  where g.id = p_group_id;

  if g_owner is null then
    perform public.raise_app_error(
      'ERR_GROUP_NOT_FOUND',
      jsonb_build_object('group_id', p_group_id)
    );
  end if;

  if g_owner <> uid then
    perform public.raise_app_error(
      'ERR_GROUP_DELETE_FORBIDDEN',
      jsonb_build_object('group_id', p_group_id)
    );
  end if;

  delete from public.groups where id = p_group_id;
  return p_group_id;
end;
$$;

comment on function public.delete_group(uuid) is
  'Deletes a group when caller is owner; raises ERR_GROUP_NOT_FOUND / ERR_GROUP_DELETE_FORBIDDEN / ERR_AUTH_REQUIRED.';

revoke all on function public.delete_group(uuid) from public;
grant execute on function public.delete_group(uuid) to authenticated;
