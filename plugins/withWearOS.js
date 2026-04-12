const {
  withAndroidManifest,
  withDangerousMod,
  withAppBuildGradle,
  withMainApplication,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PACKAGE_DIR = 'com/lumora/app/wear';

// ──────────────────────────────────────────────
// Native Module: WearDataLayerModule.kt
// ──────────────────────────────────────────────
const WEAR_MODULE_KOTLIN = `package com.lumora.app.wear

import android.net.Uri
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.tasks.Tasks
import com.google.android.gms.wearable.DataClient
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

class WearDataLayerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext),
    DataClient.OnDataChangedListener {

    companion object {
        const val NAME = "WearDataLayer"
        private const val TAG = "WearDataLayer"
        const val ALARMS_PATH = "/alarms"
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val dataClient: DataClient by lazy {
        Wearable.getDataClient(reactApplicationContext)
    }

    override fun getName(): String = NAME

    override fun initialize() {
        super.initialize()
        dataClient.addListener(this)
        Log.d(TAG, "WearDataLayer initialized, listening for data changes")
    }

    override fun invalidate() {
        dataClient.removeListener(this)
        scope.cancel()
        super.invalidate()
    }

    /**
     * Sync the full alarm list to the watch via DataClient.
     * Called from JS whenever alarms change.
     */
    @ReactMethod
    fun syncAlarms(alarmsJson: String) {
        scope.launch {
            try {
                val request = PutDataMapRequest.create(ALARMS_PATH).apply {
                    dataMap.putString("data", alarmsJson)
                    dataMap.putLong("timestamp", System.currentTimeMillis())
                }.asPutDataRequest().setUrgent()

                Tasks.await(dataClient.putDataItem(request))
                Log.d(TAG, "Alarms synced to watch")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to sync alarms to watch", e)
            }
        }
    }

    /**
     * Read the latest alarm data from the DataLayer.
     * Used on app startup to check for watch-side changes made while app was closed.
     */
    @ReactMethod
    fun getLatestAlarms(promise: Promise) {
        scope.launch {
            try {
                val uri = Uri.Builder()
                    .scheme("wear")
                    .authority("*")
                    .path(ALARMS_PATH)
                    .build()

                val dataItems = Tasks.await(dataClient.getDataItems(uri))
                var result: String? = null

                for (i in 0 until dataItems.count) {
                    val item = dataItems[i]
                    if (item.uri.path == ALARMS_PATH) {
                        val dataMap = DataMapItem.fromDataItem(item).dataMap
                        result = dataMap.getString("data")
                        break
                    }
                }
                dataItems.release()
                promise.resolve(result)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to get alarms from data layer", e)
                promise.reject("WEAR_ERROR", "Failed to read from data layer", e)
            }
        }
    }

    // Required for NativeEventEmitter
    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    /**
     * Called when data changes on the DataLayer (e.g., watch edited an alarm).
     * Emits an event to JS so the Zustand store can update.
     */
    override fun onDataChanged(dataEvents: DataEventBuffer) {
        for (event in dataEvents) {
            if (event.type == DataEvent.TYPE_CHANGED &&
                event.dataItem.uri.path == ALARMS_PATH
            ) {
                val dataMap = DataMapItem.fromDataItem(event.dataItem).dataMap
                val json = dataMap.getString("data") ?: continue
                val source = dataMap.getString("source") ?: "unknown"

                // Only emit to JS if the change came from the watch
                if (source == "watch") {
                    Log.d(TAG, "Received alarm update from watch")
                    reactApplicationContext
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        .emit("onWatchAlarmsChanged", json)
                }
            }
        }
    }
}
`;

// ──────────────────────────────────────────────
// ReactPackage: WearDataLayerPackage.kt
// ──────────────────────────────────────────────
const WEAR_PACKAGE_KOTLIN = `package com.lumora.app.wear

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class WearDataLayerPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(WearDataLayerModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
`;

// ──────────────────────────────────────────────
// Plugin implementation
// ──────────────────────────────────────────────
function withWearOS(config) {
  // Step 1: Write Kotlin source files
  config = withDangerousMod(config, [
    'android',
    (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const javaDir = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'java',
        ...PACKAGE_DIR.split('/'),
      );

      fs.mkdirSync(javaDir, { recursive: true });

      fs.writeFileSync(
        path.join(javaDir, 'WearDataLayerModule.kt'),
        WEAR_MODULE_KOTLIN,
      );
      fs.writeFileSync(
        path.join(javaDir, 'WearDataLayerPackage.kt'),
        WEAR_PACKAGE_KOTLIN,
      );

      return config;
    },
  ]);

  // Step 2: Add play-services-wearable dependency to app/build.gradle
  config = withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;
    const dep = 'com.google.android.gms:play-services-wearable';

    if (!contents.includes(dep)) {
      config.modResults.contents = contents.replace(
        /dependencies\s*\{/,
        `dependencies {\n    implementation("${dep}:18.2.0")`,
      );
    }

    // Add kotlinx-coroutines if not present (needed for the native module)
    if (!contents.includes('kotlinx-coroutines-play-services')) {
      config.modResults.contents = config.modResults.contents.replace(
        /dependencies\s*\{/,
        `dependencies {\n    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.7.3")`,
      );
    }

    return config;
  });

  // Step 3: Register native package in MainApplication
  config = withMainApplication(config, (config) => {
    const contents = config.modResults.contents;
    const importLine = 'import com.lumora.app.wear.WearDataLayerPackage';
    const addLine = 'add(WearDataLayerPackage())';

    // Add import
    if (!contents.includes(importLine)) {
      config.modResults.contents = config.modResults.contents.replace(
        /^(package .+)$/m,
        `$1\n${importLine}`,
      );
    }

    // Add package registration
    if (!contents.includes(addLine)) {
      // Expo SDK 50+ pattern: packages returned from PackageList inside an apply block
      if (contents.includes('.apply {')) {
        config.modResults.contents = config.modResults.contents.replace(
          /\.apply\s*\{/,
          `.apply {\n              ${addLine}`,
        );
      } else {
        // Fallback: add after PackageList creation
        config.modResults.contents = config.modResults.contents.replace(
          /(PackageList\(this\)\.packages)/,
          `$1.apply {\n              ${addLine}\n            }`,
        );
      }
    }

    return config;
  });

  // Step 4: Add WearableListenerService capability to AndroidManifest
  config = withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (!application) return config;

    // Add meta-data for wearable capability
    if (!application['meta-data']) {
      application['meta-data'] = [];
    }
    const hasWearMeta = application['meta-data'].some(
      (m) =>
        m.$?.['android:name'] ===
        'com.google.android.gms.version',
    );
    // play-services-wearable auto-adds this, but ensure it exists
    if (!hasWearMeta) {
      application['meta-data'].push({
        $: {
          'android:name': 'com.google.android.gms.version',
          'android:value': '@integer/google_play_services_version',
        },
      });
    }

    return config;
  });

  return config;
}

module.exports = withWearOS;
