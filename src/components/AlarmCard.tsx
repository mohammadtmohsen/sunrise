import React, { useCallback } from 'react';
import { View, Text, Switch, Pressable, Alert } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import type { Alarm } from '../models/types';
import { formatOffset, formatTime, formatTime24, formatTimeUntil } from '../utils/timeUtils';
import { SunriseIcon, SunsetIcon, AlarmIcon } from './Icons';
import { COLORS } from '../utils/constants';

interface Props {
  alarm: Alarm;
  onToggle: (id: string) => void;
  onPress: (id: string) => void;
  onDelete: (id: string) => void;
}

const DELETE_THRESHOLD = -80;

export function AlarmCard({ alarm, onToggle, onPress, onDelete }: Props) {
  const isAbsolute = alarm.type === 'absolute';
  const eventLabel = isAbsolute ? 'Fixed time' : alarm.referenceEvent === 'sunrise' ? 'Sunrise' : 'Sunset';
  const EventIconComponent = isAbsolute ? AlarmIcon : alarm.referenceEvent === 'sunrise' ? SunriseIcon : SunsetIcon;
  const eventColor = isAbsolute ? COLORS.accent : alarm.referenceEvent === 'sunrise' ? COLORS.sunrise : COLORS.sunset;

  const translateX = useSharedValue(0);

  const confirmDelete = useCallback(() => {
    Alert.alert('Delete Alarm', `Delete "${alarm.name}"?`, [
      { text: 'Cancel', style: 'cancel', onPress: () => { translateX.value = withSpring(0); } },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(alarm.id) },
    ]);
  }, [alarm.id, alarm.name, onDelete]);

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      if (event.translationX < 0) {
        translateX.value = Math.max(event.translationX, -120);
      }
    })
    .onEnd((event) => {
      if (event.translationX < DELETE_THRESHOLD) {
        translateX.value = withTiming(-120);
        runOnJS(confirmDelete)();
      } else {
        translateX.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={{ marginHorizontal: 16, marginBottom: 10, borderRadius: 14, overflow: 'hidden' }}>
      {/* Delete background */}
      <View
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 120,
          backgroundColor: COLORS.danger,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600' }}>Delete</Text>
      </View>

      {/* Card */}
      <GestureDetector gesture={swipeGesture}>
        <Animated.View style={cardStyle}>
          <Pressable
            onPress={() => onPress(alarm.id)}
            style={({ pressed }) => ({
              backgroundColor: pressed ? COLORS.surfaceLight : COLORS.surface,
              borderRadius: 14,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
            })}
            accessibilityRole="button"
            accessibilityLabel={`${alarm.name}, ${isAbsolute ? formatTime24(alarm.absoluteHour, alarm.absoluteMinute) : `${formatOffset(alarm.offsetMinutes)} ${eventLabel}`}, ${alarm.isEnabled ? 'enabled' : 'disabled'}${alarm.nextTriggerAt && alarm.isEnabled ? `, next at ${formatTime(new Date(alarm.nextTriggerAt))}` : ''}`}
            accessibilityHint="Double tap to edit"
          >
            {/* Event icon */}
            <View style={{ marginRight: 14 }} accessibilityElementsHidden>
              <EventIconComponent size={28} />
            </View>

            {/* Info */}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 2 }}>
                <Text
                  style={{
                    color: COLORS.textPrimary,
                    fontSize: 17,
                    fontWeight: '600',
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  {alarm.name}
                </Text>
                {alarm.nextTriggerAt && (
                  <Text style={{ color: alarm.isEnabled ? COLORS.textPrimary : COLORS.textMuted, fontSize: 17, fontWeight: '700', paddingLeft: 8 }}>
                    {formatTime(new Date(alarm.nextTriggerAt))}
                  </Text>
                )}
              </View>
              <Text style={{ color: alarm.isEnabled ? eventColor : COLORS.textMuted, fontSize: 13, marginBottom: 2 }}>
                {isAbsolute
                  ? `Daily at ${formatTime24(alarm.absoluteHour, alarm.absoluteMinute)}`
                  : `${formatOffset(alarm.offsetMinutes)} ${eventLabel.toLowerCase()}`}
              </Text>
              {alarm.nextTriggerAt && (
                <Text style={{ color: alarm.isEnabled ? COLORS.accent : COLORS.textMuted, fontSize: 12 }}>
                  {alarm.isEnabled ? formatTimeUntil(new Date(alarm.nextTriggerAt)) : 'Disabled'}
                </Text>
              )}
            </View>

            {/* Toggle */}
            <Switch
              style={{ marginLeft: 12 }}
              value={alarm.isEnabled}
              onValueChange={() => onToggle(alarm.id)}
              trackColor={{ false: COLORS.border, true: eventColor }}
              thumbColor="#ffffff"
              accessibilityLabel={`Toggle ${alarm.name} ${alarm.isEnabled ? 'off' : 'on'}`}
            />
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
