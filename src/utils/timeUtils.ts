import dayjs from 'dayjs';

/**
 * Format a Date to a time string following the device's locale and 12h/24h preference.
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format an hour+minute to a time string following the device's locale and 12h/24h preference.
 */
export function formatTime24(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatTimeUntil(date: Date): string {
  const now = dayjs();
  const target = dayjs(date);
  const diffMinutes = target.diff(now, 'minute');

  if (diffMinutes < 0) return 'passed';
  if (diffMinutes < 60) return `in ${diffMinutes}m`;

  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  if (mins === 0) return `in ${hours}h`;
  return `in ${hours}h ${mins}m`;
}

export function formatOffset(offsetMinutes: number): string {
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  const direction = offsetMinutes < 0 ? 'before' : offsetMinutes > 0 ? 'after' : 'at';

  if (offsetMinutes === 0) return 'At exact time';

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);

  return `${parts.join(' ')} ${direction}`;
}

export function computeTriggerTime(
  sunEventTime: Date,
  offsetMinutes: number,
): Date {
  return dayjs(sunEventTime).add(offsetMinutes, 'minute').toDate();
}

/**
 * Compute the next trigger time for an absolute alarm.
 * If the time has already passed today, returns tomorrow's time.
 */
export function computeAbsoluteTriggerTime(hour: number, minute: number): Date {
  const now = dayjs();
  let trigger = now.hour(hour).minute(minute).second(0).millisecond(0);

  if (trigger.isBefore(now) || trigger.isSame(now)) {
    trigger = trigger.add(1, 'day');
  }

  return trigger.toDate();
}

export function getNextOccurrence(
  sunEventTime: Date,
  offsetMinutes: number,
): { triggerTime: Date; isNextDay: boolean } {
  const triggerTime = computeTriggerTime(sunEventTime, offsetMinutes);
  const now = new Date();

  if (triggerTime > now) {
    return { triggerTime, isNextDay: false };
  }

  const nextDay = dayjs(triggerTime).add(1, 'day').toDate();
  return { triggerTime: nextDay, isNextDay: true };
}

export function getTodayDateString(): string {
  return dayjs().format('YYYY-MM-DD');
}
