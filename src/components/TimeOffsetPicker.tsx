import React from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../utils/constants';

interface Props {
  hours: number;
  minutes: number;
  onHoursChange: (hours: number) => void;
  onMinutesChange: (minutes: number) => void;
}

function NumberStepper({
  label,
  value,
  onChange,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  max: number;
}) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginBottom: 8 }}>
        {label}
      </Text>
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
        accessibilityRole="adjustable"
        accessibilityLabel={`${label}: ${value}`}
        accessibilityValue={{ min: 0, max, now: value }}
      >
        <Pressable
          onPress={() => { Haptics.selectionAsync(); onChange(Math.max(0, value - 1)); }}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: COLORS.surfaceLight,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          accessibilityLabel={`Decrease ${label.toLowerCase()}`}
          accessibilityRole="button"
        >
          <Text style={{ color: COLORS.textPrimary, fontSize: 20, fontWeight: '700' }}>-</Text>
        </Pressable>
        <Text style={{ color: COLORS.textPrimary, fontSize: 36, fontWeight: '700', minWidth: 60, textAlign: 'center' }}>
          {String(value).padStart(2, '0')}
        </Text>
        <Pressable
          onPress={() => { Haptics.selectionAsync(); onChange(Math.min(max, value + 1)); }}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: COLORS.surfaceLight,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          accessibilityLabel={`Increase ${label.toLowerCase()}`}
          accessibilityRole="button"
        >
          <Text style={{ color: COLORS.textPrimary, fontSize: 20, fontWeight: '700' }}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function TimeOffsetPicker({ hours, minutes, onHoursChange, onMinutesChange }: Props) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 32, paddingVertical: 16 }}>
      <NumberStepper label="Hours" value={hours} onChange={onHoursChange} max={23} />
      <Text style={{ color: COLORS.textMuted, fontSize: 36, fontWeight: '700', alignSelf: 'flex-end', marginBottom: 0 }}>
        :
      </Text>
      <NumberStepper label="Minutes" value={minutes} onChange={onMinutesChange} max={59} />
    </View>
  );
}
