import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandMMKVStorage } from './storage';
import type { StoredLocation } from '../models/types';

interface LocationState {
  location: StoredLocation | null;
  isLoading: boolean;
  error: string | null;
  setLocation: (location: StoredLocation) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      location: null,
      isLoading: false,
      error: null,

      setLocation: (location) => set({ location, error: null }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error, isLoading: false }),
    }),
    {
      name: 'location-store',
      storage: createJSONStorage(() => zustandMMKVStorage),
      partialize: (state) => ({ location: state.location }),
    },
  ),
);
