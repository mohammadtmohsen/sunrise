import { useCallback } from 'react';
import * as Location from 'expo-location';
import { useLocationStore } from '../stores/locationStore';
import type { StoredLocation } from '../models/types';

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

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

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
