-- Idempotent: Her grup için groups.owner_id satırına uygun group_members (role owner) oluşturur / günceller.
-- Supabase SQL Editor’da çalıştırın (service role / postgres). E-posta App Review dokümantasyonu ile aynıdır.
--
-- İlgili: docs/group-ownership-review-account.md

with ru as (
  select id from auth.users where email = 'review.halisaha+20260507@gmail.com'
)
insert into public.group_members (group_id, player_id, role)
select g.id, g.owner_id, 'owner'
from public.groups g
join ru on ru.id = g.owner_id
on conflict (group_id, player_id) do update set role = 'owner';
