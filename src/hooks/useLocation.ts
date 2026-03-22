import { useCallback } from 'react';
import * as Location from 'expo-location';
import { useLocationStore } from '../stores/locationStore';
import type { StoredLocation } from '../models/types';

/**
 * Race a promise against a timeout. Rejects if the timeout fires first.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Location request timed out')), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

export function useLocation() {
  const { location, isLoading, error, setLocation, setLoading, setError } =
    useLocationStore();

  const fetchLocation = useCallback(async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied');
        return;
      }

      let position: Location.LocationObject | null = null;

      // Strategy 1: Try last known position first (instant, no GPS needed)
      try {
        position = await Location.getLastKnownPositionAsync();
      } catch {
        // May not be available
      }

      // Strategy 2: Request current position with timeout
      if (!position) {
        try {
          position = await withTimeout(
            Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            }),
            10_000,
          );
        } catch {
          // Timed out or failed — try lower accuracy
        }
      }

      // Strategy 3: Lowest accuracy as last resort
      if (!position) {
        try {
          position = await withTimeout(
            Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Lowest,
            }),
            10_000,
          );
        } catch {
          // Final fallback failed
        }
      }

      if (!position) {
        setError('Could not determine location. Please try again outdoors.');
        return;
      }

      const stored: StoredLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        timestamp: new Date().toISOString(),
        source: 'gps',
      };

      setLocation(stored);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get location');
    } finally {
      setLoading(false);
    }
  }, [setLocation, setLoading, setError]);

  return { location, isLoading, error, fetchLocation };
}
