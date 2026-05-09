# Kişisel veri envanteri (teknik)

**Son güncelleme:** 2026-05-09  
**Kapsam:** Bu depodaki mobil uygulama + Supabase (Postgres, Auth, Edge Functions) ve cihaz tarafı kalıcılık.  
**Not:** Bu belge **hukuki KVKK uygunluk raporu değildir**; hukuk / gizlilik uzmanı ile `aydınlatma metni`, işleme dayanakları ve saklama politikalarını ayrıca ele alın.

## 1. Veri kategorileri (özet)

| Kategori | Örnekler (bu projede) |
|----------|------------------------|
| Kimlik / hesap | Kullanıcı UUID’si, e-posta (Supabase Auth), görünen ad |
| İletişim / tanıtım | E-posta; push bildirim cihaz token’ı |
| Finans / ödeme | IBAN, IBAN hesap adı, maç ödeme notu, “ödendi” bayrağı, fiyat alanları |
| Konum / etkinlik | Saha/venue metni, maç zamanı; gruba üyelik |
| Davranış / tercih | RSVP, kadro, skor, istatistik, maç içi puanlar, bildirim tercihleri JSON’u |
| Teknik / kullanım | Uygulama ön planda/arka planda durumu, `last_seen_at`, platform bilgisi (push) |
| Görsel | Profil `photo_uri` (URL veya depolama yolu — altyapıya bağlı) |

## 2. Supabase Auth (`auth` şeması)

Supabase tarafından yönetilir; uygulama doğrudan tabloya yazmaz.

| Tipik alan / kavram | Amaç (ürün) | Erişim |
|---------------------|-------------|--------|
| `auth.users.id` | `public.profiles.id` ile bire bir | JWT / RLS `auth.uid()` |
| E-posta, parola özeti, oturumlar | Giriş / hesap yönetimi | Supabase Auth API; mobil `supabase-js` |

**Not:** Tam sütun listesi ve saklama için Supabase proje dokümantasyonu / dashboard kullanılmalıdır.

## 3. Postgres `public` şeması (uygulama verisi)

Kaynak: migration’lar ve [`src/services/supabase/types.ts`](../src/services/supabase/types.ts).

| Tablo / görünüm | Kişisel / hassas alanlar (özet) | Ürün amacı |
|-----------------|----------------------------------|------------|
| `profiles` | `id`, `display_name`, `photo_uri`, `position`, `preferred_foot`, **`iban`**, **`notification_preferences` (JSON)**, zaman damgaları | Oyuncu profili; ödeme IBAN’ı; push tercihleri |
| `profiles_public` (view) | `id`, `display_name`, `photo_uri`, `position`, `preferred_foot` | Roster / maç ekranlarında **hassas alan olmadan** gösterim |
| `matches` | `organizer_id`, `venue`, `starts_at`, **`iban`**, **`iban_account_name`**, `payment_note`, `price_per_person`, `join_code`, `group_id`, … | Maç organizasyonu ve ödeme bilgisi |
| `match_attendees` | `player_id`, `status` (RSVP), `paid` | Katılım ve ödeme durumu |
| `match_team_players` | `player_id`, takım | Kadro |
| `match_stat_lines` | `player_id`, gol/asist sayıları | Skor / istatistik |
| `self_report_requests` | `player_id`, talep tipi / durumu | Kendi bildirimi akışı |
| `groups` | `name`, `owner_id`, `join_code` | Gruplar |
| `group_members` | `player_id`, `role` | Üyelik |
| `group_weekly_series` | `venue`, `iban`, `default_organizer_id`, zaman / fiyat alanları | Tekrarlayan maç şablonu |
| `push_tokens` | **`user_id`**, **`token`**, `platform` | Push bildirimleri |
| `notification_deliveries` | `recipient_id`, **`token`**, `match_id`, `group_id`, `type`, zamanlama alanları | Bildirim kuyruğu |
| `notification_presence` | `user_id`, **`app_state`**, **`last_seen_at`** | Uygulama içi / push kanal seçimi |
| `match_peer_ratings` | `rater_id`, `ratee_id`, `score` | Maç sonrası oy (1–10) |
| `match_motm_votes` | `voter_id`, `pick_player_id` | Maçın adamı oyu |
| `match_rating_submissions` | `rater_id`, `submitted_at` | Tek seferlik gönderim kaydı |
| `match_player_rating_aggregates` | Oyuncu / maç bazlı toplamlar (puan sayıları) | Özet istatistik |
| `player_rating_aggregates` | Oyuncu bazlı toplamlar, `motm_count` | Liderlik / profil özetleri |

