import { AppRegistry, Platform } from 'react-native';
import { scheduleAllAlarms } from './src/services/alarmScheduler';
import { updatePersistentNotification } from './src/services/persistentNotificationService';
import { getSunTimes } from './src/services/sunCalcService';
import { useAlarmStore } from './src/stores/alarmStore';
import { useLocationStore } from './src/stores/locationStore';

// Define the background recalculation task (must be top-level, before app renders)
import './src/tasks/backgroundRecalculate';

// Register headless JS task for rescheduling alarms after device reboot.
// BootAlarmReceiver (native BroadcastReceiver) starts BootAlarmTaskService on BOOT_COMPLETED,
// which invokes this task to reschedule all enabled alarms immediately.
AppRegistry.registerHeadlessTask('RESCHEDULE_ALARMS_ON_BOOT', () => async () => {
  try {
    console.log('[BootTask] Rescheduling alarms after reboot');
    const location = useLocationStore.getState().location;
    if (!location) {
      console.warn('[BootTask] No location stored — skipping');
      return;
    }

    const sunTimes = getSunTimes(location.latitude, location.longitude);
    useAlarmStore.getState().recalculateAllTriggerTimes(sunTimes);

    const enabledAlarms = Object.values(useAlarmStore.getState().alarms).filter(
      (a) => a.isEnabled,
    );

    if (enabledAlarms.length > 0) {
      await scheduleAllAlarms(enabledAlarms, sunTimes);
    }

    await updatePersistentNotification();

    // Ensure the daily maintenance alarm and periodic refresh are scheduled after reboot
    const { scheduleDailyMaintenance: schedMaint } = require('./src/services/maintenanceScheduler');
    await schedMaint();
    const { scheduleNotificationRefresh: schedRefresh } = require('./src/services/notificationRefreshService');
    await schedRefresh();

    console.log('[BootTask] Done — rescheduled', enabledAlarms.length, 'alarms');
  } catch (error) {
    console.error('[BootTask] Failed to reschedule alarms:', error);
  }
});

// Register Expo Router entry point
import 'expo-router/entry';
