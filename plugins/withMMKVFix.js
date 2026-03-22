const { withXcodeProject } = require('expo/config-plugins');

/**
 * Fix MMKV crc32 linker error on Xcode 26 by adding -lz to the main app target.
 * MMKV uses zlib's crc32 but Xcode 26 no longer auto-links it.
 */
function withMMKVFix(config) {
  return withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;

    // Add -lz to all build configurations of the main target
    const buildConfigs = xcodeProject.pbxXCBuildConfigurationSection();
    for (const key in buildConfigs) {
      const buildConfig = buildConfigs[key];
      if (
        buildConfig.buildSettings &&
        buildConfig.buildSettings.PRODUCT_NAME
      ) {
        const ldflags = buildConfig.buildSettings.OTHER_LDFLAGS || ['$(inherited)'];
        if (Array.isArray(ldflags)) {
          if (!ldflags.includes('-lz')) {
            ldflags.push('-lz');
          }
        }
        buildConfig.buildSettings.OTHER_LDFLAGS = ldflags;
      }
    }

    return config;
  });
}

module.exports = withMMKVFix;
