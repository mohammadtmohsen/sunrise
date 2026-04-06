import React from 'react';
import { View, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useLocation } from '../../src/hooks/useLocation';
import { useSunTimes } from '../../src/hooks/useSunTimes';
import { SunTimesDisplay } from '../../src/components/SunTimesDisplay';
import { AppHeader } from '../../src/components/AppHeader';
import { SettingsIcon } from '../../src/components/Icons';
import { COLORS } from '../../src/utils/constants';

export default function MainLayout() {
  const router = useRouter();
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

          const isAlarmForm = route.name === 'alarm/create' || route.name === 'alarm/[id]';

          return (
            <AppHeader
              title={title}
              canGoBack={canGoBack}
              onBack={() => navigation.goBack()}
              rightAction={isHome ? (
                <Pressable
                  onPress={() => router.push('/settings')}
                  style={{ padding: 8, marginRight: -8 }}
                  accessibilityLabel="Settings"
                  accessibilityRole="button"
                >
                  <SettingsIcon size={22} />
                </Pressable>
              ) : undefined}
            >
              {!isHome && !isAlarmForm && (
                <View style={{ paddingBottom: 8 }}>
                  <SunTimesDisplay sunTimes={todaySunTimes} isValid={isValid} />
                </View>
              )}
            </AppHeader>
          );
        },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Lumora' }} />
      <Stack.Screen name="alarm/create" options={{ title: 'New Alarm' }} />
      <Stack.Screen name="alarm/[id]" options={{ title: 'Edit Alarm' }} />
    </Stack>
  );
}
