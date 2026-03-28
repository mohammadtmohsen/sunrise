import notifee, { EventType } from '@notifee/react-native';
import { Linking, Platform } from 'react-native';
import { dismissAlarm, scheduleSnooze } from './src/services/alarmScheduler';
import { scheduleNextDayAlarm } from './src/services/nextDayScheduler';
import { updatePersistentNotification } from './src/services/persistentNotificationService';
import { playAlarmSound, stopAlarmSound } from './src/services/soundService';
import { useAlarmStore } from './src/stores/alarmStore';
import { mmkv } from './src/stores/storage';

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
    case EventType.DELIVERED:
      // Alarm just fired in background — store for when app opens
      console.log(
        '[BackgroundEvent] DELIVERED — storing pending alarm:',
        alarmId,
      );
      mmkv.set('pending-alarm-id', alarmId);
      break;
    case EventType.PRESS:
      // User tapped notification — store for when app opens
      console.log('[BackgroundEvent] PRESS — storing pending alarm:', alarmId);
      mmkv.set('pending-alarm-id', alarmId);
      break;
    case EventType.ACTION_PRESS:
      if (detail.pressAction?.id === 'dismiss') {
        await stopAlarmSound();
        await dismissAlarm(alarmId);
        await scheduleNextDayAlarm(alarmId);
        await updatePersistentNotification();
      } else if (detail.pressAction?.id === 'snooze') {
        await stopAlarmSound();
        const alarm = useAlarmStore.getState().alarms[alarmId];
        if (alarm) {
          await scheduleSnooze(alarm, alarm.snoozeDurationMinutes);
          await dismissAlarm(alarmId);
        }
        await updatePersistentNotification();
      }
      break;
    case EventType.DISMISSED:
      await stopAlarmSound();
      await dismissAlarm(alarmId);
      await scheduleNextDayAlarm(alarmId);
      await updatePersistentNotification();
      break;
  }
});

// Register foreground service — plays alarm sound continuously on Android
// when the alarm notification fires. Runs until stopForegroundService() is called.
notifee.registerForegroundService((notification) => {
  return new Promise<void>((resolve) => {
    const alarmId = notification?.data?.alarmId as string | undefined;
    console.log('[ForegroundService] Started — alarmId:', alarmId);
    if (alarmId) {
      mmkv.set('pending-alarm-id', alarmId);
    }
    playAlarmSound().catch((error) => {
      console.error('[ForegroundService] Failed to play alarm sound:', error);
    });

    // Directly launch the app to foreground over lock screen.
    // This bypasses MIUI/OEM ROMs that block Android's fullScreenIntent API.
    // Uses the app's deep link scheme to call startActivity() directly.
    if (Platform.OS === 'android') {
      setTimeout(() => {
        Linking.openURL('lumora://alarm-trigger').catch((err) => {
          console.warn('[ForegroundService] Failed to launch app:', err);
        });
      }, 800);
    }

    // Auto-cleanup after 5 minutes to prevent zombie foreground services
    setTimeout(() => {
      console.log('[ForegroundService] Auto-cleanup after timeout');
      stopAlarmSound().catch(() => {});
      resolve();
    }, 5 * 60 * 1000);
  });
});

// Register Expo Router entry point
import 'expo-router/entry';
