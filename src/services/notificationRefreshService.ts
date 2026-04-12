import { Platform } from 'react-native';
import {
  scheduleNativeNotificationRefresh,
  cancelNativeNotificationRefresh,
} from './nativeAlarmEngine';

/**
 * Schedule the next periodic notification refresh.
 * Fires every 15 minutes to keep the expanded notification countdown fresh,
 * even when the app is killed. Each refresh re-schedules the next one,
 * creating a self-sustaining chain.
 *
 * Android-only — iOS does not have persistent notifications.
 */
export async function scheduleNotificationRefresh(): Promise<void> {
  if (Platform.OS !== 'android') return;

  const refreshAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now

  try {
    await cancelNativeNotificationRefresh();
    await scheduleNativeNotificationRefresh(refreshAt);
  } catch (e) {
    console.warn('[scheduleNotificationRefresh] Failed:', e);
  }
}
