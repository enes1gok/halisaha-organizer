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
