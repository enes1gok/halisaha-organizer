import { createAuthedUser, describeIntegration } from './setup';

describeIntegration('RPC join_group_by_code', () => {
  it('lets a second user join via join_code', async () => {
    const owner = await createAuthedUser('jg_owner');
    const joiner = await createAuthedUser('jg_joiner');

    const { data: group, error: cErr } = await owner.client.rpc('create_group', {
      p_name: 'JoinCode Grubu',
    });
    expect(cErr).toBeNull();
    const code = group!.join_code;

    const { data: joined, error: jErr } = await joiner.client.rpc('join_group_by_code', {
      p_code: code,
    });
    expect(jErr).toBeNull();
    expect(joined?.id).toBe(group!.id);

    const { data: row, error: sErr } = await joiner.client
      .from('group_members')
      .select('role')
      .eq('group_id', group!.id)
      .eq('player_id', joiner.userId)
      .maybeSingle();
    expect(sErr).toBeNull();
    expect(row?.role).toBe('member');
  });

  it('returns null for unknown code', async () => {
    const u = await createAuthedUser('jg_unknown');
    const { data, error } = await u.client.rpc('join_group_by_code', { p_code: 'ZZZZZZZZ' });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });
});