## 4. `audit` şeması

| Nesne | İçerik | Not |
|-------|--------|-----|
| `audit.row_changes` | Tablo adı, kayıt id, işlem tipi, `old_data` / `new_data` (JSON), `actor_id` | Migrasyonda IBAN için maskeleme hedefi belirtilmiş; **genel olarak değişiklik geçmişi kişisel veri içerebilir**. API ile `authenticated` için RLS politikası yok → satır görünmez; operasyonel erişim `service_role` / DB admin. |

## 5. Edge Functions

| Fonksiyon | Dosya | Kişisel veri teması |
|-----------|-------|---------------------|
| `group-match-created` | [`supabase/functions/group-match-created/index.ts`](../supabase/functions/group-match-created/index.ts) | `profiles` üzerinden **çok kullanıcıya** `notification_preferences`; `notification_presence`; push token ile `notification_deliveries` oluşturma / işleme ( **`service_role`** istemcisi beklenir) |

## 6. Mobil uygulama (cihaz)

| Yer | Veri | Not |
|-----|------|-----|
| `AsyncStorage` (Zustand `persist`) | Maçlar, oyuncular, gruplar, senkronize profil alanları, oturumla ilişkili state | Cihazda düz metin JSON; cihaz güvenliği ve uygulama kilidi ürün kararı |
| `expo-secure-store` | Supabase oturum token’ları ( [`src/lib/supabase.ts`](../src/lib/supabase.ts) ) | Oturum kalıcılığı |
| Clipboard (IBAN kopyala) | Geçici pano | Kullanıcı eylemine bağlı |

Bu repoda **Sentry / Analytics SDK** için arama sonucu eşleşmesi **yok** (harici davranış analitiği kodda görünmüyor).

## 7. Üçüncü taraflar (örnek envanter satırları)

Hukuki sözleşme ve DPA için kendi ticari listesi oluşturulmalıdır; teknik bağlantı özeti:

| Taraf | Rol |
|-------|-----|
| **Supabase** | Postgres, Auth, Edge Functions barındırıcı; veri işleyen |
| **Expo / EAS** | Build, OTA güncelleme süreçleri — ürün hesabına göre işlenen meta veriler |
| **Google Play** | Dağıtım, crash / istatistik (Play Console ayarlarına bağlı) |
| **FCM / APNs** (push) | Push iletimi; token’lar `push_tokens` ve `notification_deliveries` içinde |

## 8. Son teknik güvenlik sertleştirmesi (referans)

- [`docs/supabase-security-hardening-rollout.md`](supabase-security-hardening-rollout.md) — `profiles` satır bazlı okuma, `profiles_public` ayrımı, aggregate tablolarda RLS, trigger fonksiyonlarında istemci `EXECUTE` daraltması.

## 9. Önerilen sonraki adımlar (süreç / hukuk tarafı — özet)

- Aydınlatma metni ve gizlilik politikası ile bu envanterdeki her kategori için **amaç + hukuki sebep + saklama süresi** eşlemesi.  
- Veri sahibi talepleri (silme, düzeltme, bilgi) için operasyonel süreç ve Supabase / yedekler kapsamı.  
- Gerekirse **VERBİS** ve hukuk danışmanlığı.  

Bu dosya güncellendiğinde **“Son güncelleme”** satırını ve ilgili migration / özellik değişikliklerini düzenleyin.
