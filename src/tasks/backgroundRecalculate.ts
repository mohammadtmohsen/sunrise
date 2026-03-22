import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { useAlarmStore } from '../stores/alarmStore';
import { useLocationStore } from '../stores/locationStore';
import { getSunTimes } from '../services/sunCalcService';
import { scheduleAllAlarms } from '../services/alarmScheduler';
import { updatePersistentNotification } from '../services/persistentNotificationService';

export const RECALCULATE_TASK = 'RECALCULATE_SUNRISE_ALARMS';

/**
 * Background task that recalculates all alarm trigger times based on
 * the latest sunrise/sunset data. Runs approximately every 6 hours.
 *
 * This is the first leg of the triple-redundancy strategy:
 * 1. Background fetch (this task) — ~every 6 hours
 * 2. Foreground recalc — on every AppState change to 'active'
 * 3. Next-day-on-dismiss — when alarm is dismissed, schedule next occurrence
 */
TaskManager.defineTask(RECALCULATE_TASK, async () => {
  try {
    const location = useLocationStore.getState().location;
    if (!location) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Calculate today's sun times
    const sunTimes = getSunTimes(location.latitude, location.longitude);

    // Recalculate all alarm trigger times in the store
    useAlarmStore.getState().recalculateAllTriggerTimes(sunTimes);

    // Get enabled alarms and reschedule via Notifee
    const enabledAlarms = Object.values(useAlarmStore.getState().alarms).filter(
      (a) => a.isEnabled,
    );

    if (enabledAlarms.length > 0) {
      await scheduleAllAlarms(enabledAlarms, sunTimes);
    }

    await updatePersistentNotification();

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.warn('Background recalculation failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Register the background fetch task. Should be called once on app start.
 * On iOS, the OS decides when to wake the app (typically every few hours).
 * On Android, WorkManager handles scheduling with the minimum interval.
 */
export async function registerBackgroundRecalculation(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(RECALCULATE_TASK);
    if (isRegistered) return;

    await BackgroundFetch.registerTaskAsync(RECALCULATE_TASK, {
      minimumInterval: 6 * 60 * 60, // 6 hours in seconds
      stopOnTerminate: false, // Android: continue after app kill
      startOnBoot: true, // Android: restart after reboot
    });
  } catch (error) {
    console.warn('Failed to register background recalculation:', error);
  }
}
