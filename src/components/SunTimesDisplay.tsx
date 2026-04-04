import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, {
  Path,
  Circle,
  Line,
  Defs,
  RadialGradient,
  LinearGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import type { SunTimes, AlarmMode } from '../models/types';
import { formatTime, formatTimeUntil } from '../utils/timeUtils';
import { SunriseIcon, SunsetIcon, AlarmIcon, LocationIcon } from './Icons';
import { COLORS } from '../utils/constants';

interface Props {
  sunTimes: SunTimes | null;
  isValid: boolean;
  // Interactive mode (add/edit screen only)
  mode?: AlarmMode;
  onModeChange?: (mode: AlarmMode) => void;
  alarmTime?: Date | null;
}

const CURVE_HEIGHT = 85;
const HORIZON_Y = 48;
const DAY_AMPLITUDE = 40;
const NIGHT_AMPLITUDE = 20;
const NUM_POINTS = 60;
const SUN_RADIUS = 7;

function getCurveY(
  frac: number,
  sunriseFrac: number,
  sunsetFrac: number,
): number {
  if (frac >= sunriseFrac && frac <= sunsetFrac) {
    const t = (frac - sunriseFrac) / (sunsetFrac - sunriseFrac);
    return HORIZON_Y - DAY_AMPLITUDE * Math.sin(Math.PI * t);
  }
  const nightDuration = 1 - (sunsetFrac - sunriseFrac);
  let t: number;
  if (frac > sunsetFrac) {
    t = (frac - sunsetFrac) / nightDuration;
  } else {
    t = (frac + 1 - sunsetFrac) / nightDuration;
  }
  return HORIZON_Y + NIGHT_AMPLITUDE * Math.sin(Math.PI * t);
}

function buildPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  const p = points[0];
  let d = `M${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    d += `L${points[i].x.toFixed(1)},${points[i].y.toFixed(1)}`;
  }
  return d;
}

function DaylightBar({
  sunrise,
  sunset,
  alarmTime,
  alarmColor,
}: {
  sunrise: Date;
  sunset: Date;
  alarmTime?: Date | null;
  alarmColor?: string;
}) {
  const [width, setWidth] = useState(300);
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const totalMs = 24 * 60 * 60 * 1000;

  const sunriseFrac = (sunrise.getTime() - dayStart.getTime()) / totalMs;
  const sunsetFrac = (sunset.getTime() - dayStart.getTime()) / totalMs;
  const nowFrac = Math.min(
    Math.max((now.getTime() - dayStart.getTime()) / totalMs, 0),
    1,
  );
  const isDaytime = now >= sunrise && now <= sunset;

  // Generate curve points
  const allPoints: { x: number; y: number }[] = [];
  const dayPointsList: { x: number; y: number }[] = [];
  const nightBeforeList: { x: number; y: number }[] = [];
  const nightAfterList: { x: number; y: number }[] = [];

  for (let i = 0; i <= NUM_POINTS; i++) {
    const frac = i / NUM_POINTS;
    const x = frac * width;
    const y = getCurveY(frac, sunriseFrac, sunsetFrac);
    allPoints.push({ x, y });
    if (frac >= sunriseFrac && frac <= sunsetFrac) {
      dayPointsList.push({ x, y });
    } else if (frac < sunriseFrac) {
      nightBeforeList.push({ x, y });
    } else {
      nightAfterList.push({ x, y });
    }
  }

  const dayPath = buildPath(dayPointsList);
  const nightBeforePath = buildPath(nightBeforeList);
  const nightAfterPath = buildPath(nightAfterList);

  // Filled area under day arc (close path along horizon)
  const dayFillPath =
    dayPointsList.length > 1
      ? dayPath +
        `L${dayPointsList[dayPointsList.length - 1].x.toFixed(1)},${HORIZON_Y}` +
        `L${dayPointsList[0].x.toFixed(1)},${HORIZON_Y}Z`
      : '';

  // Sun position on curve
  const sunX = nowFrac * width;
  const sunY = getCurveY(nowFrac, sunriseFrac, sunsetFrac);

  return (
    <View
      style={{ marginTop: 12 }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole='image'
      accessibilityLabel={`Sun path: sunrise at ${formatTime(sunrise)}, sunset at ${formatTime(sunset)}, ${isDaytime ? 'daytime' : now < sunrise ? 'before sunrise' : 'after sunset'}`}
    >
      <Svg width={width} height={CURVE_HEIGHT}>
        <Defs>
          {/* Warm glow under day arc */}
          <LinearGradient id='dayFill' x1='0' y1='0' x2='0' y2='1'>
            <Stop offset='0%' stopColor={COLORS.accent} stopOpacity={0.15} />
            <Stop offset='100%' stopColor={COLORS.accent} stopOpacity={0} />
          </LinearGradient>
          {/* Day arc stroke gradient: sunrise → sunset color */}
          <LinearGradient id='dayStroke' x1='0' y1='0' x2='1' y2='0'>
            <Stop offset='0%' stopColor={COLORS.sunrise} stopOpacity={0.7} />
            <Stop offset='50%' stopColor={COLORS.accent} stopOpacity={0.5} />
            <Stop offset='100%' stopColor={COLORS.sunset} stopOpacity={0.7} />
          </LinearGradient>
          {/* Sun outer glow */}
          <RadialGradient id='sunGlowOuter' cx='50%' cy='50%' r='50%'>
            <Stop offset='0%' stopColor={COLORS.accent} stopOpacity={0.25} />
            <Stop offset='100%' stopColor={COLORS.accent} stopOpacity={0} />
          </RadialGradient>
          {/* Sun inner glow */}
          <RadialGradient id='sunGlowInner' cx='50%' cy='50%' r='50%'>
            <Stop offset='0%' stopColor='#ffffff' stopOpacity={0.6} />
            <Stop offset='60%' stopColor='#ffffff' stopOpacity={0.15} />
            <Stop offset='100%' stopColor='#ffffff' stopOpacity={0} />
          </RadialGradient>
          {/* Night before: fades in toward sunrise */}
          <LinearGradient id='nightBeforeStroke' x1='0' y1='0' x2='1' y2='0'>
            <Stop offset='0%' stopColor='#8b9cc7' stopOpacity={0.05} />
            <Stop offset='50%' stopColor='#8b9cc7' stopOpacity={0.2} />
            <Stop offset='100%' stopColor={COLORS.sunrise} stopOpacity={0.4} />
          </LinearGradient>
          {/* Night after: fades out from sunset */}
          <LinearGradient id='nightAfterStroke' x1='0' y1='0' x2='1' y2='0'>
            <Stop offset='0%' stopColor={COLORS.sunset} stopOpacity={0.4} />
            <Stop offset='50%' stopColor='#8b9cc7' stopOpacity={0.2} />
            <Stop offset='100%' stopColor='#8b9cc7' stopOpacity={0.05} />
          </LinearGradient>
        </Defs>

        {/* Horizon line — full width */}
        <Line
          x1={0}
          y1={HORIZON_Y}
          x2={width}
          y2={HORIZON_Y}
          stroke='rgba(255,255,255,0.08)'
          strokeWidth={0.8}
        />

        {/* Warm fill under day arc */}
        {dayFillPath ? <Path d={dayFillPath} fill='url(#dayFill)' /> : null}

        {/* Night curves — cool blue fading into sunrise/sunset colors */}
        <Path
          d={nightBeforePath}
          stroke='url(#nightBeforeStroke)'
          strokeWidth={2}
          strokeLinecap='round'
          fill='none'
        />
        <Path
          d={nightAfterPath}
          stroke='url(#nightAfterStroke)'
          strokeWidth={2}
          strokeLinecap='round'
          fill='none'
        />

        {/* Day arc with gradient stroke */}
        <Path
          d={dayPath}
          stroke='url(#dayStroke)'
          strokeWidth={2.5}
          strokeLinecap='round'
          fill='none'
        />

        {/* Sunrise dot glow + dot */}
        <Circle
          cx={sunriseFrac * width}
          cy={HORIZON_Y}
          r={6}
          fill={COLORS.sunrise}
          opacity={0.15}
        />
        <Circle
          cx={sunriseFrac * width}
          cy={HORIZON_Y}
          r={3}
          fill={COLORS.sunrise}
          opacity={0.6}
        />

        {/* Sunset dot glow + dot */}
        <Circle
          cx={sunsetFrac * width}
          cy={HORIZON_Y}
          r={6}
          fill={COLORS.sunset}
          opacity={0.15}
        />
        <Circle
          cx={sunsetFrac * width}
          cy={HORIZON_Y}
          r={3}
          fill={COLORS.sunset}
          opacity={0.6}
        />

        {/* Alarm marker on curve */}
        {alarmTime && alarmColor && (() => {
          const alarmDayStart = new Date(alarmTime);
          alarmDayStart.setHours(0, 0, 0, 0);
          const alarmFrac = Math.min(Math.max((alarmTime.getTime() - alarmDayStart.getTime()) / totalMs, 0), 1);
          const alarmX = alarmFrac * width;
          const alarmY = getCurveY(alarmFrac, sunriseFrac, sunsetFrac);
          return (
            <>
              <Circle cx={alarmX} cy={alarmY} r={8} fill={alarmColor} opacity={0.15} />
              <Circle cx={alarmX} cy={alarmY} r={4} fill={alarmColor} opacity={0.8} />
              <Line
                x1={alarmX} y1={alarmY + 4}
                x2={alarmX} y2={HORIZON_Y}
                stroke={alarmColor}
                strokeWidth={0.8}
                strokeDasharray="2,2"
                opacity={0.4}
              />
            </>
          );
        })()}

        {/* Sun warm outer glow */}
        <Circle
          cx={sunX}
          cy={sunY}
          r={SUN_RADIUS * 4}
          fill='url(#sunGlowOuter)'
        />

        {/* Sun white inner glow */}
        <Circle
          cx={sunX}
          cy={sunY}
          r={SUN_RADIUS * 2}
          fill='url(#sunGlowInner)'
        />

        {/* Sun circle */}
        <Circle cx={sunX} cy={sunY} r={SUN_RADIUS} fill='#ffffff' />

        {/* Reference time markers */}
        {/* Midnight (0h) — left edge */}
        <Line
          x1={0}
          y1={HORIZON_Y - 3}
          x2={0}
          y2={HORIZON_Y + 3}
          stroke='rgba(255,255,255,0.15)'
          strokeWidth={0.8}
        />
        <SvgText
          x={4}
          y={HORIZON_Y + 12}
          fill='rgba(255,255,255,0.2)'
          fontSize={8}
          fontWeight='400'
        >
          0:00
        </SvgText>

        {/* 6 AM */}
        <Line
          x1={width * 0.25}
          y1={HORIZON_Y - 3}
          x2={width * 0.25}
          y2={HORIZON_Y + 3}
          stroke='rgba(255,255,255,0.15)'
          strokeWidth={0.8}
        />
        <SvgText
          x={width * 0.25}
          y={HORIZON_Y + 12}
          fill='rgba(255,255,255,0.2)'
          fontSize={8}
          fontWeight='400'
          textAnchor='middle'
        >
          6:00
        </SvgText>

        {/* Noon (12h) */}
        <Line
          x1={width * 0.5}
          y1={HORIZON_Y - 3}
          x2={width * 0.5}
          y2={HORIZON_Y + 3}
          stroke='rgba(255,255,255,0.15)'
          strokeWidth={0.8}
        />
        <SvgText
          x={width * 0.5}
          y={HORIZON_Y + 12}
          fill='rgba(255,255,255,0.2)'
          fontSize={8}
          fontWeight='400'
          textAnchor='middle'
        >
          12:00
        </SvgText>

        {/* 6 PM */}
        <Line
          x1={width * 0.75}
          y1={HORIZON_Y - 3}
          x2={width * 0.75}
          y2={HORIZON_Y + 3}
          stroke='rgba(255,255,255,0.15)'
          strokeWidth={0.8}
        />
        <SvgText
          x={width * 0.75}
          y={HORIZON_Y + 12}
          fill='rgba(255,255,255,0.2)'
          fontSize={8}
          fontWeight='400'
          textAnchor='middle'
        >
          18:00
        </SvgText>

        {/* Midnight (24h) — right edge */}
        <Line
          x1={width}
          y1={HORIZON_Y - 3}
          x2={width}
          y2={HORIZON_Y + 3}
          stroke='rgba(255,255,255,0.15)'
          strokeWidth={0.8}
        />
        <SvgText
          x={width - 4}
          y={HORIZON_Y + 12}
          fill='rgba(255,255,255,0.2)'
          fontSize={8}
          fontWeight='400'
          textAnchor='end'
        >
          0:00
        </SvgText>
      </Svg>
    </View>
  );
}

function DirectionPill({
  label,
  isActive,
  activeColor,
  onPress,
}: {
  label: string;
  isActive: boolean;
  activeColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      style={{
        flex: 1,
        paddingVertical: 6,
        borderRadius: 14,
        backgroundColor: isActive ? activeColor : COLORS.surface,
        borderWidth: 1,
        borderColor: isActive ? activeColor : 'rgba(255,255,255,0.08)',
        alignItems: 'center',
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
    >
      <Text style={{
        color: isActive ? '#ffffff' : COLORS.textMuted,
        fontSize: 12,
        fontWeight: isActive ? '700' : '500',
      }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function SunTimesDisplay({ sunTimes, isValid, mode, onModeChange, alarmTime }: Props) {
  const isInteractive = !!onModeChange;
  if (!sunTimes) {
    return (
      <View
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 16,
          padding: 24,
          marginHorizontal: 16,
        }}
        accessibilityRole='summary'
        accessibilityLabel='Location required to show sunrise and sunset times'
      >
        <View style={{ alignItems: 'center', marginBottom: 12 }}>
          <LocationIcon size={40} />
        </View>
        <Text
          style={{
            color: COLORS.textSecondary,
            fontSize: 16,
            textAlign: 'center',
            lineHeight: 22,
          }}
        >
          Pull down to enable location{'\n'}for sunrise & sunset times
        </Text>
      </View>
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
        accessibilityRole='summary'
        accessibilityLabel='No sunrise or sunset at your location today'
      >
        <Text
          style={{
            color: COLORS.textSecondary,
            fontSize: 16,
            textAlign: 'center',
          }}
        >
          No sunrise/sunset at your location today
        </Text>
      </View>
    );
  }

  const isSunriseSelected = mode === 'before-sunrise' || mode === 'after-sunrise';
  const isSunsetSelected = mode === 'before-sunset' || mode === 'after-sunset';
  const isFixedSelected = mode === 'fixed';

  // Determine alarm marker color
  const alarmMarkerColor = isSunriseSelected
    ? COLORS.sunrise
    : isSunsetSelected
      ? COLORS.sunset
      : isFixedSelected
        ? COLORS.primary
        : undefined;

  return (
    <View
      style={{
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 20,
        marginHorizontal: isInteractive ? 0 : 16,
      }}
      accessibilityRole='summary'
      accessibilityLabel={`Sunrise at ${formatTime(sunTimes.sunrise)}, sunset at ${formatTime(sunTimes.sunset)}`}
    >
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {/* Sunrise card */}
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(255,107,53,0.06)',
            borderRadius: 12,
            padding: 14,
            borderWidth: 1,
            borderColor: isInteractive && isSunriseSelected
              ? 'rgba(255,107,53,0.5)'
              : 'rgba(255,107,53,0.1)',
            opacity: 1,
          }}
          accessibilityLabel={`Sunrise at ${formatTime(sunTimes.sunrise)}, ${formatTimeUntil(sunTimes.sunrise)}`}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <SunriseIcon size={20} />
            <Text style={{
              color: COLORS.textMuted, fontSize: 11, marginLeft: 6,
              textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '500',
            }}>
              Sunrise
            </Text>
          </View>
          <Text style={{ color: COLORS.sunrise, fontSize: 24, fontWeight: '700', letterSpacing: -0.5 }}>
            {formatTime(sunTimes.sunrise)}
          </Text>
          <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 4 }}>
            {formatTimeUntil(sunTimes.sunrise)}
          </Text>
          {isInteractive && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <DirectionPill
                label="Before"
                isActive={mode === 'before-sunrise'}
                activeColor={COLORS.sunrise}
                onPress={() => onModeChange!('before-sunrise')}
              />
              <DirectionPill
                label="After"
                isActive={mode === 'after-sunrise'}
                activeColor={COLORS.sunrise}
                onPress={() => onModeChange!('after-sunrise')}
              />
            </View>
          )}
        </View>

        {/* Sunset card */}
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(196,69,105,0.06)',
            borderRadius: 12,
            padding: 14,
            borderWidth: 1,
            borderColor: isInteractive && isSunsetSelected
              ? 'rgba(196,69,105,0.5)'
              : 'rgba(196,69,105,0.1)',
            opacity: 1,
          }}
          accessibilityLabel={`Sunset at ${formatTime(sunTimes.sunset)}, ${formatTimeUntil(sunTimes.sunset)}`}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <SunsetIcon size={20} />
            <Text style={{
              color: COLORS.textMuted, fontSize: 11, marginLeft: 6,
              textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '500',
            }}>
              Sunset
            </Text>
          </View>
          <Text style={{ color: COLORS.sunset, fontSize: 24, fontWeight: '700', letterSpacing: -0.5 }}>
            {formatTime(sunTimes.sunset)}
          </Text>
          <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 4 }}>
            {formatTimeUntil(sunTimes.sunset)}
          </Text>
          {isInteractive && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <DirectionPill
                label="Before"
                isActive={mode === 'before-sunset'}
                activeColor={COLORS.sunset}
                onPress={() => onModeChange!('before-sunset')}
              />
              <DirectionPill
                label="After"
                isActive={mode === 'after-sunset'}
                activeColor={COLORS.sunset}
                onPress={() => onModeChange!('after-sunset')}
              />
            </View>
          )}
        </View>
      </View>

      {/* Daylight curve */}
      <DaylightBar
        sunrise={sunTimes.sunrise}
        sunset={sunTimes.sunset}
        alarmTime={isInteractive ? alarmTime : undefined}
        alarmColor={alarmMarkerColor}
      />

      {/* Fixed Time pill (interactive mode only) */}
      {isInteractive && (
        <Pressable
          onPress={() => { Haptics.selectionAsync(); onModeChange!('fixed'); }}
          style={{
            alignSelf: 'center',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginTop: 12,
            paddingVertical: 8,
            paddingHorizontal: 20,
            borderRadius: 20,
            backgroundColor: isFixedSelected ? COLORS.primary : COLORS.surface,
            borderWidth: 1,
            borderColor: isFixedSelected ? COLORS.primary : 'rgba(255,255,255,0.08)',
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: isFixedSelected }}
          accessibilityLabel="Fixed time alarm"
        >
          <AlarmIcon size={14} />
          <Text style={{
            color: isFixedSelected ? '#ffffff' : COLORS.textMuted,
            fontSize: 13,
            fontWeight: isFixedSelected ? '700' : '500',
          }}>
            Fixed Time
          </Text>
        </Pressable>
      )}

      {/* Refresh hint */}
    </View>
  );
}
