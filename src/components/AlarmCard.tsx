import React, { useCallback, useEffect } from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolateColor,
  runOnJS,
} from 'react-native-reanimated';
import type { Alarm } from '../models/types';
import {
  formatOffset,
  formatTime,
  formatTime24,
  formatTimeUntil,
  formatRepeatDays,
} from '../utils/timeUtils';
import { SunriseIcon, SunsetIcon, AlarmIcon } from './Icons';
import { COLORS } from '../utils/constants';

interface Props {
  alarm: Alarm;
  onToggle: (id: string) => void;
  onPress: (id: string) => void;
  onDelete: (id: string) => void;
}

const TRACK_W = 48;
const TRACK_H = 28;
const THUMB_SIZE = 22;
const THUMB_TRAVEL = TRACK_W - THUMB_SIZE - 6;

export function AnimatedToggle({
  value,
  onValueChange,
  activeColor,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: () => void;
  activeColor: string;
  accessibilityLabel?: string;
}) {
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 150 });
  }, [value]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [COLORS.border, activeColor],
    ),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * THUMB_TRAVEL }],
  }));

  return (
    <Pressable
      onPress={onValueChange}
      accessibilityRole='switch'
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
    >
      <Animated.View
        style={[
          {
            width: TRACK_W,
            height: TRACK_H,
            borderRadius: TRACK_H / 2,
            justifyContent: 'center',
            paddingHorizontal: 3,
          },
          trackStyle,
        ]}
      >
        <Animated.View
          style={[
            {
              width: THUMB_SIZE,
              height: THUMB_SIZE,
              borderRadius: THUMB_SIZE / 2,
              backgroundColor: '#ffffff',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.2,
              shadowRadius: 2,
              elevation: 3,
            },
            thumbStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

export function AlarmCard({ alarm, onToggle, onPress, onDelete }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const deleteThreshold = -(screenWidth * 0.5);
  const maxSwipe = -(screenWidth - 32);

  const isAbsolute = alarm.type === 'absolute';
  const eventLabel = isAbsolute
    ? 'Fixed time'
    : alarm.referenceEvent === 'sunrise'
      ? 'Sunrise'
      : 'Sunset';
  const EventIconComponent = isAbsolute
    ? AlarmIcon
    : alarm.referenceEvent === 'sunrise'
      ? SunriseIcon
      : SunsetIcon;
  const eventColor = isAbsolute
    ? COLORS.accent
    : alarm.referenceEvent === 'sunrise'
      ? COLORS.sunrise
      : COLORS.sunset;

  const translateX = useSharedValue(0);

  const doDelete = useCallback(() => {
    onDelete(alarm.id);
  }, [alarm.id, onDelete]);

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      if (event.translationX < 0) {
        translateX.value = Math.max(event.translationX, maxSwipe);
      }
    })
    .onEnd(() => {
      if (translateX.value < deleteThreshold) {
        translateX.value = withTiming(maxSwipe, { duration: 200 });
        runOnJS(doDelete)();
      } else {
        translateX.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteStyle = useAnimatedStyle(() => ({
    width: Math.abs(Math.min(translateX.value, 0)),
  }));

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 10,
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      {/* Delete background — grows with swipe */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: COLORS.danger,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
          },
          deleteStyle,
        ]}
      >
        <View
          style={{
            width: 24,
            height: 24,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: 18,
              height: 2,
              backgroundColor: '#ffffff',
              borderRadius: 1,
              position: 'absolute',
              top: 4,
            }}
          />
          <View
            style={{
              width: 14,
              height: 16,
              borderRadius: 2,
              borderWidth: 1.5,
              borderColor: '#ffffff',
              marginTop: 4,
            }}
          />
          <View
            style={{
              width: 8,
              height: 2,
              backgroundColor: '#ffffff',
              borderRadius: 1,
              position: 'absolute',
              top: 2,
            }}
          />
        </View>
      </Animated.View>

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
            accessibilityRole='button'
            accessibilityLabel={`${alarm.name}, ${isAbsolute ? formatTime24(alarm.absoluteHour, alarm.absoluteMinute) : `${formatOffset(alarm.offsetMinutes)} ${eventLabel}`}, ${alarm.isEnabled ? 'enabled' : 'disabled'}${alarm.nextTriggerAt ? `, next at ${formatTime(new Date(alarm.nextTriggerAt))}` : ''}`}
            accessibilityHint='Double tap to edit'
          >
            {/* Column 1: Time + Icon */}
            <View
              style={{ alignItems: 'center', marginRight: 14, minWidth: 56 }}
            >
              {alarm.nextTriggerAt ? (
                <Text
                  style={{
                    color: alarm.isEnabled
                      ? COLORS.textPrimary
                      : COLORS.textMuted,
                    fontSize: 18,
                    fontWeight: '700',
                    marginBottom: 6,
                  }}
                >
                  {formatTime(new Date(alarm.nextTriggerAt))}
                </Text>
              ) : (
                <Text
                  style={{
                    color: COLORS.textMuted,
                    fontSize: 14,
                    marginBottom: 6,
                  }}
                >
                  --:--
                </Text>
              )}
              <View
                accessibilityElementsHidden
                style={{
                  opacity: alarm.isEnabled ? 1 : 0.3,
                  position: 'relative',
                }}
              >
                <EventIconComponent size={30} />
                <Text
                  style={{
                    position: 'absolute',
                    bottom: 2,
                    right: -6,
                    color:
                      (alarm.repeatMode ?? 'once') === 'repeat'
                        ? COLORS.success
                        : COLORS.accent,
                    fontSize: 12,
                    fontWeight: '900',
                  }}
                >
                  {(alarm.repeatMode ?? 'once') === 'repeat'
                    ? '\u221E'
                    : '\u2460'}
                </Text>
              </View>
            </View>

            {/* Column 2: Details */}
            <View style={{ flex: 1 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 3,
                  gap: 6,
                }}
              >
                <Text
                  style={{
                    color: alarm.isEnabled
                      ? COLORS.textPrimary
                      : COLORS.textMuted,
                    fontSize: 17,
                    fontWeight: '600',
                    flexShrink: 1,
                  }}
                  numberOfLines={1}
                >
                  {alarm.name}
                </Text>
                <View
                  style={{
                    width: 16,
                    height: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: alarm.isEnabled ? 0.7 : 0.3,
                  }}
                >
                  <Text style={{ fontSize: 13, lineHeight: 16 }}>
                    {alarm.alarmStyle === 'reminder' ? '🔔' : '⏰'}
                  </Text>
                </View>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 3,
                  gap: 6,
                }}
              >
                <Text
                  style={{
                    color: alarm.isEnabled ? eventColor : COLORS.textMuted,
                    fontSize: 13,
                  }}
                  numberOfLines={1}
                >
                  {isAbsolute
                    ? formatTime24(alarm.absoluteHour, alarm.absoluteMinute)
                    : `${formatOffset(alarm.offsetMinutes)} ${eventLabel.toLowerCase()}`}
                </Text>
              </View>
              <Text
                style={{
                  color: alarm.isEnabled
                    ? COLORS.textSecondary
                    : COLORS.textMuted,
                  fontSize: 11,
                  marginBottom: 2,
                }}
              >
                {formatRepeatDays(alarm.repeatMode, alarm.repeatDays, alarm.nextTriggerAt)}
              </Text>
              <Text
                style={{
                  color: alarm.isEnabled ? COLORS.accent : COLORS.textMuted,
                  fontSize: 12,
                }}
              >
                {alarm.isEnabled
                  ? alarm.nextTriggerAt
                    ? formatTimeUntil(new Date(alarm.nextTriggerAt))
                    : ''
                  : 'Disabled'}
              </Text>
            </View>

            {/* Column 3: Toggle */}
            <View style={{ marginLeft: 12 }}>
              <AnimatedToggle
                value={alarm.isEnabled}
                onValueChange={() => onToggle(alarm.id)}
                activeColor={eventColor}
                accessibilityLabel={`Toggle ${alarm.name} ${alarm.isEnabled ? 'off' : 'on'}`}
              />
            </View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
