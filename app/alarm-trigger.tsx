import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Dimensions,
  StyleSheet,
  Platform,
  BackHandler,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  withSequence,
  runOnJS,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Line,
  Path,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import notifee from '@notifee/react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useAlarmStore } from '../src/stores/alarmStore';
import { playAlarmSound, stopAlarmSound } from '../src/services/soundService';
import { handleSnooze, handleDismiss } from '../src/services/alarmEventHandler';
import { formatTime } from '../src/utils/timeUtils';
import { COLORS } from '../src/utils/constants';
import { mmkv } from '../src/stores/storage';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DISMISS_THRESHOLD = -180;

// Arc dimensions
const ARC_W = 260;
const ARC_H = 130;
const HORIZON_Y = ARC_H - 10;
const SUN_R = 10;

function buildArc(w: number, _h: number, horizonY: number): string {
  const startX = 20;
  const endX = w - 20;
  const peakY = 16;
  const cpX1 = startX + (endX - startX) * 0.25;
  const cpY1 = peakY - 10;
  const cpX2 = startX + (endX - startX) * 0.75;
  const cpY2 = peakY - 10;
  return `M${startX},${horizonY} C${cpX1},${cpY1} ${cpX2},${cpY2} ${endX},${horizonY}`;
}

export default function AlarmTriggerScreen() {
  const params = useLocalSearchParams<{ alarmId: string }>();
  // Use alarmId from URL params, or fall back to MMKV pending-alarm-id
  // (covers deep links that arrive before pending alarm poll runs)
  const alarmId = params.alarmId || mmkv.getString('pending-alarm-id') || undefined;
  const alarm = useAlarmStore((s) => (alarmId ? s.alarms[alarmId] : null));
  // Fallback name from MMKV in case store isn't hydrated yet
  const fallbackName = mmkv.getString('pending-alarm-name') || undefined;
  const alarmName = alarm?.name ?? fallbackName ?? 'Alarm';
  const [currentTime, setCurrentTime] = useState(new Date());

  const translateY = useSharedValue(0);
  const breathe = useSharedValue(0);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    activateKeepAwakeAsync('alarm-trigger');

    // Clear pending alarm keys now that the trigger screen is open
    mmkv.delete('pending-alarm-id');
    mmkv.delete('pending-alarm-name');

    async function setup() {
      if (Platform.OS === 'android' && alarmId) {
        // Stop foreground service first — this kills the service's sound/vibration
        try { await notifee.stopForegroundService(); } catch {}
        try { await notifee.cancelNotification(alarmId); } catch {}
        try { await notifee.cancelNotification(`${alarmId}-snooze`); } catch {}
      }
      // Stop any existing sound (from foreground service's JS context leaking)
      await stopAlarmSound();
      // Play sound fresh in this screen's context
      await playAlarmSound();
    }
    setup();

    return () => {
      stopAlarmSound();
      deactivateKeepAwake('alarm-trigger');
    };
  }, [alarmId]);

  // Gentle breathing animation for the sun dot
  useEffect(() => {
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.cubic) }),
      ),
      -1,
      true,
    );
  }, []);

  const onDismiss = useCallback(async () => {
    if (alarmId) {
      await handleDismiss(alarmId);
    }
    setTimeout(() => BackHandler.exitApp(), 300);
  }, [alarmId]);

  const onSnooze = useCallback(async () => {
    if (alarmId) {
      await handleSnooze(alarmId);
    }
    setTimeout(() => BackHandler.exitApp(), 300);
  }, [alarmId]);

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

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: interpolate(translateY.value, [0, -SCREEN_HEIGHT], [1, 0.3]),
  }));

  const sunGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breathe.value, [0, 1], [0.3, 0.6]),
  }));

  const isSunrise = alarm?.referenceEvent === 'sunrise' || !alarm;
  const eventColor = isSunrise ? COLORS.sunrise : COLORS.sunset;
  const snoozeMins = alarm?.snoozeDurationMinutes ?? 5;

  // Sun sits at the peak of the arc
  const sunX = ARC_W / 2;
  const sunY = 16;

  const arcPath = buildArc(ARC_W, ARC_H, HORIZON_Y);

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[styles.container, containerStyle]}
        accessibilityRole="alert"
        accessibilityLabel={`Alarm: ${alarmName}. Swipe up to dismiss.`}
      >
        {/* Arc illustration */}
        <View style={styles.arcArea}>
          <Svg width={ARC_W} height={ARC_H}>
            <Defs>
              <LinearGradient id="arcStroke" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0%" stopColor={eventColor} stopOpacity={0.1} />
                <Stop offset="50%" stopColor={eventColor} stopOpacity={0.4} />
                <Stop offset="100%" stopColor={eventColor} stopOpacity={0.1} />
              </LinearGradient>
              <RadialGradient id="dotGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={eventColor} stopOpacity={0.4} />
                <Stop offset="100%" stopColor={eventColor} stopOpacity={0} />
              </RadialGradient>
            </Defs>

            {/* Horizon */}
            <Line
              x1={20} y1={HORIZON_Y} x2={ARC_W - 20} y2={HORIZON_Y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={0.5}
            />

            {/* Arc curve */}
            <Path
              d={arcPath}
              stroke="url(#arcStroke)"
              strokeWidth={1.5}
              fill="none"
              strokeLinecap="round"
            />

            {/* Sun glow (animated via wrapper) */}
          </Svg>

          {/* Animated glow behind sun */}
          <Animated.View style={[{
            position: 'absolute',
            left: sunX - 24,
            top: sunY - 24,
          }, sunGlowStyle]}>
            <Svg width={48} height={48}>
              <Circle cx={24} cy={24} r={24} fill="url(#dotGlow)" />
            </Svg>
          </Animated.View>

          {/* Sun dot */}
          <View style={{
            position: 'absolute',
            left: sunX - SUN_R,
            top: sunY - SUN_R,
            width: SUN_R * 2,
            height: SUN_R * 2,
            borderRadius: SUN_R,
            backgroundColor: '#ffffff',
          }} />
        </View>

        {/* Time */}
        <Text style={styles.time}>
          {formatTime(currentTime)}
        </Text>

        {/* Alarm name */}
        <Text style={[styles.name, { color: eventColor }]}>
          {alarmName}
        </Text>

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Snooze */}
        <Pressable
          onPress={onSnooze}
          style={({ pressed }) => [
            styles.snoozeButton,
            { backgroundColor: pressed ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)' },
          ]}
          accessibilityLabel={`Snooze for ${snoozeMins} minutes`}
          accessibilityRole="button"
        >
          <Text style={styles.snoozeText}>
            Snooze · {snoozeMins} min
          </Text>
        </Pressable>

        {/* Swipe hint */}
        <View style={styles.hintContainer}>
          <View style={styles.swipeBar} />
          <Text style={styles.hintText}>swipe up to dismiss</Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#0d0d1a',
    paddingTop: SCREEN_HEIGHT * 0.12,
    paddingHorizontal: 32,
    paddingBottom: 24,
  },
  arcArea: {
    width: ARC_W,
    height: ARC_H,
    marginBottom: 16,
  },
  time: {
    color: '#ffffff',
    fontSize: 64,
    fontWeight: '200',
    letterSpacing: 4,
    marginBottom: 8,
  },
  name: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  snoozeButton: {
    width: '100%',
    paddingVertical: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    marginBottom: 32,
  },
  snoozeText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  hintContainer: {
    alignItems: 'center',
    gap: 8,
    paddingBottom: 16,
  },
  swipeBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  hintText: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
});
