import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import type { Alarm, SunTimes } from '../models/types';

const isAndroid = Platform.OS === 'android';

// The native module is only available on Android
const WearDataLayerNative = isAndroid ? NativeModules.WearDataLayer : null;
const emitter = WearDataLayerNative
  ? new NativeEventEmitter(WearDataLayerNative)
  : null;

export interface AlarmSyncPayload {
  alarms: Record<string, Alarm>;
  sunTimes: {
    sunriseISO: string | null;
    sunsetISO: string | null;
    date: string | null;
  } | null;
  version: number;
  source: 'phone' | 'watch';
}

// Cached sun times so we can include them in every sync
let cachedSunTimes: AlarmSyncPayload['sunTimes'] = null;

/**
 * Update the cached sun times. Call this from useSunTimes or wherever
 * sun times are recalculated on the phone.
 */
export function updateWatchSunTimes(sunTimes: SunTimes | null): void {
  if (sunTimes) {
    cachedSunTimes = {
      sunriseISO: sunTimes.sunrise.toISOString(),
      sunsetISO: sunTimes.sunset.toISOString(),
      date: sunTimes.date,
    };
  } else {
    cachedSunTimes = null;
  }
}

/**
 * Sync the current alarm list + sun times to the connected Wear OS watch.
 * Call this whenever alarms change.
 */
export function syncAlarmsToWatch(alarms: Record<string, Alarm>): void {
  if (!WearDataLayerNative) return;

  const payload: AlarmSyncPayload = {
    alarms,
    sunTimes: cachedSunTimes,
    version: Date.now(),
    source: 'phone',
  };

  WearDataLayerNative.syncAlarms(JSON.stringify(payload));
}

/**
 * Read the latest alarm data from the Wearable Data Layer.
 * Useful on app startup to check if the watch made changes while the app was closed.
 */
export async function getLatestAlarmsFromWatch(): Promise<AlarmSyncPayload | null> {
  if (!WearDataLayerNative) return null;

  try {
    const json: string | null =
      await WearDataLayerNative.getLatestAlarms();
    if (!json) return null;
    return JSON.parse(json) as AlarmSyncPayload;
  } catch {
    return null;
  }
}

/**
 * Subscribe to alarm changes coming from the watch.
 * Returns an unsubscribe function.
 */
export function onWatchAlarmsChanged(
  callback: (alarms: Record<string, Alarm>) => void,
): () => void {
  if (!emitter) return () => {};

  const subscription = emitter.addListener(
    'onWatchAlarmsChanged',
    (json: string) => {
      try {
        const payload: AlarmSyncPayload = JSON.parse(json);
        callback(payload.alarms);
      } catch {
        // Ignore malformed data
      }
    },
  );

  return () => subscription.remove();
}
