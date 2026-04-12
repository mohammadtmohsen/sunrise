import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { AlarmEngine } = NativeModules;
const emitter =
  Platform.OS === 'android' ? new NativeEventEmitter(AlarmEngine) : null;

// ─── Alarm Scheduling ──────────────────────────────────────────

export async function scheduleNativeAlarm(params: {
  alarmId: string;
  triggerTime: Date;
  title: string;
  body: string;
  soundUri?: string | null;
  vibrate?: boolean;
  snoozeDurationMinutes?: number;
  repeatMode?: string;
}): Promise<void> {
  if (Platform.OS !== 'android') return;
  await AlarmEngine.scheduleAlarm(
    params.alarmId,
    params.triggerTime.getTime(),
    params.title,
    params.body,
    params.soundUri ?? null,
    params.vibrate ?? true,
    params.snoozeDurationMinutes ?? 5,
    params.repeatMode ?? 'once',
  );
}

export async function cancelNativeAlarm(alarmId: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  await AlarmEngine.cancelAlarm(alarmId);
}

export async function dismissNativeAlarm(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await AlarmEngine.dismissAlarm();
}

export async function snoozeNativeAlarm(
  alarmId: string,
  durationMinutes: number,
): Promise<void> {
  if (Platform.OS !== 'android') return;
  await AlarmEngine.snoozeAlarm(alarmId, durationMinutes * 60 * 1000);
}

// ─── Reminder Scheduling ───────────────────────────────────────

export async function scheduleNativeReminder(params: {
  alarmId: string;
  triggerTime: Date;
  title: string;
  body: string;
  soundUri?: string | null;
  vibrate?: boolean;
  repeatMode?: string;
}): Promise<void> {
  if (Platform.OS !== 'android') return;
  await AlarmEngine.scheduleReminder(
    params.alarmId,
    params.triggerTime.getTime(),
    params.title,
    params.body,
    params.soundUri ?? null,
    params.vibrate ?? true,
    params.repeatMode ?? 'once',
  );
}

export async function cancelNativeReminder(alarmId: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  await AlarmEngine.cancelReminder(alarmId);
}

// ─── Persistent Notification ───────────────────────────────────

export async function showNativePersistentNotification(params: {
  title: string;
  body: string;
  chronoBase: number; // ms timestamp for countdown
  expandedLines: string[];
}): Promise<void> {
  if (Platform.OS !== 'android') return;
  await AlarmEngine.showPersistentNotification(
    params.title,
    params.body,
    params.chronoBase,
    params.expandedLines,
  );
}

export async function hideNativePersistentNotification(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await AlarmEngine.hidePersistentNotification();
}

// ─── Notification Channels ─────────────────────────────────────

export async function createNativeNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await AlarmEngine.createNotificationChannels();
}

// ─── Maintenance & Refresh ─────────────────────────────────────

export async function scheduleNativeDailyMaintenance(
  triggerTime: Date,
): Promise<void> {
  if (Platform.OS !== 'android') return;
  await AlarmEngine.scheduleDailyMaintenance(triggerTime.getTime());
}

export async function cancelNativeDailyMaintenance(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await AlarmEngine.cancelDailyMaintenance();
}

export async function scheduleNativeNotificationRefresh(
  triggerTime: Date,
): Promise<void> {
  if (Platform.OS !== 'android') return;
  await AlarmEngine.scheduleNotificationRefresh(triggerTime.getTime());
}

export async function cancelNativeNotificationRefresh(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await AlarmEngine.cancelNotificationRefresh();
}

// ─── Permissions ───────────────────────────────────────────────

export async function getNativeNotificationSettings(): Promise<{
  alarm: boolean;
  notifications: boolean;
  batteryOptimized: boolean;
}> {
  if (Platform.OS !== 'android')
    return { alarm: true, notifications: true, batteryOptimized: false };
  return await AlarmEngine.getNotificationSettings();
}

/**
 * Get alarmIds that were dismissed as "once" alarms while JS was not running.
 * Returns the IDs and clears the native flags.
 */
export async function getDismissedOnceAlarms(): Promise<string[]> {
  if (Platform.OS !== 'android') return [];
  return await AlarmEngine.getDismissedOnceAlarms();
}

export async function openNativeBatteryOptimizationSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await AlarmEngine.openBatteryOptimizationSettings();
}

export async function openNativeAlarmPermissionSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await AlarmEngine.openAlarmPermissionSettings();
}

export async function openNativeNotificationSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await AlarmEngine.openNotificationSettings();
}

export async function openNativePowerManagerSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await AlarmEngine.openPowerManagerSettings();
}

export async function checkNativeBatteryOptimization(): Promise<{
  isOptimized: boolean;
  hasPowerManager: boolean;
}> {
  if (Platform.OS !== 'android')
    return { isOptimized: false, hasPowerManager: false };
  return await AlarmEngine.checkBatteryOptimization();
}

// ─── Event Listeners ───────────────────────────────────────────

export function onAlarmDismissed(
  callback: (alarmId: string) => void,
): () => void {
  if (!emitter) return () => {};
  const sub = emitter.addListener('alarmDismissed', (event) =>
    callback(event.alarmId),
  );
  return () => sub.remove();
}

export function onAlarmSnoozed(
  callback: (alarmId: string, snoozeDuration: number) => void,
): () => void {
  if (!emitter) return () => {};
  const sub = emitter.addListener('alarmSnoozed', (event) =>
    callback(event.alarmId, event.snoozeDuration),
  );
  return () => sub.remove();
}

export function onReminderDelivered(
  callback: (alarmId: string) => void,
): () => void {
  if (!emitter) return () => {};
  const sub = emitter.addListener('reminderDelivered', (event) =>
    callback(event.alarmId),
  );
  return () => sub.remove();
}

export function onReminderDismissed(
  callback: (alarmId: string) => void,
): () => void {
  if (!emitter) return () => {};
  const sub = emitter.addListener('reminderDismissed', (event) =>
    callback(event.alarmId),
  );
  return () => sub.remove();
}

export function onMaintenanceTriggered(callback: () => void): () => void {
  if (!emitter) return () => {};
  const sub = emitter.addListener('maintenanceTriggered', () => callback());
  return () => sub.remove();
}

export function onRefreshTriggered(callback: () => void): () => void {
  if (!emitter) return () => {};
  const sub = emitter.addListener('refreshTriggered', () => callback());
  return () => sub.remove();
}
