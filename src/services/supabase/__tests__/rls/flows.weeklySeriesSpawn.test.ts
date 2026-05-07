import { insertGroupMatchAsOrganizer, insertMatchAsOrganizer } from './fixtures';
import { createAuthedUser, describeIntegration } from './setup';

describeIntegration('weekly series spawn after submit_match_result', () => {
  it('creates next-week match when active series exists', async () => {
    const org = await createAuthedUser('weekly_org');
    const { data: grp, error: gErr } = await org.client.rpc('create_group', { p_name: 'WeeklySpawn' });
    expect(gErr).toBeNull();
    expect(grp).toBeTruthy();
    const groupId = (grp as { id: string }).id;

    const { error: sErr } = await org.client.from('group_weekly_series').upsert(
      {
        group_id: groupId,
        is_active: true,
        weekday_isodow: 3,
        local_time: '17:00:00',
        timezone: 'Europe/Istanbul',
        venue: 'Spawn sahası',
        max_players: 14,
        default_organizer_id: org.userId,
      },
      { onConflict: 'group_id' },
    );
    expect(sErr).toBeNull();

    const joinCode = `WSP${Date.now().toString(36).toUpperCase().slice(-8)}`;
    const startsAt = '2026-05-06T14:00:00.000Z';
    const match = await insertGroupMatchAsOrganizer(org.client, joinCode, groupId, startsAt);

    const { error: scoreErr } = await org.client.rpc('submit_match_result', {
      p_match_id: match.id,
      p_score_a: 1,
      p_score_b: 0,
      p_scorers: [{ player_id: org.userId, count: 1 }],
      p_assists: [],
    });
    expect(scoreErr).toBeNull();

    const { data: children, error: cErr } = await org.client
      .from('matches')
      .select('id, starts_at, spawned_from_match_id, series_id')
      .eq('spawned_from_match_id', match.id);
    expect(cErr).toBeNull();
    expect(children?.length).toBe(1);
    const next = children![0]!;
    expect(next.spawned_from_match_id).toBe(match.id);
    expect(next.series_id).toBeTruthy();
    expect(new Date(next.starts_at as string).toISOString().slice(0, 16)).toBe('2026-05-13T14:00');

    const { error: scoreErr2 } = await org.client.rpc('submit_match_result', {
      p_match_id: match.id,
      p_score_a: 2,
      p_score_b: 0,
      p_scorers: [{ player_id: org.userId, count: 2 }],
      p_assists: [],
    });
    expect(scoreErr2).toBeNull();

    const { data: children2, error: c2Err } = await org.client
      .from('matches')
      .select('id')
      .eq('spawned_from_match_id', match.id);
    expect(c2Err).toBeNull();
    expect(children2?.length).toBe(1);
  });

  it('does not spawn without active series', async () => {
    const org = await createAuthedUser('weekly_plain');
    const joinCode = `WPL${Date.now().toString(36).toUpperCase().slice(-8)}`;
    const match = await insertMatchAsOrganizer(org.client, joinCode);

    const { error: scoreErr } = await org.client.rpc('submit_match_result', {
      p_match_id: match.id,
      p_score_a: 1,
      p_score_b: 1,
      p_scorers: [],
      p_assists: [],
    });
    expect(scoreErr).toBeNull();

    const { data: children, error: cErr } = await org.client
      .from('matches')
      .select('id')
      .eq('spawned_from_match_id', match.id);
    expect(cErr).toBeNull();
    expect(children?.length ?? 0).toBe(0);
  });
});
