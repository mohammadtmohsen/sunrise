import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandMMKVStorage } from './storage';
import { DEFAULT_SNOOZE_MINUTES } from '../utils/constants';

interface SettingsState {
  defaultSnoozeDuration: number;
  defaultVibrate: boolean;
  hasCompletedOnboarding: boolean;
  showPersistentNotification: boolean;
  forceAlarmEvents: boolean;
  customSoundUri: string | null;
  customSoundName: string | null;
  customReminderSoundUri: string | null;
  customReminderSoundName: string | null;
  setDefaultSnoozeDuration: (minutes: number) => void;
  setDefaultVibrate: (vibrate: boolean) => void;
  setOnboardingComplete: () => void;
  setShowPersistentNotification: (show: boolean) => void;
  setForceAlarmEvents: (force: boolean) => void;
  setCustomSound: (uri: string, name: string) => void;
  clearCustomSound: () => void;
  setCustomReminderSound: (uri: string, name: string) => void;
  clearCustomReminderSound: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      defaultSnoozeDuration: DEFAULT_SNOOZE_MINUTES,
      defaultVibrate: false,
      hasCompletedOnboarding: false,
      showPersistentNotification: true,
      forceAlarmEvents: true,
      customSoundUri: null,
      customSoundName: null,
      customReminderSoundUri: null,
      customReminderSoundName: null,

      setDefaultSnoozeDuration: (minutes) =>
        set({ defaultSnoozeDuration: minutes }),
      setDefaultVibrate: (vibrate) => set({ defaultVibrate: vibrate }),
      setOnboardingComplete: () => set({ hasCompletedOnboarding: true }),
      setShowPersistentNotification: (show) =>
        set({ showPersistentNotification: show }),
      setForceAlarmEvents: (force) => set({ forceAlarmEvents: force }),
      setCustomSound: (uri, name) =>
        set({ customSoundUri: uri, customSoundName: name }),
      clearCustomSound: () =>
        set({ customSoundUri: null, customSoundName: null }),
      setCustomReminderSound: (uri, name) =>
        set({ customReminderSoundUri: uri, customReminderSoundName: name }),
      clearCustomReminderSound: () =>
        set({ customReminderSoundUri: null, customReminderSoundName: null }),
    }),
    {
      name: 'settings-store',
      storage: createJSONStorage(() => zustandMMKVStorage),
    },
  ),
);
