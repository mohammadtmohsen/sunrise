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

function Roller({
  label,
  value,
  onChange,
  max,
  format,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  max: number;
  format?: (v: number) => string;
}) {
  const display = format ? format(value) : String(value).padStart(2, '0');

  const increment = () => {
    Haptics.selectionAsync();
    onChange(value >= max ? 0 : value + 1);
  };

  const decrement = () => {
    Haptics.selectionAsync();
    onChange(value <= 0 ? max : value - 1);
  };

  return (
    <View
      style={{ alignItems: 'center' }}
      accessibilityRole="adjustable"
      accessibilityLabel={`${label}: ${display}`}
      accessibilityValue={{ min: 0, max, now: value }}
    >
      <Text style={{ color: COLORS.textMuted, fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </Text>
      <Pressable
        onPress={increment}
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: COLORS.surfaceLight,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
        }}
        accessibilityLabel={`Increase ${label.toLowerCase()}`}
        accessibilityRole="button"
      >
        <Text style={{ color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' }}>{'\u25B2'}</Text>
      </Pressable>
      <Text style={{ color: COLORS.textPrimary, fontSize: 42, fontWeight: '700', minWidth: 64, textAlign: 'center' }}>
        {display}
      </Text>
      <Pressable
        onPress={decrement}
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: COLORS.surfaceLight,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 8,
        }}
        accessibilityLabel={`Decrease ${label.toLowerCase()}`}
        accessibilityRole="button"
      >
        <Text style={{ color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' }}>{'\u25BC'}</Text>
      </Pressable>
    </View>
  );
}

export function AbsoluteTimePicker({ hour, minute, onHourChange, onMinuteChange }: Props) {
  const isPM = hour >= 12;
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

  const toggleAMPM = () => {
    Haptics.selectionAsync();
    onHourChange(isPM ? hour - 12 : hour + 12);
  };

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 12 }}>
      <Roller
        label="Hour"
        value={displayHour}
        onChange={(v) => {
          // Convert 12-hour display back to 24-hour
          let h24 = v;
          if (v === 12) {
            h24 = isPM ? 12 : 0;
          } else {
            h24 = isPM ? v + 12 : v;
          }
          onHourChange(h24);
        }}
        max={12}
        format={(v) => String(v)}
      />
      <Text style={{ color: COLORS.textMuted, fontSize: 42, fontWeight: '700', marginTop: 20 }}>:</Text>
      <Roller
        label="Minute"
        value={minute}
        onChange={onMinuteChange}
        max={59}
      />
      <Pressable
        onPress={toggleAMPM}
        style={{
          marginLeft: 8,
          marginTop: 20,
          paddingVertical: 10,
          paddingHorizontal: 16,
          borderRadius: 10,
          backgroundColor: COLORS.surfaceLight,
        }}
        accessibilityLabel={`Toggle to ${isPM ? 'AM' : 'PM'}`}
        accessibilityRole="button"
      >
        <Text style={{ color: isPM ? COLORS.sunset : COLORS.sunrise, fontSize: 18, fontWeight: '700' }}>
          {isPM ? 'PM' : 'AM'}
        </Text>
      </Pressable>
    </View>
  );
}
