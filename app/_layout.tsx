import React, { useEffect, useState } from 'react';
import { AppState, Platform, View, type AppStateStatus } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import notifee, { EventType } from '@notifee/react-native';
import { useLocation } from '../src/hooks/useLocation';
import { useAlarmStore } from '../src/stores/alarmStore';
import { useLocationStore } from '../src/stores/locationStore';
import { mmkv } from '../src/stores/storage';
import {
  setupNotificationChannel,
  setupReminderNotificationChannel,
  setupStatusNotificationChannel,
  requestNotificationPermission,
  setupIOSCategories,
  checkBatteryOptimization,
} from '../src/services/notificationService';
import { scheduleAllAlarms, promptFullScreenIntentPermission, dismissAlarm, scheduleSnooze, scheduleNotificationRefresh } from '../src/services/alarmScheduler';
import { getSunTimes, isSunTimesValid } from '../src/services/sunCalcService';

import { updatePersistentNotification } from '../src/services/persistentNotificationService';
import { stopAlarmSound } from '../src/services/soundService';
import { scheduleNextDayAlarm } from '../src/services/nextDayScheduler';
import { useAppStateRecalculation } from '../src/hooks/useAppStateRecalculation';
import { useRescheduleOnResume } from '../src/hooks/useRescheduleOnResume';
import { registerBackgroundRecalculation } from '../src/tasks/backgroundRecalculate';
import { useSettingsStore } from '../src/stores/settingsStore';
import { scheduleDailyMaintenance } from '../src/services/maintenanceScheduler';
import { AppHeader } from '../src/components/AppHeader';
import { COLORS } from '../src/utils/constants';

