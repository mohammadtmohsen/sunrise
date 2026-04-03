import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import dayjs from 'dayjs';
import { zustandMMKVStorage } from './storage';
import type { Alarm, AlarmType, AlarmStyle, SunTimes } from '../models/types';
import { computeTriggerTime, computeAbsoluteTriggerTime } from '../utils/timeUtils';
import { DEFAULT_SNOOZE_MINUTES } from '../utils/constants';

interface AddAlarmParams {
  name: string;
  type: AlarmType;
  // Relative fields
  referenceEvent?: 'sunrise' | 'sunset';
  offsetMinutes?: number;
  // Absolute fields
  absoluteHour?: number;
  absoluteMinute?: number;
  // Optional
  alarmStyle?: AlarmStyle;
  soundUri?: string | null;
  vibrate?: boolean;
}

interface AlarmState {
  alarms: Record<string, Alarm>;
  addAlarm: (params: AddAlarmParams) => string;
  updateAlarm: (id: string, updates: Partial<Alarm>) => void;
  deleteAlarm: (id: string) => void;
  toggleAlarm: (id: string) => void;
  recalculateAllTriggerTimes: (sunTimes: SunTimes | null) => void;
  getAlarmsArray: () => Alarm[];
  getEnabledAlarms: () => Alarm[];
}

export const useAlarmStore = create<AlarmState>()(
  persist(
    (set, get) => ({
      alarms: {},

      addAlarm: (params) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
        const now = new Date().toISOString();
        const alarm: Alarm = {
          id,
          name: params.name,
          type: params.type,
          referenceEvent: params.referenceEvent ?? 'sunrise',
          offsetMinutes: params.offsetMinutes ?? 0,
          absoluteHour: params.absoluteHour ?? 6,
          absoluteMinute: params.absoluteMinute ?? 0,
          alarmStyle: params.alarmStyle ?? 'alarm',
          isEnabled: true,
          soundUri: params.soundUri ?? null,
          vibrate: params.vibrate ?? true,
          snoozeDurationMinutes: DEFAULT_SNOOZE_MINUTES,
          createdAt: now,
          updatedAt: now,
          nextTriggerAt: null,
          notificationId: null,
        };
        set((state) => ({
          alarms: { ...state.alarms, [id]: alarm },
        }));
        return id;
      },

      updateAlarm: (id, updates) => {
        set((state) => {
          const existing = state.alarms[id];
          if (!existing) return state;
          return {
            alarms: {
              ...state.alarms,
              [id]: {
                ...existing,
                ...updates,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        });
      },

      deleteAlarm: (id) => {
        set((state) => {
          const { [id]: _, ...rest } = state.alarms;
          return { alarms: rest };
        });
      },

      toggleAlarm: (id) => {
        set((state) => {
          const existing = state.alarms[id];
          if (!existing) return state;
          return {
            alarms: {
              ...state.alarms,
              [id]: {
                ...existing,
                isEnabled: !existing.isEnabled,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        });
      },

      recalculateAllTriggerTimes: (sunTimes) => {
        set((state) => {
          const now = new Date();
          const updated = { ...state.alarms };
          for (const [id, alarm] of Object.entries(updated)) {
            let triggerTime: Date | null = null;
            if (alarm.type === 'absolute') {
              triggerTime = computeAbsoluteTriggerTime(alarm.absoluteHour, alarm.absoluteMinute);
            } else if (sunTimes) {
              const eventTime = sunTimes[alarm.referenceEvent];
              triggerTime = computeTriggerTime(eventTime, alarm.offsetMinutes);
              // If past, shift to tomorrow
              if (triggerTime <= now) {
                triggerTime = dayjs(triggerTime).add(1, 'day').toDate();
              }
            }
            updated[id] = {
              ...alarm,
              nextTriggerAt: triggerTime?.toISOString() ?? null,
            };
          }
          return { alarms: updated };
        });
      },

      getAlarmsArray: () => {
        return Object.values(get().alarms).sort((a, b) => {
          const aTime = a.nextTriggerAt ? new Date(a.nextTriggerAt).getTime() : Infinity;
          const bTime = b.nextTriggerAt ? new Date(b.nextTriggerAt).getTime() : Infinity;
          return aTime - bTime;
        });
      },

      getEnabledAlarms: () => {
        return Object.values(get().alarms).filter((a) => a.isEnabled);
      },
    }),
    {
      name: 'alarm-store',
      storage: createJSONStorage(() => zustandMMKVStorage),
    },
  ),
);
