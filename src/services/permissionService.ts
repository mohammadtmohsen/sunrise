import notifee, {
  AuthorizationStatus,
  IOSNotificationSetting,
} from '@notifee/react-native';
import { Platform, Alert, Linking } from 'react-native';

/**
 * Detect Xiaomi/Redmi/POCO devices running MIUI/HyperOS.
 */
export function isXiaomiDevice(): boolean {
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
