import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Dimensions,
  AppRegistry,
  Platform,
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
import { playAlarmSound, stopAlarmSound } from '../services/soundService';
import { handleSnooze, handleDismiss } from '../services/alarmEventHandler';
import { useAlarmStore } from '../stores/alarmStore';
import { SunriseIcon } from './Icons';
import { COLORS } from '../utils/constants';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DISMISS_THRESHOLD = -150;

/**
 * Standalone alarm screen rendered by Notifee's fullScreenAction mainComponent.
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

  // On Android, the foreground service already plays sound — only play on iOS
  useEffect(() => {
    if (Platform.OS === 'ios') {
      playAlarmSound();
    }
    return () => {
      stopAlarmSound();
    };
  }, []);

  // Pulse animation
  useEffect(() => {
    pulseScale.value = withRepeat(
      withTiming(1.15, { duration: 800 }),
      -1,
      true,
    );
  }, []);

  const onDismiss = useCallback(async () => {
    if (alarmId) {
      await handleDismiss(alarmId);
    } else {
      await stopAlarmSound();
    }
  }, [alarmId]);

  const onSnooze = useCallback(async () => {
    if (alarmId) {
      await handleSnooze(alarmId);
    } else {
      await stopAlarmSound();
    }
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
              {'▲'}
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
                Snooze · {snoozeMins} min
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

// Register as a standalone component for Notifee's fullScreenAction
AppRegistry.registerComponent('alarm-screen', () => AlarmScreenComponent);

export default AlarmScreenComponent;
