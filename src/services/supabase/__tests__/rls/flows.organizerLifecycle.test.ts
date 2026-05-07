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
    });
    expect(scoreErr).toBeNull();

    const { data: row } = await player.client.from('matches').select('score_a, score_b').eq('id', match.id).single();
    expect(row?.score_a).toBe(5);
    expect(row?.score_b).toBe(4);
  });
});
