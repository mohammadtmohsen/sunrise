import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandMMKVStorage } from './storage';
import { DEFAULT_SNOOZE_MINUTES } from '../utils/constants';

interface SettingsState {
  defaultSnoozeDuration: number;
  defaultVibrate: boolean;
  hasCompletedOnboarding: boolean;
  setDefaultSnoozeDuration: (minutes: number) => void;
  setDefaultVibrate: (vibrate: boolean) => void;
  setOnboardingComplete: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      defaultSnoozeDuration: DEFAULT_SNOOZE_MINUTES,
      defaultVibrate: true,
      hasCompletedOnboarding: false,

      setDefaultSnoozeDuration: (minutes) =>
        set({ defaultSnoozeDuration: minutes }),
      setDefaultVibrate: (vibrate) => set({ defaultVibrate: vibrate }),
      setOnboardingComplete: () => set({ hasCompletedOnboarding: true }),
    }),
    {
      name: 'settings-store',
      storage: createJSONStorage(() => zustandMMKVStorage),
    },
  ),
);
