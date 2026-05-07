import { describeIntegration, createAuthedUser } from './setup';

describeIntegration('RPC ensure_my_profile', () => {
  it('succeeds for a signed-in user', async () => {
    const user = await createAuthedUser('ensure_profile');
    const { error } = await user.client.rpc('ensure_my_profile');
    expect(error).toBeNull();
  });
});
