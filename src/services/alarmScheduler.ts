import notifee, {
  TriggerType,
  AndroidCategory,
  AndroidImportance,
  AndroidVisibility,
  AndroidStyle,
  AndroidLaunchActivityFlag,
  AlarmType,
} from '@notifee/react-native';
import { Platform, Alert, Linking } from 'react-native';
import type { Alarm, SunTimes } from '../models/types';
import {
  computeTriggerTime,
  computeAbsoluteTriggerTime,
  formatTime,
  formatTime24,
  formatOffset,
} from '../utils/timeUtils';
import { ALARM_CHANNEL_ID, REMINDER_CHANNEL_ID } from '../utils/constants';
import { useSettingsStore } from '../stores/settingsStore';

/**
 * Ensure Android exact alarm permission is granted.
 * On Android 12+, SCHEDULE_EXACT_ALARM must be explicitly enabled by the user.
 * Returns true if scheduling can proceed.
 */
async function ensureExactAlarmPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  try {
    const settings = await notifee.getNotificationSettings();
    // android.alarm is 1 (ENABLED) if exact alarms are allowed
    if (settings.android?.alarm === 1) return true;

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
                await notifee.openAlarmPermissionSettings();
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
 * Detect Xiaomi/Redmi/POCO devices running MIUI/HyperOS.
 */
function isXiaomiDevice(): boolean {
  if (Platform.OS !== 'android') return false;
  const constants = Platform.constants as Record<string, unknown>;
  const brand = String(constants.Brand ?? '').toLowerCase();
  const manufacturer = String(constants.Manufacturer ?? '').toLowerCase();
  return (
    brand.includes('xiaomi') ||
    brand.includes('redmi') ||
    brand.includes('poco') ||
    manufacturer.includes('xiaomi')
  );
}

/**
 * Prompt user to enable permissions required for alarms to show over the lock screen.
 * On Xiaomi/Redmi (MIUI), the standard Android full-screen intent setting doesn't exist —
 * users need to enable Autostart + "Display pop-up windows while running in background".
 */
export async function promptFullScreenIntentPermission(): Promise<void> {
  if (Platform.OS !== 'android') return;

  if (isXiaomiDevice()) {
    await new Promise<void>((resolve) => {
      Alert.alert(
        'Xiaomi/Redmi: Extra Permissions Needed',
        'For alarms to show over the lock screen, please enable these settings:\n\n'
        + '1. Settings > Apps > Manage apps > Lumora > Autostart → Enable\n\n'
        + '2. Settings > Apps > Manage apps > Lumora > Other permissions → Enable "Display pop-up windows while running in the background"\n\n'
        + '3. Settings > Battery > Lumora → Set to "No restrictions"\n\n'
        + 'Tap "Open Settings" to go to the app info page.',
        [
          { text: 'Later', style: 'cancel', onPress: () => resolve() },
          {
            text: 'Open Settings',
            onPress: async () => {
              try {
                await Linking.openSettings();
              } catch {
                // ignore
              }
              resolve();
            },
          },
          {
            text: 'Battery Settings',
            onPress: async () => {
              try {
                await notifee.openBatteryOptimizationSettings();
              } catch {
                try { await Linking.openSettings(); } catch { /* ignore */ }
              }
              resolve();
            },
          },
        ],
        { cancelable: false },
      );
    });
    return;
  }

  // Standard Android — prompt for full-screen intent permission
  await new Promise<void>((resolve) => {
    Alert.alert(
      'Full-Screen Alarm Permission',
      'To show alarms over the lock screen, please enable "Full-screen notifications" for Lumora in Settings.',
      [
        { text: 'Later', style: 'cancel', onPress: () => resolve() },
        {
          text: 'Open Settings',
          onPress: async () => {
            try {
              await Linking.sendIntent(
                'android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT',
                [{ key: 'package', value: 'com.lumora.app' }],
              );
            } catch {
              try {
                await notifee.openNotificationSettings();
              } catch {
                // ignore
              }
            }
            resolve();
          },
        },
      ],
      { cancelable: false },
    );
  });
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

export type ScheduleFailure =
  | 'disabled'
  | 'no-sun-times'
  | 'past-time'
  | 'no-permission'
  | 'error';

export type ScheduleResult =
  | { success: true; notificationId: string }
  | { success: false; reason: ScheduleFailure };

/**
 * Schedule a single alarm via Notifee.
 * Supports both relative (sunrise/sunset) and absolute (fixed time) alarms.
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
  const hasCustomReminderSound = !!useSettingsStore.getState().customReminderSoundUri;

  try {
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
        android: isReminder
          ? {
              channelId: REMINDER_CHANNEL_ID,
              importance: AndroidImportance.HIGH,
              visibility: AndroidVisibility.PUBLIC,
              sound: hasCustomReminderSound ? undefined : 'default',
              vibrationPattern: [100, 200],
              lightUpScreen: true,
              autoCancel: false,
              ongoing: false,
              asForegroundService: hasCustomReminderSound,
              pressAction: { id: 'default' },
              actions: [
                {
                  title: 'Dismiss',
                  pressAction: { id: 'dismiss' },
                },
              ],
              style: {
                type: AndroidStyle.BIGTEXT,
                text: `${alarm.name}\n${body}`,
              },
            }
          : {
              channelId: ALARM_CHANNEL_ID,
              category: AndroidCategory.ALARM,
              importance: AndroidImportance.HIGH,
              visibility: AndroidVisibility.PUBLIC,
              sound: 'default',
              vibrationPattern: [500, 200, 500, 200],
              lightUpScreen: true,
              autoCancel: false,
              ongoing: true,
              badgeCount: 0,
              asForegroundService: true,
              fullScreenAction: {
                id: 'default',
                launchActivity: 'default',
                launchActivityFlags: [AndroidLaunchActivityFlag.NEW_TASK],
              },
              pressAction: {
                id: 'default',
                launchActivity: 'default',
                launchActivityFlags: [AndroidLaunchActivityFlag.NEW_TASK],
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
        ios: isReminder
          ? {
              sound: 'default',
              interruptionLevel: 'timeSensitive',
              foregroundPresentationOptions: {
                banner: true,
                sound: true,
                badge: true,
                list: true,
              },
            }
          : {
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
          allowWhileIdle: true,
        },
      },
    );

    console.log('[scheduleAlarm] Scheduled:', alarm.id, 'at', triggerTime.toISOString());
    return { success: true, notificationId };
  } catch (error) {
    console.error('[scheduleAlarm] Failed to create trigger notification:', error);
    return { success: false, reason: 'error' };
  }
}

/**
 * Cancel a scheduled alarm notification and any active snooze.
 */
export async function cancelAlarm(alarm: Alarm): Promise<void> {
  const ids = [alarm.id, `${alarm.id}-snooze`, `${alarm.id}-persist`, `${alarm.id}-watch`];
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
): Promise<Record<string, ScheduleResult>> {
  const results: Record<string, ScheduleResult> = {};

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
        vibrationPattern: [500, 200, 500, 200],
        lightUpScreen: true,
        autoCancel: false,
        ongoing: true,
        asForegroundService: true,
        fullScreenAction: {
          id: 'default',
          mainComponent: 'alarm-screen',
          launchActivity: 'default',
          launchActivityFlags: [AndroidLaunchActivityFlag.NEW_TASK],
        },
        pressAction: {
          id: 'default',
          launchActivity: 'default',
          launchActivityFlags: [AndroidLaunchActivityFlag.NEW_TASK],
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
        allowWhileIdle: true,
      },
    },
  );

  return notificationId;
}

/**
 * Dismiss an active alarm — cancel notification + stop foreground service.
 */
export async function dismissAlarm(alarmId: string): Promise<void> {
  const ids = [alarmId, `${alarmId}-snooze`, `${alarmId}-persist`, `${alarmId}-watch`];
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
