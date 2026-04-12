import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useSettingsStore } from '../stores/settingsStore';
import { dismissNativeAlarm } from './nativeAlarmEngine';

let currentPlayer: AudioPlayer | null = null;
let vibrationInterval: ReturnType<typeof setInterval> | null = null;
let previewPlayer: AudioPlayer | null = null;

/**
 * Play alarm sound. On Android, the native AlarmService handles sound playback,
 * so this is primarily used on iOS or as a fallback.
 */
export async function playAlarmSound(): Promise<void> {
  // On Android, native AlarmService handles sound — only play in JS on iOS
  if (Platform.OS === 'android') return;

  if (currentPlayer) {
    try {
      currentPlayer.pause();
      currentPlayer.release();
    } catch {}
    currentPlayer = null;
  }

  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldRouteThroughEarpiece: false,
    });

    const { customSoundUri } = useSettingsStore.getState();
    const source = customSoundUri
      ? { uri: customSoundUri }
      : require('../../assets/sounds/alarm-default.wav');

    const player = createAudioPlayer(source);
    player.loop = true;
    player.volume = 1.0;
    player.play();

    currentPlayer = player;
    startVibration();
  } catch (error) {
    console.warn('Failed to play alarm sound:', error);
    startVibration();
  }
}

export async function playReminderSound(): Promise<void> {
  if (currentPlayer) {
    try {
      currentPlayer.pause();
      currentPlayer.release();
    } catch {}
    currentPlayer = null;
  }

  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldRouteThroughEarpiece: false,
    });

    const { customReminderSoundUri } = useSettingsStore.getState();
    const source = customReminderSoundUri
      ? { uri: customReminderSoundUri }
      : require('../../assets/sounds/alarm-default.wav');

    const player = createAudioPlayer(source);
    player.loop = false;
    player.volume = 1.0;
    player.play();

    currentPlayer = player;

    // Single vibration burst for reminders
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch (error) {
    console.warn('Failed to play reminder sound:', error);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }
}

export async function playPreviewSound(uri: string | null): Promise<void> {
  await stopPreviewSound();

  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldRouteThroughEarpiece: false,
    });

    const source = uri
      ? { uri }
      : require('../../assets/sounds/alarm-default.wav');

    previewPlayer = createAudioPlayer(source);
    previewPlayer.loop = false;
    previewPlayer.volume = 1.0;
    previewPlayer.play();
  } catch (error) {
    console.warn('Failed to play preview sound:', error);
  }
}

export async function stopPreviewSound(): Promise<void> {
  if (previewPlayer) {
    try {
      previewPlayer.pause();
      previewPlayer.release();
    } catch {}
    previewPlayer = null;
  }
}

/**
 * Stop alarm sound. On Android, also dismisses the native alarm service
 * which handles its own sound playback.
 */
export async function stopAlarmSound(): Promise<void> {
  if (Platform.OS === 'android') {
    try { await dismissNativeAlarm(); } catch {}
  }

  stopVibration();

  if (currentPlayer) {
    try {
      currentPlayer.pause();
      currentPlayer.release();
    } catch {
      // Player may already be released
    }
    currentPlayer = null;
  }

  try {
    await setAudioModeAsync({
      playsInSilentMode: false,
      shouldRouteThroughEarpiece: false,
    });
  } catch {
    // May fail if audio session was already released
  }
}

function startVibration(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  vibrationInterval = setInterval(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, 1500);
}

function stopVibration(): void {
  if (vibrationInterval) {
    clearInterval(vibrationInterval);
    vibrationInterval = null;
  }
}

export function isPlaying(): boolean {
  return currentPlayer !== null;
}
