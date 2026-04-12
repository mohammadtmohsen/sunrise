import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Alarm, SunTimes } from '../models/types';
import {
  computeTriggerTime,
  computeAbsoluteTriggerTime,
  computeNextTriggerForDays,
  computeNextRelativeTriggerForDays,
  formatTime,
  formatTime24,
  formatOffset,
  formatRepeatDays,
} from '../utils/timeUtils';
import { scheduleNotificationRefresh } from './notificationRefreshService';
import {
  scheduleNativeAlarm,
  cancelNativeAlarm,
  cancelNativeReminder,
  scheduleNativeReminder,
  snoozeNativeAlarm,
  dismissNativeAlarm,
  getNativeNotificationSettings,
  openNativeAlarmPermissionSettings,
} from './nativeAlarmEngine';

/**
 * Ensure Android exact alarm permission is granted.
 * On Android 12+, SCHEDULE_EXACT_ALARM must be explicitly enabled by the user.
 * Returns true if scheduling can proceed.
 */
async function ensureExactAlarmPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  try {
    const settings = await getNativeNotificationSettings();
    if (settings.alarm) return true;

    // Wait for user to choose an action before returning
    const granted = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Exact Alarm Permission Required',
        'Lumora needs "Alarms & reminders" permission to schedule alarms. Please enable it in Settings, then save the alarm again.',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          {
            text: 'Open Settings',
            onPress: async () => {
              try {
                await openNativeAlarmPermissionSettings();
              } catch {
                // Settings may not be available
              }
              resolve(false);
            },
          },
        ],
        { cancelable: false },
      );
    });

    return granted;
  } catch {
    // If we can't check, try anyway
    return true;
  }
}

/**
 * Compute the trigger time for an alarm based on its type.
 * - Relative: sunEventTime + offsetMinutes
 * - Absolute: next occurrence of absoluteHour:absoluteMinute
 */
function getAlarmTriggerTime(
  alarm: Alarm,
  sunTimes: SunTimes | null,
): Date | null {
  const hasDays = alarm.repeatDays && alarm.repeatDays.length > 0;

  if (alarm.type === 'absolute') {
    return hasDays
      ? computeNextTriggerForDays(alarm.absoluteHour, alarm.absoluteMinute, alarm.repeatDays)
      : computeAbsoluteTriggerTime(alarm.absoluteHour, alarm.absoluteMinute);
  }

  // Relative alarm requires sun times
  if (!sunTimes) return null;
  const eventTime = sunTimes[alarm.referenceEvent];
  if (hasDays) {
    return computeNextRelativeTriggerForDays(eventTime, alarm.offsetMinutes, alarm.repeatDays);
  }
  const triggerTime = computeTriggerTime(eventTime, alarm.offsetMinutes);
  // If trigger time is past, shift to next day so re-enabled "once" alarms
  // and freshly scheduled alarms always resolve to a future occurrence
  if (triggerTime.getTime() <= Date.now()) {
    const nextDay = new Date(triggerTime);
    nextDay.setDate(nextDay.getDate() + 1);
    return nextDay;
  }
  return triggerTime;
}

/**
 * Build the notification body text based on alarm type.
 */
function getAlarmBody(alarm: Alarm, triggerTime: Date): string {
  const repeatLabel = formatRepeatDays(alarm.repeatMode, alarm.repeatDays);
  if (alarm.type === 'absolute') {
    return `${repeatLabel} at ${formatTime24(alarm.absoluteHour, alarm.absoluteMinute)}`;
  }
  const eventLabel = alarm.referenceEvent === 'sunrise' ? 'Sunrise' : 'Sunset';
  const offsetLabel = formatOffset(alarm.offsetMinutes);
  return `${offsetLabel} ${eventLabel.toLowerCase()} \u2022 ${repeatLabel} \u2022 ${formatTime(triggerTime)}`;
}

export type ScheduleFailure =
  | 'disabled'
  | 'no-sun-times'
  | 'past-time'
  | 'no-permission'
  | 'error';

export type ScheduleResult =
  | { success: true; notificationId: string; triggerTime: Date }
  | { success: false; reason: ScheduleFailure };

/**
 * Schedule a single alarm.
 * - Android alarm-style: uses native AlarmEngine
 * - Android reminder-style: uses native AlarmEngine reminder
 * - iOS: uses expo-notifications
 *
 * sunTimes can be null for absolute alarms (they don't depend on sun position).
 */
