import { useEffect } from 'react';
import notifee, { EventType } from '@notifee/react-native';
import type { Router } from 'expo-router';
import { useAlarmStore } from '../stores/alarmStore';
import {
  handleSnooze,
  handleDismiss,
  handleReminderDismiss,
  handleAlarmPress,
} from '../services/alarmEventHandler';

/**
 * Subscribes to Notifee foreground events and dispatches them
 * to the central alarm event handler.
 */
export function useNotificationEvents(router: Router) {
  useEffect(() => {
    const unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
      const alarmId = detail.notification?.data?.alarmId as string | undefined;
      const isAlarm = detail.notification?.data?.type === 'alarm-trigger';

      console.log(
        '[ForegroundEvent] type:',
        type,
        'alarmId:',
        alarmId,
        'isAlarm:',
        isAlarm,
      );

      const alarm = alarmId ? useAlarmStore.getState().alarms[alarmId] : null;
      const isReminder = alarm?.alarmStyle === 'reminder';

      switch (type) {
        case EventType.DELIVERED:
          // Full alarms are handled by the foreground service (stores pending-alarm-id + deep link)
          break;
        case EventType.PRESS:
          if (isAlarm && alarmId && !isReminder) {
            console.log('[ForegroundEvent] PRESS — navigating to alarm-trigger');
            router.push({ pathname: '/alarm-trigger', params: { alarmId } });
          }
          if (isAlarm && alarmId && isReminder) {
            handleAlarmPress(alarmId, true, detail.notification?.id);
          }
          break;
        case EventType.ACTION_PRESS:
          if (detail.pressAction?.id === 'snooze' && alarmId) {
            handleSnooze(alarmId);
          } else if (detail.pressAction?.id === 'dismiss' && alarmId) {
            handleDismiss(alarmId);
          }
          break;
        case EventType.DISMISSED:
          if (isAlarm && alarmId && isReminder) {
            handleReminderDismiss(alarmId, detail.notification?.id);
          }
          break;
      }
    });

    return unsubscribe;
  }, [router]);
}
