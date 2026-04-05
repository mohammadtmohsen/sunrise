import notifee, {
  AndroidImportance,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import { useAlarmStore } from '../stores/alarmStore';
import { useLocationStore } from '../stores/locationStore';
import { useSettingsStore } from '../stores/settingsStore';
import { getSunTimes, isSunTimesValid } from './sunCalcService';
import { STATUS_CHANNEL_ID, STATUS_NOTIFICATION_ID, STATUS_GROUP_ID } from '../utils/constants';
import { formatTime } from '../utils/timeUtils';
import type { Alarm, SunTimes } from '../models/types';

/** Prefix for per-alarm child notification IDs */
const CHILD_PREFIX = 'status-alarm-';

/**
 * Get all enabled alarms sorted by next trigger time (soonest first).
 * Only includes alarms with a future trigger time.
 */
function getFutureAlarms(alarms: Record<string, Alarm>): Alarm[] {
  const now = Date.now();
  return Object.values(alarms)
    .filter(a => a.isEnabled && a.nextTriggerAt && new Date(a.nextTriggerAt).getTime() > now)
    .sort((a, b) => new Date(a.nextTriggerAt!).getTime() - new Date(b.nextTriggerAt!).getTime());
}

/**
 * Build the sun times line: "Sunrise 06:23  ·  Sunset 19:45"
 */
function buildSunLine(sunTimes: SunTimes): string {
  return `Sunrise ${formatTime(sunTimes.sunrise)}  ·  Sunset ${formatTime(sunTimes.sunset)}`;
}

/**
 * Remove stale child notifications for alarms that are no longer active.
 */
async function cleanupStaleChildren(activeAlarmIds: Set<string>): Promise<void> {
  try {
    const displayed = await notifee.getDisplayedNotifications();
    for (const n of displayed) {
      if (n.id?.startsWith(CHILD_PREFIX)) {
        const alarmId = n.id.slice(CHILD_PREFIX.length);
        if (!activeAlarmIds.has(alarmId)) {
          await notifee.cancelNotification(n.id);
        }
      }
    }
  } catch {
    // May fail if notifications can't be queried
  }
}

/**
 * Update or create the persistent status notifications.
 *
 * Uses a notification group with:
 *   - A summary notification (collapsed: next alarm + sun times)
 *   - One child notification per alarm, each with its own LIVE chronometer
 *
 * When collapsed: shows the summary with the next alarm's countdown.
 * When expanded: shows each alarm as a separate row with its own ticking countdown.
 *
 * Should be called whenever alarms, sun times, or settings change.
 * No-op on iOS (iOS does not support ongoing notifications).
 */
export async function updatePersistentNotification(): Promise<void> {
  if (Platform.OS !== 'android') return;

  const { showPersistentNotification } = useSettingsStore.getState();
  if (!showPersistentNotification) {
    await cancelPersistentNotification();
    return;
  }

  try {
    const location = useLocationStore.getState().location;
    const alarms = useAlarmStore.getState().alarms;
    const futureAlarms = getFutureAlarms(alarms);
    const nextAlarm = futureAlarms.length > 0 ? futureAlarms[0] : null;

    // Compute fresh sun times
    let sunTimes: SunTimes | null = null;
    if (location) {
      const computed = getSunTimes(location.latitude, location.longitude);
      if (isSunTimesValid(computed)) {
        sunTimes = computed;
      }
    }

    // --- Summary (group parent) notification ---
    let title: string;
    let body: string;
    let showChronometer = false;
    let timestamp: number | undefined;

    if (nextAlarm && nextAlarm.nextTriggerAt) {
      const triggerDate = new Date(nextAlarm.nextTriggerAt);
      const triggerAt = triggerDate.getTime();
      const repeatIcon = (nextAlarm.repeatMode ?? 'once') === 'repeat' ? '∞' : '①';
      title = `${nextAlarm.name}  ·  ${formatTime(triggerDate)}  ${repeatIcon}`;
      body = sunTimes ? buildSunLine(sunTimes) : 'Location not set';

      if (triggerAt > Date.now()) {
        showChronometer = true;
        timestamp = triggerAt;
      }
    } else {
      title = sunTimes ? buildSunLine(sunTimes) : 'Lumora';
      body = 'No active alarms';
    }

    // Display the group summary notification
    await notifee.displayNotification({
      id: STATUS_NOTIFICATION_ID,
      title,
      body,
      android: {
        channelId: STATUS_CHANNEL_ID,
        groupId: STATUS_GROUP_ID,
        groupSummary: true,
        ongoing: true,
        autoCancel: false,
        onlyAlertOnce: true,
        importance: AndroidImportance.LOW,
        badgeCount: 0,
        smallIcon: 'ic_launcher',
        showChronometer,
        chronometerDirection: 'down',
        timestamp,
        pressAction: {
          id: 'default',
          launchActivity: 'default',
        },
      },
    });

    // --- Per-alarm child notifications (each with its own live chronometer) ---
    const activeIds = new Set<string>();

    for (const alarm of futureAlarms) {
      const triggerDate = new Date(alarm.nextTriggerAt!);
      const triggerAt = triggerDate.getTime();
      const childId = `${CHILD_PREFIX}${alarm.id}`;
      activeIds.add(alarm.id);

      const style = alarm.alarmStyle === 'reminder' ? '🔔' : '⏰';
      const repeat = (alarm.repeatMode ?? 'once') === 'repeat' ? '∞' : '①';

      await notifee.displayNotification({
        id: childId,
        title: `${style}  ${alarm.name}  ${repeat}`,
        body: `${formatTime(triggerDate)}`,
        android: {
          channelId: STATUS_CHANNEL_ID,
          groupId: STATUS_GROUP_ID,
          groupSummary: false,
          ongoing: true,
          autoCancel: false,
          onlyAlertOnce: true,
          importance: AndroidImportance.LOW,
          badgeCount: 0,
          smallIcon: 'ic_launcher',
          showChronometer: triggerAt > Date.now(),
          chronometerDirection: 'down',
          timestamp: triggerAt > Date.now() ? triggerAt : undefined,
          pressAction: {
            id: 'default',
            launchActivity: 'default',
          },
        },
      });
    }

    // Remove child notifications for alarms that no longer exist or are past
    await cleanupStaleChildren(activeIds);
  } catch (e) {
    console.warn('Failed to update persistent notification:', e);
  }
}

/**
 * Remove all persistent status notifications (summary + children).
 */
export async function cancelPersistentNotification(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    // Cancel the summary
    await notifee.cancelNotification(STATUS_NOTIFICATION_ID);

    // Cancel all child notifications
    const displayed = await notifee.getDisplayedNotifications();
    for (const n of displayed) {
      if (n.id?.startsWith(CHILD_PREFIX)) {
        await notifee.cancelNotification(n.id);
      }
    }
  } catch {
    // May not exist
  }
}
