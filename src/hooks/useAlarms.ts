import { useCallback, useEffect } from 'react';
import { useAlarmStore } from '../stores/alarmStore';
import {
  scheduleAlarm,
  cancelAlarm,
  scheduleAllAlarms,
} from '../services/alarmScheduler';
import type { SunTimes } from '../models/types';

export function useAlarms(sunTimes: SunTimes | null) {
  const {
    alarms,
    addAlarm,
    updateAlarm,
    deleteAlarm,
    toggleAlarm,
    recalculateAllTriggerTimes,
    getAlarmsArray,
    getEnabledAlarms,
  } = useAlarmStore();

  // Recalculate trigger times and reschedule when sun times change
  useEffect(() => {
    if (sunTimes) {
      recalculateAllTriggerTimes(sunTimes);
    }
    // Reschedule all enabled alarms (works for both relative and absolute)
    const enabled = Object.values(useAlarmStore.getState().alarms).filter(
      (a) => a.isEnabled,
    );
    if (enabled.length > 0) {
      scheduleAllAlarms(enabled, sunTimes);
    }
  }, [sunTimes?.date, sunTimes?.sunrise.getTime(), sunTimes?.sunset.getTime()]);

  const handleToggle = useCallback(
    async (id: string) => {
      toggleAlarm(id);
      const alarm = useAlarmStore.getState().alarms[id];
      if (!alarm) return;

      if (alarm.isEnabled) {
        // Was just enabled — schedule it
        // Absolute alarms don't need sunTimes, relative ones do
        const notificationId = await scheduleAlarm(alarm, sunTimes);
        if (notificationId) {
          updateAlarm(id, { notificationId });
        }
      } else {
        // Was just disabled — cancel it
        await cancelAlarm(alarm);
        updateAlarm(id, { notificationId: null });
      }
    },
    [sunTimes, toggleAlarm, updateAlarm],
  );

  return {
    alarms: getAlarmsArray(),
    enabledAlarms: getEnabledAlarms(),
    addAlarm,
    updateAlarm,
    deleteAlarm,
    toggleAlarm: handleToggle,
  };
}
