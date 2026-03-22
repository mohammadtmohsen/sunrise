import React, { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import type { SunTimes } from '../models/types';
import { formatTime, formatTimeUntil } from '../utils/timeUtils';
import { SunriseIcon, SunsetIcon, LocationIcon } from './Icons';
import { COLORS } from '../utils/constants';

interface Props {
  sunTimes: SunTimes | null;
  isValid: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

function DaylightBar({ sunrise, sunset }: { sunrise: Date; sunset: Date }) {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);

  const totalMs = dayEnd.getTime() - dayStart.getTime();
  const sunrisePercent = ((sunrise.getTime() - dayStart.getTime()) / totalMs) * 100;
  const sunsetPercent = ((sunset.getTime() - dayStart.getTime()) / totalMs) * 100;
  const nowPercent = ((now.getTime() - dayStart.getTime()) / totalMs) * 100;

  const isDaytime = now >= sunrise && now <= sunset;
  const progressWidth = useSharedValue(0);

  useEffect(() => {
    progressWidth.value = withTiming(Math.min(nowPercent, 100), {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
  }, [nowPercent]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%` as any,
  }));

  return (
    <View style={{ marginTop: 16, paddingHorizontal: 4 }}>
      {/* Bar */}
      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: COLORS.border,
          overflow: 'hidden',
          flexDirection: 'row',
        }}
      >
        {/* Night before sunrise */}
        <View style={{ width: `${sunrisePercent}%`, backgroundColor: '#1a1a3e' }} />
        {/* Daylight */}
        <View
          style={{
            width: `${sunsetPercent - sunrisePercent}%`,
            backgroundColor: isDaytime ? COLORS.accent : '#4a3a1a',
            opacity: isDaytime ? 1 : 0.4,
          }}
        />
        {/* Night after sunset */}
        <View style={{ flex: 1, backgroundColor: '#1a1a3e' }} />

        {/* Now indicator */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: -2,
              height: 10,
              width: 10,
              borderRadius: 5,
              backgroundColor: COLORS.textPrimary,
              borderWidth: 2,
              borderColor: COLORS.background,
              marginLeft: -5,
            },
            progressStyle,
          ]}
        />
      </View>

      {/* Labels */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ color: COLORS.textMuted, fontSize: 11 }}>12 AM</Text>
        <Text style={{ color: isDaytime ? COLORS.accent : COLORS.textMuted, fontSize: 11, fontWeight: '600' }}>
          {isDaytime ? 'Daytime' : now < sunrise ? 'Before sunrise' : 'After sunset'}
        </Text>
        <Text style={{ color: COLORS.textMuted, fontSize: 11 }}>12 AM</Text>
      </View>
    </View>
  );
}

export function SunTimesDisplay({ sunTimes, isValid, onRefresh, isRefreshing }: Props) {
  if (!sunTimes) {
    return (
      <Pressable
        onPress={onRefresh}
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 16,
          padding: 24,
          marginHorizontal: 16,
        }}
        accessibilityRole="summary"
        accessibilityLabel="Location required to show sunrise and sunset times"
      >
        <View style={{ alignItems: 'center', marginBottom: 12 }}>
          <LocationIcon size={40} />
        </View>
        <Text style={{ color: COLORS.textSecondary, fontSize: 16, textAlign: 'center', lineHeight: 22 }}>
          Tap to enable location{'\n'}for sunrise & sunset times
        </Text>
      </Pressable>
    );
  }

  if (!isValid) {
    return (
      <View
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 16,
          padding: 24,
          marginHorizontal: 16,
        }}
        accessibilityRole="summary"
        accessibilityLabel="No sunrise or sunset at your location today"
      >
        <Text style={{ color: COLORS.textSecondary, fontSize: 16, textAlign: 'center' }}>
          No sunrise/sunset at your location today
        </Text>
      </View>
    );
  }




  return (
    <Pressable
      onPress={onRefresh}
      style={{
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 20,
        marginHorizontal: 16,
      }}
      accessibilityRole="summary"
      accessibilityLabel={`Sunrise at ${formatTime(sunTimes.sunrise)}, sunset at ${formatTime(sunTimes.sunset)}. Tap to refresh.`}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {/* Sunrise */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <View style={{ marginBottom: 4 }} accessibilityElementsHidden>
            <SunriseIcon size={28} />
          </View>
          <Text style={{ color: COLORS.textMuted, fontSize: 12, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
            Sunrise
          </Text>
          <Text
            style={{
              color: COLORS.sunrise,
              fontSize: 22,
              fontWeight: '700',
            }}
            accessibilityLabel={`Sunrise at ${formatTime(sunTimes.sunrise)}`}
          >
            {formatTime(sunTimes.sunrise)}
          </Text>
          <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 2 }}>
            {formatTimeUntil(sunTimes.sunrise)}
          </Text>
        </View>

        {/* Divider */}
        <View style={{ width: 1, backgroundColor: COLORS.border, marginHorizontal: 12, marginVertical: 4 }} />

        {/* Sunset */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <View style={{ marginBottom: 4 }} accessibilityElementsHidden>
            <SunsetIcon size={28} />
          </View>
          <Text style={{ color: COLORS.textMuted, fontSize: 12, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
            Sunset
          </Text>
          <Text
            style={{
              color: COLORS.sunset,
              fontSize: 22,
              fontWeight: '700',
            }}
            accessibilityLabel={`Sunset at ${formatTime(sunTimes.sunset)}`}
          >
            {formatTime(sunTimes.sunset)}
          </Text>
          <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 2 }}>
            {formatTimeUntil(sunTimes.sunset)}
          </Text>
        </View>
      </View>

      {/* Daylight progress bar */}
      <DaylightBar sunrise={sunTimes.sunrise} sunset={sunTimes.sunset} />

      {/* Refresh hint */}
      {isRefreshing && (
        <Text style={{ color: COLORS.textMuted, fontSize: 11, textAlign: 'center', marginTop: 8 }}>
          Updating location...
        </Text>
      )}
    </Pressable>
  );
}
