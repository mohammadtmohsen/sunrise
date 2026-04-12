const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Custom Expo config plugin for the Sunrise alarm app.
 *
 * Modifies AndroidManifest.xml to add:
 * - USE_FULL_SCREEN_INTENT permission (required for alarm full-screen UI)
 * - FOREGROUND_SERVICE permission (required for native AlarmService)
 * - FOREGROUND_SERVICE_MEDIA_PLAYBACK permission (Android 14+ foreground service type)
 * - REQUEST_IGNORE_BATTERY_OPTIMIZATIONS (for prompting battery optimization exemption)
 * - showWhenLocked="true" on MainActivity (show over lock screen)
 * - turnScreenOn="true" on MainActivity (turn screen on when alarm fires)
 */
function withAlarmPermissions(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // --- Permissions ---
    const permissions = manifest['uses-permission'] || [];
    const permissionsToAdd = [
      'android.permission.USE_FULL_SCREEN_INTENT',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
      'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.SCHEDULE_EXACT_ALARM',
      'android.permission.USE_EXACT_ALARM',
      'android.permission.WAKE_LOCK',
      'android.permission.ACCESS_NOTIFICATION_POLICY',
      'android.permission.POST_NOTIFICATIONS',
    ];

    for (const perm of permissionsToAdd) {
      const exists = permissions.some(
        (p) => p.$?.['android:name'] === perm,
      );
      if (!exists) {
        permissions.push({
          $: { 'android:name': perm },
        });
      }
    }
    manifest['uses-permission'] = permissions;

    // NOTE: showWhenLocked and turnScreenOn are ONLY on AlarmActivity
    // (declared in withNativeAlarmEngine plugin), NOT on MainActivity.
    // Having them on MainActivity causes the app to show over the lock screen
    // when AlarmActivity finishes, preventing the phone from re-locking.

    return config;
  });
}

module.exports = withAlarmPermissions;
