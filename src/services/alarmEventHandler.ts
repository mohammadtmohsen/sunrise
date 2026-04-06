import { stopAlarmSound } from './soundService';
import { dismissAlarm, scheduleSnooze } from './alarmScheduler';
import { scheduleNextDayAlarm } from './nextDayScheduler';
import { updatePersistentNotification } from './persistentNotificationService';
import { useAlarmStore } from '../stores/alarmStore';
import { mmkv } from '../stores/storage';
import notifee from '@notifee/react-native';

/**
 * Central alarm event handler — single source of truth for all alarm lifecycle events.
 *
 * This is a pure imperative service (no React, no hooks) so it works in every context:
 * background event handler, foreground event handler, alarm trigger UI, and
 * Notifee full-screen component.
 */

export async function handleSnooze(alarmId: string): Promise<void> {
  await stopAlarmSound();
  const alarm = useAlarmStore.getState().alarms[alarmId];
  if (alarm) {
    await scheduleSnooze(alarm, alarm.snoozeDurationMinutes);
    const snoozeAt = new Date(Date.now() + alarm.snoozeDurationMinutes * 60 * 1000);
    useAlarmStore.getState().updateAlarm(alarmId, {
      nextTriggerAt: snoozeAt.toISOString(),
    });
  }
  await dismissAlarm(alarmId);
  await updatePersistentNotification();
}

export async function handleDismiss(alarmId: string): Promise<void> {
  await stopAlarmSound();
  await dismissAlarm(alarmId);
  await scheduleNextDayAlarm(alarmId);
  await updatePersistentNotification();
}

export async function handleReminderDismiss(
  alarmId: string,
  notificationId?: string,
): Promise<void> {
  if (notificationId) {
    try {
      await notifee.cancelNotification(notificationId);
    } catch {}
  }
  await scheduleNextDayAlarm(alarmId);
  await updatePersistentNotification();
}

export async function handleAlarmDelivered(
  alarmId: string,
  isReminder: boolean,
): Promise<void> {
  if (!isReminder) {
    mmkv.set('pending-alarm-id', alarmId);
  }
  await updatePersistentNotification();
}

export async function handleAlarmPress(
  alarmId: string,
  isReminder: boolean,
  notificationId?: string,
): Promise<void> {
  if (isReminder) {
    await handleReminderDismiss(alarmId, notificationId);
  } else {
    mmkv.set('pending-alarm-id', alarmId);
  }
}
