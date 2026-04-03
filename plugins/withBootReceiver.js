const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PACKAGE_DIR = 'com/lumora/app';

const BOOT_RECEIVER_KOTLIN = `package com.lumora.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == "android.intent.action.QUICKBOOT_POWERON" ||
            intent.action == "com.htc.intent.action.QUICKBOOT_POWERON"
        ) {
            try {
                val serviceIntent = Intent(context, BootAlarmTaskService::class.java)
                context.startService(serviceIntent)
            } catch (_: Exception) {
                // Service start may fail on some OEMs
            }
        }
    }
}
`;

const BOOT_TASK_SERVICE_KOTLIN = `package com.lumora.app

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class BootAlarmTaskService : HeadlessJsTaskService() {
    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
        return HeadlessJsTaskConfig(
            "RESCHEDULE_ALARMS_ON_BOOT",
            Arguments.createMap(),
            60000L,
            true
        )
    }
}
`;

function withBootReceiver(config) {
  // Step 1: Write the Kotlin source files
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
        path.join(javaDir, 'BootAlarmReceiver.kt'),
        BOOT_RECEIVER_KOTLIN,
      );
      fs.writeFileSync(
        path.join(javaDir, 'BootAlarmTaskService.kt'),
        BOOT_TASK_SERVICE_KOTLIN,
      );

      return config;
    },
  ]);

  // Step 2: Register the receiver and service in AndroidManifest.xml
  config = withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (!application) return config;

    // Add BroadcastReceiver
    if (!application.receiver) {
      application.receiver = [];
    }
    const hasReceiver = application.receiver.some(
      (r) => r.$?.['android:name'] === '.BootAlarmReceiver',
    );
    if (!hasReceiver) {
      application.receiver.push({
        $: {
          'android:name': '.BootAlarmReceiver',
          'android:exported': 'true',
          'android:enabled': 'true',
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } },
              { $: { 'android:name': 'android.intent.action.QUICKBOOT_POWERON' } },
            ],
          },
        ],
      });
    }

    // Add HeadlessJsTaskService
    if (!application.service) {
      application.service = [];
    }
    const hasService = application.service.some(
      (s) => s.$?.['android:name'] === '.BootAlarmTaskService',
    );
    if (!hasService) {
      application.service.push({
        $: {
          'android:name': '.BootAlarmTaskService',
          'android:exported': 'false',
        },
      });
    }

    return config;
  });

  return config;
}

module.exports = withBootReceiver;
