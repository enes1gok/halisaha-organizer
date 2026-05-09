import { insertMatchAsOrganizer } from './fixtures';
import { createAuthedUser, describeIntegration } from './setup';

describeIntegration('RPC match_peer_ratings', () => {
  it('submit peer ratings + MOTM and returns public summary for viewers', async () => {
    const org = await createAuthedUser('peer_org');
    const p1 = await createAuthedUser('peer_p1');
    const joinCode = `PEER${Date.now().toString(36).toUpperCase().slice(-8)}`;
    const match = await insertMatchAsOrganizer(org.client, joinCode);

    const { data: joinedId, error: joinErr } = await p1.client.rpc('join_match_by_join_code', {
      p_code: joinCode,
    });
    expect(joinErr).toBeNull();
    expect(joinedId).toBe(match.id);

    const line = await org.client.from('match_team_players').insert([
      { match_id: match.id, player_id: org.userId, team: 'A' },
      { match_id: match.id, player_id: p1.userId, team: 'B' },
    ]);
    expect(line.error).toBeNull();

    const { error: scoreErr } = await org.client.rpc('submit_match_result', {
      p_match_id: match.id,
      p_score_a: 3,
      p_score_b: 2,
      p_scorers: [{ player_id: org.userId, count: 1 }],
      p_assists: [],
    });
    expect(scoreErr).toBeNull();

    const { error: rateErr } = await p1.client.rpc('upsert_match_peer_ratings', {
      p_match_id: match.id,
      p_scores: [{ ratee_id: org.userId, score: 80 }],
    });
    expect(rateErr).toBeNull();

    const { error: motmErr } = await p1.client.rpc('upsert_match_motm_vote', {
      p_match_id: match.id,
      p_pick_player_id: org.userId,
    });
    expect(motmErr).toBeNull();

    const { data: summaryOrg, error: sumOrgErr } = await org.client.rpc('get_match_rating_public_summary', {
      p_match_id: match.id,
    });
    expect(sumOrgErr).toBeNull();
    const sOrg = summaryOrg as { players: { player_id: string; avg: number | null; votes_count: number }[] };
    expect(sOrg.players?.length).toBe(2);
    const orgRow = sOrg.players!.find((p) => p.player_id === org.userId);
    expect(orgRow?.avg).toBe(80);
    expect(orgRow?.votes_count).toBe(1);

    const { data: summaryP1, error: sumP1Err } = await p1.client.rpc('get_match_rating_public_summary', {
      p_match_id: match.id,
    });
    expect(sumP1Err).toBeNull();
    expect((summaryP1 as { motm?: { votes: number }[] }).motm?.[0]?.votes).toBe(1);

    const outsider = await createAuthedUser('peer_out');
    const { data: outsiderSum, error: outErr } = await outsider.client.rpc('get_match_rating_public_summary', {
      p_match_id: match.id,
    });
    expect(outErr).toBeNull();
    expect(outsiderSum).toBeNull();
  });

  it('participant cannot select another user peer rating rows', async () => {
    const org = await createAuthedUser('peer_org_sel');
    const p1 = await createAuthedUser('peer_p1_sel');
    const joinCode = `PEVR${Date.now().toString(36).toUpperCase().slice(-8)}`;
    const match = await insertMatchAsOrganizer(org.client, joinCode);
    await p1.client.rpc('join_match_by_join_code', { p_code: joinCode });
    await org.client.from('match_team_players').insert([
      { match_id: match.id, player_id: org.userId, team: 'A' },
      { match_id: match.id, player_id: p1.userId, team: 'A' },
    ]);
    await org.client.rpc('submit_match_result', {
      p_match_id: match.id,
      p_score_a: 1,
      p_score_b: 0,
      p_scorers: [{ player_id: org.userId, count: 1 }],
      p_assists: [],
    });
    await p1.client.rpc('upsert_match_peer_ratings', {
      p_match_id: match.id,
      p_scores: [{ ratee_id: org.userId, score: 70 }],
    });

    const { data: peerRows } = await org.client.from('match_peer_ratings').select('*').eq('match_id', match.id);
    expect((peerRows as unknown[]).length).toBe(0);
  });
});
