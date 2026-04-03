import notifee, {
  AndroidImportance,
  AndroidVisibility,
  AuthorizationStatus,
  IOSNotificationSetting,
} from '@notifee/react-native';
import { Platform, Linking } from 'react-native';
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

/**
 * Check current notification permission status.
 */
export async function checkNotificationPermission(): Promise<boolean> {
  const settings = await notifee.getNotificationSettings();
  return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
}

/**
 * Check if Critical Alerts are enabled on iOS.
 * Returns true on Android (not applicable).
 */
export async function checkCriticalAlertsPermission(): Promise<boolean> {
  if (Platform.OS !== 'ios') return true;

  const settings = await notifee.getNotificationSettings();
  return settings.ios?.criticalAlert === IOSNotificationSetting.ENABLED;
}

/**
 * Check Android battery optimization status.
 */
export async function checkBatteryOptimization(): Promise<{
  isOptimized: boolean;
  hasPowerManager: boolean;
}> {
  if (Platform.OS !== 'android') {
    return { isOptimized: false, hasPowerManager: false };
  }

  const isOptimized = await notifee.isBatteryOptimizationEnabled();
  const powerInfo = await notifee.getPowerManagerInfo();

  return {
    isOptimized,
    hasPowerManager: powerInfo.activity !== null,
  };
}

export async function openBatterySettings(): Promise<void> {
  await notifee.openBatteryOptimizationSettings();
}

export async function openPowerManagerSettings(): Promise<void> {
  await notifee.openPowerManagerSettings();
}

export async function openAlarmPermissionSettings(): Promise<void> {
  await notifee.openAlarmPermissionSettings();
}

/**
 * Check if full-screen intent permission is granted (Android 14+).
 * Required for the alarm to show a full-screen UI over the lock screen.
 */
/**
 * Check if full-screen intent permission is likely needed.
 * On Android 14+ (API 34), USE_FULL_SCREEN_INTENT must be explicitly granted.
 */
export function needsFullScreenIntentPermission(): boolean {
  if (Platform.OS !== 'android') return false;
  return Platform.Version >= 34;
}

/**
 * Open the system settings page where users can enable full-screen intent permission.
 * Required on Android 14+ for the alarm to show over the lock screen.
 */
export async function openFullScreenIntentSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Linking.sendIntent(
      'android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT',
      [{ key: 'package', value: 'com.lumora.app' }],
    );
  } catch {
    // Fallback to app notification settings if the intent isn't available
    await notifee.openNotificationSettings();
  }
}

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
