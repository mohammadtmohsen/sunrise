import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

let currentSound: Audio.Sound | null = null;
let vibrationInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Play the alarm sound on loop.
 *
 * On iOS, this handles the in-app sound playback when the user taps the
 * notification and opens the alarm-trigger screen. The notification itself
 * plays the bundled .caf file for up to 30 seconds.
 *
 * On Android, the foreground service + notification channel handles sound,
 * but we also play here for the full-screen AlarmScreenComponent.
 */
export async function playAlarmSound(): Promise<void> {
  try {
    // Configure audio session for alarm playback
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true, // Critical: play even in silent mode on iOS
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });

    const { sound } = await Audio.Sound.createAsync(
      // Use the bundled alarm sound (works on both platforms)
      require('../../assets/sounds/alarm-default.wav'),
      {
        shouldPlay: true,
        isLooping: true,
        volume: 1.0,
      },
    );

    currentSound = sound;

    // Start vibration pattern
    startVibration();
  } catch (error) {
    console.warn('Failed to play alarm sound:', error);
    // Still vibrate even if sound fails
    startVibration();
  }
}

/**
 * Stop the alarm sound and vibration.
 */
export async function stopAlarmSound(): Promise<void> {
  stopVibration();

  if (currentSound) {
    try {
      await currentSound.stopAsync();
      await currentSound.unloadAsync();
    } catch {
      // Sound may already be unloaded
    }
    currentSound = null;
  }

  // Reset audio mode
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      playsInSilentModeIOS: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
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
  return currentSound !== null;
}
