import type { User } from '@supabase/supabase-js';

/** Supabase `email_confirmed_at` doluysa e-posta doğrulanmış sayılır. */
export function isEmailVerified(user: User | null | undefined): boolean {
  return Boolean(user?.email_confirmed_at);
}
