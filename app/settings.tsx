import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { AnimatedToggle } from '../src/components/AlarmCard';
import { pickAudioFile, deleteCustomSound } from '../src/services/audioPickerService';
import { playPreviewSound, stopPreviewSound } from '../src/services/soundService';
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
  needsFullScreenIntentPermission,
  openFullScreenIntentSettings,
} from '../src/services/notificationService';
import {
  updatePersistentNotification,
  cancelPersistentNotification,
} from '../src/services/persistentNotificationService';
import { scheduleAllAlarms } from '../src/services/alarmScheduler';
import { useAlarmStore } from '../src/stores/alarmStore';
import { useLocationStore } from '../src/stores/locationStore';
import { getSunTimes, isSunTimesValid } from '../src/services/sunCalcService';
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
        backgroundColor:
          pressed && onPress ? COLORS.surfaceLight : COLORS.surface,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
      })}
    >
      <Text style={{ color: COLORS.textPrimary, fontSize: 16, flex: 1 }}>
        {label}
      </Text>
      {value && (
        <Text
          style={{ color: valueColor ?? COLORS.textSecondary, fontSize: 16 }}
        >
          {value}
        </Text>
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
    forceAlarmEvents,
    setForceAlarmEvents,
    customSoundUri,
    customSoundName,
    setCustomSound,
    clearCustomSound,
    customReminderSoundUri,
    customReminderSoundName,
    setCustomReminderSound,
    clearCustomReminderSound,
  } = useSettingsStore();

  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isPreviewingReminder, setIsPreviewingReminder] = useState(false);
  const [notifPermission, setNotifPermission] = useState<boolean | null>(null);
  const [criticalAlerts, setCriticalAlerts] = useState<boolean | null>(null);
  const [batteryInfo, setBatteryInfo] = useState<{
    isOptimized: boolean;
    hasPowerManager: boolean;
  } | null>(null);

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

  const handlePickSound = useCallback(async () => {
    try {
      const result = await pickAudioFile();
      if (result) {
        if (customSoundUri) {
          await deleteCustomSound(customSoundUri);
        }
        setCustomSound(result.uri, result.name);
      }
    } catch {
      Alert.alert('Error', 'Failed to select audio file. Please try again.');
    }
  }, [customSoundUri, setCustomSound]);

  const handlePreview = useCallback(async () => {
    if (isPreviewing) {
      await stopPreviewSound();
      setIsPreviewing(false);
    } else {
      setIsPreviewing(true);
      await playPreviewSound(customSoundUri);
      setTimeout(async () => {
        await stopPreviewSound();
        setIsPreviewing(false);
      }, 10000);
    }
  }, [isPreviewing, customSoundUri]);

  const handleResetSound = useCallback(async () => {
    if (customSoundUri) {
      await deleteCustomSound(customSoundUri);
    }
    clearCustomSound();
    await stopPreviewSound();
    setIsPreviewing(false);
  }, [customSoundUri, clearCustomSound]);

  const handlePickReminderSound = useCallback(async () => {
    try {
      const result = await pickAudioFile();
      if (result) {
        if (customReminderSoundUri) {
          await deleteCustomSound(customReminderSoundUri);
        }
        setCustomReminderSound(result.uri, result.name);
      }
    } catch {
      Alert.alert('Error', 'Failed to select audio file. Please try again.');
    }
  }, [customReminderSoundUri, setCustomReminderSound]);

  const handlePreviewReminder = useCallback(async () => {
    if (isPreviewingReminder) {
      await stopPreviewSound();
      setIsPreviewingReminder(false);
    } else {
      setIsPreviewingReminder(true);
      await playPreviewSound(customReminderSoundUri);
      setTimeout(async () => {
        await stopPreviewSound();
        setIsPreviewingReminder(false);
      }, 10000);
    }
  }, [isPreviewingReminder, customReminderSoundUri]);

  const handleResetReminderSound = useCallback(async () => {
    if (customReminderSoundUri) {
      await deleteCustomSound(customReminderSoundUri);
    }
    clearCustomReminderSound();
    await stopPreviewSound();
    setIsPreviewingReminder(false);
  }, [customReminderSoundUri, clearCustomReminderSound]);

  useEffect(() => {
    return () => { stopPreviewSound(); };
  }, []);

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
      <Text
        style={{
          color: COLORS.textSecondary,
          fontSize: 13,
          marginLeft: 20,
          marginTop: 24,
          marginBottom: 8,
        }}
      >
        LOCATION
      </Text>
      <View
        style={{ borderRadius: 12, overflow: 'hidden', marginHorizontal: 16 }}
      >
        <SettingsRow
          label='Current Location'
          value={
            location
              ? `${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`
              : 'Not set'
          }
        />
        <SettingsRow
          label='Refresh Location'
          value={isLoading ? 'Loading...' : 'Tap to refresh'}
          onPress={fetchLocation}
        />
        <SettingsRow
          label='Source'
          value={
            location?.source === 'gps'
              ? 'GPS'
              : location?.source === 'manual'
                ? 'Manual'
                : 'N/A'
          }
        />
      </View>

      {/* Permissions */}
      <Text
        style={{
          color: COLORS.textSecondary,
          fontSize: 13,
          marginLeft: 20,
          marginTop: 24,
          marginBottom: 8,
        }}
      >
        PERMISSIONS
      </Text>
      <View
        style={{ borderRadius: 12, overflow: 'hidden', marginHorizontal: 16 }}
      >
        <SettingsRow
          label='Notifications'
          value={
            notifPermission === null
              ? 'Checking...'
              : notifPermission
                ? 'Granted'
                : 'Denied'
          }
          valueColor={notifPermission ? COLORS.success : COLORS.danger}
          onPress={notifPermission ? undefined : handleNotifPermission}
        />
        {Platform.OS === 'android' && (
          <>
            <SettingsRow
              label='Exact Alarms'
              value='Open settings'
              onPress={openAlarmPermissionSettings}
            />
            {needsFullScreenIntentPermission() && (
              <SettingsRow
                label='Full-Screen Alarm'
                value='Enable (required)'
                valueColor={COLORS.accent}
                onPress={openFullScreenIntentSettings}
              />
            )}
            {batteryInfo?.isOptimized && (
              <SettingsRow
                label='Battery Optimization'
                value='Disable for alarms'
                valueColor={COLORS.danger}
                onPress={openBatterySettings}
              />
            )}
            {batteryInfo?.hasPowerManager && (
              <SettingsRow
                label='Power Manager'
                value='Configure'
                onPress={openPowerManagerSettings}
              />
            )}
          </>
        )}
        {Platform.OS === 'ios' && (
          <>
            <SettingsRow
              label='Critical Alerts'
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
              <View
                style={{
                  backgroundColor: COLORS.surface,
                  padding: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: COLORS.border,
                }}
              >
                <Text
                  style={{
                    color: COLORS.textMuted,
                    fontSize: 12,
                    lineHeight: 17,
                  }}
                >
                  Critical Alerts allow alarms to play sound even in Do Not
                  Disturb and Focus modes. This requires a special entitlement
                  from Apple.
                  {'\n\n'}
                  Without Critical Alerts, alarms use Time Sensitive
                  notifications which may be silenced in strict Focus modes.
                </Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* Alarm Defaults */}
      <Text
        style={{
          color: COLORS.textSecondary,
          fontSize: 13,
          marginLeft: 20,
          marginTop: 24,
          marginBottom: 8,
        }}
      >
        ALARM DEFAULTS
      </Text>
      <View
        style={{ borderRadius: 12, overflow: 'hidden', marginHorizontal: 16 }}
      >
        <SettingsRow
          label='Snooze Duration'
          value={`${defaultSnoozeDuration} min`}
          onPress={handleSnoozeDuration}
        />
        {/* Alarm Sound */}
        <Pressable
          onPress={handlePickSound}
          style={{
            backgroundColor: COLORS.surface,
            padding: 16,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: COLORS.border,
          }}
        >
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ color: COLORS.textPrimary, fontSize: 16 }}>
              Alarm Sound
            </Text>
            <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
              {customSoundName ?? 'Default'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable
              onPress={(e) => { e.stopPropagation(); handlePreview(); }}
              hitSlop={8}
              style={{
                paddingVertical: 4,
                paddingHorizontal: 10,
                borderRadius: 8,
                backgroundColor: isPreviewing ? COLORS.accent : 'rgba(255,255,255,0.06)',
              }}
            >
              <Text style={{ color: isPreviewing ? '#000000' : COLORS.accent, fontSize: 13, fontWeight: '600' }}>
                {isPreviewing ? 'Stop' : 'Play'}
              </Text>
            </Pressable>
            {customSoundUri && (
              <Pressable
                onPress={(e) => { e.stopPropagation(); handleResetSound(); }}
                hitSlop={8}
              >
                <Text style={{ color: COLORS.danger, fontSize: 13, fontWeight: '600' }}>
                  Reset
                </Text>
              </Pressable>
            )}
          </View>
        </Pressable>

        {/* Reminder Sound */}
        <Pressable
          onPress={handlePickReminderSound}
          style={{
            backgroundColor: COLORS.surface,
            padding: 16,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: COLORS.border,
          }}
        >
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ color: COLORS.textPrimary, fontSize: 16 }}>
              Reminder Sound
            </Text>
            <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
              {customReminderSoundName ?? 'Default'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable
              onPress={(e) => { e.stopPropagation(); handlePreviewReminder(); }}
              hitSlop={8}
              style={{
                paddingVertical: 4,
                paddingHorizontal: 10,
                borderRadius: 8,
                backgroundColor: isPreviewingReminder ? COLORS.accent : 'rgba(255,255,255,0.06)',
              }}
            >
              <Text style={{ color: isPreviewingReminder ? '#000000' : COLORS.accent, fontSize: 13, fontWeight: '600' }}>
                {isPreviewingReminder ? 'Stop' : 'Play'}
              </Text>
            </Pressable>
            {customReminderSoundUri && (
              <Pressable
                onPress={(e) => { e.stopPropagation(); handleResetReminderSound(); }}
                hitSlop={8}
              >
                <Text style={{ color: COLORS.danger, fontSize: 13, fontWeight: '600' }}>
                  Reset
                </Text>
              </Pressable>
            )}
          </View>
        </Pressable>

        {/* Vibration */}
        <View
          style={{
            backgroundColor: COLORS.surface,
            padding: 16,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: COLORS.textPrimary, fontSize: 16 }}>
            Vibration
          </Text>
          <AnimatedToggle
            value={defaultVibrate}
            onValueChange={() => setDefaultVibrate(!defaultVibrate)}
            activeColor="#7c3aed"
          />
        </View>
      </View>

      {/* Status Notification (Android only) */}
      {Platform.OS === 'android' && (
        <>
          <Text
            style={{
              color: COLORS.textSecondary,
              fontSize: 13,
              marginLeft: 20,
              marginTop: 24,
              marginBottom: 8,
            }}
          >
            STATUS NOTIFICATION
          </Text>
          <View
            style={{
              borderRadius: 12,
              overflow: 'hidden',
              marginHorizontal: 16,
            }}
          >
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
                <Text style={{ color: COLORS.textPrimary, fontSize: 16 }}>
                  Always-on notification
                </Text>
                <Text
                  style={{
                    color: COLORS.textMuted,
                    fontSize: 12,
                    marginTop: 4,
                  }}
                >
                  Shows sunrise time, next alarm, and countdown in your
                  notification shade
                </Text>
              </View>
              <AnimatedToggle
                value={showPersistentNotification}
                onValueChange={() => {
                  const next = !showPersistentNotification;
                  setShowPersistentNotification(next);
                  if (next) {
                    updatePersistentNotification();
                  } else {
                    cancelPersistentNotification();
                  }
                }}
                activeColor={COLORS.primary}
              />
            </View>
            {/* Force alarm events */}
            <View
              style={{
                backgroundColor: COLORS.surface,
                padding: 16,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTopWidth: 1,
                borderTopColor: COLORS.border,
              }}
            >
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ color: COLORS.textPrimary, fontSize: 16 }}>
                  Force alarm events
                </Text>
                <Text
                  style={{
                    color: COLORS.textMuted,
                    fontSize: 12,
                    marginTop: 4,
                  }}
                >
                  Improves alarm accuracy{'\n'}Note: The system will show an alarm icon in the status bar
                </Text>
              </View>
              <AnimatedToggle
                value={forceAlarmEvents}
                onValueChange={async () => {
                  const next = !forceAlarmEvents;
                  setForceAlarmEvents(next);
                  // Reschedule all alarms with the new alarm type
                  const loc = useLocationStore.getState().location;
                  const sun = loc ? getSunTimes(loc.latitude, loc.longitude) : null;
                  if (!sun || isSunTimesValid(sun)) {
                    const enabled = Object.values(useAlarmStore.getState().alarms).filter(a => a.isEnabled);
                    if (enabled.length > 0) {
                      await scheduleAllAlarms(enabled, sun);
                    }
                  }
                }}
                activeColor={COLORS.primary}
              />
            </View>
          </View>
        </>
      )}

      {/* About */}
      <Text
        style={{
          color: COLORS.textSecondary,
          fontSize: 13,
          marginLeft: 20,
          marginTop: 24,
          marginBottom: 8,
        }}
      >
        ABOUT
      </Text>
      <View
        style={{
          borderRadius: 12,
          overflow: 'hidden',
          marginHorizontal: 16,
          marginBottom: 40,
        }}
      >
        <SettingsRow label='Version' value='1.0.0' />
      </View>
    </ScrollView>
  );
}
