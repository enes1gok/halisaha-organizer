import { insertMatchAsOrganizer } from './fixtures';
import {
  createAnonClient,
  createAuthedUser,
  describeIntegration,
} from './setup';

describeIntegration('RPC join_match_by_join_code', () => {
  it('adds attendee for authenticated user', async () => {
    const org = await createAuthedUser('join_org');
    const player = await createAuthedUser('join_player');
    const joinCode = `JOIN${Date.now().toString(36).toUpperCase().slice(-8)}`;
    const match = await insertMatchAsOrganizer(org.client, joinCode);

    const { data, error } = await player.client.rpc('join_match_by_join_code', {
      p_code: joinCode,
    });
    expect(error).toBeNull();
    expect(data).toBe(match.id);

    const { data: rows, error: selErr } = await player.client
      .from('match_attendees')
      .select('player_id')
      .eq('match_id', match.id)
      .eq('player_id', player.userId);
    expect(selErr).toBeNull();
    expect(rows?.length).toBe(1);
  });

  it('fails for anon session', async () => {
    const anon = createAnonClient();
    const { data, error } = await anon.rpc('join_match_by_join_code', { p_code: 'ANYCODE' });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });
});
