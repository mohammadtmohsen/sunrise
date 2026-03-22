import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, Dimensions, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
  Easing,
  interpolateColor,
} from 'react-native-reanimated';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useAlarmStore } from '../src/stores/alarmStore';
import { playAlarmSound, stopAlarmSound } from '../src/services/soundService';
import { dismissAlarm, scheduleSnooze } from '../src/services/alarmScheduler';
import { scheduleNextDayAlarm } from '../src/services/nextDayScheduler';
import { COLORS } from '../src/utils/constants';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DISMISS_THRESHOLD = -150;

export default function AlarmTriggerScreen() {
  const router = useRouter();
  const { alarmId } = useLocalSearchParams<{ alarmId: string }>();
  const alarm = useAlarmStore((s) => (alarmId ? s.alarms[alarmId] : null));
  const [currentTime, setCurrentTime] = useState(new Date());

  const translateY = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.3);
  const chevronY = useSharedValue(0);
  const bgProgress = useSharedValue(0);

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Start alarm sound and keep screen awake
  useEffect(() => {
    activateKeepAwakeAsync('alarm-trigger');
    playAlarmSound();
    return () => {
      stopAlarmSound();
      deactivateKeepAwake('alarm-trigger');
    };
  }, []);

  // Animations
  useEffect(() => {
    // Pulsing icon
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 600, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 600, easing: Easing.in(Easing.cubic) }),
      ),
      -1,
      true,
    );

    // Glow effect
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 1000 }),
        withTiming(0.2, { duration: 1000 }),
      ),
      -1,
      true,
    );

    // Bouncing chevron hint
    chevronY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 600, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 600, easing: Easing.in(Easing.cubic) }),
      ),
      -1,
      true,
    );

    // Slow background color transition (sunrise effect)
    bgProgress.value = withRepeat(
      withTiming(1, { duration: 8000, easing: Easing.linear }),
      -1,
      true,
    );
  }, []);

  const handleDismiss = useCallback(async () => {
    await stopAlarmSound();
    if (alarmId) {
      await dismissAlarm(alarmId);
      await scheduleNextDayAlarm(alarmId);
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [alarmId, router]);

  const handleSnooze = useCallback(async () => {
    await stopAlarmSound();
    if (alarm) {
      await scheduleSnooze(alarm, alarm.snoozeDurationMinutes);
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [alarm, router]);

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
        runOnJS(handleDismiss)();
      } else {
        translateY.value = withSpring(0);
      }
    });

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: chevronY.value }],
  }));

  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      bgProgress.value,
      [0, 0.5, 1],
      ['#1a1a2e', '#2a1a2e', '#1a1a2e'],
    ),
  }));

  const timeString = currentTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const isSunrise = alarm?.referenceEvent === 'sunrise' || !alarm;
  const eventColor = isSunrise ? COLORS.sunrise : COLORS.sunset;

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[styles.container, containerStyle, bgStyle]}
        accessibilityRole="alert"
        accessibilityLabel={`Alarm: ${alarm?.name ?? 'Alarm'}. Swipe up to dismiss.`}
      >
        {/* Glow behind icon */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: '22%',
              width: 200,
              height: 200,
              borderRadius: 100,
              backgroundColor: eventColor,
            },
            glowStyle,
          ]}
        />

        {/* Icon */}
        <Animated.Text style={[{ fontSize: 80, marginBottom: 24 }, pulseStyle]}>
          {isSunrise ? '☀️' : '🌅'}
        </Animated.Text>

        {/* Time */}
        <Text style={[styles.time, { color: COLORS.textPrimary }]}>
          {timeString}
        </Text>

        {/* Alarm name */}
        <Text style={[styles.name, { color: eventColor }]}>
          {alarm?.name ?? 'Alarm'}
        </Text>

        {/* Swipe hint */}
        <View style={styles.hintContainer}>
          <Animated.Text style={[styles.chevron, { color: COLORS.textMuted }, chevronStyle]}>
            ▲
          </Animated.Text>
          <Text style={[styles.hintText, { color: COLORS.textMuted }]}>
            Swipe up to dismiss
          </Text>
        </View>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <Pressable
            onPress={handleDismiss}
            style={({ pressed }) => [
              styles.dismissButton,
              { backgroundColor: pressed ? '#d13550' : COLORS.primary },
            ]}
            accessibilityLabel="Dismiss alarm"
            accessibilityRole="button"
          >
            <Text style={styles.dismissText}>Dismiss</Text>
          </Pressable>

          <Pressable
            onPress={handleSnooze}
            style={({ pressed }) => [
              styles.snoozeButton,
              { backgroundColor: pressed ? COLORS.surfaceLight : COLORS.surface },
            ]}
            accessibilityLabel={`Snooze for ${alarm?.snoozeDurationMinutes ?? 5} minutes`}
            accessibilityRole="button"
          >
            <Text style={styles.snoozeText}>
              Snooze {alarm?.snoozeDurationMinutes ?? 5} min
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  time: {
    fontSize: 56,
    fontWeight: '200',
    letterSpacing: 2,
    marginBottom: 8,
  },
  name: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  hintContainer: {
    marginTop: 4,
    marginBottom: 60,
    alignItems: 'center',
  },
  chevron: {
    fontSize: 28,
    marginBottom: 2,
  },
  hintText: {
    fontSize: 15,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  dismissButton: {
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
  },
  dismissText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  snoozeButton: {
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
  },
  snoozeText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
});
