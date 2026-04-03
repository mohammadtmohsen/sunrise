export type AlarmType = 'relative' | 'absolute';
export type AlarmMode = 'before-sunrise' | 'after-sunrise' | 'before-sunset' | 'after-sunset' | 'fixed';
export type AlarmStyle = 'alarm' | 'reminder';
export type RepeatMode = 'once' | 'repeat';

export interface Alarm {
  id: string;
  name: string;
  type: AlarmType;

  // Relative alarm fields (used when type === 'relative')
  referenceEvent: 'sunrise' | 'sunset';
  offsetMinutes: number; // Negative = before, positive = after

  // Absolute alarm fields (used when type === 'absolute')
  absoluteHour: number; // 0-23
  absoluteMinute: number; // 0-59

  alarmStyle: AlarmStyle;
  repeatMode: RepeatMode;
  repeatDays: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  isEnabled: boolean;
  soundUri: string | null;
  vibrate: boolean;
  snoozeDurationMinutes: number;
  createdAt: string;
  updatedAt: string;
  nextTriggerAt: string | null;
  notificationId: string | null;
}

export interface StoredLocation {
  latitude: number;
  longitude: number;
  timestamp: string;
  source: 'gps' | 'manual';
}

export interface SunTimes {
  date: string; // YYYY-MM-DD
  sunrise: Date;
  sunset: Date;
  latitude: number;
  longitude: number;
}
