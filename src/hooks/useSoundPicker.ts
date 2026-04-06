import { useEffect, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { pickAudioFile, deleteCustomSound } from '../services/audioPickerService';
import { playPreviewSound, stopPreviewSound } from '../services/soundService';
import { useSettingsStore } from '../stores/settingsStore';

/**
 * Manages alarm and reminder sound picking, previewing, and resetting.
 */
export function useSoundPicker() {
  const {
    customSoundUri,
    customSoundName,
    setCustomSound,
    clearCustomSound,
    customReminderSoundUri,
    customReminderSoundName,
    setCustomReminderSound,
    clearCustomReminderSound,
  } = useSettingsStore();

  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isPreviewingReminder, setIsPreviewingReminder] = useState(false);

  // Stop preview on unmount
  useEffect(() => {
    return () => { stopPreviewSound(); };
  }, []);

  // --- Alarm sound ---

  const handlePickSound = useCallback(async () => {
    try {
      const result = await pickAudioFile();
      if (result) {
        if (customSoundUri) {
          await deleteCustomSound(customSoundUri);
        }
        setCustomSound(result.uri, result.name);
      }
    } catch {
      Alert.alert('Error', 'Failed to select audio file. Please try again.');
    }
  }, [customSoundUri, setCustomSound]);

  const handlePreview = useCallback(async () => {
    if (isPreviewing) {
      await stopPreviewSound();
      setIsPreviewing(false);
    } else {
      setIsPreviewing(true);
      await playPreviewSound(customSoundUri);
      setTimeout(async () => {
        await stopPreviewSound();
        setIsPreviewing(false);
      }, 10000);
    }
  }, [isPreviewing, customSoundUri]);

  const handleResetSound = useCallback(async () => {
    if (customSoundUri) {
      await deleteCustomSound(customSoundUri);
    }
    clearCustomSound();
    await stopPreviewSound();
    setIsPreviewing(false);
  }, [customSoundUri, clearCustomSound]);

  // --- Reminder sound ---

  const handlePickReminderSound = useCallback(async () => {
    try {
      const result = await pickAudioFile();
      if (result) {
        if (customReminderSoundUri) {
          await deleteCustomSound(customReminderSoundUri);
        }
        setCustomReminderSound(result.uri, result.name);
      }
    } catch {
      Alert.alert('Error', 'Failed to select audio file. Please try again.');
    }
  }, [customReminderSoundUri, setCustomReminderSound]);

  const handlePreviewReminder = useCallback(async () => {
    if (isPreviewingReminder) {
      await stopPreviewSound();
      setIsPreviewingReminder(false);
    } else {
      setIsPreviewingReminder(true);
      await playPreviewSound(customReminderSoundUri);
      setTimeout(async () => {
        await stopPreviewSound();
        setIsPreviewingReminder(false);
      }, 10000);
    }
  }, [isPreviewingReminder, customReminderSoundUri]);

  const handleResetReminderSound = useCallback(async () => {
    if (customReminderSoundUri) {
      await deleteCustomSound(customReminderSoundUri);
    }
    clearCustomReminderSound();
    await stopPreviewSound();
    setIsPreviewingReminder(false);
  }, [customReminderSoundUri, clearCustomReminderSound]);

  return {
    // Alarm sound
    customSoundUri,
    customSoundName,
    isPreviewing,
    handlePickSound,
    handlePreview,
    handleResetSound,
    // Reminder sound
    customReminderSoundUri,
    customReminderSoundName,
    isPreviewingReminder,
    handlePickReminderSound,
    handlePreviewReminder,
    handleResetReminderSound,
  };
}
