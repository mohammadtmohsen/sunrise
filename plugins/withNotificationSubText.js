const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PACKAGE_DIR = 'com/lumora/app';

const MODULE_KOTLIN = `package com.lumora.app

import android.app.NotificationManager
import android.content.Context
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class NotificationSubTextModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "NotificationSubText"

    @ReactMethod
    fun setSubText(tag: String, subText: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            val active = manager.activeNotifications.find { it.tag == tag }
            if (active == null) {
                promise.resolve(false)
                return
            }

            val rebuilt = NotificationCompat.Builder(context, active.notification)
                .setSubText(subText)
                .build()

            manager.notify(active.tag, active.id, rebuilt)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }
}
`;

const PACKAGE_KOTLIN = `package com.lumora.app

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class NotificationSubTextPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(NotificationSubTextModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
`;

function withNotificationSubText(config) {
  config = withDangerousMod(config, [
    'android',
    (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const javaDir = path.join(
        projectRoot, 'android', 'app', 'src', 'main', 'java',
        ...PACKAGE_DIR.split('/'),
      );

      fs.mkdirSync(javaDir, { recursive: true });

      fs.writeFileSync(
        path.join(javaDir, 'NotificationSubTextModule.kt'),
        MODULE_KOTLIN,
      );
      fs.writeFileSync(
        path.join(javaDir, 'NotificationSubTextPackage.kt'),
        PACKAGE_KOTLIN,
      );

      // Patch MainApplication.kt to register the package
      const mainAppPath = path.join(javaDir, 'MainApplication.kt');
      if (fs.existsSync(mainAppPath)) {
        let content = fs.readFileSync(mainAppPath, 'utf8');
        if (!content.includes('NotificationSubTextPackage')) {
          // Add to the packages list
          content = content.replace(
            /override val packages: List<ReactPackage>\s*get\(\) =\s*PackageList\(this\)\.packages/,
            `override val packages: List<ReactPackage>
          get() = PackageList(this).packages.toMutableList().apply {
            add(NotificationSubTextPackage())
          }`,
          );
          fs.writeFileSync(mainAppPath, content);
        }
      }

      return config;
    },
  ]);

  return config;
}

module.exports = withNotificationSubText;
