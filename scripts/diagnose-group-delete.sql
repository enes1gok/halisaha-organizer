-- Grup silme teşhisi: owner_id, DELETE politikası ve FK referansları (salt okunur).
-- Tüm '<paste-group-id-here>' yer tutucularını gerçek grup UUID ile değiştirin.
-- docs/group-delete-db-verify.md

-- 1) Grup satırı ve sahip
select id, name, owner_id, join_code
from public.groups
where id = '<paste-group-id-here>'::uuid;

-- 2) Üyelik rolleri (sunucu DELETE yetkisini `groups.owner_id` ile verir)
select player_id, role
from public.group_members
where group_id = '<paste-group-id-here>'::uuid;

-- 3) DELETE politikası var mı?
select polname, polcmd, pg_get_expr(polqual, polrelid) as using_expr
from pg_policy
where polrelid = 'public.groups'::regclass
  and polname = 'groups_delete_owner';

-- 4) Bu gruba bağlı maçlar (`public.delete_group` RPC sonrası genelde group_id NULL kalır)
select id, group_id, venue, starts_at
from public.matches
where group_id = '<paste-group-id-here>'::uuid;

-- 5) İnceleme hesabı UID ile owner_id karşılaştırması (email sabit)
with ru as (
  select id as review_uid from auth.users where email = 'review.halisaha+20260507@gmail.com'
)
select g.id,
       g.owner_id,
       ru.review_uid,
       (g.owner_id = ru.review_uid) as owner_matches_review
from public.groups g
cross join ru
where g.id = '<paste-group-id-here>'::uuid;

-- 6) RPC deploy doğrulaması (PGRST202 alıyorsanız buradan başlayın)
-- Beklenen: tek satır; args = 'p_group_id uuid'
select n.nspname  as schema,
       p.proname  as function_name,
       pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'delete_group';
