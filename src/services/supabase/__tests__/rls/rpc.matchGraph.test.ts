import { insertMatchAsOrganizer } from './fixtures';
import { createAuthedUser, describeIntegration } from './setup';

describeIntegration('RPC match graph', () => {
  it('get_match_graph_for_user returns payload for visible match', async () => {
    const org = await createAuthedUser('graph_org');
    const joinCode = `GRAPH${Date.now().toString(36).toUpperCase().slice(-6)}`;
    const match = await insertMatchAsOrganizer(org.client, joinCode);

    const { data, error } = await org.client.rpc('get_match_graph_for_user', {
      p_match_id: match.id,
    });
    expect(error).toBeNull();
    const row = Array.isArray(data) ? data[0] : data;
    expect(row?.id).toBe(match.id);
    expect(row?.attendees).toBeDefined();
  });

  it('list_visible_match_graphs_for_user includes organizer match', async () => {
    const org = await createAuthedUser('list_graph_org');
    const joinCode = `LGRAPH${Date.now().toString(36).toUpperCase().slice(-6)}`;
    const match = await insertMatchAsOrganizer(org.client, joinCode);

    const { data, error } = await org.client.rpc('list_visible_match_graphs_for_user');
    expect(error).toBeNull();
    const ids = (data ?? []).map((r: { id: string }) => r.id);
    expect(ids).toContain(match.id);
  });
});