export async function scheduleAlarm(
  alarm: Alarm,
  sunTimes: SunTimes | null,
): Promise<ScheduleResult> {
  if (!alarm.isEnabled) return { success: false, reason: 'disabled' };

  const triggerTime = getAlarmTriggerTime(alarm, sunTimes);
  if (!triggerTime) return { success: false, reason: 'no-sun-times' };

  // If trigger time is in the past, don't schedule
  if (triggerTime.getTime() <= Date.now()) {
    return { success: false, reason: 'past-time' };
  }

  // Ensure exact alarm permission on Android 12+
  const canSchedule = await ensureExactAlarmPermission();
  if (!canSchedule) return { success: false, reason: 'no-permission' };

  // Cancel existing notification for this alarm if any
  await cancelAlarm(alarm);

  const body = getAlarmBody(alarm, triggerTime);

  const isReminder = alarm.alarmStyle === 'reminder';

  try {
    if (Platform.OS === 'android') {
      if (isReminder) {
        // REMINDER style on Android: use native AlarmEngine reminder
        await scheduleNativeReminder({
          alarmId: alarm.id,
          triggerTime,
          title: alarm.name,
          body,
          soundUri: alarm.soundUri,
          vibrate: alarm.vibrate,
          repeatMode: alarm.repeatMode,
        });
        console.log(
          '[scheduleAlarm] Native reminder scheduled:', alarm.id,
          'at', triggerTime.toISOString(),
          '| in', Math.round((triggerTime.getTime() - Date.now()) / 1000), 'seconds',
        );
      } else {
        // ALARM style on Android: use native AlarmEngine for 100% reliable
        // fullscreen alarm, sound, and lock screen support on Android 14+/15.
        await scheduleNativeAlarm({
          alarmId: alarm.id,
          triggerTime,
          title: alarm.name,
          body,
          soundUri: alarm.soundUri,
          vibrate: alarm.vibrate,
          snoozeDurationMinutes: alarm.snoozeDurationMinutes,
          repeatMode: alarm.repeatMode,
        });
        console.log(
          '[scheduleAlarm] Native alarm scheduled:', alarm.id,
          'at', triggerTime.toISOString(),
          '| in', Math.round((triggerTime.getTime() - Date.now()) / 1000), 'seconds',
        );
      }
      return { success: true, notificationId: alarm.id, triggerTime };
    }

    // iOS: use expo-notifications
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: alarm.name,
        body,
        sound: isReminder ? 'default' : 'alarm-default.caf',
        data: {
          alarmId: alarm.id,
          alarmName: alarm.name,
          type: 'alarm-trigger',
          isReminder: isReminder ? 'true' : 'false',
        },
        categoryIdentifier: isReminder ? undefined : 'alarm-actions',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerTime,
      },
    });

    console.log(
      '[scheduleAlarm] expo-notifications scheduled:', alarm.id,
      'at', triggerTime.toISOString(),
      '| in', Math.round((triggerTime.getTime() - Date.now()) / 1000), 'seconds',
      '| style:', alarm.alarmStyle,
    );
    return { success: true, notificationId, triggerTime };
  } catch (error) {
    console.error('[scheduleAlarm] Failed to schedule alarm:', error);
    return { success: false, reason: 'error' };
  }
}

/**
 * Cancel a scheduled alarm notification and any active snooze.
 */
export async function cancelAlarm(alarm: Alarm): Promise<void> {
  if (Platform.OS === 'android') {
    // Cancel both native alarm and reminder since we don't always know which type was scheduled
    try { await cancelNativeAlarm(alarm.id); } catch {}
    try { await cancelNativeReminder(alarm.id); } catch {}
  } else {
    // iOS: cancel via expo-notifications
    const ids = [alarm.id, `${alarm.id}-snooze`];
    for (const id of ids) {
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
      } catch {
        // Notification may not exist
      }
    }
  }
}

/**
 * Schedule all enabled alarms. Used after sun time recalculation.
 */
export async function scheduleAllAlarms(
  alarms: Alarm[],
  sunTimes: SunTimes | null,
): Promise<Record<string, ScheduleResult>> {
  const results: Record<string, ScheduleResult> = {};

  for (const alarm of alarms) {
    if (alarm.isEnabled) {
      results[alarm.id] = await scheduleAlarm(alarm, sunTimes);
    }
  }

  // Schedule periodic notification refresh once (not per-alarm)
  await scheduleNotificationRefresh();

  return results;
}

/**
 * Cancel all alarm notifications.
 */
export async function cancelAllAlarms(alarms: Alarm[]): Promise<void> {
  for (const alarm of alarms) {
    await cancelAlarm(alarm);
  }
}

/**
 * Schedule a snooze alarm. Fires after snoozeDurationMinutes from now.
 */
export async function scheduleSnooze(
  alarm: Alarm,
  snoozeDurationMinutes: number,
): Promise<string> {
  const snoozeTime = Date.now() + snoozeDurationMinutes * 60 * 1000;

  if (Platform.OS === 'android') {
    await snoozeNativeAlarm(alarm.id, snoozeDurationMinutes);
    return `${alarm.id}-snooze`;
  }

  // iOS: use expo-notifications for snooze
  const notificationId = await Notifications.scheduleNotificationAsync({
    identifier: `${alarm.id}-snooze`,
    content: {
      title: `${alarm.name} (Snoozed)`,
      body: `Alarm in ${snoozeDurationMinutes} minutes`,
      sound: 'alarm-default.caf',
      data: {
        alarmId: alarm.id,
        alarmName: alarm.name,
        type: 'alarm-trigger',
        isSnooze: 'true',
      },
      categoryIdentifier: 'alarm-actions',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(snoozeTime),
    },
  });

  return notificationId;
}

// Re-export for backwards compatibility with dynamic requires in index.ts
export { scheduleNotificationRefresh } from './notificationRefreshService';

/**
 * Dismiss an active alarm — cancel notification + stop native alarm service.
 */
export async function dismissAlarm(alarmId: string): Promise<void> {
  if (Platform.OS === 'android') {
    // Dismiss active native alarm (stops sound, cancels notifications)
    try { await dismissNativeAlarm(); } catch {}
    // Also cancel any scheduled alarm/reminder for cleanup
    try { await cancelNativeAlarm(alarmId); } catch {}
    try { await cancelNativeReminder(alarmId); } catch {}
  } else {
    // iOS: cancel any pending notifications
    const ids = [alarmId, `${alarmId}-snooze`];
    for (const id of ids) {
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
      } catch {
        // May not exist
      }
    }
  }
}
