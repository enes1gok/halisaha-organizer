import { mapSupabaseError, toUserMessage } from '../errors';

describe('mapSupabaseError', () => {
  it('maps grup name check constraint to Turkish grup adı message', () => {
    const err = mapSupabaseError(
      { message: 'new row for relation "groups" violates check constraint "groups_name_check"', code: '23514' },
      'createGroupRemote',
    );
    expect(err.code).toBe('VALIDATION');
    expect(err.message).toBe('Grup adı en az 2 karakter olmalı.');
  });

  it('maps foreign key to profiles to Turkish explanation', () => {
    const err = mapSupabaseError(
      {
        message: 'insert or update on table "groups" violates foreign key constraint "groups_owner_id_fkey"',
        code: '23503',
      },
      'createGroupRemote',
    );
    expect(err.message).toContain('Profil kaydınız');
  });

  it('maps duplicate join_code conflict', () => {
    const err = mapSupabaseError(
      { message: 'duplicate key value violates unique constraint "groups_join_code_key"', code: '23505' },
      'createGroupRemote',
    );
    expect(err.code).toBe('CONFLICT');
    expect(err.message).toContain('Katılım kodu');
  });

  it('maps network failures', () => {
    const err = mapSupabaseError({ message: 'TypeError: Network request failed' }, 'fetchMyGroups');
    expect(err.code).toBe('NETWORK');
    expect(err.message).toContain('Ağ bağlantısı');
  });

  it('maps Turkish RPC grup adı message as validation', () => {
    const err = mapSupabaseError({ message: 'Grup adı en az 2 karakter olmalı.' }, 'createGroupRemote');
    expect(err.code).toBe('VALIDATION');
    expect(err.message).toBe('Grup adı en az 2 karakter olmalı.');
  });
});

describe('toUserMessage', () => {
  it('returns AppError.message for mapped errors', () => {
    const err = mapSupabaseError({ message: 'not authenticated', code: '401' }, 'x');
    expect(toUserMessage(err)).toBe(err.message);
  });
});
