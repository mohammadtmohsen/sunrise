import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Dimensions,
  AppRegistry,
  Platform,
  BackHandler,
} from 'react-native';
import {
  GestureHandlerRootView,
  GestureDetector,
  Gesture,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { dismissNativeAlarm } from '../services/nativeAlarmEngine';
import { playAlarmSound, stopAlarmSound } from '../services/soundService';
import { handleSnooze, handleDismiss } from '../services/alarmEventHandler';
import { useAlarmStore } from '../stores/alarmStore';
import { SunriseIcon } from './Icons';
import { COLORS } from '../utils/constants';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DISMISS_THRESHOLD = -150;

/**
 * Standalone alarm screen rendered by native AlarmActivity.
 * This runs in a separate React Native root on Android when the full-screen intent fires
 * (e.g., device is locked/screen off). It does NOT have access to Expo Router navigation.
 */
function AlarmScreenComponent({ notification }: { notification: any }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const translateY = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  const alarmName =
    notification?.data?.alarmName ?? notification?.title ?? 'Alarm';
  const alarmId = notification?.data?.alarmId as string | undefined;
  const alarm = alarmId ? useAlarmStore.getState().alarms[alarmId] : null;
  const snoozeMins = alarm?.snoozeDurationMinutes ?? 5;

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Sound lifecycle — matches alarm-trigger.tsx pattern.
  // On Android, the native AlarmService plays sound.
  // We dismiss native alarm first, then play fresh in this component's context if needed.
  useEffect(() => {
    async function setup() {
      if (Platform.OS === 'android') {
        // Dismiss native alarm service — stops sound/vibration and cancels notifications
        try { await dismissNativeAlarm(); } catch {}
      }
      // Stop any lingering sound, then play fresh
      await stopAlarmSound();
      await playAlarmSound();
    }
    setup();

    return () => {
      stopAlarmSound();
    };
  }, [alarmId]);

  // Pulse animation
  useEffect(() => {
    pulseScale.value = withRepeat(
      withTiming(1.15, { duration: 800 }),
      -1,
      true,
    );
  }, []);

  const onDismiss = useCallback(async () => {
    await stopAlarmSound();
    if (alarmId) {
      await handleDismiss(alarmId);
    }
    // Exit the standalone activity
    setTimeout(() => BackHandler.exitApp(), 300);
  }, [alarmId]);

  const onSnooze = useCallback(async () => {
    await stopAlarmSound();
    if (alarmId) {
      await handleSnooze(alarmId);
    }
    setTimeout(() => BackHandler.exitApp(), 300);
  }, [alarmId]);

  // Swipe up to dismiss
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY < 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY < DISMISS_THRESHOLD) {
        translateY.value = withTiming(-SCREEN_HEIGHT, { duration: 300 });
        runOnJS(onDismiss)();
      } else {
        translateY.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const timeString = currentTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            {
              flex: 1,
              backgroundColor: COLORS.background,
              alignItems: 'center',
              justifyContent: 'center',
              padding: 32,
            },
            animatedStyle,
          ]}
        >
          <Animated.View style={[{ marginBottom: 32 }, pulseStyle]}>
            <SunriseIcon size={80} />
          </Animated.View>

          <Text
            style={{
              color: COLORS.textPrimary,
              fontSize: 56,
              fontWeight: '200',
              letterSpacing: 2,
              marginBottom: 12,
            }}
          >
            {timeString}
          </Text>

          <Text
            style={{
              color: COLORS.sunrise,
              fontSize: 24,
              fontWeight: '600',
              marginBottom: 8,
            }}
          >
            {alarmName}
          </Text>

          <View
            style={{ marginTop: 4, marginBottom: 80, alignItems: 'center' }}
          >
            <Text
              style={{ color: COLORS.textMuted, fontSize: 28, marginBottom: 4 }}
            >
              {'\u25B2'}
            </Text>
            <Text style={{ color: COLORS.textMuted, fontSize: 15 }}>
              Swipe up to dismiss
            </Text>
          </View>

          <View style={{ width: '100%', gap: 12 }}>
            <Pressable
              onPress={onDismiss}
              style={({ pressed }) => ({
                paddingVertical: 18,
                borderRadius: 30,
                backgroundColor: pressed ? '#d13550' : COLORS.primary,
                alignItems: 'center',
              })}
            >
              <Text
                style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}
              >
                Dismiss
              </Text>
            </Pressable>

            <Pressable
              onPress={onSnooze}
              style={({ pressed }) => ({
                paddingVertical: 18,
                borderRadius: 30,
                backgroundColor: pressed ? COLORS.surfaceLight : COLORS.surface,
                alignItems: 'center',
              })}
            >
              <Text
                style={{
                  color: COLORS.textSecondary,
                  fontSize: 16,
                  fontWeight: '600',
                }}
              >
                Snooze \u00B7 {snoozeMins} min
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

// Register as a standalone component for native AlarmActivity
AppRegistry.registerComponent('alarm-screen', () => AlarmScreenComponent);

export default AlarmScreenComponent;
