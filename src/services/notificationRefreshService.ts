import notifee, {
  TriggerType,
  AlarmType,
  AndroidImportance,
  AndroidVisibility,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import { REFRESH_NOTIFICATION_ID, STATUS_CHANNEL_ID } from '../utils/constants';

/**
 * Schedule the next periodic notification refresh.
 * Fires every 15 minutes to keep the expanded notification countdown fresh,
 * even when the app is killed. Each refresh re-schedules the next one,
 * creating a self-sustaining chain.
 *
 * Uses SET_EXACT_AND_ALLOW_WHILE_IDLE (not SET_ALARM_CLOCK) to avoid
 * competing with real alarms for the highest-priority alarm slot.
 */
export async function scheduleNotificationRefresh(): Promise<void> {
  if (Platform.OS !== 'android') return;

  const refreshAt = Date.now() + 15 * 60 * 1000; // 15 minutes from now

  try {
    await notifee.cancelTriggerNotification(REFRESH_NOTIFICATION_ID);
    await notifee.createTriggerNotification(
      {
        id: REFRESH_NOTIFICATION_ID,
        title: 'Updating alarm status',
        body: '',
        data: { type: 'notification-refresh' },
        android: {
          channelId: STATUS_CHANNEL_ID,
          importance: AndroidImportance.LOW,
          visibility: AndroidVisibility.SECRET,
          sound: undefined,
          autoCancel: true,
          ongoing: false,
          asForegroundService: false,
          pressAction: { id: 'default' },
        },
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: refreshAt,
        alarmManager: {
          type: AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE,
          allowWhileIdle: true,
        },
      },
    );
  } catch (e) {
    console.warn('[scheduleNotificationRefresh] Failed:', e);
  }
}
