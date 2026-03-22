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
import { formatOffset, formatTime, formatTime24 } from '../utils/timeUtils';
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
  const eventIcon = isAbsolute ? '⏰' : alarm.referenceEvent === 'sunrise' ? '☀️' : '🌅';
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
              opacity: alarm.isEnabled ? 1 : 0.5,
            })}
            accessibilityRole="button"
            accessibilityLabel={`${alarm.name}, ${isAbsolute ? formatTime24(alarm.absoluteHour, alarm.absoluteMinute) : `${formatOffset(alarm.offsetMinutes)} ${eventLabel}`}, ${alarm.isEnabled ? 'enabled' : 'disabled'}${alarm.nextTriggerAt && alarm.isEnabled ? `, next at ${formatTime(new Date(alarm.nextTriggerAt))}` : ''}`}
            accessibilityHint="Double tap to edit"
          >
            {/* Event icon */}
            <Text
              style={{ fontSize: 28, marginRight: 14 }}
              accessibilityElementsHidden
            >
              {eventIcon}
            </Text>

            {/* Info */}
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: COLORS.textPrimary,
                  fontSize: 17,
                  fontWeight: '600',
                  marginBottom: 2,
                }}
                numberOfLines={1}
              >
                {alarm.name}
              </Text>
              <Text style={{ color: eventColor, fontSize: 13, marginBottom: 2 }}>
                {isAbsolute
                  ? `Daily at ${formatTime24(alarm.absoluteHour, alarm.absoluteMinute)}`
                  : `${formatOffset(alarm.offsetMinutes)} ${eventLabel.toLowerCase()}`}
              </Text>
              {alarm.nextTriggerAt && alarm.isEnabled && (
                <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>
                  Next: {formatTime(new Date(alarm.nextTriggerAt))}
                </Text>
              )}
            </View>

            {/* Toggle */}
            <Switch
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
