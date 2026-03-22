const { withEntitlementsPlist, withInfoPlist } = require('expo/config-plugins');

/**
 * Custom Expo config plugin for iOS alarm-specific configuration.
 *
 * Adds:
 * - Critical Alerts entitlement (com.apple.developer.usernotifications.critical-alerts)
 *   NOTE: Requires Apple approval — submit request at:
 *   https://developer.apple.com/contact/request/notifications-critical-alerts-entitlement/
 *
 * - UIBackgroundModes: audio, fetch, remote-notification
 *   (audio for alarm playback, fetch for background recalculation)
 *
 * - Time Sensitive notification support
 */
function withIOSAlarmPermissions(config) {
  // Add Critical Alerts entitlement
  config = withEntitlementsPlist(config, (config) => {
    config.modResults['com.apple.developer.usernotifications.critical-alerts'] = true;
    return config;
  });

  // Add background modes for audio playback and background fetch
  config = withInfoPlist(config, (config) => {
    const existingModes = config.modResults.UIBackgroundModes || [];
    const requiredModes = ['audio', 'fetch', 'remote-notification'];

    for (const mode of requiredModes) {
      if (!existingModes.includes(mode)) {
        existingModes.push(mode);
      }
    }

    config.modResults.UIBackgroundModes = existingModes;

    return config;
  });

  return config;
}

module.exports = withIOSAlarmPermissions;
