import { insertMatchAsOrganizer } from './fixtures';
import { createAuthedUser, describeIntegration } from './setup';

describeIntegration('flows organizer lifecycle', () => {
  it('create match → join by code → submit score', async () => {
    const org = await createAuthedUser('life_org');
    const player = await createAuthedUser('life_player');
    const joinCode = `LIFE${Date.now().toString(36).toUpperCase().slice(-8)}`;
    const match = await insertMatchAsOrganizer(org.client, joinCode);

    const { data: joinedId, error: joinErr } = await player.client.rpc('join_match_by_join_code', {
      p_code: joinCode,
    });
    expect(joinErr).toBeNull();
    expect(joinedId).toBe(match.id);

    const { error: scoreErr } = await org.client.rpc('submit_match_result', {
      p_match_id: match.id,
      p_score_a: 2,
      p_score_b: 1,
      p_scorers: [{ player_id: org.userId, count: 2 }],
      p_assists: [],
      p_own_goals: [],
    });
    expect(scoreErr).toBeNull();

    const { data: finished, error: mErr } = await org.client
      .from('matches')
      .select('status, score_a, score_b')
      .eq('id', match.id)
      .single();
    expect(mErr).toBeNull();
    expect(finished?.status).toBe('finished');
    expect(finished?.score_a).toBe(2);
    expect(finished?.score_b).toBe(1);
  });

  it('lineup participant may submit_match_result without being organizer', async () => {
    const org = await createAuthedUser('line_org');
    const player = await createAuthedUser('line_player');
    const joinCode = `LINE${Date.now().toString(36).toUpperCase().slice(-8)}`;
    const match = await insertMatchAsOrganizer(org.client, joinCode);

    const { error: joinErr } = await player.client.rpc('join_match_by_join_code', { p_code: joinCode });
    expect(joinErr).toBeNull();

    const { error: lineupErr } = await org.client.from('match_team_players').insert([
      { match_id: match.id, player_id: org.userId, team: 'A' },
      { match_id: match.id, player_id: player.userId, team: 'B' },
    ]);
    expect(lineupErr).toBeNull();

    const { error: lockErr } = await org.client.from('matches').update({ lineup_locked: true }).eq('id', match.id);
    expect(lockErr).toBeNull();

    const { error: scoreErr } = await player.client.rpc('submit_match_result', {
      p_match_id: match.id,
      p_score_a: 5,
      p_score_b: 4,
      p_scorers: [{ player_id: player.userId, count: 1 }],
      p_assists: [],
      p_own_goals: [],
    });
    expect(scoreErr).toBeNull();

    const { data: row } = await player.client.from('matches').select('score_a, score_b').eq('id', match.id).single();
    expect(row?.score_a).toBe(5);
    expect(row?.score_b).toBe(4);
  });

  it('supports note_only/iban/cash payment methods at creation', async () => {
    const org = await createAuthedUser('pay_org');
    const now = Date.now();
    const base = {
      p_starts_at: new Date(now + 72 * 60 * 60 * 1000).toISOString(),
      p_venue: 'RLS odeme sahasi',
      p_max_players: 14,
      p_group_id: null,
      p_price_per_person: 120,
    };

    const noteOnly = await org.client.rpc('create_match_with_organizer_attendee', {
      ...base,
      p_join_code: `PAYNOT${now.toString(36).toUpperCase().slice(-6)}`,
      p_iban: null,
      p_payment_method: 'note_only',
      p_iban_account_name: null,
      p_payment_note: 'Top ve forma herkesin kendi sorumluluğunda.',
    });
    expect(noteOnly.error).toBeNull();

    const iban = await org.client.rpc('create_match_with_organizer_attendee', {
      ...base,
      p_join_code: `PAYIBN${(now + 1).toString(36).toUpperCase().slice(-6)}`,
      p_iban: 'TR330006100519786457841326',
      p_payment_method: 'iban',
      p_iban_account_name: 'Ali Yilmaz',
      p_payment_note: null,
    });
    expect(iban.error).toBeNull();
    expect((iban.data as { iban_account_name?: string } | null)?.iban_account_name).toBe('ALI YILMAZ');

    const cash = await org.client.rpc('create_match_with_organizer_attendee', {
      ...base,
      p_join_code: `PAYCSH${(now + 2).toString(36).toUpperCase().slice(-6)}`,
      p_iban: null,
      p_payment_method: 'cash',
      p_iban_account_name: null,
      p_payment_note: null,
    });
    expect(cash.error).toBeNull();

    const invalidNoteOnly = await org.client.rpc('create_match_with_organizer_attendee', {
      ...base,
      p_join_code: `PAYINV${(now + 3).toString(36).toUpperCase().slice(-6)}`,
      p_iban: null,
      p_payment_method: 'note_only',
      p_iban_account_name: null,
      p_payment_note: '   ',
    });
    expect(invalidNoteOnly.error?.message).toContain('ERR_MATCH_PAYMENT_NOTE_REQUIRED');
  });
});
