import { useAlarmStore } from '../stores/alarmStore';
import { useLocationStore } from '../stores/locationStore';
import { getTomorrowSunTimes, isSunTimesValid } from './sunCalcService';
import { scheduleAlarm } from './alarmScheduler';
import { updatePersistentNotification } from './persistentNotificationService';

/**
 * Third leg of triple-redundancy: when an alarm is dismissed,
 * immediately schedule tomorrow's occurrence.
 *
 * For absolute alarms: no sun times needed, schedules next day directly.
 * For relative alarms: computes tomorrow's sun times first.
 */
export async function scheduleNextDayAlarm(alarmId: string): Promise<void> {
  const alarm = useAlarmStore.getState().alarms[alarmId];
  if (!alarm || !alarm.isEnabled) return;

  // "Once" alarms auto-disable after firing — don't reschedule
  if (alarm.repeatMode === 'once') {
    useAlarmStore.getState().updateAlarm(alarmId, {
      isEnabled: false,
      nextTriggerAt: null,
      notificationId: null,
    });
    await updatePersistentNotification();
    return;
  }

  if (alarm.type === 'absolute') {
    const result = await scheduleAlarm(alarm, null);
    if (result.success) {
      useAlarmStore.getState().updateAlarm(alarmId, { notificationId: result.notificationId });
    }
    await updatePersistentNotification();
    return;
  }

  // Relative alarm — need tomorrow's sun times
  const location = useLocationStore.getState().location;
  if (!location) return;

  const tomorrowSunTimes = getTomorrowSunTimes(
    location.latitude,
    location.longitude,
  );

  if (!isSunTimesValid(tomorrowSunTimes)) return;

  const result = await scheduleAlarm(alarm, tomorrowSunTimes);
  if (result.success) {
    useAlarmStore.getState().updateAlarm(alarmId, { notificationId: result.notificationId });
  }
  await updatePersistentNotification();
}
