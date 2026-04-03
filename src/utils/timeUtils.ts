import dayjs from 'dayjs';

/**
 * Format a Date to a 24-hour time string (HH:MM).
 */
export function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * Format an hour+minute to a 24-hour time string (HH:MM).
 */
export function formatTime24(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function formatTimeUntil(date: Date): string {
  const now = dayjs();
  let target = dayjs(date);

  // If the time has passed, shift to next day
  if (target.isBefore(now)) {
    target = target.add(1, 'day');
  }

  const diffMinutes = target.diff(now, 'minute');
  if (diffMinutes < 1) return 'in <1m';

  const days = Math.floor(diffMinutes / (60 * 24));
  const hours = Math.floor((diffMinutes % (60 * 24)) / 60);
  const mins = diffMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);

  return `in ${parts.join(' ')}`;
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

/**
 * Compute the next trigger time for an absolute alarm restricted to specific days.
 * Walks forward day by day (max 7) to find the next day in `days` where HH:MM is in the future.
 */
export function computeNextTriggerForDays(hour: number, minute: number, days: number[]): Date {
  const now = dayjs();
  for (let offset = 0; offset < 7; offset++) {
    const candidate = now.add(offset, 'day').hour(hour).minute(minute).second(0).millisecond(0);
    if (days.includes(candidate.day()) && candidate.isAfter(now)) {
      return candidate.toDate();
    }
  }
  // Fallback: next week's first matching day
  const candidate = now.add(7, 'day').hour(hour).minute(minute).second(0).millisecond(0);
  return candidate.toDate();
}

/**
 * Compute the next trigger time for a relative (sun-based) alarm restricted to specific days.
 * Uses the sun event time + offset, then walks forward day-by-day if today doesn't match.
 */
export function computeNextRelativeTriggerForDays(
  sunEventTime: Date,
  offsetMinutes: number,
  days: number[],
): Date {
  const now = dayjs();
  const todayTrigger = dayjs(sunEventTime).add(offsetMinutes, 'minute');

  if (days.includes(todayTrigger.day()) && todayTrigger.isAfter(now)) {
    return todayTrigger.toDate();
  }

  // Walk forward to find next matching day (approximate: shift sun event by N days)
  for (let offset = 1; offset <= 7; offset++) {
    const candidate = todayTrigger.add(offset, 'day');
    if (days.includes(candidate.day())) {
      return candidate.toDate();
    }
  }

  return todayTrigger.add(1, 'day').toDate();
}

const DAY_LABELS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKENDS = [0, 6];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export function formatRepeatDays(repeatMode?: 'once' | 'repeat', repeatDays?: number[], nextTriggerAt?: string | null): string {
  const mode = repeatMode ?? 'once';
  const days = repeatDays ?? [];

  if (mode === 'once') {
    if (days.length === 0) {
      if (nextTriggerAt) {
        const trigger = dayjs(nextTriggerAt);
        const now = dayjs();
        if (trigger.isSame(now, 'day')) return 'Once today';
        if (trigger.isSame(now.add(1, 'day'), 'day')) return 'Once tomorrow';
      }
      return 'Once';
    }
    const selectedDay = days[0];
    const today = new Date().getDay();
    const tomorrow = (today + 1) % 7;
    if (selectedDay === today) return 'Once today';
    if (selectedDay === tomorrow) return 'Once tomorrow';
    return `Once on ${DAY_LABELS_SHORT[selectedDay]}`;
  }

  if (days.length === 0) return 'Repeat';

  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 7) return 'Every day';
  if (sorted.length === 5 && WEEKDAYS.every((d) => sorted.includes(d))) return 'Every Weekdays';
  if (sorted.length === 2 && WEEKENDS.every((d) => sorted.includes(d))) return 'Every Weekends';

  return `Every ${sorted.map((d) => DAY_LABELS_SHORT[d]).join(', ')}`;
}
