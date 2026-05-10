import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { reportError } from '../logging/reportError';
import { runRemoteCatchUp } from './remoteCatchUp';

export const BACKGROUND_SYNC_TASK_NAME = 'halisaha-background-sync';
export const BACKGROUND_SYNC_MINIMUM_INTERVAL_MINUTES = 60;

if (!TaskManager.isTaskDefined(BACKGROUND_SYNC_TASK_NAME)) {
  TaskManager.defineTask(BACKGROUND_SYNC_TASK_NAME, async () => {
    try {
      await runRemoteCatchUp({ reason: 'background' });
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (error) {
      reportError({ error, operation: 'backgroundSyncTask' });
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

export async function registerBackgroundSyncTask(): Promise<boolean> {
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return false;

  const registered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK_NAME);
  if (registered) return true;

  await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK_NAME, {
    minimumInterval: BACKGROUND_SYNC_MINIMUM_INTERVAL_MINUTES,
  });
  return true;
}

export async function unregisterBackgroundSyncTask(): Promise<void> {
  const registered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK_NAME);
  if (!registered) return;
  await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK_NAME);
}
