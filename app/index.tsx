import React, { useCallback } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useLocationStore } from '../src/stores/locationStore';
import { useSunTimes } from '../src/hooks/useSunTimes';
import { useAlarms } from '../src/hooks/useAlarms';
import { cancelAlarm } from '../src/services/alarmScheduler';
import { useAlarmStore } from '../src/stores/alarmStore';
import { AlarmCard } from '../src/components/AlarmCard';
import { PermissionBanner } from '../src/components/PermissionBanner';
import { BatteryOptimizationPrompt } from '../src/components/BatteryOptimizationPrompt';
import { SettingsIcon, AlarmIcon } from '../src/components/Icons';
import { COLORS } from '../src/utils/constants';
import type { Alarm } from '../src/models/types';

export default function HomeScreen() {
  const router = useRouter();
  const location = useLocationStore((s) => s.location);
  const { todaySunTimes } = useSunTimes(location);
  const { alarms, toggleAlarm } = useAlarms(todaySunTimes);

  const handleAlarmPress = useCallback(
    (id: string) => {
      router.push(`/alarm/${id}`);
    },
    [router],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const alarm = useAlarmStore.getState().alarms[id];
      if (alarm) {
        await cancelAlarm(alarm);
      }
      useAlarmStore.getState().deleteAlarm(id);
    },
    [],
  );

  const renderAlarm = useCallback(
    ({ item }: { item: Alarm }) => (
      <AlarmCard
        alarm={item}
        onToggle={toggleAlarm}
        onPress={handleAlarmPress}
        onDelete={handleDelete}
      />
    ),
    [toggleAlarm, handleAlarmPress, handleDelete],
  );

  const renderHeader = useCallback(
    () => (
      <View style={{ paddingTop: 8, paddingBottom: 8 }}>
        <PermissionBanner />
        <BatteryOptimizationPrompt />

        {/* Section header */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 16,
            marginBottom: 12,
          }}
        >
          <Pressable
            onPress={() => router.push('/settings')}
            style={{ padding: 8, marginLeft: -8 }}
            accessibilityLabel="Settings"
            accessibilityRole="button"
          >
            <SettingsIcon size={22} />
          </Pressable>
        </View>
      </View>
    ),
    [router],
  );

  const renderEmpty = useCallback(
    () => (
      <View
        style={{ paddingHorizontal: 32, paddingTop: 40, alignItems: 'center' }}
        accessibilityRole="summary"
      >
        <View style={{ marginBottom: 16 }} accessibilityElementsHidden>
          <AlarmIcon size={56} />
        </View>
        <Text
          style={{
            color: COLORS.textPrimary,
            fontSize: 18,
            fontWeight: '600',
            marginBottom: 8,
            textAlign: 'center',
          }}
        >
          No alarms yet
        </Text>
        <Text
          style={{
            color: COLORS.textSecondary,
            fontSize: 15,
            textAlign: 'center',
            lineHeight: 22,
          }}
        >
          Tap the + button to create your first{'\n'}sunrise or sunset alarm
        </Text>
      </View>
    ),
    [],
  );

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <FlatList
        data={alarms}
        keyExtractor={(item) => item.id}
        renderItem={renderAlarm}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      <Pressable
        onPress={() => router.push('/alarm/create')}
        style={({ pressed }) => ({
          position: 'absolute',
          bottom: 32,
          right: 24,
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: pressed ? '#d13550' : COLORS.primary,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: COLORS.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 8,
        })}
        accessibilityLabel="Create new alarm"
        accessibilityRole="button"
      >
        <Text style={{ color: '#ffffff', fontSize: 28, fontWeight: '300', marginTop: -2 }}>+</Text>
      </Pressable>
    </View>
  );
}
