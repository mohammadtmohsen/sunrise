import notifee, {
  TriggerType,
  AndroidCategory,
  AndroidImportance,
  AndroidVisibility,
  AndroidStyle,
  AlarmType,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import type { Alarm, SunTimes } from '../models/types';
import {
  computeTriggerTime,
  computeAbsoluteTriggerTime,
  formatTime,
  formatTime24,
  formatOffset,
} from '../utils/timeUtils';
import { ALARM_CHANNEL_ID } from '../utils/constants';

/**
 * Compute the trigger time for an alarm based on its type.
 * - Relative: sunEventTime + offsetMinutes
 * - Absolute: next occurrence of absoluteHour:absoluteMinute
 */
function getAlarmTriggerTime(alarm: Alarm, sunTimes: SunTimes | null): Date | null {
  if (alarm.type === 'absolute') {
    return computeAbsoluteTriggerTime(alarm.absoluteHour, alarm.absoluteMinute);
  }

  // Relative alarm requires sun times
  if (!sunTimes) return null;
  const eventTime = sunTimes[alarm.referenceEvent];
  return computeTriggerTime(eventTime, alarm.offsetMinutes);
}

/**
 * Build the notification body text based on alarm type.
 */
function getAlarmBody(alarm: Alarm, triggerTime: Date): string {
  if (alarm.type === 'absolute') {
    return `Daily at ${formatTime24(alarm.absoluteHour, alarm.absoluteMinute)}`;
  }
  const eventLabel = alarm.referenceEvent === 'sunrise' ? 'Sunrise' : 'Sunset';
  const offsetLabel = formatOffset(alarm.offsetMinutes);
  return `${offsetLabel} ${eventLabel.toLowerCase()} \u2022 ${formatTime(triggerTime)}`;
}

/**
 * Schedule a single alarm via Notifee.
 * Supports both relative (sunrise/sunset) and absolute (fixed time) alarms.
 *
 * sunTimes can be null for absolute alarms (they don't depend on sun position).
 */
export async function scheduleAlarm(
  alarm: Alarm,
  sunTimes: SunTimes | null,
): Promise<string | null> {
  if (!alarm.isEnabled) return null;

  const triggerTime = getAlarmTriggerTime(alarm, sunTimes);
  if (!triggerTime) return null;

  // If trigger time is in the past, don't schedule
  if (triggerTime.getTime() <= Date.now()) {
    return null;
  }

  // Cancel existing notification for this alarm if any
  await cancelAlarm(alarm);

  const body = getAlarmBody(alarm, triggerTime);

  const notificationId = await notifee.createTriggerNotification(
    {
      id: alarm.id,
      title: alarm.name,
      body,
      data: {
        alarmId: alarm.id,
        alarmName: alarm.name,
        type: 'alarm-trigger',
      },
      android: {
        channelId: ALARM_CHANNEL_ID,
        category: AndroidCategory.ALARM,
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        sound: 'default',
        vibrationPattern: [0, 500, 200, 500, 200, 500],
        lightUpScreen: true,
        autoCancel: false,
        ongoing: true,
        asForegroundService: true,
        fullScreenAction: {
          id: 'default',
          mainComponent: 'alarm-screen',
        },
        pressAction: {
          id: 'default',
          launchActivity: 'default',
        },
        actions: [
          {
            title: 'Dismiss',
            pressAction: { id: 'dismiss' },
          },
          {
            title: 'Snooze',
            pressAction: { id: 'snooze' },
          },
        ],
        style: {
          type: AndroidStyle.BIGTEXT,
          text: `${alarm.name}\n${body}`,
        },
      },
      ios: {
        critical: true,
        criticalVolume: 1.0,
        sound: 'alarm-default.caf',
        interruptionLevel: 'timeSensitive',
        categoryId: 'alarm-actions',
        foregroundPresentationOptions: {
          banner: true,
          sound: true,
          badge: false,
          list: true,
        },
      },
    },
    {
      type: TriggerType.TIMESTAMP,
      timestamp: triggerTime.getTime(),
      alarmManager: {
        type: AlarmType.SET_ALARM_CLOCK,
      },
    },
  );

  return notificationId;
}

/**
 * Cancel a scheduled alarm notification and any active snooze.
 */
export async function cancelAlarm(alarm: Alarm): Promise<void> {
  const ids = [alarm.id, `${alarm.id}-snooze`];
  for (const id of ids) {
    try {
      await notifee.cancelNotification(id);
    } catch {
      // Notification may not exist
    }
    try {
      await notifee.cancelTriggerNotification(id);
    } catch {
      // Trigger may not exist
    }
  }
}

/**
 * Schedule all enabled alarms. Used after sun time recalculation.
 */
export async function scheduleAllAlarms(
  alarms: Alarm[],
  sunTimes: SunTimes | null,
): Promise<Record<string, string | null>> {
  const results: Record<string, string | null> = {};

  for (const alarm of alarms) {
    if (alarm.isEnabled) {
      results[alarm.id] = await scheduleAlarm(alarm, sunTimes);
    }
  }

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

  const notificationId = await notifee.createTriggerNotification(
    {
      id: `${alarm.id}-snooze`,
      title: `${alarm.name} (Snoozed)`,
      body: `Alarm in ${snoozeDurationMinutes} minutes`,
      data: {
        alarmId: alarm.id,
        alarmName: alarm.name,
        type: 'alarm-trigger',
        isSnooze: 'true',
      },
      android: {
        channelId: ALARM_CHANNEL_ID,
        category: AndroidCategory.ALARM,
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        sound: 'default',
        vibrationPattern: [0, 500, 200, 500, 200, 500],
        lightUpScreen: true,
        autoCancel: false,
        ongoing: true,
        asForegroundService: true,
        fullScreenAction: {
          id: 'default',
          mainComponent: 'alarm-screen',
        },
        pressAction: {
          id: 'default',
          launchActivity: 'default',
        },
        actions: [
          {
            title: 'Dismiss',
            pressAction: { id: 'dismiss' },
          },
          {
            title: 'Snooze',
            pressAction: { id: 'snooze' },
          },
        ],
      },
      ios: {
        critical: true,
        criticalVolume: 1.0,
        sound: 'alarm-default.caf',
        interruptionLevel: 'timeSensitive',
        categoryId: 'alarm-actions',
        foregroundPresentationOptions: {
          banner: true,
          sound: true,
          badge: false,
          list: true,
        },
      },
    },
    {
      type: TriggerType.TIMESTAMP,
      timestamp: snoozeTime,
      alarmManager: {
        type: AlarmType.SET_ALARM_CLOCK,
      },
    },
  );

  return notificationId;
}

/**
 * Dismiss an active alarm — cancel notification + stop foreground service.
 */
export async function dismissAlarm(alarmId: string): Promise<void> {
  const ids = [alarmId, `${alarmId}-snooze`];
  for (const id of ids) {
    try {
      await notifee.cancelNotification(id);
    } catch {
      // May not exist
    }
  }
  try {
    await notifee.stopForegroundService();
  } catch {
    // May not be running
  }
}
