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
  const alarms = useAlarmStore((s) => s.alarms);
  const addAlarm = useAlarmStore((s) => s.addAlarm);
  const updateAlarm = useAlarmStore((s) => s.updateAlarm);
  const deleteAlarm = useAlarmStore((s) => s.deleteAlarm);
  const toggleAlarm = useAlarmStore((s) => s.toggleAlarm);
  const recalculateAllTriggerTimes = useAlarmStore((s) => s.recalculateAllTriggerTimes);

  // Stable sorted array — only recomputes when the alarms record changes
  const alarmsArray = useMemo(() => {
    return Object.values(alarms).sort((a, b) => {
      const aTime = a.nextTriggerAt ? new Date(a.nextTriggerAt).getTime() : Infinity;
      const bTime = b.nextTriggerAt ? new Date(b.nextTriggerAt).getTime() : Infinity;
      return aTime - bTime;
    });
  }, [alarms]);

  const enabledAlarms = useMemo(() => {
    return Object.values(alarms).filter((a) => a.isEnabled);
  }, [alarms]);

  // Stable key that changes when alarm IDs, types, offsets, or enabled state change
  // but NOT when nextTriggerAt or notificationId change (which recalculate sets)
  const alarmFingerprint = useMemo(() => {
    return Object.values(alarms)
      .map((a) => `${a.id}:${a.type}:${a.referenceEvent}:${a.offsetMinutes}:${a.absoluteHour}:${a.absoluteMinute}:${a.isEnabled}:${a.repeatMode}:${(a.repeatDays ?? []).join(',')}`)
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
          updateAlarm(id, {
            notificationId: result.notificationId,
            nextTriggerAt: result.triggerTime.toISOString(),
          });
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
    alarms: alarmsArray,
    enabledAlarms,
    addAlarm,
    updateAlarm,
    deleteAlarm,
    toggleAlarm: handleToggle,
  };
}
