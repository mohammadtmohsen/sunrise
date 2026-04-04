import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, RefreshControl, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAlarmStore } from '../../../src/stores/alarmStore';
import { useLocation } from '../../../src/hooks/useLocation';
import { useSunTimes } from '../../../src/hooks/useSunTimes';
import { SunTimesDisplay } from '../../../src/components/SunTimesDisplay';
import { isSunTimesValid } from '../../../src/services/sunCalcService';
import { TimeOffsetPicker } from '../../../src/components/TimeOffsetPicker';
import { AbsoluteTimePicker } from '../../../src/components/AbsoluteTimePicker';
import { scheduleAlarm, type ScheduleFailure } from '../../../src/services/alarmScheduler';
import { updatePersistentNotification } from '../../../src/services/persistentNotificationService';
import { formatTime, computeTriggerTime, computeAbsoluteTriggerTime } from '../../../src/utils/timeUtils';
import { COLORS } from '../../../src/utils/constants';
import { DayPills } from '../../../src/components/DayPills';
import { formatRepeatDays } from '../../../src/utils/timeUtils';
import type { AlarmType, AlarmMode, AlarmStyle, RepeatMode } from '../../../src/models/types';

export default function EditAlarmScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const alarm = useAlarmStore((s) => s.alarms[id!]);
  const updateAlarm = useAlarmStore((s) => s.updateAlarm);
  const alarms = useAlarmStore((s) => s.alarms);

  const { location, isLoading: locationLoading, fetchLocation } = useLocation();
  const { todaySunTimes } = useSunTimes(location);

  const initialOffset = Math.abs(alarm?.offsetMinutes ?? 30);
  const [name, setName] = useState(alarm?.name ?? '');
  const [alarmStyle, setAlarmStyle] = useState<AlarmStyle>(alarm?.alarmStyle ?? 'alarm');
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(alarm?.repeatMode ?? 'once');
  const [repeatDays, setRepeatDays] = useState<number[]>(alarm?.repeatDays ?? []);
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

  const currentMode: AlarmMode = alarmType === 'absolute'
    ? 'fixed'
    : `${direction}-${referenceEvent}` as AlarmMode;

  const handleModeChange = useCallback((newMode: AlarmMode) => {
    if (newMode === 'fixed') {
      setAlarmType('absolute');
    } else {
      setAlarmType('relative');
      const [dir, event] = newMode.split('-') as ['before' | 'after', 'sunrise' | 'sunset'];
      setDirection(dir);
      setReferenceEvent(event);
    }
  }, []);

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

    const duplicateName = Object.values(alarms).some(
      (a) => a.id !== id && a.name.toLowerCase() === name.trim().toLowerCase(),
    );
    if (duplicateName) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Duplicate name', 'An alarm with this name already exists. Please choose a different name.');
      return;
    }
    if (repeatMode === 'repeat' && repeatDays.length === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Days required', 'Please select at least one day for a repeating alarm.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Compute nextTriggerAt immediately so persistent notification can show it
    const triggerTime = alarmType === 'absolute'
      ? computeAbsoluteTriggerTime(absoluteHour, absoluteMinute)
      : todaySunTimes
        ? computeTriggerTime(todaySunTimes[referenceEvent], offsetMinutes)
        : null;

    updateAlarm(id!, {
      name: name.trim(),
      type: alarmType,
      referenceEvent,
      offsetMinutes,
      absoluteHour,
      absoluteMinute,
      alarmStyle,
      repeatMode,
      repeatDays,
      isEnabled: true,
      nextTriggerAt: triggerTime?.toISOString() ?? null,
    });

    // Reschedule (alarm is now always enabled after save)
    const updated = useAlarmStore.getState().alarms[id!];
    if (updated) {
      const result = await scheduleAlarm(updated, todaySunTimes);
      if (result.success) {
        updateAlarm(id!, {
          notificationId: result.notificationId,
          nextTriggerAt: result.triggerTime.toISOString(),
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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
      {/* Sun times display with interactive mode selector */}
      <SunTimesDisplay
        sunTimes={todaySunTimes}
        isValid={!!todaySunTimes && isSunTimesValid(todaySunTimes)}
        mode={currentMode}
        onModeChange={handleModeChange}
        alarmTime={previewTime}
      />

      <View style={{ height: 16 }} />

      {/* Name */}
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Alarm name, e.g. Morning Run"
        placeholderTextColor={COLORS.textMuted}
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 12,
          padding: 16,
          color: COLORS.textPrimary,
          fontSize: 16,
          marginBottom: 16,
        }}
      />

      {/* Alarm style toggle */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        {(['alarm', 'reminder'] as const).map((style) => (
          <Pressable
            key={style}
            onPress={() => { Haptics.selectionAsync(); setAlarmStyle(style); }}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: alarmStyle === style
                ? COLORS.surfaceLight
                : COLORS.surface,
              alignItems: 'center',
            }}
          >
            <Text style={{
              color: alarmStyle === style ? '#ffffff' : COLORS.textMuted,
              fontSize: 15,
              fontWeight: alarmStyle === style ? '700' : '400',
            }}>
              {style === 'alarm' ? '⏰ Alarm' : '🔔 Reminder'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Repeat mode toggle */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        {(['once', 'repeat'] as const).map((mode) => (
          <Pressable
            key={mode}
            onPress={() => {
              Haptics.selectionAsync();
              if (mode === 'once' && repeatMode === 'repeat') {
                setRepeatDays(repeatDays.length > 0 ? [repeatDays[0]] : []);
              } else if (mode === 'repeat' && repeatMode === 'once') {
                setRepeatDays(repeatDays.length > 0 ? repeatDays : [0, 1, 2, 3, 4, 5, 6]);
              }
              setRepeatMode(mode);
            }}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: repeatMode === mode ? COLORS.surfaceLight : COLORS.surface,
              alignItems: 'center',
            }}
          >
            <Text style={{
              color: repeatMode === mode ? COLORS.textPrimary : COLORS.textMuted,
              fontSize: 15,
              fontWeight: repeatMode === mode ? '700' : '400',
            }}>
              <Text style={{ color: mode === 'once' ? COLORS.accent : COLORS.success }}>
                {mode === 'once' ? '\u2460 ' : '\u221E '}
              </Text>
              {mode === 'once' ? 'Once' : 'Repeat'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Day pills */}
      <View style={{ marginBottom: 16, alignItems: 'center' }}>
        <DayPills
          repeatMode={repeatMode}
          selectedDays={repeatDays}
          onDaysChange={setRepeatDays}
        />
      </View>

      {/* Conditional: Relative offset picker */}
      {alarmType === 'relative' && (
        <View style={{ backgroundColor: COLORS.surface, borderRadius: 12, padding: 12 }}>
          <TimeOffsetPicker
            hours={hours}
            minutes={minutes}
            onHoursChange={setHours}
            onMinutesChange={setMinutes}
          />
        </View>
      )}

      {/* Conditional: Absolute time picker */}
      {alarmType === 'absolute' && (
        <View style={{ backgroundColor: COLORS.surface, borderRadius: 12, padding: 12 }}>
          <AbsoluteTimePicker
            hour={absoluteHour}
            minute={absoluteMinute}
            onHourChange={setAbsoluteHour}
            onMinuteChange={setAbsoluteMinute}
          />
        </View>
      )}

      {/* Compact preview */}
      {previewTime && (
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 16,
          gap: 8,
        }}>
          <Text style={{ color: COLORS.accent, fontSize: 18, fontWeight: '700' }}>
            {formatTime(previewTime)}
          </Text>
          <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>
            {alarmType === 'relative' ? `based on ${referenceEvent}` : formatRepeatDays(repeatMode, repeatDays)}
          </Text>
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
          marginTop: 24,
          marginBottom: 12,
        })}
      >
        <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}>
          Save Changes
        </Text>
      </Pressable>

    </ScrollView>
    </KeyboardAvoidingView>
  );
}
