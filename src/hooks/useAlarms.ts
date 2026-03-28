import { useCallback, useEffect, useMemo } from 'react';
import { useAlarmStore } from '../stores/alarmStore';
import {
  scheduleAlarm,
  cancelAlarm,
  scheduleAllAlarms,
} from '../services/alarmScheduler';
import { updatePersistentNotification } from '../services/persistentNotificationService';
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

  // Stable key that changes when alarm IDs, types, offsets, or enabled state change
  // but NOT when nextTriggerAt or notificationId change (which recalculate sets)
  const alarmFingerprint = useMemo(() => {
    return Object.values(alarms)
      .map((a) => `${a.id}:${a.type}:${a.referenceEvent}:${a.offsetMinutes}:${a.absoluteHour}:${a.absoluteMinute}:${a.isEnabled}`)
      .sort()
      .join('|');
  }, [alarms]);

  // Recalculate trigger times when alarm config or sun times change
  useEffect(() => {
    recalculateAllTriggerTimes(sunTimes);

    const enabled = Object.values(useAlarmStore.getState().alarms).filter(
      (a) => a.isEnabled,
    );
    if (enabled.length > 0) {
      scheduleAllAlarms(enabled, sunTimes).then(() => updatePersistentNotification());
    } else {
      updatePersistentNotification();
    }
  }, [alarmFingerprint, sunTimes?.date, sunTimes?.sunrise?.getTime(), sunTimes?.sunset?.getTime()]);

  const handleToggle = useCallback(
    async (id: string) => {
      toggleAlarm(id);
      const alarm = useAlarmStore.getState().alarms[id];
      if (!alarm) return;

      if (alarm.isEnabled) {
        // Was just enabled — schedule it
        // Absolute alarms don't need sunTimes, relative ones do
        const result = await scheduleAlarm(alarm, sunTimes);
        if (result.success) {
          updateAlarm(id, { notificationId: result.notificationId });
        }
      } else {
        // Was just disabled — cancel it
        await cancelAlarm(alarm);
        updateAlarm(id, { notificationId: null });
      }
      updatePersistentNotification();
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
