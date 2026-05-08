-- Explicit grup adı doğrulaması ve Türkçe hata mesajları (istemci ile uyumlu)

create or replace function public.create_group(p_name text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  created public.groups;
  code text;
  trimmed text;
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;

  trimmed := trim(coalesce(p_name, ''));
  if char_length(trimmed) < 2 then
    raise exception 'Grup adı en az 2 karakter olmalı.';
  end if;
  if char_length(trimmed) > 80 then
    raise exception 'Grup adı en fazla 80 karakter olabilir.';
  end if;

  code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));

  insert into public.groups (name, owner_id, join_code)
  values (trimmed, uid, code)
  returning * into created;

  insert into public.group_members (group_id, player_id, role)
  values (created.id, uid, 'owner')
  on conflict do nothing;

  return created;
end;
$$;
