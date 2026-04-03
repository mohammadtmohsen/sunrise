import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAlarmStore } from '../stores/alarmStore';
import { useLocationStore } from '../stores/locationStore';
import { getSunTimes, isSunTimesValid } from '../services/sunCalcService';
import { scheduleAlarm } from '../services/alarmScheduler';
import { updatePersistentNotification } from '../services/persistentNotificationService';

/**
 * When the app returns to foreground, check for enabled alarms that have no
 * notificationId (i.e. scheduling previously failed — e.g. permission was
 * missing). Attempt to reschedule them now that the user may have granted
 * the required permissions.
 */
export function useRescheduleOnResume() {
  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (nextState !== 'active') return;

      const alarms = useAlarmStore.getState().alarms;
      const unscheduled = Object.values(alarms).filter(
        (a) => a.isEnabled && !a.notificationId,
      );
      if (unscheduled.length === 0) return;

      const location = useLocationStore.getState().location;
      const sunTimes =
        location
          ? getSunTimes(location.latitude, location.longitude)
          : null;

      if (sunTimes && !isSunTimesValid(sunTimes)) return;

      for (const alarm of unscheduled) {
        const result = await scheduleAlarm(alarm, sunTimes);
        if (result.success) {
          useAlarmStore.getState().updateAlarm(alarm.id, {
            notificationId: result.notificationId,
            nextTriggerAt: result.triggerTime.toISOString(),
          });
        }
      }

      await updatePersistentNotification();
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);
}
