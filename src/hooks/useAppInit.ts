import { useEffect } from 'react';
import { Platform } from 'react-native';
import notifee from '@notifee/react-native';
import {
  setupNotificationChannel,
  setupReminderNotificationChannel,
  setupStatusNotificationChannel,
  requestNotificationPermission,
  setupIOSCategories,
} from '../services/notificationService';
import { scheduleAllAlarms } from '../services/alarmScheduler';
import { scheduleNotificationRefresh } from '../services/notificationRefreshService';
import { promptFullScreenIntentPermission, checkBatteryOptimization } from '../services/permissionService';
import { updatePersistentNotification } from '../services/persistentNotificationService';
import { stopAlarmSound } from '../services/soundService';
import { getSunTimes, isSunTimesValid } from '../services/sunCalcService';
import { registerBackgroundRecalculation } from '../tasks/backgroundRecalculate';
import { scheduleDailyMaintenance } from '../services/maintenanceScheduler';
import { useAlarmStore } from '../stores/alarmStore';
import { useLocationStore } from '../stores/locationStore';
import { useSettingsStore } from '../stores/settingsStore';

/**
 * Handles all one-time app initialization: permissions, channels, scheduling,
 * battery optimization, and onboarding prompts.
 */
export function useAppInit() {
  useEffect(() => {
    async function init() {
      // Safety: stop any orphaned sound/vibration from a previous session
      await stopAlarmSound();
      await requestNotificationPermission();
      await setupNotificationChannel();
      await setupReminderNotificationChannel();
      await setupStatusNotificationChannel();
      await setupIOSCategories();
      await registerBackgroundRecalculation();
      await scheduleDailyMaintenance();
      await scheduleNotificationRefresh();

      // On first launch or when battery optimization is enabled, request exemption.
      // Battery-optimized apps get killed by Android, preventing alarms from firing.
      if (Platform.OS === 'android') {
        const batteryInfo = await checkBatteryOptimization();
        if (batteryInfo.isOptimized) {
          try {
            await notifee.openBatteryOptimizationSettings();
          } catch {
            // Settings may not be available on all OEMs
          }
        }
      }

      // On first launch, prompt for Xiaomi/OEM-specific permissions
      const hasCompleted = useSettingsStore.getState().hasCompletedOnboarding;
      if (!hasCompleted && Platform.OS === 'android') {
        await promptFullScreenIntentPermission();
      }

      useSettingsStore.getState().setOnboardingComplete();

      // Re-register all enabled alarms with AlarmManager on every app open.
      // This handles: first install (alarms lost before boot receiver runs),
      // OS clearing alarm registrations, and permission grants since last open.
      // Only proceeds if exact alarm permission is already granted — avoids
      // showing permission prompts on every app open (prompts happen on alarm save).
      const hasAlarmPerm = Platform.OS !== 'android' ||
        (await notifee.getNotificationSettings()).android?.alarm === 1;
      if (hasAlarmPerm) {
        const loc = useLocationStore.getState().location;
        const sun = loc ? getSunTimes(loc.latitude, loc.longitude) : null;
        if (!sun || isSunTimesValid(sun)) {
          const enabled = Object.values(useAlarmStore.getState().alarms).filter(a => a.isEnabled);
          if (enabled.length > 0) {
            await scheduleAllAlarms(enabled, sun);
          }
        }
      }

      await updatePersistentNotification();
    }
    init();
  }, []);

  // Periodically refresh the persistent notification every 60s while app is in foreground.
  // This keeps relative times ("in 2h 14m") accurate, prevents the chronometer from
  // going negative (by switching to the next alarm), and updates after alarm dismissals.
  useEffect(() => {
    const interval = setInterval(() => {
      updatePersistentNotification().catch(() => {});
    }, 60_000);
    return () => clearInterval(interval);
  }, []);
}
