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

  it('accepts postgres error code as number', () => {
    const err = mapSupabaseError({ message: 'violates check constraint', code: 23514 }, 'createGroupRemote');
    expect(err.code).toBe('VALIDATION');
  });

  it('uses details when message is empty (PostgREST / PLpgSQL)', () => {
    const err = mapSupabaseError(
      {
        code: 'P0001',
        message: '',
        details: 'ERROR: Katılım kodu üretilemedi.\nCONTEXT: SQL statement',
      },
      'createGroupRemote',
    );
    expect(err.message).toContain('Katılım kodu üretilemedi');
  });

  it('maps ERR_AUTH_REQUIRED token to translation', () => {
    const err = mapSupabaseError({ message: 'ERR_AUTH_REQUIRED', code: 'P0001' }, 'ensureMyProfile');
    expect(err.translationKey).toBe('errors.rpc.authRequired');
    expect(err.code).toBe('AUTH_REQUIRED');
    expect(err.message).toContain('giriş yapmanız');
  });

  it('maps ERR_MATCH_CREATE_GROUP_FORBIDDEN token to translation', () => {
    const err = mapSupabaseError({ message: 'ERR_MATCH_CREATE_GROUP_FORBIDDEN', code: 'P0001' }, 'createMatchRpc');
    expect(err.translationKey).toBe('errors.rpc.matchCreateGroupForbidden');
    expect(err.code).toBe('FORBIDDEN');
    expect(err.message).toContain('grupta maç');
  });

  it('maps ERR_MATCH_PAYMENT_METHOD_INVALID token to translation', () => {
    const err = mapSupabaseError({ message: 'ERR_MATCH_PAYMENT_METHOD_INVALID', code: 'P0001' }, 'createMatchRpc');
    expect(err.translationKey).toBe('errors.rpc.matchPaymentMethodInvalid');
    expect(err.code).toBe('VALIDATION');
  });

  it('maps ERR_MATCH_PAYMENT_IBAN_REQUIRED token to translation', () => {
    const err = mapSupabaseError({ message: 'ERR_MATCH_PAYMENT_IBAN_REQUIRED', code: 'P0001' }, 'createMatchRpc');
    expect(err.translationKey).toBe('errors.rpc.matchPaymentIbanRequired');
    expect(err.code).toBe('VALIDATION');
  });

  it('maps ERR_MATCH_PAYMENT_NOTE_REQUIRED token to translation', () => {
    const err = mapSupabaseError({ message: 'ERR_MATCH_PAYMENT_NOTE_REQUIRED', code: 'P0001' }, 'createMatchRpc');
    expect(err.translationKey).toBe('errors.rpc.matchPaymentNoteRequired');
    expect(err.code).toBe('VALIDATION');
  });

  it('maps ERR_MATCH_PAYMENT_NOTE_TOO_LONG token to translation', () => {
    const err = mapSupabaseError({ message: 'ERR_MATCH_PAYMENT_NOTE_TOO_LONG', code: 'P0001' }, 'createMatchRpc');
    expect(err.translationKey).toBe('errors.rpc.matchPaymentNoteTooLong');
    expect(err.code).toBe('VALIDATION');
  });

  it('maps ERR_MATCH_SCORE_BEFORE_END token to translation', () => {
    const err = mapSupabaseError({ message: 'ERR_MATCH_SCORE_BEFORE_END', code: 'P0001' }, 'submitMatchResultRpc');
    expect(err.translationKey).toBe('errors.rpc.matchScoreBeforeEnd');
    expect(err.code).toBe('VALIDATION');
    expect(err.message).toContain('bitiş');
  });

  it('maps outdated create_match_with_organizer_attendee signature to migration guidance', () => {
    const err = mapSupabaseError(
      {
        code: 'PGRST202',
        message:
          'Could not find the function public.create_match_with_organizer_attendee(p_group_id, p_iban, p_iban_account_name, p_join_code, p_max_players, p_payment_method, p_payment_note, p_price_per_person, p_starts_at, p_venue) in the schema cache',
      },
      'insertMatchWithOrganizerAttendee.create_match_rpc',
    );
    expect(err.translationKey).toBe('errors.rpc.backendSchemaOutdated');
    expect(err.retryable).toBe(false);
    expect(err.message).toContain('migration');
  });

  it('maps named check constraint matches_max_players_chk', () => {
    const err = mapSupabaseError(
      {
        message: 'new row for relation "matches" violates check constraint "matches_max_players_chk"',
        code: '23514',
      },
      'insertMatch',
    );
    expect(err.translationKey).toBe('errors.db.matches_max_players_chk');
    expect(err.code).toBe('VALIDATION');
    expect(err.message).toContain('22');
  });

  it('attaches traceId and requestPayload when provided', () => {
    const err = mapSupabaseError({ message: 'ERR_FORBIDDEN', code: 'P0001' }, 'submitMatchResultRpc', {
      traceId: 'trace-test-1',
      requestPayload: { matchId: 'm1', scoreA: 1, scoreB: 2 },
    });
    expect(err.traceId).toBe('trace-test-1');
    expect(err.meta?.traceId).toBe('trace-test-1');
    expect(err.meta?.requestPayload).toEqual({ matchId: 'm1', scoreA: 1, scoreB: 2 });
  });

  it('parses JSON Postgres DETAIL into meta.pgDetail', () => {
    const err = mapSupabaseError(
      {
        message: 'ERR_AUTH_REQUIRED',
        code: 'P0001',
        details: '{"field":"starts_at","reason":"past"}',
      },
      'rpc',
    );
    expect(err.meta?.pgDetail).toEqual({ field: 'starts_at', reason: 'past' });
  });
});

describe('toUserMessage', () => {
  it('returns AppError.message for mapped errors', () => {
    const err = mapSupabaseError({ message: 'not authenticated', code: '401' }, 'x');
    expect(toUserMessage(err)).toBe(err.message);
  });
});
