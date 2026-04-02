import notifee, {
  TriggerType,
  AlarmType,
  AndroidImportance,
  AndroidVisibility,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import { useAlarmStore } from '../stores/alarmStore';
import { useLocationStore } from '../stores/locationStore';
import { getSunTimes } from './sunCalcService';
import { scheduleAllAlarms } from './alarmScheduler';
import { updatePersistentNotification } from './persistentNotificationService';
import { MAINTENANCE_NOTIFICATION_ID, STATUS_CHANNEL_ID } from '../utils/constants';

/**
 * Schedule a silent daily maintenance alarm using SET_ALARM_CLOCK.
 * This is the most reliable timer on Android — it fires even in Doze mode
 * and is immune to battery optimization, unlike WorkManager/background fetch.
 *
 * Runs at ~2:30 AM daily to recalculate sun times and reschedule all alarms.
 */
export async function scheduleDailyMaintenance(): Promise<void> {
  if (Platform.OS !== 'android') return;

  // Calculate next 2:30 AM
  const now = new Date();
  const next = new Date(now);
  next.setHours(2, 30, 0, 0);

  // If it's already past 2:30 AM today, schedule for tomorrow
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  try {
    // Cancel any existing maintenance trigger
    await notifee.cancelTriggerNotification(MAINTENANCE_NOTIFICATION_ID);

    await notifee.createTriggerNotification(
      {
        id: MAINTENANCE_NOTIFICATION_ID,
        title: 'Updating alarm schedule',
        body: 'Recalculating sunrise and sunset times',
        data: { type: 'maintenance' },
        android: {
          channelId: STATUS_CHANNEL_ID,
          importance: AndroidImportance.LOW,
          visibility: AndroidVisibility.SECRET,
          sound: undefined,
          autoCancel: true,
          ongoing: false,
          asForegroundService: false,
          pressAction: { id: 'default' },
        },
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: next.getTime(),
        alarmManager: {
          type: AlarmType.SET_ALARM_CLOCK,
          allowWhileIdle: true,
        },
      },
    );

    console.log('[Maintenance] Scheduled for', next.toISOString());
  } catch (error) {
    console.warn('[Maintenance] Failed to schedule:', error);
  }
}

/**
 * Run the daily maintenance: recalculate sun times, reschedule all alarms,
 * then schedule the next maintenance run.
 */
export async function runDailyMaintenance(): Promise<void> {
  try {
    console.log('[Maintenance] Running daily recalculation');

    const location = useLocationStore.getState().location;
    if (!location) {
      console.warn('[Maintenance] No location — skipping');
      await scheduleDailyMaintenance();
      return;
    }

    const sunTimes = getSunTimes(location.latitude, location.longitude);
    useAlarmStore.getState().recalculateAllTriggerTimes(sunTimes);

    const enabledAlarms = Object.values(useAlarmStore.getState().alarms).filter(
      (a) => a.isEnabled,
    );

    if (enabledAlarms.length > 0) {
      await scheduleAllAlarms(enabledAlarms, sunTimes);
    }

    await updatePersistentNotification();
    console.log('[Maintenance] Rescheduled', enabledAlarms.length, 'alarms');
  } catch (error) {
    console.error('[Maintenance] Failed:', error);
  }

  // Always reschedule the next maintenance run
  await scheduleDailyMaintenance();
}
