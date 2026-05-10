import { createAuthedUser, describeIntegration } from './setup';

describeIntegration('RPC create_group', () => {
  it('creates group and owner membership', async () => {
    const owner = await createAuthedUser('group_owner');
    const { data, error } = await owner.client.rpc('create_group', { p_name: 'Test Grubu' });
    expect(error).toBeNull();
    expect(data?.owner_id).toBe(owner.userId);
    expect(data?.join_code?.length).toBeGreaterThanOrEqual(4);

    const { data: members, error: mErr } = await owner.client
      .from('group_members')
      .select('role')
      .eq('group_id', data!.id)
      .eq('player_id', owner.userId);
    expect(mErr).toBeNull();
    expect(members?.[0]?.role).toBe('owner');
  });

  it('rejects group name shorter than 2 characters', async () => {
    const owner = await createAuthedUser('group_owner_short');
    const { error } = await owner.client.rpc('create_group', { p_name: 'x' });
    expect(error).not.toBeNull();
    expect(error?.message ?? '').toMatch(/Grup adı|karakter/i);
  });

  it('get_my_groups_bundle_for_user returns groups and memberships json', async () => {
    const owner = await createAuthedUser('bundle_owner');
    const { data: grp, error: cErr } = await owner.client.rpc('create_group', { p_name: 'Bundle Test' });
    expect(cErr).toBeNull();
    expect(grp?.id).toBeDefined();

    const { data: bundle, error: bErr } = await owner.client.rpc('get_my_groups_bundle_for_user');
    expect(bErr).toBeNull();
    expect(bundle && typeof bundle === 'object').toBe(true);
    const b = bundle as { groups?: unknown[]; memberships?: unknown[]; profiles?: unknown[] };
    expect(Array.isArray(b.groups)).toBe(true);
    expect((b.groups ?? []).some((g) => (g as { id?: string }).id === grp!.id)).toBe(true);
    expect(Array.isArray(b.memberships)).toBe(true);
    expect(Array.isArray(b.profiles)).toBe(true);
  });
});
