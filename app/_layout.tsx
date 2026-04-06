import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useLocation } from '../src/hooks/useLocation';
import { useAppInit } from '../src/hooks/useAppInit';
import { useNotificationEvents } from '../src/hooks/useNotificationEvents';
import { usePendingAlarm } from '../src/hooks/usePendingAlarm';
import { useAppStateRecalculation } from '../src/hooks/useAppStateRecalculation';
import { AppHeader } from '../src/components/AppHeader';
import { COLORS } from '../src/utils/constants';

export default function RootLayout() {
  const router = useRouter();
  const { location, fetchLocation } = useLocation();

  useAppInit();
  useNotificationEvents(router);
  const { isReady } = usePendingAlarm(router);
  useAppStateRecalculation();

  useEffect(() => {
    if (!location) {
      fetchLocation();
    }
  }, []);

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
