import { insertMatchAsOrganizer } from './fixtures';
import { createAuthedUser, describeIntegration } from './setup';

describeIntegration('flows participant boundaries', () => {
  it('participant cannot update match core fields', async () => {
    const org = await createAuthedUser('bound_org');
    const player = await createAuthedUser('bound_player');
    const joinCode = `BND${Date.now().toString(36).toUpperCase().slice(-8)}`;
    const match = await insertMatchAsOrganizer(org.client, joinCode);

    const { error: joinErr } = await player.client.rpc('join_match_by_join_code', { p_code: joinCode });
    expect(joinErr).toBeNull();

    const { data, error } = await player.client
      .from('matches')
      .update({ venue: 'Yetkisiz saha' })
      .eq('id', match.id)
      .select('venue');

    expect(error).toBeNull();
    expect(data?.length ?? 0).toBe(0);
  });

  it('participant cannot delete match', async () => {
    const org = await createAuthedUser('bound_org2');
    const player = await createAuthedUser('bound_player2');
    const joinCode = `BND2${Date.now().toString(36).toUpperCase().slice(-6)}`;
    const match = await insertMatchAsOrganizer(org.client, joinCode);
    await player.client.rpc('join_match_by_join_code', { p_code: joinCode });

    const { error } = await player.client.from('matches').delete().eq('id', match.id);
    expect(error).toBeNull();

    const { data: still } = await org.client.from('matches').select('id').eq('id', match.id).maybeSingle();
    expect(still?.id).toBe(match.id);
  });
});
