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

  it('list_match_graphs_for_match_ids returns rows for visible matches', async () => {
    const org = await createAuthedUser('batch_graph_org');
    const joinCode = `BGRAPH${Date.now().toString(36).toUpperCase().slice(-6)}`;
    const match = await insertMatchAsOrganizer(org.client, joinCode);

    const { data, error } = await org.client.rpc('list_match_graphs_for_match_ids', {
      p_match_ids: [match.id],
    });
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect((data as { id: string }[]).length).toBe(1);
    expect((data as { id: string }[])[0]?.id).toBe(match.id);
  });
});
