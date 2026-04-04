import React from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../utils/constants';

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

interface Props {
  repeatMode: 'once' | 'repeat';
  selectedDays: number[];
  onDaysChange: (days: number[]) => void;
}

export function DayPills({ repeatMode, selectedDays, onDaysChange }: Props) {
  const allSelected = ALL_DAYS.every((d) => selectedDays.includes(d));

  const handleDayPress = (day: number) => {
    Haptics.selectionAsync();
    if (repeatMode === 'once') {
      // Single-select: toggle the tapped day
      onDaysChange(selectedDays.includes(day) ? [] : [day]);
    } else {
      // Multi-select: toggle the tapped day
      if (selectedDays.includes(day)) {
        onDaysChange(selectedDays.filter((d) => d !== day));
      } else {
        onDaysChange([...selectedDays, day]);
      }
    }
  };

  const handleAllPress = () => {
    Haptics.selectionAsync();
    onDaysChange(allSelected ? [] : [...ALL_DAYS]);
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {DAY_LETTERS.map((letter, index) => {
        const isSelected = selectedDays.includes(index);
        return (
          <Pressable
            key={index}
            onPress={() => handleDayPress(index)}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: isSelected ? COLORS.primary : COLORS.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                color: isSelected ? '#ffffff' : COLORS.textMuted,
                fontSize: 13,
                fontWeight: isSelected ? '700' : '400',
              }}
            >
              {letter}
            </Text>
          </Pressable>
        );
      })}

      <Pressable
        onPress={handleAllPress}
        disabled={repeatMode === 'once'}
        style={{
          paddingHorizontal: 12,
          height: 34,
          borderRadius: 17,
          backgroundColor: allSelected && repeatMode === 'repeat' ? COLORS.primary : COLORS.surface,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: repeatMode === 'once' ? 0.3 : 1,
        }}
      >
        <Text
          style={{
            color: allSelected && repeatMode === 'repeat' ? '#ffffff' : COLORS.textMuted,
            fontSize: 13,
            fontWeight: allSelected && repeatMode === 'repeat' ? '700' : '400',
          }}
        >
          All
        </Text>
      </Pressable>
    </View>
  );
}
