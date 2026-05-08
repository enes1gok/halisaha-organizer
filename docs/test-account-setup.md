# Test hesabı ve `profiles` kaydı

Bu proje oturum açılmış kullanıcı için yerel `players` listesini, Supabase `public.profiles` satırından doldurur. Test veya QA için kullanıcı **hem `auth.users` hem `public.profiles` ile tutarlı** olmalıdır.

## 1. Uygulama ortamı

Kök dizinde `.env` (veya Expo’nun okuduğu yapı) içinde şunlar tanımlı olmalıdır:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Metro’yu ortam değişikliğinden sonra yeniden başlatın.

**Kayıt sonrası hemen ana uygulama:** Hosted projede **Authentication → Providers → Email** altında **Confirm email** (zorunlu e-posta doğrulaması) **kapalı** olmalıdır; açıksa `signUp` çoğu zaman oturum döndürmez ve kullanıcı onboarding ekranında kalır. Yerel `supabase/config.toml` içindeki `enable_confirmations = false` ile aynı davranışı hedefleyin.

## 2. Test kullanıcısı oluşturma (Supabase Dashboard)

1. **Authentication** → **Users** → **Add user** → e-posta + şifre ile oluşturun (veya **Sign up** ile uygulamadan kayıt).
2. Kullanıcı detayından **User UID** değerini kopyalayın.

## 3. `profiles` satırını doğrulama

SQL Editor’da:

```sql
select id, display_name, position, preferred_foot, created_at
from public.profiles
where id = '<user-uid>';
```

- **Beklenen:** tek satır.
- **Yoksa:** önce projedeki migration’ların (özellikle `ensure_my_profile`) uzak projeye uygulandığından emin olun; ardından uygulamada bu kullanıcıyla **bir kez giriş** yapın. İstemci oturumda `ensure_my_profile` RPC’sini çağırır ve eksik satırı oluşturur.
- Tetikleyici (`handle_new_user`) yeni kayıtlarda satırı zaten ekler; RPC eski veya tutarsız ortamlar için güvenlik ağıdır.

## 4. Mağaza inceleme hesabı

Sabit e-posta / şifre ile tanımlı hesap için bkz. [app-review-test-account.md](./app-review-test-account.md).

## 5. Hosted güvenlik (operasyon)

Üretim projesinde Supabase Dashboard → **Authentication** altında [sızmış şifre koruması](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) (Have I Been Pwned) açılabilir; özellik erişimi plana bağlıdır. Database linter uyarısı (`auth_leaked_password_protection`) bu ayarın kapalı olduğunu işaret eder.
