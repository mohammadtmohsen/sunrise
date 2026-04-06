import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAlarmStore } from '../stores/alarmStore';
import { useLocationStore } from '../stores/locationStore';
import { getSunTimes, isSunTimesValid } from '../services/sunCalcService';
import { scheduleAlarm, scheduleAllAlarms } from '../services/alarmScheduler';
import { updatePersistentNotification } from '../services/persistentNotificationService';
import { getTodayDateString } from '../utils/timeUtils';

/**
 * Combined AppState handler for alarm recalculation and rescheduling.
 *
 * On every resume:
 *  1. Update persistent notification (clear stale chronometer)
 *  2. If date changed, recalculate sun times and reschedule all alarms
 *  3. Retry any enabled alarms that failed to schedule (e.g. permission was missing)
 *
 * Uses a single AppState listener to avoid duplicate work.
 */
export function useAppStateRecalculation() {
  const lastRecalcDate = useRef<string>(getTodayDateString());

  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (nextState !== 'active') return;

      const location = useLocationStore.getState().location;
      const sunTimes = location
        ? getSunTimes(location.latitude, location.longitude)
        : null;

      // --- Date-change recalculation ---
      const today = getTodayDateString();
      if (lastRecalcDate.current !== today) {
        lastRecalcDate.current = today;

        if (sunTimes && isSunTimesValid(sunTimes)) {
          useAlarmStore.getState().recalculateAllTriggerTimes(sunTimes);

          const enabledAlarms = Object.values(
            useAlarmStore.getState().alarms,
          ).filter((a) => a.isEnabled);

          if (enabledAlarms.length > 0) {
            await scheduleAllAlarms(enabledAlarms, sunTimes);
          }
        }
      }

      // --- Retry unscheduled alarms ---
      const alarms = useAlarmStore.getState().alarms;
      const unscheduled = Object.values(alarms).filter(
        (a) => a.isEnabled && !a.notificationId,
      );

      if (unscheduled.length > 0 && (!sunTimes || isSunTimesValid(sunTimes))) {
        for (const alarm of unscheduled) {
          const result = await scheduleAlarm(alarm, sunTimes);
          if (result.success) {
            useAlarmStore.getState().updateAlarm(alarm.id, {
              notificationId: result.notificationId,
              nextTriggerAt: result.triggerTime.toISOString(),
            });
          }
        }
      }

      // Single persistent notification update at the end
      await updatePersistentNotification();
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);
}
