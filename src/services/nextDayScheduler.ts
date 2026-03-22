import { useAlarmStore } from '../stores/alarmStore';
import { useLocationStore } from '../stores/locationStore';
import { getTomorrowSunTimes, isSunTimesValid } from './sunCalcService';
import { scheduleAlarm } from './alarmScheduler';

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

  if (alarm.type === 'absolute') {
    // Absolute alarms don't need sun times
    const notificationId = await scheduleAlarm(alarm, null);
    if (notificationId) {
      useAlarmStore.getState().updateAlarm(alarmId, { notificationId });
    }
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

  const notificationId = await scheduleAlarm(alarm, tomorrowSunTimes);
  if (notificationId) {
    useAlarmStore.getState().updateAlarm(alarmId, { notificationId });
  }
}
