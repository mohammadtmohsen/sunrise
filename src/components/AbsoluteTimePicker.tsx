import React from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../utils/constants';

interface Props {
  hour: number;
  minute: number;
  onHourChange: (hour: number) => void;
  onMinuteChange: (minute: number) => void;
}

function NumberStepper({
  label,
  value,
  onChange,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  max: number;
  step?: number;
}) {
  return (
    <View
      style={{ alignItems: 'center', flex: 1 }}
      accessibilityRole="adjustable"
      accessibilityLabel={`${label}: ${value}`}
      accessibilityValue={{ min: 0, max, now: value }}
    >
      <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <Pressable
          onPress={() => { Haptics.selectionAsync(); onChange(value - step < 0 ? Math.floor(max / step) * step : value - step); }}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: COLORS.surfaceLight,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          accessibilityLabel={`Decrease ${label.toLowerCase()}`}
          accessibilityRole="button"
        >
          <Text style={{ color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' }}>-</Text>
        </Pressable>
        <Text style={{ color: COLORS.textPrimary, fontSize: 32, fontWeight: '700', width: 50, textAlign: 'center' }}>
          {String(value).padStart(2, '0')}
        </Text>
        <Pressable
          onPress={() => { Haptics.selectionAsync(); onChange(value + step > max ? 0 : value + step); }}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: COLORS.surfaceLight,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          accessibilityLabel={`Increase ${label.toLowerCase()}`}
          accessibilityRole="button"
        >
          <Text style={{ color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' }}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function AbsoluteTimePicker({ hour, minute, onHourChange, onMinuteChange }: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
      <NumberStepper label="Hours" value={hour} onChange={onHourChange} max={23} />
      <Text style={{ color: COLORS.textMuted, fontSize: 32, fontWeight: '700', marginTop: 16 }}>
        :
      </Text>
      <NumberStepper label="Minutes" value={minute} onChange={onMinuteChange} max={59} step={1} />
    </View>
  );
}
