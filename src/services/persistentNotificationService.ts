import notifee, {
  AndroidImportance,
  AndroidStyle,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import { useAlarmStore } from '../stores/alarmStore';
import { useLocationStore } from '../stores/locationStore';
import { useSettingsStore } from '../stores/settingsStore';
import { getSunTimes, isSunTimesValid } from './sunCalcService';
import { STATUS_CHANNEL_ID, STATUS_NOTIFICATION_ID } from '../utils/constants';
import { formatTime, formatTimeUntil } from '../utils/timeUtils';
import type { Alarm, SunTimes } from '../models/types';

/**
 * Find the next enabled alarm that will fire in the future.
 */
function getNextAlarm(alarms: Record<string, Alarm>): Alarm | null {
  const now = Date.now();
  let next: Alarm | null = null;
  let nextTime = Infinity;

  for (const alarm of Object.values(alarms)) {
    if (!alarm.isEnabled || !alarm.nextTriggerAt) continue;
    const triggerAt = new Date(alarm.nextTriggerAt).getTime();
    if (triggerAt > now && triggerAt < nextTime) {
      next = alarm;
      nextTime = triggerAt;
    }
  }

  return next;
}

/**
 * Update or create the persistent status notification.
 * Shows sunrise time and next alarm with a native countdown timer.
 *
 * Should be called whenever alarms, sun times, or settings change.
 * No-op on iOS (iOS does not support ongoing notifications).
 */
export async function updatePersistentNotification(): Promise<void> {
  if (Platform.OS !== 'android') return;

  const { showPersistentNotification } = useSettingsStore.getState();
  if (!showPersistentNotification) {
    await cancelPersistentNotification();
    return;
  }

  try {
    const location = useLocationStore.getState().location;
    const alarms = useAlarmStore.getState().alarms;
    const nextAlarm = getNextAlarm(alarms);

    // Compute sun times
    let sunTimes: SunTimes | null = null;
    if (location) {
      const computed = getSunTimes(location.latitude, location.longitude);
      if (isSunTimesValid(computed)) {
        sunTimes = computed;
      }
    }

    // Build notification content
    const sunriseText = sunTimes
      ? `Sunrise ${formatTime(sunTimes.sunrise)}`
      : null;

    let title: string;
    let body: string;
    let showChronometer = false;
    let timestamp: number | undefined;

    if (nextAlarm && nextAlarm.nextTriggerAt) {
      const triggerAt = new Date(nextAlarm.nextTriggerAt).getTime();
      title = `Next: ${nextAlarm.name}`;
      const parts: string[] = [];
      if (sunriseText) parts.push(sunriseText);
      parts.push(formatTimeUntil(new Date(nextAlarm.nextTriggerAt)));
      body = parts.join(' \u2022 ');
      showChronometer = true;
      timestamp = triggerAt;
    } else {
      title = sunriseText ?? 'Lumora';
      body = 'No active alarms';
    }

    await notifee.displayNotification({
      id: STATUS_NOTIFICATION_ID,
      title,
      body,
      android: {
        channelId: STATUS_CHANNEL_ID,
        ongoing: true,
        autoCancel: false,
        onlyAlertOnce: true,
        importance: AndroidImportance.LOW,
        smallIcon: 'ic_launcher',
        showChronometer,
        chronometerDirection: 'down',
        timestamp,
        pressAction: {
          id: 'default',
          launchActivity: 'default',
        },
        style: {
          type: AndroidStyle.BIGTEXT,
          text: buildExpandedText(sunTimes, nextAlarm),
        },
      },
    });
  } catch (e) {
    console.warn('Failed to update persistent notification:', e);
  }
}

/**
 * Build the expanded (big text) content for the notification.
 */
function buildExpandedText(
  sunTimes: SunTimes | null,
  nextAlarm: Alarm | null,
): string {
  const lines: string[] = [];

  if (sunTimes) {
    lines.push(
      `Sunrise: ${formatTime(sunTimes.sunrise)}  \u2022  Sunset: ${formatTime(sunTimes.sunset)}`,
    );
  }

  if (nextAlarm && nextAlarm.nextTriggerAt) {
    const triggerDate = new Date(nextAlarm.nextTriggerAt);
    lines.push(
      `Next alarm: ${nextAlarm.name} at ${formatTime(triggerDate)}`,
    );
  } else {
    lines.push('No active alarms');
  }

  return lines.join('\n');
}

/**
 * Remove the persistent status notification.
 */
export async function cancelPersistentNotification(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await notifee.cancelNotification(STATUS_NOTIFICATION_ID);
  } catch {
    // May not exist
  }
}
