import { insertMatchAsOrganizer } from './fixtures';
import { createAnonClient, createAuthedUser, describeIntegration } from './setup';

describeIntegration('RPC set_match_attendee_rsvp', () => {
  it('rejects anonymous caller with ERR_AUTH_REQUIRED', async () => {
    const anon = createAnonClient();
    const { error } = await anon.rpc('set_match_attendee_rsvp', {
      p_match_id: '00000000-0000-4000-8000-000000000099',
      p_status: 'going',
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain('ERR_AUTH_REQUIRED');
  });

  it('lets a joined player update own RSVP status', async () => {
    const org = await createAuthedUser('rsvp_org');
    const player = await createAuthedUser('rsvp_pl');
    const joinCode = `RSV${Date.now().toString(36).toUpperCase().slice(-7)}`;
    const match = await insertMatchAsOrganizer(org.client, joinCode);

    await player.client.rpc('join_match_by_join_code', { p_code: joinCode });

    const { error } = await player.client.rpc('set_match_attendee_rsvp', {
      p_match_id: match.id,
      p_status: 'maybe',
    });
    expect(error).toBeNull();

    const { data } = await player.client
      .from('match_attendees')
      .select('status')
      .eq('match_id', match.id)
      .eq('player_id', player.userId)
      .single();
    expect(data?.status).toBe('maybe');
  });

  it('is idempotent — no duplicate row on repeated calls with same status', async () => {
    const org = await createAuthedUser('rsvp_idem_o');
    const player = await createAuthedUser('rsvp_idem_p');
    const joinCode = `IDP${Date.now().toString(36).toUpperCase().slice(-7)}`;
    const match = await insertMatchAsOrganizer(org.client, joinCode);
    await player.client.rpc('join_match_by_join_code', { p_code: joinCode });

    await player.client.rpc('set_match_attendee_rsvp', {
      p_match_id: match.id,
      p_status: 'not_going',
    });
    const { error } = await player.client.rpc('set_match_attendee_rsvp', {
      p_match_id: match.id,
      p_status: 'not_going',
    });
    expect(error).toBeNull();

    const { data } = await player.client
      .from('match_attendees')
      .select('player_id')
      .eq('match_id', match.id)
      .eq('player_id', player.userId);
    expect(data?.length).toBe(1);
  });

  it('rejects non-member with ERR_MATCH_NOT_FOUND', async () => {
    const org = await createAuthedUser('rsvp_nm_o');
    const nonMember = await createAuthedUser('rsvp_nm_u');
    const joinCode = `NMB${Date.now().toString(36).toUpperCase().slice(-7)}`;
    const match = await insertMatchAsOrganizer(org.client, joinCode);

    const { error } = await nonMember.client.rpc('set_match_attendee_rsvp', {
      p_match_id: match.id,
      p_status: 'going',
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain('ERR_MATCH_NOT_FOUND');
  });

  it('allows status transitions in both directions', async () => {
    const org = await createAuthedUser('rsvp_tr_o');
    const player = await createAuthedUser('rsvp_tr_p');
    const joinCode = `TRN${Date.now().toString(36).toUpperCase().slice(-7)}`;
    const match = await insertMatchAsOrganizer(org.client, joinCode);
    await player.client.rpc('join_match_by_join_code', { p_code: joinCode });

    // going → not_going
    await player.client.rpc('set_match_attendee_rsvp', {
      p_match_id: match.id,
      p_status: 'not_going',
    });
    // not_going → going
    const { error } = await player.client.rpc('set_match_attendee_rsvp', {
      p_match_id: match.id,
      p_status: 'going',
    });
    expect(error).toBeNull();

    const { data } = await player.client
      .from('match_attendees')
      .select('status')
      .eq('match_id', match.id)
      .eq('player_id', player.userId)
      .single();
    expect(data?.status).toBe('going');
  });
});
