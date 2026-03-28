import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, RefreshControl, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useAlarmStore } from '../../../src/stores/alarmStore';
import { useLocation } from '../../../src/hooks/useLocation';
import { useSunTimes } from '../../../src/hooks/useSunTimes';
import { TimeOffsetPicker } from '../../../src/components/TimeOffsetPicker';
import { AbsoluteTimePicker } from '../../../src/components/AbsoluteTimePicker';
import { scheduleAlarm, type ScheduleFailure } from '../../../src/services/alarmScheduler';
import { updatePersistentNotification } from '../../../src/services/persistentNotificationService';
import { formatTime, computeTriggerTime, computeAbsoluteTriggerTime } from '../../../src/utils/timeUtils';
import { SunriseIcon } from '../../../src/components/Icons';
import { COLORS } from '../../../src/utils/constants';
import type { AlarmType } from '../../../src/models/types';

export default function CreateAlarmScreen() {
  const router = useRouter();
  const addAlarm = useAlarmStore((s) => s.addAlarm);
  const { location, isLoading: locationLoading, fetchLocation } = useLocation();
  const { todaySunTimes } = useSunTimes(location);

  const [name, setName] = useState('');
  const [alarmType, setAlarmType] = useState<AlarmType>('relative');

  // Relative fields
  const [referenceEvent, setReferenceEvent] = useState<'sunrise' | 'sunset'>('sunrise');
  const [direction, setDirection] = useState<'before' | 'after'>('before');
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(30);

  // Absolute fields
  const [absoluteHour, setAbsoluteHour] = useState(6);
  const [absoluteMinute, setAbsoluteMinute] = useState(0);

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

  const handleSave = async () => {
    if (!name.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Name required', 'Please enter a name for your alarm.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const alarmId = addAlarm({
      name: name.trim(),
      type: alarmType,
      referenceEvent,
      offsetMinutes,
      absoluteHour,
      absoluteMinute,
    });

    // Compute nextTriggerAt immediately so persistent notification can show it
    const triggerTime = alarmType === 'absolute'
      ? computeAbsoluteTriggerTime(absoluteHour, absoluteMinute)
      : todaySunTimes
        ? computeTriggerTime(todaySunTimes[referenceEvent], offsetMinutes)
        : null;
    if (triggerTime) {
      useAlarmStore.getState().updateAlarm(alarmId, {
        nextTriggerAt: triggerTime.toISOString(),
      });
    }

    // Schedule the alarm notification
    const alarm = useAlarmStore.getState().alarms[alarmId];
    if (alarm) {
      const result = await scheduleAlarm(alarm, todaySunTimes);
      if (result.success) {
        useAlarmStore.getState().updateAlarm(alarmId, {
          notificationId: result.notificationId,
        });
      } else {
        const messages: Record<ScheduleFailure, string> = {
          'disabled': 'The alarm is disabled.',
          'no-sun-times': 'Location not available yet. Pull down to refresh location, then try again.',
          'past-time': 'The alarm time has already passed for today. It will be scheduled for tomorrow.',
          'no-permission': 'Alarm permission was not granted. Please enable it in Settings and save the alarm again.',
          'error': 'Something went wrong scheduling the alarm. Please try again.',
        };
        Alert.alert('Alarm Not Scheduled', messages[result.reason]);
      }
    }

    updatePersistentNotification();
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={locationLoading}
          onRefresh={fetchLocation}
          tintColor={COLORS.primary}
        />
      }
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <SunriseIcon size={18} />
            <Text style={{ color: COLORS.textPrimary, fontSize: 15, fontWeight: alarmType === 'relative' ? '700' : '400' }}>
              Sun-relative
            </Text>
          </View>
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
            Fixed time
          </Text>
        </Pressable>
      </View>

      {/* Conditional: Relative alarm fields */}
      {alarmType === 'relative' && (
        <>
          {/* Reference Event */}
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
                  {event === 'sunrise' ? 'Sunrise' : 'Sunset'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Direction */}
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

          {/* Offset */}
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
        })}
      >
        <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}>
          Save Alarm
        </Text>
      </Pressable>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
