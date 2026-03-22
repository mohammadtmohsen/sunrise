import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../utils/constants';

interface Props {
  title: string;
  canGoBack?: boolean;
  onBack?: () => void;
  children?: React.ReactNode;
}

export function AppHeader({ title, canGoBack, onBack, children }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ backgroundColor: COLORS.background, paddingTop: insets.top }}>
      <View style={{ height: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
        {canGoBack && onBack && (
          <Pressable
            onPress={onBack}
            hitSlop={12}
            style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginRight: 4 }}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Text style={{ color: COLORS.primary, fontSize: 28, fontWeight: '300', marginTop: -2 }}>{'‹'}</Text>
          </Pressable>
        )}
        <Text
          style={{ color: COLORS.textPrimary, fontSize: 18, fontWeight: '700', flex: 1 }}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}
