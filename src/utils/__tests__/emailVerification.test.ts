import type { User } from '@supabase/supabase-js';
import { isEmailVerified } from '../emailVerification';

describe('isEmailVerified', () => {
  it('returns false for null/undefined user', () => {
    expect(isEmailVerified(null)).toBe(false);
    expect(isEmailVerified(undefined)).toBe(false);
  });

  it('returns false when email_confirmed_at is missing', () => {
    const u = { email_confirmed_at: null } as unknown as User;
    expect(isEmailVerified(u)).toBe(false);
  });

  it('returns true when email_confirmed_at is set', () => {
    const u = { email_confirmed_at: '2026-01-01T00:00:00Z' } as unknown as User;
    expect(isEmailVerified(u)).toBe(true);
  });
});
