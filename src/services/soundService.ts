import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

let currentPlayer: AudioPlayer | null = null;
let vibrationInterval: ReturnType<typeof setInterval> | null = null;

export async function playAlarmSound(): Promise<void> {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldRouteThroughEarpiece: false,
    });

    const player = createAudioPlayer(
      require('../../assets/sounds/alarm-default.wav'),
    );
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