export default function RootLayout() {
  const router = useRouter();
  const { location, fetchLocation } = useLocation();
  // Gate rendering until we've checked for a pending alarm.
  // This prevents the home screen from flashing before the alarm trigger screen.
  const [isReady, setIsReady] = useState(false);

  useAppStateRecalculation();
  useRescheduleOnResume();

  useEffect(() => {
    if (!location) {
      fetchLocation();
    }
  }, []);

  useEffect(() => {
    async function init() {
      // Safety: stop any orphaned sound/vibration from a previous session
      await stopAlarmSound();
      await requestNotificationPermission();
      await setupNotificationChannel();
      await setupReminderNotificationChannel();
      await setupStatusNotificationChannel();
      await setupIOSCategories();
      await registerBackgroundRecalculation();
      await scheduleDailyMaintenance();
      await scheduleNotificationRefresh();
      // On first launch or when battery optimization is enabled, request exemption.
      // Battery-optimized apps get killed by Android, preventing alarms from firing.
      if (Platform.OS === 'android') {
        const batteryInfo = await checkBatteryOptimization();
        if (batteryInfo.isOptimized) {
          try {
            await notifee.openBatteryOptimizationSettings();
          } catch {
            // Settings may not be available on all OEMs
          }
        }
      }

      // On first launch, prompt for Xiaomi/OEM-specific permissions
      const hasCompleted = useSettingsStore.getState().hasCompletedOnboarding;
      if (!hasCompleted && Platform.OS === 'android') {
        await promptFullScreenIntentPermission();
      }

      useSettingsStore.getState().setOnboardingComplete();

      // Re-register all enabled alarms with AlarmManager on every app open.
      // This handles: first install (alarms lost before boot receiver runs),
      // OS clearing alarm registrations, and permission grants since last open.
      // Only proceeds if exact alarm permission is already granted — avoids
      // showing permission prompts on every app open (prompts happen on alarm save).
      const hasAlarmPerm = Platform.OS !== 'android' ||
        (await notifee.getNotificationSettings()).android?.alarm === 1;
      if (hasAlarmPerm) {
        const loc = useLocationStore.getState().location;
        const sun = loc ? getSunTimes(loc.latitude, loc.longitude) : null;
        if (!sun || isSunTimesValid(sun)) {
          const enabled = Object.values(useAlarmStore.getState().alarms).filter(a => a.isEnabled);
          if (enabled.length > 0) {
            await scheduleAllAlarms(enabled, sun);
          }
        }
      }

      await updatePersistentNotification();
    }
    init();
  }, []);

  // Periodically refresh the persistent notification every 60s while app is in foreground.
  // This keeps relative times ("in 2h 14m") accurate, prevents the chronometer from
  // going negative (by switching to the next alarm), and updates after alarm dismissals.
  useEffect(() => {
    const interval = setInterval(() => {
      updatePersistentNotification().catch(() => {});
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
      const alarmId = detail.notification?.data?.alarmId as string | undefined;
      const isAlarm = detail.notification?.data?.type === 'alarm-trigger';

      console.log(
        '[ForegroundEvent] type:',
        type,
        'alarmId:',
        alarmId,
        'isAlarm:',
        isAlarm,
      );

      // Check if this is a reminder (should not launch full-screen)
      const alarm = alarmId ? useAlarmStore.getState().alarms[alarmId] : null;
      const isReminder = alarm?.alarmStyle === 'reminder';

      switch (type) {
        case EventType.DELIVERED:
          // Full alarms are handled by the foreground service (stores pending-alarm-id + deep link)
          // No action needed here to avoid double trigger
          break;
        case EventType.PRESS:
          if (isAlarm && alarmId && !isReminder) {
            console.log(
              '[ForegroundEvent] PRESS — navigating to alarm-trigger',
            );
            router.push({ pathname: '/alarm-trigger', params: { alarmId } });
          }
          if (isAlarm && alarmId && isReminder) {
            // Reminder tapped — cancel notification and schedule next day
            if (detail.notification?.id) {
              notifee.cancelNotification(detail.notification.id);
            }
            scheduleNextDayAlarm(alarmId);
          }
          break;
        case EventType.ACTION_PRESS:
          if (detail.pressAction?.id === 'snooze' && alarmId) {
            stopAlarmSound();
            const alarmForSnooze = useAlarmStore.getState().alarms[alarmId];
            if (alarmForSnooze) {
              scheduleSnooze(alarmForSnooze, alarmForSnooze.snoozeDurationMinutes);
              // Update nextTriggerAt to snooze time so persistent notification shows correct countdown
              const snoozeAt = new Date(Date.now() + alarmForSnooze.snoozeDurationMinutes * 60 * 1000);
              useAlarmStore.getState().updateAlarm(alarmId, {
                nextTriggerAt: snoozeAt.toISOString(),
              });
            }
            dismissAlarm(alarmId);
            updatePersistentNotification();
          } else if (detail.pressAction?.id === 'dismiss' && alarmId) {
            stopAlarmSound();
            dismissAlarm(alarmId);
            scheduleNextDayAlarm(alarmId);
            updatePersistentNotification();
          }
          break;
        case EventType.DISMISSED:
          // When reminder notification is swiped away, schedule next day
          if (isAlarm && alarmId && isReminder) {
            scheduleNextDayAlarm(alarmId);
          }
          break;
      }
    });

    return unsubscribe;
  }, [router]);

  // Check for pending alarm — handles all cases: cold start, warm start, and
  // alarm firing while app is open (foreground service stores ID in MMKV)
  useEffect(() => {
    function checkPendingAlarm() {
      const pendingAlarmId = mmkv.getString('pending-alarm-id');
      if (pendingAlarmId) {
        console.log('[PendingAlarm] Found pending alarm:', pendingAlarmId);
        mmkv.delete('pending-alarm-id');

        // Don't launch full-screen for reminders
        const pendingAlarm = useAlarmStore.getState().alarms[pendingAlarmId];
        if (pendingAlarm?.alarmStyle === 'reminder') {
          console.log('[PendingAlarm] Reminder — skipping alarm-trigger');
          stopAlarmSound();
          scheduleNextDayAlarm(pendingAlarmId);
          return true;
        }

        router.replace({
          pathname: '/alarm-trigger',
          params: { alarmId: pendingAlarmId },
        });
        return true;
      }
      return false;
    }

    // Check on mount (cold start) — run immediately, no delay
    async function checkInitialNotification() {
      // Synchronous MMKV check first (instant)
      if (checkPendingAlarm()) {
        setIsReady(true);
        return;
      }

      // Then check Notifee's initial notification (async, for tapped-to-open case)
      const initial = await notifee.getInitialNotification();
      if (initial) {
        const alarmId = initial.notification?.data?.alarmId as
          | string
          | undefined;
        const isAlarm = initial.notification?.data?.type === 'alarm-trigger';
        if (alarmId && isAlarm) {
          const alarm = useAlarmStore.getState().alarms[alarmId];
          if (alarm?.alarmStyle !== 'reminder') {
            router.replace({ pathname: '/alarm-trigger', params: { alarmId } });
          }
        }
      }
      setIsReady(true);
    }

    checkInitialNotification();

    // Check when app comes back to foreground
    const appStateSub = AppState.addEventListener(
      'change',
      (state: AppStateStatus) => {
        if (state === 'active') {
          // Small delay to let MMKV write settle
          setTimeout(() => checkPendingAlarm(), 200);
        }
      },
    );

    // Poll MMKV every second — catches the case where foreground service
    // stores alarm ID while the app is already open
    const pollInterval = setInterval(() => {
      checkPendingAlarm();
    }, 1000);

    return () => {
      appStateSub.remove();
      clearInterval(pollInterval);
    };
  }, [router]);

  // Show dark screen until we've checked for pending alarm —
  // prevents home screen from flashing before alarm trigger
  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0d0d1a' }} />
    );
  }

  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: COLORS.background }}
    >
      <StatusBar style='light' />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: COLORS.background },
          animation: 'slide_from_right',
          header: ({ options, navigation }) => {
            const title = options.title ?? '';
            const canGoBack = navigation.canGoBack();
            return (
              <AppHeader
                title={title}
                canGoBack={canGoBack}
                onBack={() => navigation.goBack()}
              />
            );
          },
        }}
      >
        <Stack.Screen
          name='(main)'
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name='alarm-trigger'
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name='settings'
          options={{
            title: 'Settings',
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
