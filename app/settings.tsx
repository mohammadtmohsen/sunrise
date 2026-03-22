import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Switch, Alert, Platform, Linking } from 'react-native';
import { useLocation } from '../src/hooks/useLocation';
import { useSettingsStore } from '../src/stores/settingsStore';
import {
  checkNotificationPermission,
  requestNotificationPermission,
  checkCriticalAlertsPermission,
  checkBatteryOptimization,
  openBatterySettings,
  openPowerManagerSettings,
  openAlarmPermissionSettings,
} from '../src/services/notificationService';
import {
  updatePersistentNotification,
  cancelPersistentNotification,
} from '../src/services/persistentNotificationService';
import { COLORS } from '../src/utils/constants';

function SettingsRow({
  label,
  value,
  onPress,
  valueColor,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  valueColor?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed && onPress ? COLORS.surfaceLight : COLORS.surface,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
      })}
    >
      <Text style={{ color: COLORS.textPrimary, fontSize: 16, flex: 1 }}>{label}</Text>
      {value && (
        <Text style={{ color: valueColor ?? COLORS.textSecondary, fontSize: 16 }}>{value}</Text>
      )}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { location, isLoading, fetchLocation } = useLocation();
  const {
    defaultVibrate,
    setDefaultVibrate,
    defaultSnoozeDuration,
    setDefaultSnoozeDuration,
    showPersistentNotification,
    setShowPersistentNotification,
  } = useSettingsStore();

  const [notifPermission, setNotifPermission] = useState<boolean | null>(null);
  const [criticalAlerts, setCriticalAlerts] = useState<boolean | null>(null);
  const [batteryInfo, setBatteryInfo] = useState<{ isOptimized: boolean; hasPowerManager: boolean } | null>(null);

  useEffect(() => {
    async function checkPermissions() {
      const granted = await checkNotificationPermission();
      setNotifPermission(granted);

      if (Platform.OS === 'android') {
        const info = await checkBatteryOptimization();
        setBatteryInfo(info);
      }

      if (Platform.OS === 'ios') {
        const critical = await checkCriticalAlertsPermission();
        setCriticalAlerts(critical);
      }
    }
    checkPermissions();
  }, []);

  const handleNotifPermission = async () => {
    const granted = await requestNotificationPermission();
    setNotifPermission(granted);
    if (!granted) {
      Alert.alert(
        'Notifications Required',
        'Please enable notifications in your device settings to use alarms.',
      );
    }
  };

  const handleSnoozeDuration = () => {
    const options = [5, 10, 15, 20, 30];
    Alert.alert(
      'Snooze Duration',
      'Choose default snooze duration',
      options.map((mins) => ({
        text: `${mins} minutes`,
        onPress: () => setDefaultSnoozeDuration(mins),
      })),
    );
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Location */}
      <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginLeft: 20, marginTop: 24, marginBottom: 8 }}>
        LOCATION
      </Text>
      <View style={{ borderRadius: 12, overflow: 'hidden', marginHorizontal: 16 }}>
        <SettingsRow
          label="Current Location"
          value={
            location
              ? `${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`
              : 'Not set'
          }
        />
        <SettingsRow
          label="Refresh Location"
          value={isLoading ? 'Loading...' : 'Tap to refresh'}
          onPress={fetchLocation}
        />
        <SettingsRow
          label="Source"
          value={location?.source === 'gps' ? 'GPS' : location?.source === 'manual' ? 'Manual' : 'N/A'}
        />
      </View>

      {/* Permissions */}
      <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginLeft: 20, marginTop: 24, marginBottom: 8 }}>
        PERMISSIONS
      </Text>
      <View style={{ borderRadius: 12, overflow: 'hidden', marginHorizontal: 16 }}>
        <SettingsRow
          label="Notifications"
          value={notifPermission === null ? 'Checking...' : notifPermission ? 'Granted' : 'Denied'}
          valueColor={notifPermission ? COLORS.success : COLORS.danger}
          onPress={notifPermission ? undefined : handleNotifPermission}
        />
        {Platform.OS === 'android' && (
          <>
            <SettingsRow
              label="Exact Alarms"
              value="Open settings"
              onPress={openAlarmPermissionSettings}
            />
            {batteryInfo?.isOptimized && (
              <SettingsRow
                label="Battery Optimization"
                value="Disable for alarms"
                valueColor={COLORS.danger}
                onPress={openBatterySettings}
              />
            )}
            {batteryInfo?.hasPowerManager && (
              <SettingsRow
                label="Power Manager"
                value="Configure"
                onPress={openPowerManagerSettings}
              />
            )}
          </>
        )}
        {Platform.OS === 'ios' && (
          <>
            <SettingsRow
              label="Critical Alerts"
              value={
                criticalAlerts === null
                  ? 'Checking...'
                  : criticalAlerts
                    ? 'Enabled'
                    : 'Not available'
              }
              valueColor={criticalAlerts ? COLORS.success : COLORS.textMuted}
              onPress={() => Linking.openSettings()}
            />
            {criticalAlerts === false && (
              <View style={{ backgroundColor: COLORS.surface, padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                <Text style={{ color: COLORS.textMuted, fontSize: 12, lineHeight: 17 }}>
                  Critical Alerts allow alarms to play sound even in Do Not Disturb and Focus modes. This requires a special entitlement from Apple.
                  {'\n\n'}
                  Without Critical Alerts, alarms use Time Sensitive notifications which may be silenced in strict Focus modes.
                </Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* Alarm Defaults */}
      <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginLeft: 20, marginTop: 24, marginBottom: 8 }}>
        ALARM DEFAULTS
      </Text>
      <View style={{ borderRadius: 12, overflow: 'hidden', marginHorizontal: 16 }}>
        <SettingsRow
          label="Snooze Duration"
          value={`${defaultSnoozeDuration} min`}
          onPress={handleSnoozeDuration}
        />
        <View
          style={{
            backgroundColor: COLORS.surface,
            padding: 16,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: COLORS.textPrimary, fontSize: 16 }}>Vibration</Text>
          <Switch
            value={defaultVibrate}
            onValueChange={setDefaultVibrate}
            trackColor={{ false: COLORS.border, true: COLORS.primary }}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      {/* Status Notification (Android only) */}
      {Platform.OS === 'android' && (
        <>
          <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginLeft: 20, marginTop: 24, marginBottom: 8 }}>
            STATUS NOTIFICATION
          </Text>
          <View style={{ borderRadius: 12, overflow: 'hidden', marginHorizontal: 16 }}>
            <View
              style={{
                backgroundColor: COLORS.surface,
                padding: 16,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ color: COLORS.textPrimary, fontSize: 16 }}>Always-on notification</Text>
                <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 4 }}>
                  Shows sunrise time, next alarm, and countdown in your notification shade
                </Text>
              </View>
              <Switch
                value={showPersistentNotification}
                onValueChange={(value) => {
                  setShowPersistentNotification(value);
                  if (value) {
                    updatePersistentNotification();
                  } else {
                    cancelPersistentNotification();
                  }
                }}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor="#ffffff"
              />
            </View>
          </View>
        </>
      )}

      {/* About */}
      <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginLeft: 20, marginTop: 24, marginBottom: 8 }}>
        ABOUT
      </Text>
      <View style={{ borderRadius: 12, overflow: 'hidden', marginHorizontal: 16, marginBottom: 40 }}>
        <SettingsRow label="Version" value="1.0.0" />
      </View>
    </ScrollView>
  );
}
