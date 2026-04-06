import notifee, {
  AndroidImportance,
  AndroidVisibility,
  AuthorizationStatus,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import { ALARM_CHANNEL_ID, REMINDER_CHANNEL_ID, STATUS_CHANNEL_ID } from '../utils/constants';

/**
 * Delete old channel versions that are now superseded.
 * Android channels are immutable once created — sound/importance settings
 * cannot be changed. We use versioned channel IDs and delete old ones.
 */
async function deleteOldChannels(): Promise<void> {
  const oldChannels = [
    'alarm-channel', 'alarm-channel-v1',
    'reminder-channel', 'reminder-channel-v1',
    'status-channel', 'status-channel-v1',
  ];
  for (const id of oldChannels) {
    try { await notifee.deleteChannel(id); } catch { /* may not exist */ }
  }
}

/**
 * Set up the Android notification channel for alarms.
 * Must be called before scheduling any notification.
 */
export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await deleteOldChannels();

  await notifee.createChannel({
    id: ALARM_CHANNEL_ID,
    name: 'Alarms',
    description: 'Sunrise and sunset alarm notifications',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    sound: 'default',
    vibration: true,
    bypassDnd: true,
  });
}

/**
 * Set up the Android notification channel for reminders.
 * High importance with sound enabled so reminders are audible.
 */
export async function setupReminderNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await notifee.createChannel({
    id: REMINDER_CHANNEL_ID,
    name: 'Reminders',
    description: 'Simple reminder notifications',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    sound: 'default',
    vibration: true,
    bypassDnd: true,
  });
}

/**
 * Set up the Android notification channel for the persistent status notification.
 * Uses LOW importance so it appears silently in the shade without sound/vibration.
 */
export async function setupStatusNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await notifee.createChannel({
    id: STATUS_CHANNEL_ID,
    name: 'Alarm Status',
    description:
      'Always-visible notification showing sunrise time and next alarm',
    importance: AndroidImportance.LOW,
    visibility: AndroidVisibility.PUBLIC,
    sound: undefined,
    vibration: false,
  });
}

/**
 * Request notification permission.
 * On iOS, also requests Critical Alerts permission (requires Apple entitlement).
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const settings = await notifee.requestPermission({
      alert: true,
      badge: true,
      sound: true,
      criticalAlert: true, // Requires Apple entitlement — will silently be ignored if not granted
      announcement: false,
      provisional: false,
    });
    return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
  }

  // Android
  const settings = await notifee.requestPermission();
  return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
}

// Re-export permission functions for backwards compatibility
export {
  checkNotificationPermission,
  checkCriticalAlertsPermission,
  checkBatteryOptimization,
  openBatterySettings,
  openPowerManagerSettings,
  openAlarmPermissionSettings,
  needsFullScreenIntentPermission,
  openFullScreenIntentSettings,
} from './permissionService';

/**
 * Set up iOS notification categories with Dismiss and Snooze actions.
 * These appear as buttons on the notification on iOS.
 */
export async function setupIOSCategories(): Promise<void> {
  if (Platform.OS !== 'ios') return;

  await notifee.setNotificationCategories([
    {
      id: 'alarm-actions',
      actions: [
        {
          id: 'dismiss',
          title: 'Dismiss',
          destructive: true,
          foreground: false, // Can be handled in background
        },
        {
          id: 'snooze',
          title: 'Snooze',
          destructive: false,
          foreground: false,
        },
      ],
    },
  ]);
}
