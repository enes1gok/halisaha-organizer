import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { runRemoteCatchUp } from '../remoteCatchUp';
import {
  BACKGROUND_SYNC_MINIMUM_INTERVAL_MINUTES,
  BACKGROUND_SYNC_TASK_NAME,
  registerBackgroundSyncTask,
  unregisterBackgroundSyncTask,
} from '../backgroundTask';

jest.mock('expo-background-task', () => ({
  BackgroundTaskResult: { Success: 1, Failed: 2 },
  BackgroundTaskStatus: { Restricted: 1, Available: 2 },
  getStatusAsync: jest.fn(),
  registerTaskAsync: jest.fn(() => Promise.resolve()),
  unregisterTaskAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  isTaskDefined: jest.fn(() => false),
  isTaskRegisteredAsync: jest.fn(),
}));

jest.mock('../remoteCatchUp', () => ({
  runRemoteCatchUp: jest.fn(),
}));

jest.mock('../../logging/reportError', () => ({
  reportError: jest.fn(),
}));

const mockGetStatusAsync = BackgroundTask.getStatusAsync as jest.MockedFunction<
  typeof BackgroundTask.getStatusAsync
>;
const mockRegisterTaskAsync = BackgroundTask.registerTaskAsync as jest.MockedFunction<
  typeof BackgroundTask.registerTaskAsync
>;
const mockUnregisterTaskAsync = BackgroundTask.unregisterTaskAsync as jest.MockedFunction<
  typeof BackgroundTask.unregisterTaskAsync
>;
const mockIsTaskRegisteredAsync = TaskManager.isTaskRegisteredAsync as jest.MockedFunction<
  typeof TaskManager.isTaskRegisteredAsync
>;
const mockDefineTask = TaskManager.defineTask as jest.MockedFunction<typeof TaskManager.defineTask>;
const mockRunRemoteCatchUp = runRemoteCatchUp as jest.MockedFunction<typeof runRemoteCatchUp>;
const definedTaskExecutor = mockDefineTask.mock.calls[0][1];

describe('background sync task', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('defines a task that reports success or failure', async () => {
    mockRunRemoteCatchUp.mockResolvedValue({ status: 'synced' });
    const taskBody = {
      data: {},
      error: null,
      executionInfo: { eventId: 'event-1', taskName: BACKGROUND_SYNC_TASK_NAME },
    };

    await expect(definedTaskExecutor(taskBody)).resolves.toBe(
      BackgroundTask.BackgroundTaskResult.Success,
    );

    mockRunRemoteCatchUp.mockRejectedValueOnce(new Error('network'));
    await expect(definedTaskExecutor(taskBody)).resolves.toBe(
      BackgroundTask.BackgroundTaskResult.Failed,
    );
  });

  it('registers with the configured interval when available', async () => {
    mockGetStatusAsync.mockResolvedValue(BackgroundTask.BackgroundTaskStatus.Available);
    mockIsTaskRegisteredAsync.mockResolvedValue(false);

    await expect(registerBackgroundSyncTask()).resolves.toBe(true);

    expect(mockRegisterTaskAsync).toHaveBeenCalledWith(BACKGROUND_SYNC_TASK_NAME, {
      minimumInterval: BACKGROUND_SYNC_MINIMUM_INTERVAL_MINUTES,
    });
  });

  it('does not register when background tasks are restricted', async () => {
    mockGetStatusAsync.mockResolvedValue(BackgroundTask.BackgroundTaskStatus.Restricted);

    await expect(registerBackgroundSyncTask()).resolves.toBe(false);
    expect(mockRegisterTaskAsync).not.toHaveBeenCalled();
  });

  it('unregisters only when the task is registered', async () => {
    mockIsTaskRegisteredAsync.mockResolvedValue(true);

    await unregisterBackgroundSyncTask();

    expect(mockUnregisterTaskAsync).toHaveBeenCalledWith(BACKGROUND_SYNC_TASK_NAME);
  });
});
