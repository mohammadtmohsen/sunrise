import { Platform } from 'react-native';
import { useAlarmStore } from '../stores/alarmStore';
import { useLocationStore } from '../stores/locationStore';
import { useSettingsStore } from '../stores/settingsStore';
import { getSunTimes, isSunTimesValid } from './sunCalcService';
import { formatTime } from '../utils/timeUtils';
import type { Alarm, SunTimes } from '../models/types';
import {
  showNativePersistentNotification,
  hideNativePersistentNotification,
} from './nativeAlarmEngine';

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
 * Build expanded lines listing all registered alarms with relative times.
 */
function buildAlarmLines(futureAlarms: Alarm[]): string[] {
  return futureAlarms.map(a => {
    const triggerDate = new Date(a.nextTriggerAt!);
    const triggerMs = triggerDate.getTime();
    const relative = formatRelativeTime(triggerMs);
    const style = a.alarmStyle === 'reminder' ? '🔔' : '⏰';
    const repeat = (a.repeatMode ?? 'once') === 'repeat' ? '∞' : '①';
    return `${style}  ${a.name}  ·  ${formatTime(triggerDate)}  (${relative})  ${repeat}`;
  });
}

/**
 * Update or create the persistent status notification.
 *
 * Single ongoing notification with:
 *   Collapsed: next alarm name + time + live chronometer countdown
 *   Expanded: all alarms with their times and relative countdowns
 *
 * Should be called whenever alarms, sun times, or settings change.
 * Android-only — iOS does not support ongoing notifications.
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
    let chronoBase = 0;

    if (nextAlarm && nextAlarm.nextTriggerAt) {
      const triggerDate = new Date(nextAlarm.nextTriggerAt);
      const triggerAt = triggerDate.getTime();

      // Title: alarm name + exact trigger time + repeat icon
      const repeatIcon = (nextAlarm.repeatMode ?? 'once') === 'repeat' ? '∞' : '①';
      title = `${nextAlarm.name}  ·  ${formatTime(triggerDate)}  ${repeatIcon}`;

      // Body: sunrise + sunset
      body = sunTimes
        ? buildSunLine(sunTimes)
        : 'Location not set';

      // Only show chronometer if the trigger time is still in the future
      if (triggerAt > Date.now()) {
        chronoBase = triggerAt;
      }
    } else {
      // No active alarms — show sun times as title
      title = sunTimes ? buildSunLine(sunTimes) : 'Lumora';
      body = 'No active alarms';
    }

    // Build expanded view with all alarms
    const expandedLines = buildAlarmLines(futureAlarms);

    await showNativePersistentNotification({
      title,
      body,
      chronoBase,
      expandedLines,
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
    await hideNativePersistentNotification();
  } catch {
    // May not exist
  }
}
