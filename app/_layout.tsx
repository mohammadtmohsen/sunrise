import React, { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import notifee, { EventType } from '@notifee/react-native';
import { useLocation } from '../src/hooks/useLocation';
import { useAlarmStore } from '../src/stores/alarmStore';
import { mmkv } from '../src/stores/storage';
import {
  setupNotificationChannel,
  setupStatusNotificationChannel,
  requestNotificationPermission,
  setupIOSCategories,
} from '../src/services/notificationService';

import { updatePersistentNotification } from '../src/services/persistentNotificationService';
import { dismissAlarm, scheduleSnooze } from '../src/services/alarmScheduler';
import { stopAlarmSound } from '../src/services/soundService';
import { scheduleNextDayAlarm } from '../src/services/nextDayScheduler';
import { useAppStateRecalculation } from '../src/hooks/useAppStateRecalculation';
import { useRescheduleOnResume } from '../src/hooks/useRescheduleOnResume';
import { registerBackgroundRecalculation } from '../src/tasks/backgroundRecalculate';
import { useSettingsStore } from '../src/stores/settingsStore';
import { AppHeader } from '../src/components/AppHeader';
import { COLORS } from '../src/utils/constants';

export default function RootLayout() {
  const router = useRouter();
  const { location, fetchLocation } = useLocation();

  useAppStateRecalculation();
  useRescheduleOnResume();

  useEffect(() => {
    if (!location) {
      fetchLocation();
    }
  }, []);

  useEffect(() => {
    async function init() {
      await requestNotificationPermission();
      await setupNotificationChannel();
      await setupStatusNotificationChannel();
      await setupIOSCategories();
      await registerBackgroundRecalculation();
      useSettingsStore.getState().setOnboardingComplete();
      await updatePersistentNotification();
    }
    init();
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

      switch (type) {
        case EventType.DELIVERED:
          if (isAlarm && alarmId) {
            console.log(
              '[ForegroundEvent] DELIVERED — navigating to alarm-trigger',
            );
            router.push({ pathname: '/alarm-trigger', params: { alarmId } });
          }
          break;
        case EventType.PRESS:
          if (isAlarm && alarmId) {
            console.log(
              '[ForegroundEvent] PRESS — navigating to alarm-trigger',
            );
            router.push({ pathname: '/alarm-trigger', params: { alarmId } });
          }
          break;
        case EventType.ACTION_PRESS:
          if (detail.pressAction?.id === 'snooze' && alarmId) {
            stopAlarmSound();
            const alarm = useAlarmStore.getState().alarms[alarmId];
            if (alarm) {
              scheduleSnooze(alarm, alarm.snoozeDurationMinutes);
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
        router.push({
          pathname: '/alarm-trigger',
          params: { alarmId: pendingAlarmId },
        });
        return true;
      }
      return false;
    }

    // Check on mount (cold start)
    async function checkInitialNotification() {
      if (checkPendingAlarm()) return;

      const initial = await notifee.getInitialNotification();
      if (initial) {
        const alarmId = initial.notification?.data?.alarmId as
          | string
          | undefined;
        const isAlarm = initial.notification?.data?.type === 'alarm-trigger';
        if (alarmId && isAlarm) {
          router.push({ pathname: '/alarm-trigger', params: { alarmId } });
        }
      }
    }

    setTimeout(() => checkInitialNotification(), 300);

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
