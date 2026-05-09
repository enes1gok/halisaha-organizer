import type { User } from '@supabase/supabase-js';
import { isEmailNotConfirmedSignInError, isEmailVerified } from '../emailVerification';

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

describe('isEmailNotConfirmedSignInError', () => {
  it('detects common Supabase English messages', () => {
    expect(isEmailNotConfirmedSignInError('Email not confirmed')).toBe(true);
    expect(isEmailNotConfirmedSignInError('email_address_not_confirmed')).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isEmailNotConfirmedSignInError('Invalid login credentials')).toBe(false);
  });
});
