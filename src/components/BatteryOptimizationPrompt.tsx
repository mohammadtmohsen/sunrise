import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import {
  checkBatteryOptimization,
  openBatterySettings,
  openPowerManagerSettings,
} from '../services/notificationService';
import { useSettingsStore } from '../stores/settingsStore';
import { COLORS } from '../utils/constants';

/**
 * Banner that prompts the user to disable battery optimization on Android.
 * Without this, alarm scheduling may be unreliable on OEM-skinned devices
 * (Samsung, Xiaomi, Huawei, etc.).
 *
 * Shows once after onboarding. Can be dismissed permanently.
 */
export function BatteryOptimizationPrompt() {
  const [visible, setVisible] = useState(false);
  const [hasPowerManager, setHasPowerManager] = useState(false);
  const hasCompletedOnboarding = useSettingsStore((s) => s.hasCompletedOnboarding);

  useEffect(() => {
    if (Platform.OS !== 'android' || !hasCompletedOnboarding) return;

    async function check() {
      const info = await checkBatteryOptimization();
      if (info.isOptimized) {
        setVisible(true);
        setHasPowerManager(info.hasPowerManager);
      }
    }
    check();
  }, [hasCompletedOnboarding]);

  if (!visible) return null;

  return (
    <View
      style={{
        backgroundColor: '#3a2a0a',
        borderRadius: 12,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#5a4a1a',
      }}
    >
      <Text style={{ color: COLORS.accent, fontSize: 15, fontWeight: '600', marginBottom: 6 }}>
        Battery optimization is enabled
      </Text>
      <Text style={{ color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 12 }}>
        Your alarms may not fire reliably. Disable battery optimization for Sunrise to ensure alarms work when your screen is off.
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={async () => {
            await openBatterySettings();
          }}
          style={({ pressed }) => ({
            flex: 1,
            paddingVertical: 10,
            borderRadius: 8,
            backgroundColor: pressed ? '#d4941a' : COLORS.accent,
            alignItems: 'center',
          })}
        >
          <Text style={{ color: '#000000', fontSize: 14, fontWeight: '600' }}>
            Fix Now
          </Text>
        </Pressable>
        {hasPowerManager && (
          <Pressable
            onPress={async () => {
              await openPowerManagerSettings();
            }}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 10,
              borderRadius: 8,
              backgroundColor: pressed ? COLORS.surfaceLight : COLORS.surface,
              alignItems: 'center',
            })}
          >
            <Text style={{ color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' }}>
              Power Manager
            </Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => setVisible(false)}
          style={{
            paddingVertical: 10,
            paddingHorizontal: 12,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: COLORS.textMuted, fontSize: 14 }}>Dismiss</Text>
        </Pressable>
      </View>
    </View>
  );
}
