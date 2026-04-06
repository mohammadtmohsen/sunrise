import { useEffect, useState, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import notifee from '@notifee/react-native';
import type { Router } from 'expo-router';
import { useAlarmStore } from '../stores/alarmStore';
import { mmkv } from '../stores/storage';
import { handleDismiss } from '../services/alarmEventHandler';

/**
 * Detects pending alarms from MMKV / initial notification and navigates
 * to the alarm trigger screen. Handles cold start, warm start, and
 * alarm firing while the app is open.
 *
 * Returns { isReady } — false until the initial pending-alarm check completes,
 * so the home screen doesn't flash before the alarm trigger screen.
 */
export function usePendingAlarm(router: Router) {
  const [isReady, setIsReady] = useState(false);
  const processingRef = useRef(false);

  useEffect(() => {
    function checkPendingAlarm() {
      if (processingRef.current) return false;
      const pendingAlarmId = mmkv.getString('pending-alarm-id');
      if (pendingAlarmId) {
        processingRef.current = true;
        console.log('[PendingAlarm] Found pending alarm:', pendingAlarmId);
        mmkv.delete('pending-alarm-id');

        // Don't launch full-screen for reminders
        const pendingAlarm = useAlarmStore.getState().alarms[pendingAlarmId];
        if (pendingAlarm?.alarmStyle === 'reminder') {
          console.log('[PendingAlarm] Reminder — skipping alarm-trigger');
          handleDismiss(pendingAlarmId);
          processingRef.current = false;
          return true;
        }

        router.replace({
          pathname: '/alarm-trigger',
          params: { alarmId: pendingAlarmId },
        });
        processingRef.current = false;
        return true;
      }
      return false;
    }

    // Check on mount (cold start) — run immediately, no delay
    async function checkInitialNotification() {
      // Synchronous MMKV check first (instant)
      if (checkPendingAlarm()) {
        setIsReady(true);
        return;
      }

      // Then check Notifee's initial notification (async, for tapped-to-open case)
      const initial = await notifee.getInitialNotification();
      if (initial) {
        const alarmId = initial.notification?.data?.alarmId as string | undefined;
        const isAlarm = initial.notification?.data?.type === 'alarm-trigger';
        if (alarmId && isAlarm) {
          const alarm = useAlarmStore.getState().alarms[alarmId];
          if (alarm?.alarmStyle !== 'reminder') {
            router.replace({ pathname: '/alarm-trigger', params: { alarmId } });
          }
        }
      }
      setIsReady(true);
    }

    checkInitialNotification();

    // Check when app comes back to foreground
    const appStateSub = AppState.addEventListener(
      'change',
      (state: AppStateStatus) => {
        if (state === 'active') {
          // Small delay to let MMKV write settle
          setTimeout(() => checkPendingAlarm(), 200);
        }
      },
    );

    // Listen for MMKV changes — catches the case where foreground service
    // stores alarm ID while the app is already open (replaces 1s polling)
    const mmkvListener = mmkv.addOnValueChangedListener((key) => {
      if (key === 'pending-alarm-id') {
        checkPendingAlarm();
      }
    });

    return () => {
      appStateSub.remove();
      mmkvListener.remove();
    };
  }, [router]);

  return { isReady };
}
