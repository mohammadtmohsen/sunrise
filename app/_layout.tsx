import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import notifee, { EventType } from '@notifee/react-native';
import { useLocation } from '../src/hooks/useLocation';
import { useSunTimes } from '../src/hooks/useSunTimes';
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
import { SunTimesDisplay } from '../src/components/SunTimesDisplay';
import { COLORS } from '../src/utils/constants';

export default function RootLayout() {
  const router = useRouter();
  const { location, isLoading: locationLoading, fetchLocation } = useLocation();
  const { todaySunTimes, isValid } = useSunTimes(location);

  useAppStateRecalculation();

  useEffect(() => {
    if (!location) {
      fetchLocation();
    }
  }, []);

  useEffect(() => {
    async function init() {
      await requestNotificationPermission();
      await setupNotificationChannel();
      await setupIOSCategories();
      await registerBackgroundRecalculation();
      useSettingsStore.getState().setOnboardingComplete();
    }
    init();
  }, []);

  useEffect(() => {
    const unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
      const alarmId = detail.notification?.data?.alarmId as string | undefined;
      const isAlarm = detail.notification?.data?.type === 'alarm-trigger';

      switch (type) {
        case EventType.DELIVERED:
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
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <StatusBar style="light" />

      {/* Persistent sun times header */}
      <View style={{ paddingTop: 60, paddingBottom: 12, backgroundColor: COLORS.background }}>
        <SunTimesDisplay sunTimes={todaySunTimes} isValid={isValid} onRefresh={fetchLocation} isRefreshing={locationLoading} />
      </View>

      {/* Page content below */}
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
            title: 'Alarms',
          }}
        />
        <Stack.Screen
          name="alarm/create"
          options={{
            title: 'New Alarm',
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
    </GestureHandlerRootView>
  );
}
