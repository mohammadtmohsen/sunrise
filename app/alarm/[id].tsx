import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAlarmStore } from '../../src/stores/alarmStore';
import { useLocationStore } from '../../src/stores/locationStore';
import { useSunTimes } from '../../src/hooks/useSunTimes';
import { TimeOffsetPicker } from '../../src/components/TimeOffsetPicker';
import { AbsoluteTimePicker } from '../../src/components/AbsoluteTimePicker';
import { scheduleAlarm, cancelAlarm } from '../../src/services/alarmScheduler';
import { formatTime, computeTriggerTime, computeAbsoluteTriggerTime } from '../../src/utils/timeUtils';
import { COLORS } from '../../src/utils/constants';
import type { AlarmType } from '../../src/models/types';

export default function EditAlarmScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const alarm = useAlarmStore((s) => s.alarms[id!]);
  const updateAlarm = useAlarmStore((s) => s.updateAlarm);
  const deleteAlarm = useAlarmStore((s) => s.deleteAlarm);
  const location = useLocationStore((s) => s.location);
  const { todaySunTimes } = useSunTimes(location);

  const initialOffset = Math.abs(alarm?.offsetMinutes ?? 30);
  const [name, setName] = useState(alarm?.name ?? '');
  const [alarmType, setAlarmType] = useState<AlarmType>(alarm?.type ?? 'relative');

  // Relative fields
  const [referenceEvent, setReferenceEvent] = useState<'sunrise' | 'sunset'>(alarm?.referenceEvent ?? 'sunrise');
  const [direction, setDirection] = useState<'before' | 'after'>(
    (alarm?.offsetMinutes ?? -30) < 0 ? 'before' : 'after',
  );
  const [hours, setHours] = useState(Math.floor(initialOffset / 60));
  const [minutes, setMinutes] = useState(initialOffset % 60);

  // Absolute fields
  const [absoluteHour, setAbsoluteHour] = useState(alarm?.absoluteHour ?? 6);
  const [absoluteMinute, setAbsoluteMinute] = useState(alarm?.absoluteMinute ?? 0);

  const offsetMinutes = useMemo(() => {
    const total = hours * 60 + minutes;
    return direction === 'before' ? -total : total;
  }, [hours, minutes, direction]);

  const previewTime = useMemo(() => {
    if (alarmType === 'absolute') {
      return computeAbsoluteTriggerTime(absoluteHour, absoluteMinute);
    }
    if (!todaySunTimes) return null;
    const eventTime = todaySunTimes[referenceEvent];
    return computeTriggerTime(eventTime, offsetMinutes);
  }, [alarmType, todaySunTimes, referenceEvent, offsetMinutes, absoluteHour, absoluteMinute]);

  if (!alarm) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: COLORS.textSecondary, fontSize: 16 }}>Alarm not found</Text>
      </View>
    );
  }

  const handleSave = async () => {
    if (!name.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Name required', 'Please enter a name for your alarm.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateAlarm(id!, {
      name: name.trim(),
      type: alarmType,
      referenceEvent,
      offsetMinutes,
      absoluteHour,
      absoluteMinute,
    });

    // Reschedule the alarm with updated settings
    const updated = useAlarmStore.getState().alarms[id!];
    if (updated && updated.isEnabled) {
      const notificationId = await scheduleAlarm(updated, todaySunTimes);
      if (notificationId) {
        updateAlarm(id!, { notificationId });
      }
    }

    router.back();
  };

  const handleDelete = () => {
    Alert.alert('Delete Alarm', `Are you sure you want to delete "${alarm.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await cancelAlarm(alarm);
          deleteAlarm(id!);
          router.back();
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Name */}
      <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginBottom: 8, marginLeft: 4 }}>
        ALARM NAME
      </Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Morning Run"
        placeholderTextColor={COLORS.textMuted}
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 12,
          padding: 16,
          color: COLORS.textPrimary,
          fontSize: 16,
          marginBottom: 24,
        }}
      />

      {/* Alarm Type Toggle */}
      <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginBottom: 8, marginLeft: 4 }}>
        ALARM TYPE
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
        <Pressable
          onPress={() => { Haptics.selectionAsync(); setAlarmType('relative'); }}
          style={{
            flex: 1,
            paddingVertical: 14,
            borderRadius: 12,
            backgroundColor: alarmType === 'relative' ? COLORS.primary : COLORS.surface,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: COLORS.textPrimary, fontSize: 15, fontWeight: alarmType === 'relative' ? '700' : '400' }}>
            ☀️ Sun-relative
          </Text>
        </Pressable>
        <Pressable
          onPress={() => { Haptics.selectionAsync(); setAlarmType('absolute'); }}
          style={{
            flex: 1,
            paddingVertical: 14,
            borderRadius: 12,
            backgroundColor: alarmType === 'absolute' ? COLORS.primary : COLORS.surface,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: COLORS.textPrimary, fontSize: 15, fontWeight: alarmType === 'absolute' ? '700' : '400' }}>
            ⏰ Fixed time
          </Text>
        </Pressable>
      </View>

      {/* Conditional: Relative alarm fields */}
      {alarmType === 'relative' && (
        <>
          <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginBottom: 8, marginLeft: 4 }}>
            RELATIVE TO
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
            {(['sunrise', 'sunset'] as const).map((event) => (
              <Pressable
                key={event}
                onPress={() => setReferenceEvent(event)}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: referenceEvent === event ? (event === 'sunrise' ? COLORS.sunrise : COLORS.sunset) : COLORS.surface,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: COLORS.textPrimary, fontSize: 16, fontWeight: referenceEvent === event ? '700' : '400' }}>
                  {event === 'sunrise' ? '☀️ Sunrise' : '🌅 Sunset'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginBottom: 8, marginLeft: 4 }}>
            DIRECTION
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
            {(['before', 'after'] as const).map((dir) => (
              <Pressable
                key={dir}
                onPress={() => setDirection(dir)}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: direction === dir ? COLORS.primary : COLORS.surface,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: COLORS.textPrimary, fontSize: 16, fontWeight: direction === dir ? '700' : '400' }}>
                  {dir === 'before' ? 'Before' : 'After'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginBottom: 8, marginLeft: 4 }}>
            OFFSET TIME
          </Text>
          <View style={{ backgroundColor: COLORS.surface, borderRadius: 12, padding: 16, marginBottom: 24 }}>
            <TimeOffsetPicker
              hours={hours}
              minutes={minutes}
              onHoursChange={setHours}
              onMinutesChange={setMinutes}
            />
          </View>
        </>
      )}

      {/* Conditional: Absolute alarm fields */}
      {alarmType === 'absolute' && (
        <>
          <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginBottom: 8, marginLeft: 4 }}>
            ALARM TIME
          </Text>
          <View style={{ backgroundColor: COLORS.surface, borderRadius: 12, padding: 16, marginBottom: 24 }}>
            <AbsoluteTimePicker
              hour={absoluteHour}
              minute={absoluteMinute}
              onHourChange={setAbsoluteHour}
              onMinuteChange={setAbsoluteMinute}
            />
          </View>
        </>
      )}

      {/* Preview */}
      {previewTime && (
        <View style={{ backgroundColor: COLORS.surface, borderRadius: 12, padding: 16, marginBottom: 32, alignItems: 'center' }}>
          <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginBottom: 4 }}>
            ALARM WILL RING AT
          </Text>
          <Text style={{ color: COLORS.accent, fontSize: 28, fontWeight: '700' }}>
            {formatTime(previewTime)}
          </Text>
          {alarmType === 'relative' && (
            <Text style={{ color: COLORS.textMuted, fontSize: 13, marginTop: 4 }}>
              Based on today's {referenceEvent}
            </Text>
          )}
          {alarmType === 'absolute' && (
            <Text style={{ color: COLORS.textMuted, fontSize: 13, marginTop: 4 }}>
              Repeats daily
            </Text>
          )}
        </View>
      )}

      {/* Save */}
      <Pressable
        onPress={handleSave}
        style={({ pressed }) => ({
          backgroundColor: pressed ? '#d13550' : COLORS.primary,
          borderRadius: 12,
          paddingVertical: 16,
          alignItems: 'center',
          marginBottom: 12,
        })}
      >
        <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}>
          Save Changes
        </Text>
      </Pressable>

      {/* Delete */}
      <Pressable
        onPress={handleDelete}
        style={({ pressed }) => ({
          backgroundColor: pressed ? '#3a1a1a' : 'transparent',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: COLORS.danger,
          paddingVertical: 16,
          alignItems: 'center',
        })}
      >
        <Text style={{ color: COLORS.danger, fontSize: 16, fontWeight: '600' }}>
          Delete Alarm
        </Text>
      </Pressable>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
