import { useEffect } from 'react';
import { Platform } from 'react-native';
import {
  setupNotificationChannel,
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
import {
  dismissNativeAlarm,
  getNativeNotificationSettings,
  openNativeBatteryOptimizationSettings,
  createNativeNotificationChannels,
  getDismissedOnceAlarms,
} from '../services/nativeAlarmEngine';

/**
 * Handles all one-time app initialization: permissions, channels, scheduling,
 * battery optimization, and onboarding prompts.
 */
export function useAppInit() {
  useEffect(() => {
    async function init() {
      const t0 = Date.now();
      const log = (msg: string) => console.log(`[AppInit +${Date.now() - t0}ms] ${msg}`);

      // Safety: stop any orphaned sound/vibration from a previous session.
      // Don't await dismissNativeAlarm on startup — it's slow and blocks init.
      stopAlarmSound().catch(() => {});
      if (Platform.OS === 'android') {
        dismissNativeAlarm().catch(() => {});
      }
      log('Cleanup dispatched');

      // Run permission request and channel setup in parallel
      await Promise.all([
        requestNotificationPermission(),
        Platform.OS === 'android'
          ? createNativeNotificationChannels()
          : Promise.resolve(),
        setupIOSCategories(),
      ]);
      log('Permissions + channels done');

      // Register background tasks in parallel
      await Promise.all([
        registerBackgroundRecalculation(),
        scheduleDailyMaintenance(),
        scheduleNotificationRefresh(),
      ]);
      log('Background tasks registered');

      // On first launch only, prompt for battery optimization and OEM permissions.
      const hasCompleted = useSettingsStore.getState().hasCompletedOnboarding;
      if (!hasCompleted && Platform.OS === 'android') {
        const batteryInfo = await checkBatteryOptimization();
        if (batteryInfo.isOptimized) {
          try {
            await openNativeBatteryOptimizationSettings();
          } catch {}
        }
        await promptFullScreenIntentPermission();
      }
      useSettingsStore.getState().setOnboardingComplete();
      log('Onboarding done');

      // Check battery optimization
      if (Platform.OS === 'android') {
        checkBatteryOptimization().then((info) => {
          if (info.isOptimized) {
            console.warn('[AppInit] Battery optimization is ON — alarms may not fire reliably');
          }
        });
      }

      // Process alarms that were dismissed as "once" while JS was not running.
      // Native code marks them in SharedPreferences; we disable them in the store now.
      if (Platform.OS === 'android') {
        try {
          const dismissedIds = await getDismissedOnceAlarms();
          for (const id of dismissedIds) {
            const alarm = useAlarmStore.getState().alarms[id];
            if (alarm && alarm.repeatMode === 'once') {
              useAlarmStore.getState().updateAlarm(id, {
                isEnabled: false,
                nextTriggerAt: null,
                notificationId: null,
              });
              log(`Disabled dismissed "once" alarm: ${id}`);
            }
          }
        } catch {}
      }

      // Re-register all enabled alarms on every app open.
      let hasAlarmPerm = true;
      if (Platform.OS === 'android') {
        const settings = await getNativeNotificationSettings();
        hasAlarmPerm = settings.alarm;
      }
      log('Permission check done');

      if (hasAlarmPerm) {
        const loc = useLocationStore.getState().location;
        const sun = loc ? getSunTimes(loc.latitude, loc.longitude) : null;
        if (!sun || isSunTimesValid(sun)) {
          const enabled = Object.values(useAlarmStore.getState().alarms).filter(a => a.isEnabled);
          if (enabled.length > 0) {
            await scheduleAllAlarms(enabled, sun);
            log(`Scheduled ${enabled.length} alarms`);
          }
        }
      }

      updatePersistentNotification().catch(() => {});
      log('Init complete');
    }
    init();
  }, []);

  // Periodically refresh the persistent notification every 60s while app is in foreground.
  useEffect(() => {
    const interval = setInterval(() => {
      updatePersistentNotification().catch(() => {});
    }, 60_000);
    return () => clearInterval(interval);
  }, []);
}
