import notifee, {
  EventType,
  AndroidImportance,
  AndroidVisibility,
} from '@notifee/react-native';
import { AppRegistry, Linking, Platform } from 'react-native';
import { dismissAlarm, scheduleSnooze } from './src/services/alarmScheduler';
import { scheduleAllAlarms } from './src/services/alarmScheduler';
import { scheduleNextDayAlarm } from './src/services/nextDayScheduler';
import { updatePersistentNotification } from './src/services/persistentNotificationService';
import { getSunTimes } from './src/services/sunCalcService';
import { playAlarmSound, stopAlarmSound } from './src/services/soundService';
import { useAlarmStore } from './src/stores/alarmStore';
import { useLocationStore } from './src/stores/locationStore';
import { mmkv } from './src/stores/storage';
import { ALARM_CHANNEL_ID, ALARM_GROUP_ID } from './src/utils/constants';
import { runDailyMaintenance } from './src/services/maintenanceScheduler';

// Register the standalone alarm screen component for Android full-screen intent.
// This must be imported before expo-router/entry so the component is registered
// with AppRegistry before Notifee tries to launch it.
import './src/components/AlarmScreenComponent';

// Define the background recalculation task (must be top-level, before app renders)
import './src/tasks/backgroundRecalculate';

// Register background event handler — runs when app is killed/in background
notifee.onBackgroundEvent(async ({ type, detail }) => {
  // Daily maintenance alarm — recalculate sun times and reschedule all alarms
  if (detail.notification?.data?.type === 'maintenance') {
    if (type === EventType.DELIVERED) {
      await runDailyMaintenance();
      // Cancel the notification immediately — it's invisible housekeeping
      if (detail.notification?.id) {
        await notifee.cancelNotification(detail.notification.id);
      }
    }
    return;
  }

  // Periodic notification refresh — keeps expanded countdown fresh every 15 min
  if (detail.notification?.data?.type === 'notification-refresh') {
    if (type === EventType.DELIVERED) {
      await updatePersistentNotification();
      // Re-schedule the next refresh to keep the chain going
      const { scheduleNotificationRefresh } = require('./src/services/alarmScheduler');
      await scheduleNotificationRefresh();
      if (detail.notification?.id) {
        await notifee.cancelNotification(detail.notification.id);
      }
    }
    return;
  }

  const alarmId = detail.notification?.data?.alarmId as string | undefined;
  if (!alarmId) return;

  const alarm = useAlarmStore.getState().alarms[alarmId];
  const isReminder = alarm?.alarmStyle === 'reminder';

  switch (type) {
    case EventType.DELIVERED:
      if (isReminder) {
        // Reminder — don't store pending alarm, just let notification stay visible
        console.log('[BackgroundEvent] DELIVERED reminder — updating persistent notification');
      } else {
        // Full alarm — store for when app opens
        console.log('[BackgroundEvent] DELIVERED — storing pending alarm:', alarmId);
        mmkv.set('pending-alarm-id', alarmId);
      }
      // Update persistent notification immediately so chronometer switches to next alarm
      // instead of counting past zero on the fired alarm
      await updatePersistentNotification();
      break;
    case EventType.PRESS:
      if (isReminder) {
        // Reminder tapped — cancel notification and schedule next day
        if (detail.notification?.id) {
          await notifee.cancelNotification(detail.notification.id);
        }
        await scheduleNextDayAlarm(alarmId);
        await updatePersistentNotification();
      } else {
        // Full alarm tapped — store for when app opens
        console.log('[BackgroundEvent] PRESS — storing pending alarm:', alarmId);
        mmkv.set('pending-alarm-id', alarmId);
      }
      break;
    case EventType.ACTION_PRESS:
      if (detail.pressAction?.id === 'dismiss') {
        await stopAlarmSound();
        await dismissAlarm(alarmId);
        await scheduleNextDayAlarm(alarmId);
        await updatePersistentNotification();
      } else if (detail.pressAction?.id === 'snooze') {
        await stopAlarmSound();
        if (alarm) {
          await scheduleSnooze(alarm, alarm.snoozeDurationMinutes);
          // Update nextTriggerAt to snooze time so persistent notification shows correct countdown
          const snoozeAt = new Date(Date.now() + alarm.snoozeDurationMinutes * 60 * 1000);
          useAlarmStore.getState().updateAlarm(alarmId, {
            nextTriggerAt: snoozeAt.toISOString(),
          });
          await dismissAlarm(alarmId);
        }
        await updatePersistentNotification();
      }
      break;
    case EventType.DISMISSED:
      if (isReminder) {
        // Reminder swiped away — schedule next day
        await scheduleNextDayAlarm(alarmId);
        await updatePersistentNotification();
      } else {
        await stopAlarmSound();
        await dismissAlarm(alarmId);
        await scheduleNextDayAlarm(alarmId);
        await updatePersistentNotification();
      }
      break;
  }
});

