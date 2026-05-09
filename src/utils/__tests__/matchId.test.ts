import { isRemoteMatchId, isRemoteUuid } from '../matchId';

describe('isRemoteUuid', () => {
  it('returns true for canonical UUID strings used by Supabase rows', () => {
    expect(isRemoteUuid('c0000000-0000-4000-8000-000000000010')).toBe(true);
    expect(isRemoteUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('returns false for local prefixed ids', () => {
    expect(isRemoteUuid('group-lx7k2j-m4nq')).toBe(false);
    expect(isRemoteUuid('match-local-123')).toBe(false);
  });

  it('returns false for malformed strings', () => {
    expect(isRemoteUuid('')).toBe(false);
    expect(isRemoteUuid('not-a-uuid')).toBe(false);
  });
});

describe('isRemoteMatchId', () => {
  it('delegates to isRemoteUuid', () => {
    expect(isRemoteMatchId('c0000000-0000-4000-8000-000000000010')).toBe(true);
    expect(isRemoteMatchId('group-x')).toBe(false);
  });
});
