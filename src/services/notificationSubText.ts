import { NativeModules, Platform } from 'react-native';

/**
 * Set the subText on an existing Android notification.
 * SubText appears between the app name and the notification content in the header.
 * e.g. "Lumora · Wake up · 05:32"
 *
 * @param tag - The notification ID (Notifee uses the id as the notification tag)
 * @param subText - Text to show next to the app name
 */
export async function setNotificationSubText(
  tag: string,
  subText: string,
): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  try {
    const { NotificationSubText } = NativeModules;
    if (!NotificationSubText) return false;
    return await NotificationSubText.setSubText(tag, subText);
  } catch {
    return false;
  }
}
