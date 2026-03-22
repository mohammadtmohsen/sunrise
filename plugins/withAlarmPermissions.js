const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Custom Expo config plugin for the Sunrise alarm app.
 *
 * Modifies AndroidManifest.xml to add:
 * - USE_FULL_SCREEN_INTENT permission (required for alarm full-screen UI)
 * - FOREGROUND_SERVICE permission (required for persistent alarm sound)
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

    // --- MainActivity attributes ---
    const application = manifest.application?.[0];
    if (application?.activity) {
      for (const activity of application.activity) {
        if (
          activity.$?.['android:name'] === '.MainActivity' ||
          activity.$?.['android:name']?.endsWith('.MainActivity')
        ) {
          // Show the activity over the lock screen
          activity.$['android:showWhenLocked'] = 'true';
          // Turn the screen on when this activity launches
          activity.$['android:turnScreenOn'] = 'true';
        }
      }
    }

    // --- Foreground service type for Notifee's service ---
    // Notifee registers its own ForegroundService in its manifest.
    // On Android 14+, foreground services must declare a type.
    // We add foregroundServiceType to the Notifee service if present.
    if (application?.service) {
      for (const service of application.service) {
        const serviceName = service.$?.['android:name'] || '';
        if (
          serviceName.includes('notifee') ||
          serviceName.includes('Notifee') ||
          serviceName.includes('ForegroundService')
        ) {
          service.$['android:foregroundServiceType'] = 'mediaPlayback';
        }
      }
    }

    return config;
  });
}

module.exports = withAlarmPermissions;
