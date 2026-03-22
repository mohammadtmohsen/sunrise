import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { useLocation } from '../../src/hooks/useLocation';
import { useSunTimes } from '../../src/hooks/useSunTimes';
import { SunTimesDisplay } from '../../src/components/SunTimesDisplay';
import { AppHeader } from '../../src/components/AppHeader';
import { COLORS } from '../../src/utils/constants';

export default function MainLayout() {
  const { location, isLoading } = useLocation();
  const { todaySunTimes, isValid } = useSunTimes(location);

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: COLORS.background },
        animation: 'slide_from_right',
        header: ({ options, navigation, route }) => {
          const title = options.title ?? '';
          const canGoBack = navigation.canGoBack() && route.name !== 'index';
          const isHome = route.name === 'index';

          return (
            <AppHeader title={title} canGoBack={canGoBack} onBack={() => navigation.goBack()}>
              {!isHome && (
                <View style={{ paddingBottom: 8 }}>
                  <SunTimesDisplay sunTimes={todaySunTimes} isValid={isValid} isRefreshing={isLoading} />
                </View>
              )}
            </AppHeader>
          );
        },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Sunrise' }} />
      <Stack.Screen name="alarm/create" options={{ title: 'New Alarm' }} />
      <Stack.Screen name="alarm/[id]" options={{ title: 'Edit Alarm' }} />
    </Stack>
  );
}
