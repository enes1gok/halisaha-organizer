import { insertMatchAsOrganizer } from './fixtures';
import {
  createAnonClient,
  createAuthedUser,
  describeIntegration,
} from './setup';

describeIntegration('RPC get_match_by_join_code', () => {
  it('returns a row for anon when match is upcoming', async () => {
    const org = await createAuthedUser('preview_org');
    const joinCode = `PREV${Date.now().toString(36).toUpperCase().slice(-6)}`;
    await insertMatchAsOrganizer(org.client, joinCode);

    const anon = createAnonClient();
    const { data, error } = await anon.rpc('get_match_by_join_code', { p_code: joinCode });
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect((data as unknown[]).length).toBeGreaterThanOrEqual(1);
    const row = (data as { join_code?: string }[])[0];
    expect(row?.join_code).toBe(joinCode);
  });

  it('returns empty set for junk code', async () => {
    const anon = createAnonClient();
    const { data, error } = await anon.rpc('get_match_by_join_code', { p_code: 'x' });
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });
});
