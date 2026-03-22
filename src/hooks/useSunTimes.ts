import { useMemo } from 'react';
import { getSunTimes, getTomorrowSunTimes, isSunTimesValid } from '../services/sunCalcService';
import type { StoredLocation, SunTimes } from '../models/types';

export function useSunTimes(location: StoredLocation | null) {
  const todaySunTimes = useMemo<SunTimes | null>(() => {
    if (!location) return null;
    return getSunTimes(location.latitude, location.longitude);
  }, [location?.latitude, location?.longitude]);

  const tomorrowSunTimes = useMemo<SunTimes | null>(() => {
    if (!location) return null;
    return getTomorrowSunTimes(location.latitude, location.longitude);
  }, [location?.latitude, location?.longitude]);

  const isValid = todaySunTimes ? isSunTimesValid(todaySunTimes) : false;

  return { todaySunTimes, tomorrowSunTimes, isValid };
}
