import * as matchMutations from '../../services/supabase/matchMutations';
import * as matchGraphService from '../../services/supabase/matchGraph';
import { AppError } from '../../services/supabase/errors';
import type { Match } from '../../types/domain';
import { cancelMatchUseCase } from '../matches';

jest.mock('../../services/supabase/matchMutations', () => ({
  updateMatchOrganizerFieldsRemote: jest.fn(),
  updateMatchAttendeeRemote: jest.fn(),
  replaceMatchTeamPlayersRemote: jest.fn(),
  insertSelfReportRemote: jest.fn(),
  updateSelfReportStatusRemote: jest.fn(),
}));

jest.mock('../../services/supabase/matchGraph', () => ({
  fetchMatchGraph: jest.fn(),
  fetchMyMatchesGraph: jest.fn(),
}));

jest.mock('../../services/supabase/matches', () => ({
  insertMatchWithOrganizerAttendee: jest.fn(),
  joinMatchByJoinCode: jest.fn(),
  submitMatchResultRpc: jest.fn(),
  fetchMatchesForCurrentUser: jest.fn(),
}));

jest.mock('../../services/supabase/matchRatings', () => ({
  fetchMatchRatingPublicSummary: jest.fn(),
  submitMatchRatingsBundleRemote: jest.fn(),
}));

const mockUpdateMatchOrganizerFieldsRemote = matchMutations.updateMatchOrganizerFieldsRemote as jest.MockedFunction<
  typeof matchMutations.updateMatchOrganizerFieldsRemote
>;
const mockFetchMatchGraph = matchGraphService.fetchMatchGraph as jest.MockedFunction<
  typeof matchGraphService.fetchMatchGraph
>;

const REMOTE_USER = 'a0000000-0000-4000-8000-000000000001';
const REMOTE_MATCH_ID = 'f0000000-0000-4000-8000-000000000080';
const LOCAL_MATCH_ID = 'match-abc-123';

function buildMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: REMOTE_MATCH_ID,
    startsAt: '2026-06-01T18:00:00.000Z',
    venue: 'Saha 1',
    organizerId: REMOTE_USER,
    maxPlayers: 14,
    joinCode: 'JOIN0001',
    paymentMethod: 'note_only',
    attendees: [{ playerId: REMOTE_USER, status: 'going', paid: false }],
    teamAIds: [],
    teamBIds: [],
    lineupLocked: false,
    selfReportEnabled: false,
    status: 'upcoming',
    selfReports: [],
    ...overrides,
  };
}

function buildDeps(overrides: Partial<Parameters<typeof cancelMatchUseCase>[0]> = {}) {
  const upcoming = buildMatch();
  return {
    getRemoteUserId: () => REMOTE_USER as string | null,
    getLocalMatch: jest.fn().mockReturnValue(upcoming),
    mergeHydratedRemoteMatches: jest.fn(),
    mergeRemoteGraph: jest.fn(),
    createLocalMatch: jest.fn(),
    joinLocalMatchByJoinCode: jest.fn(),
    setLocalRsvp: jest.fn(),
    setLocalPaid: jest.fn(),
    setLocalSelfReportEnabled: jest.fn(),
    addLocalSelfReport: jest.fn(),
    respondLocalSelfReport: jest.fn(),
    setLocalMatchTeams: jest.fn(),
    lockLocalLineup: jest.fn(),
    unlockLocalLineup: jest.fn(),
    setLocalMatchStatus: jest.fn(),
    submitLocalScore: jest.fn(),
    ...overrides,
  };
}

describe('cancelMatchUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates remote status to cancelled and merges graph for upcoming remote match', async () => {
    mockUpdateMatchOrganizerFieldsRemote.mockResolvedValue(undefined);
    const cancelled = buildMatch({ status: 'cancelled' });
    mockFetchMatchGraph.mockResolvedValue({
      match: cancelled,
      profiles: [],
    } as Awaited<ReturnType<typeof matchGraphService.fetchMatchGraph>>);

    const deps = buildDeps();
    await cancelMatchUseCase(deps, REMOTE_MATCH_ID);

    expect(mockUpdateMatchOrganizerFieldsRemote).toHaveBeenCalledWith(REMOTE_MATCH_ID, {
      status: 'cancelled',
    });
    expect(mockFetchMatchGraph).toHaveBeenCalledWith(REMOTE_MATCH_ID);
    expect(deps.mergeRemoteGraph).toHaveBeenCalledTimes(1);
    expect(deps.setLocalMatchStatus).not.toHaveBeenCalled();
  });

  it('throws AppError without touching remote when match is already cancelled', async () => {
    const deps = buildDeps({
      getLocalMatch: jest.fn().mockReturnValue(buildMatch({ status: 'cancelled' })),
    });

    await expect(cancelMatchUseCase(deps, REMOTE_MATCH_ID)).rejects.toBeInstanceOf(AppError);

    expect(mockUpdateMatchOrganizerFieldsRemote).not.toHaveBeenCalled();
    expect(mockFetchMatchGraph).not.toHaveBeenCalled();
    expect(deps.setLocalMatchStatus).not.toHaveBeenCalled();
  });

  it('throws AppError without touching remote when match is finished', async () => {
    const deps = buildDeps({
      getLocalMatch: jest.fn().mockReturnValue(buildMatch({ status: 'finished' })),
    });

    await expect(cancelMatchUseCase(deps, REMOTE_MATCH_ID)).rejects.toBeInstanceOf(AppError);

    expect(mockUpdateMatchOrganizerFieldsRemote).not.toHaveBeenCalled();
    expect(mockFetchMatchGraph).not.toHaveBeenCalled();
    expect(deps.setLocalMatchStatus).not.toHaveBeenCalled();
  });

  it('falls back to local mutation when there is no remote session', async () => {
    const deps = buildDeps({
      getRemoteUserId: () => null,
      getLocalMatch: jest.fn().mockReturnValue(buildMatch({ id: LOCAL_MATCH_ID })),
    });

    await cancelMatchUseCase(deps, LOCAL_MATCH_ID);

    expect(deps.setLocalMatchStatus).toHaveBeenCalledWith(LOCAL_MATCH_ID, 'cancelled');
    expect(mockUpdateMatchOrganizerFieldsRemote).not.toHaveBeenCalled();
    expect(mockFetchMatchGraph).not.toHaveBeenCalled();
  });

  it('uses local mutation for local match ids even with a remote session', async () => {
    const deps = buildDeps({
      getLocalMatch: jest.fn().mockReturnValue(buildMatch({ id: LOCAL_MATCH_ID })),
    });

    await cancelMatchUseCase(deps, LOCAL_MATCH_ID);

    expect(deps.setLocalMatchStatus).toHaveBeenCalledWith(LOCAL_MATCH_ID, 'cancelled');
    expect(mockUpdateMatchOrganizerFieldsRemote).not.toHaveBeenCalled();
    expect(mockFetchMatchGraph).not.toHaveBeenCalled();
  });

  it('rethrows when remote update fails and skips graph fetch', async () => {
    const err = new AppError({
      code: 'FORBIDDEN',
      operation: 'updateMatchOrganizerFieldsRemote',
      message: 'Bu işlem için yetkiniz bulunmuyor.',
    });
    mockUpdateMatchOrganizerFieldsRemote.mockRejectedValue(err);

    const deps = buildDeps();
    await expect(cancelMatchUseCase(deps, REMOTE_MATCH_ID)).rejects.toBe(err);

    expect(mockFetchMatchGraph).not.toHaveBeenCalled();
    expect(deps.mergeRemoteGraph).not.toHaveBeenCalled();
  });
});
