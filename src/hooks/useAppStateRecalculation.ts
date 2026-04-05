import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAlarmStore } from '../stores/alarmStore';
import { useLocationStore } from '../stores/locationStore';
import { getSunTimes, isSunTimesValid } from '../services/sunCalcService';
import { scheduleAllAlarms } from '../services/alarmScheduler';
import { updatePersistentNotification } from '../services/persistentNotificationService';
import { getTodayDateString } from '../utils/timeUtils';

/**
 * Second leg of triple-redundancy: recalculate alarms when app comes to foreground.
 *
 * Checks if the cached sun times are stale (different date) and, if so,
 * recalculates trigger times and reschedules all enabled alarms.
 */
export function useAppStateRecalculation() {
  const lastRecalcDate = useRef<string>(getTodayDateString());

  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (nextState !== 'active') return;

      // Always update persistent notification on resume — clears stale
      // chronometer, refreshes alarm list, and corrects badge count
      await updatePersistentNotification();

      const today = getTodayDateString();
      // Only recalculate sun times if the date has changed since last calculation
      if (lastRecalcDate.current === today) return;
      lastRecalcDate.current = today;

      const location = useLocationStore.getState().location;
      if (!location) return;

      const sunTimes = getSunTimes(location.latitude, location.longitude);
      if (!isSunTimesValid(sunTimes)) return;

      // Update store trigger times
      useAlarmStore.getState().recalculateAllTriggerTimes(sunTimes);

      // Reschedule all enabled alarms
      const enabledAlarms = Object.values(
        useAlarmStore.getState().alarms,
      ).filter((a) => a.isEnabled);

      if (enabledAlarms.length > 0) {
        await scheduleAllAlarms(enabledAlarms, sunTimes);
      }

      await updatePersistentNotification();
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);
}
