import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Router } from 'expo-router';
import { useAlarmStore } from '../stores/alarmStore';
import {
  handleSnooze,
  handleDismiss,
  handleReminderDismiss,
  handleAlarmDelivered,
  handleAlarmPress,
} from '../services/alarmEventHandler';
import { updatePersistentNotification } from '../services/persistentNotificationService';
import { scheduleNotificationRefresh } from '../services/notificationRefreshService';
import { runDailyMaintenance } from '../services/maintenanceScheduler';
import {
  onAlarmDismissed,
  onAlarmSnoozed,
  onReminderDelivered,
  onReminderDismissed,
  onMaintenanceTriggered,
  onRefreshTriggered,
} from '../services/nativeAlarmEngine';

/**
 * Subscribes to alarm events from native AlarmEngine (Android)
 * and expo-notifications (iOS), dispatching them to the central alarm event handler.
 */
export function useNotificationEvents(router: Router) {
  useEffect(() => {
    const cleanups: (() => void)[] = [];

    if (Platform.OS === 'android') {
      // Native AlarmEngine event listeners
      cleanups.push(
        onAlarmDismissed((alarmId) => {
          // Ignore 'unknown' — fired by cleanup dismissNativeAlarm() on app init
          if (!alarmId || alarmId === 'unknown') return;
          console.log('[NativeEvent] alarmDismissed:', alarmId);
          handleDismiss(alarmId);
        }),
      );

      cleanups.push(
        onAlarmSnoozed((alarmId, _snoozeDuration) => {
          if (!alarmId || alarmId === 'unknown') return;
          console.log('[NativeEvent] alarmSnoozed:', alarmId);
          handleSnooze(alarmId);
        }),
      );

      cleanups.push(
        onReminderDelivered((alarmId) => {
          console.log('[NativeEvent] reminderDelivered:', alarmId);
          handleAlarmDelivered(alarmId, true);
        }),
      );

      cleanups.push(
        onReminderDismissed((alarmId) => {
          if (!alarmId || alarmId === 'unknown') return;
          console.log('[NativeEvent] reminderDismissed:', alarmId);
          handleReminderDismiss(alarmId);
        }),
      );

      cleanups.push(
        onMaintenanceTriggered(() => {
          console.log('[NativeEvent] maintenanceTriggered');
          runDailyMaintenance().then(() => updatePersistentNotification());
        }),
      );

      cleanups.push(
        onRefreshTriggered(() => {
          console.log('[NativeEvent] refreshTriggered');
          updatePersistentNotification().then(() => scheduleNotificationRefresh());
        }),
      );
    }

    if (Platform.OS === 'ios') {
      // iOS: expo-notifications listeners

      // When a notification is received while app is in foreground
      const receivedSub = Notifications.addNotificationReceivedListener(
        (notification) => {
          const data = notification.request.content.data;
          const alarmId = data?.alarmId as string | undefined;
          const isAlarm = data?.type === 'alarm-trigger';

          if (!alarmId || !isAlarm) return;

          const alarm = useAlarmStore.getState().alarms[alarmId];
          const isReminder = alarm?.alarmStyle === 'reminder';
          handleAlarmDelivered(alarmId, !!isReminder);
        },
      );
      cleanups.push(() => receivedSub.remove());

      // When user interacts with a notification (tap, action button)
      const responseSub = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          const data = response.notification.request.content.data;
          const alarmId = data?.alarmId as string | undefined;
          const isAlarm = data?.type === 'alarm-trigger';
          const actionId = response.actionIdentifier;
          const notificationId = response.notification.request.identifier;

          if (!alarmId || !isAlarm) return;

          const alarm = useAlarmStore.getState().alarms[alarmId];
          const isReminder = alarm?.alarmStyle === 'reminder';

          if (actionId === 'snooze') {
            handleSnooze(alarmId);
          } else if (actionId === 'dismiss') {
            if (isReminder) {
              handleReminderDismiss(alarmId, notificationId);
            } else {
              handleDismiss(alarmId);
            }
          } else if (actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
            // User tapped the notification itself
            if (isReminder) {
              handleAlarmPress(alarmId, true, notificationId);
            } else {
              console.log('[iOSEvent] PRESS — navigating to alarm-trigger');
              router.push({ pathname: '/alarm-trigger', params: { alarmId } });
            }
          }
        },
      );
      cleanups.push(() => responseSub.remove());
    }

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [router]);
}
