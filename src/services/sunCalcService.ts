import SunCalc from 'suncalc';
import dayjs from 'dayjs';
import type { SunTimes } from '../models/types';

export function getSunTimes(
  latitude: number,
  longitude: number,
  date?: Date,
): SunTimes {
  const targetDate = date || new Date();
  const times = SunCalc.getTimes(targetDate, latitude, longitude);

  return {
    date: dayjs(targetDate).format('YYYY-MM-DD'),
    sunrise: times.sunrise,
    sunset: times.sunset,
    latitude,
    longitude,
  };
}

export function getTomorrowSunTimes(
  latitude: number,
  longitude: number,
): SunTimes {
  const tomorrow = dayjs().add(1, 'day').toDate();
  return getSunTimes(latitude, longitude, tomorrow);
}

export function isSunTimesValid(sunTimes: SunTimes): boolean {
  // suncalc returns NaN for polar regions with no sunrise/sunset
  return (
    !isNaN(sunTimes.sunrise.getTime()) && !isNaN(sunTimes.sunset.getTime())
  );
}
