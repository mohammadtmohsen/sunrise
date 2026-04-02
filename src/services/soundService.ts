import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../stores/settingsStore';

let currentPlayer: AudioPlayer | null = null;
let vibrationInterval: ReturnType<typeof setInterval> | null = null;
let previewPlayer: AudioPlayer | null = null;

export async function playAlarmSound(): Promise<void> {
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

export async function stopAlarmSound(): Promise<void> {
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
