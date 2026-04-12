import { Platform, PermissionsAndroid } from 'react-native';
import * as Notifications from 'expo-notifications';
import { createNativeNotificationChannels } from './nativeAlarmEngine';

/**
 * Set up notification channels on Android.
 * Native AlarmEngine creates all channels (alarm, reminder, status) in one call.
 */
export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await createNativeNotificationChannels();
}

/**
 * Request notification permission.
 * On iOS, requests alert, badge, sound, and critical alert permissions.
 * On Android 13+, requests POST_NOTIFICATIONS runtime permission + creates channels.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowCriticalAlerts: true,
      },
    });
    return status === 'granted';
  }

  // Android — create channels + request POST_NOTIFICATIONS on Android 13+
  await createNativeNotificationChannels();

  if (Number(Platform.Version) >= 33) {
    try {
      const result = await PermissionsAndroid.request(
        'android.permission.POST_NOTIFICATIONS' as any,
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }

  return true;
}

/**
 * Set up iOS notification categories with Dismiss and Snooze actions.
 * These appear as buttons on the notification on iOS.
 */
export async function setupIOSCategories(): Promise<void> {
  if (Platform.OS !== 'ios') return;

  await Notifications.setNotificationCategoryAsync('alarm-actions', [
    {
      identifier: 'dismiss',
      buttonTitle: 'Dismiss',
      options: {
        isDestructive: true,
      },
    },
    {
      identifier: 'snooze',
      buttonTitle: 'Snooze',
    },
  ]);
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
