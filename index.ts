import notifee, { EventType } from '@notifee/react-native';
import { dismissAlarm, scheduleSnooze } from './src/services/alarmScheduler';
import { scheduleNextDayAlarm } from './src/services/nextDayScheduler';
import { useAlarmStore } from './src/stores/alarmStore';

// Register the standalone alarm screen component for Android full-screen intent.
// This must be imported before expo-router/entry so the component is registered
// with AppRegistry before Notifee tries to launch it.
import './src/components/AlarmScreenComponent';

// Define the background recalculation task (must be top-level, before app renders)
import './src/tasks/backgroundRecalculate';

// Register background event handler — runs when app is killed/in background
notifee.onBackgroundEvent(async ({ type, detail }) => {
  const alarmId = detail.notification?.data?.alarmId as string | undefined;
  if (!alarmId) return;

  switch (type) {
    case EventType.PRESS:
      // User pressed the notification — app opens to alarm-trigger screen
      break;
    case EventType.ACTION_PRESS:
      if (detail.pressAction?.id === 'dismiss') {
        await dismissAlarm(alarmId);
        // Schedule next day's occurrence (third leg of triple-redundancy)
        await scheduleNextDayAlarm(alarmId);
      } else if (detail.pressAction?.id === 'snooze') {
        const alarm = useAlarmStore.getState().alarms[alarmId];
        if (alarm) {
          await scheduleSnooze(alarm, alarm.snoozeDurationMinutes);
          await dismissAlarm(alarmId);
        }
      }
      break;
    case EventType.DISMISSED:
      await dismissAlarm(alarmId);
      await scheduleNextDayAlarm(alarmId);
      break;
  }
});

// Register foreground service — keeps alarm sound playing when notification
// is displayed as a foreground service on Android
notifee.registerForegroundService(() => {
  // Return a promise that resolves when the service should stop.
  // The service stays alive until notifee.stopForegroundService() is called
  // from the alarm dismiss/snooze handler.
  return new Promise<void>(() => {
    // Intentionally never resolved — the service runs until explicitly stopped
    // via notifee.stopForegroundService() when the user dismisses or snoozes.
  });
});

// Register Expo Router entry point
import 'expo-router/entry';
