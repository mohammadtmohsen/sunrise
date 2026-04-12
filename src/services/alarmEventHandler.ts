import { Platform } from 'react-native';
import { stopAlarmSound } from './soundService';
import { dismissAlarm, scheduleSnooze } from './alarmScheduler';
import { scheduleNextDayAlarm } from './nextDayScheduler';
import { updatePersistentNotification } from './persistentNotificationService';
import { useAlarmStore } from '../stores/alarmStore';
import { mmkv } from '../stores/storage';
import {
  dismissNativeAlarm,
  cancelNativeAlarm,
  cancelNativeReminder,
} from './nativeAlarmEngine';

/**
 * Central alarm event handler — single source of truth for all alarm lifecycle events.
 *
 * This is a pure imperative service (no React, no hooks) so it works in every context:
 * background event handler, foreground event handler, alarm trigger UI, and
 * native alarm activity.
 */

export async function handleSnooze(alarmId: string): Promise<void> {
  console.log('[handleSnooze] Starting — alarmId:', alarmId);
  await stopAlarmSound();
  console.log('[handleSnooze] Sound stopped');
  // NOTE: Do NOT call dismissNativeAlarm() — same loop prevention as handleDismiss.
  mmkv.delete('pending-alarm-id');
  mmkv.delete('pending-alarm-name');
  console.log('[handleSnooze] MMKV cleared');
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
  console.log('[handleDismiss] Starting — alarmId:', alarmId);
  await stopAlarmSound();
  console.log('[handleDismiss] Sound stopped');
  // NOTE: Do NOT call dismissNativeAlarm() here — handleDismiss is called
  // in response to the native alarmDismissed event, so the service is already stopped.
  // Calling it again creates an infinite loop (dismiss → event → handleDismiss → dismiss → ...).
  if (Platform.OS === 'android') {
    // Cancel any future scheduled alarm/reminder for this ID
    try { await cancelNativeAlarm(alarmId); } catch {}
    try { await cancelNativeReminder(alarmId); } catch {}
  }
  console.log('[handleDismiss] Cleanup done');
  mmkv.delete('pending-alarm-id');
  mmkv.delete('pending-alarm-name');
  console.log('[handleDismiss] MMKV cleared');
  await dismissAlarm(alarmId);
  console.log('[handleDismiss] Alarm dismissed');
  await scheduleNextDayAlarm(alarmId);
  console.log('[handleDismiss] Next day scheduled');
  await updatePersistentNotification();
  console.log('[handleDismiss] Done');
}

export async function handleReminderDismiss(
  alarmId: string,
  notificationId?: string,
): Promise<void> {
  if (Platform.OS === 'android') {
    // Native handles notification cancellation via dismissNativeAlarm
    try { await cancelNativeReminder(alarmId); } catch {}
  } else if (notificationId) {
    // iOS: cancel via expo-notifications
    try {
      const Notifications = require('expo-notifications');
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch {}
  }
  await scheduleNextDayAlarm(alarmId);
  await updatePersistentNotification();
}

export async function handleAlarmDelivered(
  alarmId: string,
  isReminder: boolean,
): Promise<void> {
  console.log('[handleAlarmDelivered] alarmId:', alarmId, 'isReminder:', isReminder);
  if (!isReminder) {
    mmkv.set('pending-alarm-id', alarmId);
    console.log('[handleAlarmDelivered] Set pending-alarm-id in MMKV');
  }
  await updatePersistentNotification();
}

export async function handleAlarmPress(
  alarmId: string,
  isReminder: boolean,
  notificationId?: string,
): Promise<void> {
  console.log('[handleAlarmPress] alarmId:', alarmId, 'isReminder:', isReminder);
  if (isReminder) {
    await handleReminderDismiss(alarmId, notificationId);
  } else {
    mmkv.set('pending-alarm-id', alarmId);
  }
}