// Register foreground service — plays alarm sound continuously on Android
// when the alarm notification fires. Runs until stopForegroundService() is called.
notifee.registerForegroundService((notification) => {
  return new Promise<void>((resolve) => {
    const alarmId = notification?.data?.alarmId as string | undefined;
    console.log('[ForegroundService] Started — alarmId:', alarmId);

    const alarm = alarmId ? useAlarmStore.getState().alarms[alarmId] : null;

    // Only full alarms use the foreground service (reminders fire as regular notifications)
    if (alarmId) {
      mmkv.set('pending-alarm-id', alarmId);
    }
    // Update persistent notification immediately so it shows next alarm, not the one that just fired
    updatePersistentNotification().catch(() => {});

    playAlarmSound().catch((error) => {
      console.error('[ForegroundService] Failed to play alarm sound:', error);
    });

    // Create a regular notification that bridges to connected watches (Wear OS / Galaxy Watch).
    // Foreground service notifications don't bridge, so this companion notification does.
    if (alarmId) {
      notifee.displayNotification({
        id: `${alarmId}-watch`,
        title: notification.title ?? 'Alarm',
        body: notification.body ?? '',
        data: notification.data,
        android: {
          channelId: ALARM_CHANNEL_ID,
          groupId: ALARM_GROUP_ID,
          importance: AndroidImportance.HIGH,
          visibility: AndroidVisibility.PUBLIC,
          autoCancel: true,
          ongoing: false,
          badgeCount: 0,
          sound: 'default',
          pressAction: { id: 'default' },
        },
      }).catch(() => {});
    }

    // Directly launch the app to foreground over lock screen.
    // This bypasses MIUI/OEM ROMs that block Android's fullScreenIntent API.
    // Uses the app's deep link scheme to call startActivity() directly.
    // Include alarmId so the trigger screen can display the alarm name immediately.
    if (Platform.OS === 'android') {
      // Store alarm name in MMKV as fallback for when the store isn't hydrated yet
      if (alarmId && alarm?.name) {
        mmkv.set('pending-alarm-name', alarm.name);
      }
      setTimeout(() => {
        const url = alarmId
          ? `lumora://alarm-trigger?alarmId=${alarmId}`
          : 'lumora://alarm-trigger';
        Linking.openURL(url).catch((err) => {
          console.warn('[ForegroundService] Failed to launch app:', err);
        });
      }, 800);
    }

    // Auto-cleanup after 5 minutes to prevent zombie foreground services.
    // Also dismiss the alarm and schedule the next occurrence so it isn't lost.
    setTimeout(async () => {
      console.log('[ForegroundService] Auto-cleanup after timeout');
      await stopAlarmSound();
      if (alarmId) {
        await dismissAlarm(alarmId);
        await scheduleNextDayAlarm(alarmId);
        await updatePersistentNotification();
      }
      resolve();
    }, 5 * 60 * 1000);
  });
});

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
    const { scheduleNotificationRefresh: schedRefresh } = require('./src/services/alarmScheduler');
    await schedRefresh();

    console.log('[BootTask] Done — rescheduled', enabledAlarms.length, 'alarms');
  } catch (error) {
    console.error('[BootTask] Failed to reschedule alarms:', error);
  }
});

// Register Expo Router entry point
import 'expo-router/entry';
