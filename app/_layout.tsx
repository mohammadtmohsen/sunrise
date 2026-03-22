import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import notifee, { EventType } from '@notifee/react-native';
import { useLocation } from '../src/hooks/useLocation';
import { useAlarmStore } from '../src/stores/alarmStore';
import {
  setupNotificationChannel,
  requestNotificationPermission,
  setupIOSCategories,
} from '../src/services/notificationService';
import { dismissAlarm, scheduleSnooze } from '../src/services/alarmScheduler';
import { scheduleNextDayAlarm } from '../src/services/nextDayScheduler';
import { useAppStateRecalculation } from '../src/hooks/useAppStateRecalculation';
import { registerBackgroundRecalculation } from '../src/tasks/backgroundRecalculate';
import { useSettingsStore } from '../src/stores/settingsStore';
import { COLORS } from '../src/utils/constants';

export default function RootLayout() {
  const router = useRouter();
  const { location, fetchLocation } = useLocation();

  // Second leg of triple-redundancy: recalculate on app foreground resume
  useAppStateRecalculation();

  // Fetch location on app start if not cached
  useEffect(() => {
    if (!location) {
      fetchLocation();
    }
  }, []);

  // Set up notification infrastructure + register background task
  useEffect(() => {
    async function init() {
      await requestNotificationPermission();
      await setupNotificationChannel();
      await setupIOSCategories();
      // First leg of triple-redundancy: background fetch every ~6 hours
      await registerBackgroundRecalculation();
      // Mark onboarding complete after first init
      useSettingsStore.getState().setOnboardingComplete();
    }
    init();
  }, []);

  // Handle foreground notification events
  useEffect(() => {
    const unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
      const alarmId = detail.notification?.data?.alarmId as string | undefined;
      const isAlarm = detail.notification?.data?.type === 'alarm-trigger';

      switch (type) {
        case EventType.DELIVERED:
          // Alarm fired while app is in foreground — navigate to trigger screen
          if (isAlarm && alarmId) {
            router.push({ pathname: '/alarm-trigger', params: { alarmId } });
          }
          break;
        case EventType.PRESS:
          if (alarmId) {
            router.push({ pathname: '/alarm-trigger', params: { alarmId } });
          }
          break;
        case EventType.ACTION_PRESS:
          if (detail.pressAction?.id === 'snooze' && alarmId) {
            const alarm = useAlarmStore.getState().alarms[alarmId];
            if (alarm) {
              scheduleSnooze(alarm, alarm.snoozeDurationMinutes);
            }
            dismissAlarm(alarmId);
          } else if (detail.pressAction?.id === 'dismiss' && alarmId) {
            dismissAlarm(alarmId);
            scheduleNextDayAlarm(alarmId);
          }
          break;
      }
    });

    return unsubscribe;
  }, [router]);

  // Check if app was opened from a notification
  useEffect(() => {
    async function checkInitialNotification() {
      const initial = await notifee.getInitialNotification();
      if (initial) {
        const alarmId = initial.notification?.data?.alarmId as string | undefined;
        if (alarmId) {
          router.push({ pathname: '/alarm-trigger', params: { alarmId } });
        }
      }
    }
    checkInitialNotification();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.background },
          headerTintColor: COLORS.textPrimary,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: COLORS.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'Sunrise',
            headerLargeTitle: true,
          }}
        />
        <Stack.Screen
          name="alarm/create"
          options={{
            title: 'New Alarm',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="alarm/[id]"
          options={{
            title: 'Edit Alarm',
          }}
        />
        <Stack.Screen
          name="alarm-trigger"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            title: 'Settings',
          }}
        />
      </Stack>
    </>
  );
}
