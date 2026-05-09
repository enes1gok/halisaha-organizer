-- Allow group owners to delete their group (memberships cascade; matches.group_id set null).

drop policy if exists groups_delete_owner on public.groups;

create policy groups_delete_owner on public.groups
for delete to authenticated
using (owner_id = auth.uid());
