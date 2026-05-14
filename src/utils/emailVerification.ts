import type { User } from '@supabase/supabase-js';

/** Supabase `email_confirmed_at` doluysa e-posta doğrulanmış sayılır. */
export function isEmailVerified(user: User | null | undefined): boolean {
  return Boolean(user?.email_confirmed_at);
}

/** `signInWithPassword` hata metni — Confirm email açıkken İngilizce dönebilir. */
export function isEmailNotConfirmedSignInError(message: string): boolean {
  const m = message.toLowerCase();
  if (m.includes('email not confirmed')) return true;
  if (m.includes('email_address_not_confirmed')) return true;
  if (m.includes('not confirmed') && m.includes('email')) return true;
  return false;
}

const AUTH_ERROR_TR: Record<string, string> = {
  'email rate limit exceeded':
    'E-posta gönderme limiti aşıldı. Lütfen birkaç dakika bekleyip tekrar deneyin.',
  'invalid login credentials': 'E-posta adresi veya şifre hatalı.',
  'invalid email or password': 'E-posta adresi veya şifre hatalı.',
  'user already registered': 'Bu e-posta adresi zaten kayıtlı. Giriş yapabilirsiniz.',
  'password should be at least 6 characters': 'Şifre en az 6 karakter olmalıdır.',
  'unable to validate email address: invalid format': 'Geçersiz e-posta adresi formatı.',
  'signup requires a valid password': 'Geçerli bir şifre giriniz.',
  'for security purposes, you can only request this after':
    'Güvenlik nedeniyle çok sık istek gönderildi. Lütfen biraz bekleyin.',
};

export function translateAuthError(rawMessage: string): string {
  const lower = rawMessage.toLowerCase().trim();
  if (AUTH_ERROR_TR[lower]) return AUTH_ERROR_TR[lower];
  for (const [key, value] of Object.entries(AUTH_ERROR_TR)) {
    if (lower.includes(key)) return value;
  }
  return rawMessage;
}
