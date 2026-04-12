import { useEffect, useState, useCallback } from 'react';
import { Platform, Alert, AppState } from 'react-native';
import {
  checkNotificationPermission,
  checkCriticalAlertsPermission,
  checkBatteryOptimization,
} from '../services/permissionService';
import { requestNotificationPermission } from '../services/notificationService';

/**
 * Checks and exposes the current status of all device permissions
 * relevant to alarm functionality.
 * Re-checks when the app returns to the foreground (e.g. after changing settings).
 */
export function usePermissionStatus() {
  const [notifPermission, setNotifPermission] = useState<boolean | null>(null);
  const [criticalAlerts, setCriticalAlerts] = useState<boolean | null>(null);
  const [batteryInfo, setBatteryInfo] = useState<{
    isOptimized: boolean;
    hasPowerManager: boolean;
  } | null>(null);

  const checkPermissions = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  // Re-check when app returns to foreground (after user changes settings)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkPermissions();
      }
    });
    return () => sub.remove();
  }, [checkPermissions]);

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

  return {
    notifPermission,
    criticalAlerts,
    batteryInfo,
    handleNotifPermission,
  };
}
