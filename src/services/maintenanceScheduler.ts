import { Platform } from 'react-native';
import { useAlarmStore } from '../stores/alarmStore';
import { useLocationStore } from '../stores/locationStore';
import { getSunTimes } from './sunCalcService';
import { scheduleAllAlarms } from './alarmScheduler';
import { updatePersistentNotification } from './persistentNotificationService';
import {
  scheduleNativeDailyMaintenance,
  cancelNativeDailyMaintenance,
} from './nativeAlarmEngine';

/**
 * Schedule a silent daily maintenance alarm.
 * Fires even in Doze mode. Uses exact-idle (not SET_ALARM_CLOCK) to avoid
 * competing with real user alarms for the highest-priority alarm slot.
 *
 * Runs at ~2:30 AM daily to recalculate sun times and reschedule all alarms.
 * Android-only.
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
    await cancelNativeDailyMaintenance();
    await scheduleNativeDailyMaintenance(next);

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
