import notifee, {
  AndroidImportance,
  AndroidStyle,
  AndroidVisibility,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import { useAlarmStore } from '../stores/alarmStore';
import { useLocationStore } from '../stores/locationStore';
import { useSettingsStore } from '../stores/settingsStore';
import { getSunTimes, isSunTimesValid } from './sunCalcService';
import { STATUS_CHANNEL_ID, STATUS_NOTIFICATION_ID, STATUS_GROUP_ID } from '../utils/constants';
import { formatTime } from '../utils/timeUtils';
import { setNotificationSubText } from './notificationSubText';
import type { Alarm, SunTimes } from '../models/types';

/** Prefix for per-alarm child notification IDs */
const CHILD_PREFIX = 'status-alarm-';

/** Max child notifications with live chronometers (Android group display limit) */
const MAX_CHILDREN = 7;

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
 * Format a relative time string like "in 2h 14m" or "in 37m".
 */
function formatRelativeTime(triggerAt: number): string {
  const diff = triggerAt - Date.now();
  if (diff <= 0) return 'now';
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  return `in ${parts.join(' ') || '0m'}`;
}

/**
 * Build the sun times line: "Sunrise 06:23  ·  Sunset 19:45"
 */
function buildSunLine(sunTimes: SunTimes): string {
  return `Sunrise ${formatTime(sunTimes.sunrise)}  ·  Sunset ${formatTime(sunTimes.sunset)}`;
}

/**
 * Build InboxStyle lines for alarms beyond the child notification limit.
 * These show in the summary notification when collapsed.
 */
function buildOverflowLines(overflowAlarms: Alarm[]): string[] {
  return overflowAlarms.map(a => {
    const triggerDate = new Date(a.nextTriggerAt!);
    const relative = formatRelativeTime(triggerDate.getTime());
    const style = a.alarmStyle === 'reminder' ? '🔔' : '⏰';
    const repeat = (a.repeatMode ?? 'once') === 'repeat' ? '∞' : '①';
    return `${style}  ${a.name}  ·  ${formatTime(triggerDate)}  (${relative})  ${repeat}`;
  });
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
 *   - A summary notification (next alarm + sun times + overflow list)
 *   - Up to MAX_CHILDREN child notifications, each with its own LIVE chronometer
 *
 * The first 7 alarms get individual notifications with live countdowns.
 * Any remaining alarms are listed in the summary's InboxStyle so nothing is hidden.
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

    // Split: first MAX_CHILDREN get live chronometers, rest go in summary InboxStyle
    const childAlarms = futureAlarms.slice(0, MAX_CHILDREN);
    const overflowAlarms = futureAlarms.slice(MAX_CHILDREN);

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
      const countLabel = futureAlarms.length > 1 ? `  (${futureAlarms.length} alarms)` : '';
      title = `${nextAlarm.name}  ·  ${formatTime(triggerDate)}  ${repeatIcon}${countLabel}`;
      body = sunTimes ? buildSunLine(sunTimes) : 'Location not set';

      if (triggerAt > Date.now()) {
        showChronometer = true;
        timestamp = triggerAt;
      }
    } else {
      title = sunTimes ? buildSunLine(sunTimes) : 'Lumora';
      body = 'No active alarms';
    }

    // Build overflow lines for alarms beyond the child limit
    const overflowLines = buildOverflowLines(overflowAlarms);

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
        visibility: AndroidVisibility.PUBLIC,
        badgeCount: 0,
        smallIcon: 'ic_launcher',
        showChronometer,
        chronometerDirection: 'down',
        timestamp,
        pressAction: {
          id: 'default',
          launchActivity: 'default',
        },
        // Show overflow alarms (beyond the 7 child limit) in InboxStyle
        ...(overflowLines.length > 0
          ? {
              style: {
                type: AndroidStyle.INBOX,
                lines: overflowLines,
                title: `+${overflowLines.length} more alarms`,
              },
            }
          : {}),
      },
    });

    // Set subText on the summary so the group header shows:
    // "Lumora · Wake up · 05:32" instead of just "Lumora · 05:32"
    if (nextAlarm && nextAlarm.nextTriggerAt) {
      const triggerDate = new Date(nextAlarm.nextTriggerAt);
      await setNotificationSubText(
        STATUS_NOTIFICATION_ID,
        `${nextAlarm.name}  ·  ${formatTime(triggerDate)}`,
      );
    }

    // --- Per-alarm child notifications (each with its own live chronometer) ---
    const activeIds = new Set<string>();

    for (const alarm of childAlarms) {
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
          sortKey: String(triggerAt).padStart(15, '0'),
          ongoing: true,
          autoCancel: false,
          onlyAlertOnce: true,
          importance: AndroidImportance.LOW,
          visibility: AndroidVisibility.PUBLIC,
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
