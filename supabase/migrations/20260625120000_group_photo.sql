-- Add photo_uri and updated_at columns to groups table for profile photo support

alter table public.groups
  add column if not exists photo_uri text,
  add column if not exists updated_at timestamptz not null default now();

create trigger groups_set_updated_at
  before update on public.groups
  for each row execute procedure public.set_updated_at();

-- Storage RLS: Allow group owner/admin to upload photos to groups/{groupId}/photo.jpg
drop policy if exists avatars_group_photo_insert on storage.objects;
create policy avatars_group_photo_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = 'groups'
  and exists (
    select 1 from public.group_members gm
    where gm.group_id = (storage.foldername(name))[2]::uuid
    and gm.player_id = auth.uid()
    and gm.role in ('owner', 'admin')
  )
);

drop policy if exists avatars_group_photo_update on storage.objects;
create policy avatars_group_photo_update
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = 'groups'
  and exists (
    select 1 from public.group_members gm
    where gm.group_id = (storage.foldername(name))[2]::uuid
    and gm.player_id = auth.uid()
    and gm.role in ('owner', 'admin')
  )
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = 'groups'
  and exists (
    select 1 from public.group_members gm
    where gm.group_id = (storage.foldername(name))[2]::uuid
    and gm.player_id = auth.uid()
    and gm.role in ('owner', 'admin')
  )
);

-- RPC to update group photo_uri (owner/admin only)
create or replace function public.update_group_photo(
  p_group_id uuid,
  p_photo_uri text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id
    and player_id = auth.uid()
    and role in ('owner', 'admin')
  ) then
    perform public.raise_app_error('ERR_FORBIDDEN', jsonb_build_object('op', 'update_group_photo'));
  end if;

  update public.groups
  set photo_uri = p_photo_uri
  where id = p_group_id;
end;
$$;

revoke execute on function public.update_group_photo(uuid, text) from public;
revoke execute on function public.update_group_photo(uuid, text) from anon;
grant execute on function public.update_group_photo(uuid, text) to authenticated;

-- Update get_my_groups_bundle_for_user to include photo_uri
drop function if exists public.get_my_groups_bundle_for_user();
create function public.get_my_groups_bundle_for_user()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_group_ids uuid[];
  v_result jsonb;
begin
  select coalesce(array_agg(distinct gm.group_id), array[]::uuid[])
  into v_group_ids
  from public.group_members gm
  where gm.player_id = auth.uid();

  if v_group_ids is null or cardinality(v_group_ids) = 0 then
    return jsonb_build_object(
      'groups', '[]'::jsonb,
      'memberships', '[]'::jsonb,
      'profiles', '[]'::jsonb
    );
  end if;

  select jsonb_build_object(
    'groups', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', g.id,
            'name', g.name,
            'owner_id', g.owner_id,
            'join_code', g.join_code,
            'created_at', g.created_at,
            'photo_uri', g.photo_uri
          )
        )
        from public.groups g
        where g.id = any (v_group_ids)
      ),
      '[]'::jsonb
    ),
    'memberships', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'group_id', gm.group_id,
            'player_id', gm.player_id,
            'role', gm.role,
            'created_at', gm.created_at
          )
        )
        from public.group_members gm
        where gm.group_id = any (v_group_ids)
      ),
      '[]'::jsonb
    ),
    'profiles', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'display_name', p.display_name,
            'photo_uri', p.photo_uri,
            'position', p.position,
            'preferred_foot', p.preferred_foot,
            'weekly_match_streak_effective_weeks', p.weekly_match_streak_effective_weeks,
            'weekly_match_streak_weeks', p.weekly_match_streak_weeks,
            'weekly_match_last_qualifying_week_start', p.weekly_match_last_qualifying_week_start
          )
        )
        from public.profiles_public p
        where p.id in (
          select distinct gm.player_id
          from public.group_members gm
          where gm.group_id = any (v_group_ids)
        )
      ),
      '[]'::jsonb
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.get_my_groups_bundle_for_user() from public;
revoke execute on function public.get_my_groups_bundle_for_user() from anon;
grant execute on function public.get_my_groups_bundle_for_user() to authenticated;
