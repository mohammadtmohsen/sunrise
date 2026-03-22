import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { zustandMMKVStorage } from './storage';
import type { Alarm, AlarmType, SunTimes } from '../models/types';
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
  soundUri?: string | null;
  vibrate?: boolean;
}

interface AlarmState {
  alarms: Record<string, Alarm>;
  addAlarm: (params: AddAlarmParams) => string;
  updateAlarm: (id: string, updates: Partial<Alarm>) => void;
  deleteAlarm: (id: string) => void;
  toggleAlarm: (id: string) => void;
  recalculateAllTriggerTimes: (sunTimes: SunTimes) => void;
  getAlarmsArray: () => Alarm[];
  getEnabledAlarms: () => Alarm[];
}

export const useAlarmStore = create<AlarmState>()(
  persist(
    (set, get) => ({
      alarms: {},

      addAlarm: (params) => {
        const id = uuidv4();
        const now = new Date().toISOString();
        const alarm: Alarm = {
          id,
          name: params.name,
          type: params.type,
          referenceEvent: params.referenceEvent ?? 'sunrise',
          offsetMinutes: params.offsetMinutes ?? 0,
          absoluteHour: params.absoluteHour ?? 6,
          absoluteMinute: params.absoluteMinute ?? 0,
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
          const updated = { ...state.alarms };
          for (const [id, alarm] of Object.entries(updated)) {
            let triggerTime: Date;
            if (alarm.type === 'absolute') {
              triggerTime = computeAbsoluteTriggerTime(alarm.absoluteHour, alarm.absoluteMinute);
            } else {
              const eventTime = sunTimes[alarm.referenceEvent];
              triggerTime = computeTriggerTime(eventTime, alarm.offsetMinutes);
            }
            updated[id] = {
              ...alarm,
              nextTriggerAt: triggerTime.toISOString(),
            };
          }
          return { alarms: updated };
        });
      },

      getAlarmsArray: () => {
        return Object.values(get().alarms).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
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
