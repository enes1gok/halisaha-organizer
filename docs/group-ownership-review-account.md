# İnceleme hesabı — grup sahipliği (`owner_id`) düzeltme

App Review test kullanıcısı ile **Grubu kaldır** akışının çalışması için `public.groups.owner_id`, oturumdaki kullanıcının id’si ile (`auth.uid()`) **aynı** olmalıdır; ayrıca `owner_id` FK olarak `public.profiles(id)` gerektirir.

Hesap bilgisi: [app-review-test-account.md](./app-review-test-account.md). **UID’yi repoya veya migration’a yazmayın** — her ortamda Dashboard’dan kopyalayın.

Genel RLS checklist: [group-delete-db-verify.md](./group-delete-db-verify.md).

**Scriptler (yeniden kullanım):**

- [scripts/verify-review-account-groups.sql](../scripts/verify-review-account-groups.sql) — inceleme kullanıcısının sahibi olduğu grupları listeler.
- [scripts/sync-review-account-group-membership.sql](../scripts/sync-review-account-group-membership.sql) — `groups.owner_id` ile uyumlu `group_members` satırını idempotent günceller.
- [scripts/diagnose-group-delete.sql](../scripts/diagnose-group-delete.sql) — belirli bir `group_id` için `owner_id`, DELETE politikası ve maç FK teşhisi.

---

## Aşama 1 — Kimlik ve profil

1. Supabase Dashboard → **Authentication** → **Users** → `review.halisaha+20260507@gmail.com` → **User UID** kopyalayın (`review_uid`).
2. SQL Editor:

```sql
select id, display_name
from public.profiles
where id = '<paste-user-uid-here>'::uuid;
```

3. Satır yoksa [test-account-setup.md](./test-account-setup.md) akışını izleyin (migration + uygulamadan bir kez giriş → `ensure_my_profile`).

---

## Aşama 2 — Teşhis (hangi grup)

Silinemeyen grubun UUID’sini not edin (`group_id`). Ardından:

```sql
select g.id, g.name, g.owner_id, p.display_name as owner_display
from public.groups g
left join public.profiles p on p.id = g.owner_id
where g.id = '<paste-group-id-here>'::uuid;
```

Üyelikler:

```sql
select player_id, role
from public.group_members
where group_id = '<paste-group-id-here>'::uuid;
```

DELETE için kritik alan **`groups.owner_id`** (yalnızca `group_members.role` değil).

---

## Aşama 3 — Düzeltme (Dashboard SQL Editor)

Üretimde dikkat; mümkünse önce staging. Editor genelde RLS’yi bypass eder — düzeltme SQL’ini burada çalıştırın.

### Seçenek A — Bu grubun sahibini inceleme kullanıcısı yapın

Önce mevcut sahibi not edin (`eski_owner_uid`). Sonra (`review_uid` = Aşama 1):

```sql
update public.groups
set owner_id = '<paste-user-uid-here>'::uuid
where id = '<paste-group-id-here>'::uuid;
```

İnceleme kullanıcısı için üyelik ve rol:

```sql
insert into public.group_members (group_id, player_id, role)
values (
  '<paste-group-id-here>'::uuid,
  '<paste-user-uid-here>'::uuid,
  'owner'
)
on conflict (group_id, player_id) do update set role = 'owner';
```

Eski sahibi üye olarak bırakmak isterseniz:

```sql
update public.group_members
set role = 'member'
where group_id = '<paste-group-id-here>'::uuid
  and player_id = '<eski-owner-uid-here>'::uuid;
```

### Seçenek B — Yeni demo grup (mevcut veriyi ellemeden)

`join_code` tabloda **unique** olmalı (ör. 8 büyük harf/rakam; `create_group` RPC ile aynı fikir). `RVWDEMO1` benzersiz değilse değiştirin; çakışmada insert hata verir.

```sql
with g as (
  insert into public.groups (name, owner_id, join_code)
  values (
    'Review Demo Grup',
    '<paste-user-uid-here>'::uuid,
    'RVWDEMO1'
  )
  returning id
)
insert into public.group_members (group_id, player_id, role)
select id, '<paste-user-uid-here>'::uuid, 'owner' from g;
```

---

## Aşama 4 — Doğrulama

```sql
select id, owner_id
from public.groups
where id = '<paste-group-id-here>'::uuid;
-- owner_id = inceleme kullanıcısı UID olmalı
```

Uygulamada inceleme hesabıyla giriş → grup detayı → **Grubu kaldır**. Supabase’de ilgili `groups` satırının silindiğini doğrulayın.

---

## Risk notları

- `profiles` satırı olmadan `owner_id` güncellenemez (FK).
- Production’da başka kullanıcıya ait grupları devretmek ürün kararıdır; inceleme için **Seçenek B** genelde daha güvenlidir.
