import notifee, {
  AndroidImportance,
  AndroidStyle,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import { useAlarmStore } from '../stores/alarmStore';
import { useLocationStore } from '../stores/locationStore';
import { useSettingsStore } from '../stores/settingsStore';
import { getSunTimes, isSunTimesValid } from './sunCalcService';
import { STATUS_CHANNEL_ID, STATUS_NOTIFICATION_ID } from '../utils/constants';
import { formatTime } from '../utils/timeUtils';
import type { Alarm, SunTimes } from '../models/types';

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
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0 && minutes > 0) return `in ${hours}h ${minutes}m`;
  if (hours > 0) return `in ${hours}h`;
  return `in ${minutes}m`;
}

/**
 * Build the sun times line: "Sunrise 06:23  ·  Sunset 19:45"
 */
function buildSunLine(sunTimes: SunTimes): string {
  return `Sunrise ${formatTime(sunTimes.sunrise)}  ·  Sunset ${formatTime(sunTimes.sunset)}`;
}

/**
 * Build InboxStyle lines listing all registered alarms with relative times.
 * Android InboxStyle supports ~5-7 visible lines when expanded.
 */
function buildAlarmLines(futureAlarms: Alarm[]): string[] {
  return futureAlarms.slice(0, 7).map(a => {
    const triggerDate = new Date(a.nextTriggerAt!);
    const triggerMs = triggerDate.getTime();
    const relative = formatRelativeTime(triggerMs);
    const style = a.alarmStyle === 'reminder' ? '🔔' : '⏰';
    return `${style}  ${a.name}  ·  ${formatTime(triggerDate)}  (${relative})`;
  });
}

/**
 * Update or create the persistent status notification.
 *
 * Collapsed view:
 *   Title:  "Wake up lumors · 05:53"     (alarm name + trigger time)
 *   Body:   "Sunrise 06:23 · Sunset 19:45"
 *   Right:  native countdown timer (live, ticking) — only when next alarm is in the future
 *
 * Expanded view (InboxStyle):
 *   Lists all registered alarms/reminders with their trigger times and relative countdown.
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

    let title: string;
    let body: string;
    let showChronometer = false;
    let timestamp: number | undefined;

    if (nextAlarm && nextAlarm.nextTriggerAt) {
      const triggerDate = new Date(nextAlarm.nextTriggerAt);
      const triggerAt = triggerDate.getTime();

      // Title: alarm name + exact trigger time
      title = `${nextAlarm.name}  ·  ${formatTime(triggerDate)}`;

      // Body: sunrise + sunset
      body = sunTimes
        ? buildSunLine(sunTimes)
        : 'Location not set';

      // Only show chronometer if the trigger time is still in the future
      // This prevents the countdown from going negative
      if (triggerAt > Date.now()) {
        showChronometer = true;
        timestamp = triggerAt;
      }
    } else {
      // No active alarms — show sun times as title
      title = sunTimes ? buildSunLine(sunTimes) : 'Lumora';
      body = 'No active alarms';
    }

    // Build expanded view with all alarms
    const alarmLines = buildAlarmLines(futureAlarms);

    await notifee.displayNotification({
      id: STATUS_NOTIFICATION_ID,
      title,
      body,
      android: {
        channelId: STATUS_CHANNEL_ID,
        ongoing: true,
        autoCancel: false,
        onlyAlertOnce: true,
        importance: AndroidImportance.LOW,
        smallIcon: 'ic_launcher',
        showChronometer,
        chronometerDirection: 'down',
        timestamp,
        pressAction: {
          id: 'default',
          launchActivity: 'default',
        },
        style: alarmLines.length > 0
          ? {
              type: AndroidStyle.INBOX,
              lines: alarmLines,
              title: nextAlarm ? nextAlarm.name : 'Lumora',
            }
          : {
              type: AndroidStyle.BIGTEXT,
              text: sunTimes
                ? `Sunrise: ${formatTime(sunTimes.sunrise)}  ·  Sunset: ${formatTime(sunTimes.sunset)}\nNo active alarms`
                : 'No active alarms',
            },
      },
    });
  } catch (e) {
    console.warn('Failed to update persistent notification:', e);
  }
}

/**
 * Remove the persistent status notification.
 */
export async function cancelPersistentNotification(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await notifee.cancelNotification(STATUS_NOTIFICATION_ID);
  } catch {
    // May not exist
  }
}
