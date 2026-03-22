import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Linking, Platform } from 'react-native';
import {
  checkNotificationPermission,
  requestNotificationPermission,
} from '../services/notificationService';
import { COLORS } from '../utils/constants';

/**
 * Banner shown on the home screen when notification permission is denied.
 * Alarms cannot fire without notification permission.
 */
export function PermissionBanner() {
  const [notifGranted, setNotifGranted] = useState<boolean | null>(null);

  useEffect(() => {
    checkNotificationPermission().then(setNotifGranted);
  }, []);

  if (notifGranted === null || notifGranted) return null;

  const handleFix = async () => {
    const granted = await requestNotificationPermission();
    setNotifGranted(granted);

    if (!granted) {
      // Permission was denied — need to go to system settings
      if (Platform.OS === 'ios') {
        Linking.openSettings();
      } else {
        Linking.openSettings();
      }
    }
  };

  return (
    <View
      style={{
        backgroundColor: '#3a1a1a',
        borderRadius: 12,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#5a2a2a',
      }}
    >
      <Text style={{ color: COLORS.danger, fontSize: 15, fontWeight: '600', marginBottom: 6 }}>
        Notifications are disabled
      </Text>
      <Text style={{ color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 12 }}>
        Alarms cannot fire without notification permission. Please enable notifications for Sunrise.
      </Text>
      <Pressable
        onPress={handleFix}
        style={({ pressed }) => ({
          paddingVertical: 10,
          borderRadius: 8,
          backgroundColor: pressed ? '#c44444' : COLORS.danger,
          alignItems: 'center',
        })}
      >
        <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600' }}>
          Enable Notifications
        </Text>
      </Pressable>
    </View>
  );
}
