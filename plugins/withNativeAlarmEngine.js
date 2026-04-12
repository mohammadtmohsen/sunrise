const {
  withAndroidManifest,
  withDangerousMod,
  withAppBuildGradle,
  withMainApplication,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PACKAGE_DIR = 'com/lumora/app/alarm';

// ──────────────────────────────────────────────
// AlarmEngineModule.kt — React Native native module
// ──────────────────────────────────────────────
const ALARM_ENGINE_MODULE_KOTLIN = `package com.lumora.app.alarm

import android.app.AlarmManager
import android.app.AlarmManager.AlarmClockInfo
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.modules.core.DeviceEventManagerModule

class AlarmEngineModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "AlarmEngine"
        private const val TAG = "AlarmEngine"
        const val PREFS_NAME = "lumora_alarm_data"
        private const val PERSISTENT_NOTIFICATION_ID = 9998
        private const val STATUS_CHANNEL_ID = "status-channel-v3"
        private const val REMINDER_CHANNEL_ID = "reminder-channel-v4"
        private const val ALARM_CHANNEL_ID = "alarm-channel-v3"
        private const val MAINTENANCE_REQUEST_CODE = 8001
        private const val REFRESH_REQUEST_CODE = 8002
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun scheduleAlarm(
        alarmId: String,
        triggerTimeMs: Double,
        title: String,
        body: String,
        soundUri: String?,
        vibrate: Boolean,
        snoozeDuration: Int,
        repeatMode: String,
        promise: Promise
    ) {
        try {
            val context = reactApplicationContext
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

            // Store alarm metadata in SharedPreferences for the receiver to read
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putString("alarm_\${alarmId}_title", title)
                .putString("alarm_\${alarmId}_body", body)
                .putString("alarm_\${alarmId}_soundUri", soundUri)
                .putBoolean("alarm_\${alarmId}_vibrate", vibrate)
                .putInt("alarm_\${alarmId}_snoozeDuration", snoozeDuration)
                .putString("alarm_\${alarmId}_repeatMode", repeatMode)
                .apply()

            // PendingIntent for AlarmReceiver (fires when alarm triggers)
            val receiverIntent = Intent(context, AlarmReceiver::class.java).apply {
                action = "com.lumora.app.ALARM_TRIGGER"
                putExtra("alarmId", alarmId)
            }
            val requestCode = alarmId.hashCode()
            val triggerPendingIntent = PendingIntent.getBroadcast(
                context,
                requestCode,
                receiverIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            // PendingIntent for AlarmActivity (shows when user taps alarm icon in status bar)
            val showIntent = Intent(context, AlarmActivity::class.java).apply {
                putExtra("alarmId", alarmId)
                putExtra("alarmTitle", title)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val showPendingIntent = PendingIntent.getActivity(
                context,
                requestCode + 1,
                showIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            // Schedule using setAlarmClock — the ONLY 100% reliable alarm on Android 14+
            val alarmClockInfo = AlarmClockInfo(triggerTimeMs.toLong(), showPendingIntent)
            alarmManager.setAlarmClock(alarmClockInfo, triggerPendingIntent)

            Log.d(TAG, "Alarm scheduled: id=\$alarmId, triggerTime=\${triggerTimeMs.toLong()}")
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to schedule alarm", e)
            promise.reject("ALARM_SCHEDULE_ERROR", "Failed to schedule alarm: \${e.message}", e)
        }
    }

    @ReactMethod
    fun cancelAlarm(alarmId: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

            val receiverIntent = Intent(context, AlarmReceiver::class.java).apply {
                action = "com.lumora.app.ALARM_TRIGGER"
                putExtra("alarmId", alarmId)
            }
            val requestCode = alarmId.hashCode()
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                requestCode,
                receiverIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            alarmManager.cancel(pendingIntent)
            pendingIntent.cancel()

            // Clean up SharedPreferences
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .remove("alarm_\${alarmId}_title")
                .remove("alarm_\${alarmId}_body")
                .remove("alarm_\${alarmId}_soundUri")
                .remove("alarm_\${alarmId}_vibrate")
                .remove("alarm_\${alarmId}_snoozeDuration")
                .remove("alarm_\${alarmId}_repeatMode")
                .apply()

            Log.d(TAG, "Alarm cancelled: id=\$alarmId")
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to cancel alarm", e)
            promise.reject("ALARM_CANCEL_ERROR", "Failed to cancel alarm: \${e.message}", e)
        }
    }

    @ReactMethod
    fun dismissAlarm(promise: Promise) {
        try {
            val context = reactApplicationContext
            val dismissIntent = Intent(context, AlarmService::class.java).apply {
                action = "com.lumora.app.ALARM_DISMISS"
            }
            context.startService(dismissIntent)
            Log.d(TAG, "Dismiss alarm command sent")
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to dismiss alarm", e)
            promise.reject("ALARM_DISMISS_ERROR", "Failed to dismiss alarm: \${e.message}", e)
        }
    }

    @ReactMethod
    fun snoozeAlarm(alarmId: String, durationMs: Double, promise: Promise) {
        try {
            val context = reactApplicationContext
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

            // Stop the current alarm service
            val stopIntent = Intent(context, AlarmService::class.java).apply {
                action = "com.lumora.app.ALARM_SNOOZE"
                putExtra("alarmId", alarmId)
            }
            context.startService(stopIntent)

            // Read existing alarm metadata
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val title = prefs.getString("alarm_\${alarmId}_title", "Alarm") ?: "Alarm"

            // Reschedule as a new setAlarmClock
            val triggerTime = System.currentTimeMillis() + durationMs.toLong()

            val receiverIntent = Intent(context, AlarmReceiver::class.java).apply {
                action = "com.lumora.app.ALARM_TRIGGER"
                putExtra("alarmId", alarmId)
            }
            val requestCode = alarmId.hashCode()
            val triggerPendingIntent = PendingIntent.getBroadcast(
                context,
                requestCode,
                receiverIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val showIntent = Intent(context, AlarmActivity::class.java).apply {
                putExtra("alarmId", alarmId)
                putExtra("alarmTitle", title)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val showPendingIntent = PendingIntent.getActivity(
                context,
                requestCode + 1,
                showIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val alarmClockInfo = AlarmClockInfo(triggerTime, showPendingIntent)
            alarmManager.setAlarmClock(alarmClockInfo, triggerPendingIntent)

            Log.d(TAG, "Alarm snoozed: id=\$alarmId, newTrigger=\$triggerTime")
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to snooze alarm", e)
            promise.reject("ALARM_SNOOZE_ERROR", "Failed to snooze alarm: \${e.message}", e)
        }
    }

    // ── Reminder scheduling ──

    @ReactMethod
    fun scheduleReminder(
        alarmId: String,
        triggerTimeMs: Double,
        title: String,
        body: String,
        soundUri: String?,
        vibrate: Boolean,
        repeatMode: String,
        promise: Promise
    ) {
        try {
            val context = reactApplicationContext
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

            // Store reminder metadata in SharedPreferences
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putString("reminder_\${alarmId}_title", title)
                .putString("reminder_\${alarmId}_body", body)
                .putString("reminder_\${alarmId}_soundUri", soundUri)
                .putBoolean("reminder_\${alarmId}_vibrate", vibrate)
                .putString("reminder_\${alarmId}_repeatMode", repeatMode)
                .apply()

            val receiverIntent = Intent(context, ReminderReceiver::class.java).apply {
                action = "com.lumora.app.REMINDER_TRIGGER"
                putExtra("alarmId", alarmId)
            }
            val requestCode = alarmId.hashCode() + 100
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                requestCode,
                receiverIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                triggerTimeMs.toLong(),
                pendingIntent
            )

            Log.d(TAG, "Reminder scheduled: id=\$alarmId, triggerTime=\${triggerTimeMs.toLong()}")
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to schedule reminder", e)
            promise.reject("REMINDER_SCHEDULE_ERROR", "Failed to schedule reminder: \${e.message}", e)
        }
    }

    @ReactMethod
    fun cancelReminder(alarmId: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

            val receiverIntent = Intent(context, ReminderReceiver::class.java).apply {
                action = "com.lumora.app.REMINDER_TRIGGER"
                putExtra("alarmId", alarmId)
            }
            val requestCode = alarmId.hashCode() + 100
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                requestCode,
                receiverIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            alarmManager.cancel(pendingIntent)
            pendingIntent.cancel()

            // Clean up SharedPreferences
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .remove("reminder_\${alarmId}_title")
                .remove("reminder_\${alarmId}_body")
                .remove("reminder_\${alarmId}_soundUri")
                .remove("reminder_\${alarmId}_vibrate")
                .apply()

            Log.d(TAG, "Reminder cancelled: id=\$alarmId")
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to cancel reminder", e)
            promise.reject("REMINDER_CANCEL_ERROR", "Failed to cancel reminder: \${e.message}", e)
        }
    }

    // ── Persistent notification ──

    @ReactMethod
    fun showPersistentNotification(
        title: String,
        body: String,
        chronoBase: Double,
        expandedLines: ReadableArray,
        promise: Promise
    ) {
        try {
            val context = reactApplicationContext
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            // Ensure channel exists
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    STATUS_CHANNEL_ID,
                    "Alarm Status",
                    NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "Ongoing alarm status notifications"
                    setSound(null, null)
                    enableVibration(false)
                    lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
                }
                notificationManager.createNotificationChannel(channel)
            }

            // Build launch intent
            val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            val contentIntent = PendingIntent.getActivity(
                context,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            // Build InboxStyle
            val inboxStyle = NotificationCompat.InboxStyle()
            for (i in 0 until expandedLines.size()) {
                inboxStyle.addLine(expandedLines.getString(i))
            }

            val notification = NotificationCompat.Builder(context, STATUS_CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(body)
                .setSmallIcon(context.applicationInfo.icon)
                .setOngoing(true)
                .setAutoCancel(false)
                .setUsesChronometer(true)
                .setWhen(chronoBase.toLong())
                .setChronometerCountDown(true)
                .setStyle(inboxStyle)
                .setContentIntent(contentIntent)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build()

            notificationManager.notify(PERSISTENT_NOTIFICATION_ID, notification)

            Log.d(TAG, "Persistent notification shown")
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to show persistent notification", e)
            promise.reject("PERSISTENT_NOTIF_ERROR", "Failed to show persistent notification: \${e.message}", e)
        }
    }

    @ReactMethod
    fun hidePersistentNotification(promise: Promise) {
        try {
            val context = reactApplicationContext
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.cancel(PERSISTENT_NOTIFICATION_ID)

            Log.d(TAG, "Persistent notification hidden")
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to hide persistent notification", e)
            promise.reject("PERSISTENT_NOTIF_ERROR", "Failed to hide persistent notification: \${e.message}", e)
        }
    }

    // ── Notification channels ──

    @ReactMethod
    fun createNotificationChannels(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val context = reactApplicationContext
                val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

                // Delete old versioned channels
                val oldChannels = listOf(
                    "alarm-channel", "alarm-channel-v1", "alarm-channel-v2",
                    "reminder-channel", "reminder-channel-v1", "reminder-channel-v2", "reminder-channel-v3",
                    "status-channel", "status-channel-v1", "status-channel-v2"
                )
                for (channelId in oldChannels) {
                    notificationManager.deleteNotificationChannel(channelId)
                }

                // 1. Alarm channel — HIGH importance, no sound (MediaPlayer handles it), bypass DnD
                val alarmChannel = NotificationChannel(
                    ALARM_CHANNEL_ID,
                    "Alarm Notifications",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Alarm notifications for Lumora"
                    setBypassDnd(true)
                    lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
                    setSound(null, null)
                    enableVibration(false)
                }
                notificationManager.createNotificationChannel(alarmChannel)

                // 2. Reminder channel — HIGH importance, custom reminder sound, vibration
                val reminderChannel = NotificationChannel(
                    REMINDER_CHANNEL_ID,
                    "Reminder Notifications",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Reminder notifications for Lumora"
                    lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 200, 100, 200)
                    // Set channel sound to bundled reminder.mp3
                    val reminderResId = context.resources.getIdentifier("reminder", "raw", context.packageName)
                    if (reminderResId != 0) {
                        val soundUri = android.net.Uri.parse("android.resource://\${context.packageName}/\$reminderResId")
                        setSound(soundUri, android.media.AudioAttributes.Builder()
                            .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION)
                            .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build())
                    }
                }
                notificationManager.createNotificationChannel(reminderChannel)

                // 3. Status channel — LOW importance, no sound, no vibration
                val statusChannel = NotificationChannel(
                    STATUS_CHANNEL_ID,
                    "Alarm Status",
                    NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "Ongoing alarm status notifications"
                    lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
                    setSound(null, null)
                    enableVibration(false)
                }
                notificationManager.createNotificationChannel(statusChannel)

                Log.d(TAG, "Notification channels created")
            }
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to create notification channels", e)
            promise.reject("CHANNEL_ERROR", "Failed to create notification channels: \${e.message}", e)
        }
    }

    // ── Maintenance & refresh scheduling ──

    @ReactMethod
    fun scheduleDailyMaintenance(triggerTimeMs: Double, promise: Promise) {
        try {
            val context = reactApplicationContext
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

            val intent = Intent(context, MaintenanceReceiver::class.java).apply {
                action = "com.lumora.app.DAILY_MAINTENANCE"
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                MAINTENANCE_REQUEST_CODE,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                triggerTimeMs.toLong(),
                pendingIntent
            )

            Log.d(TAG, "Daily maintenance scheduled at \${triggerTimeMs.toLong()}")
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to schedule daily maintenance", e)
            promise.reject("MAINTENANCE_ERROR", "Failed to schedule daily maintenance: \${e.message}", e)
        }
    }

    @ReactMethod
    fun cancelDailyMaintenance(promise: Promise) {
        try {
            val context = reactApplicationContext
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

            val intent = Intent(context, MaintenanceReceiver::class.java).apply {
                action = "com.lumora.app.DAILY_MAINTENANCE"
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                MAINTENANCE_REQUEST_CODE,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            alarmManager.cancel(pendingIntent)
            pendingIntent.cancel()

            Log.d(TAG, "Daily maintenance cancelled")
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to cancel daily maintenance", e)
            promise.reject("MAINTENANCE_ERROR", "Failed to cancel daily maintenance: \${e.message}", e)
        }
    }

    @ReactMethod
    fun scheduleNotificationRefresh(triggerTimeMs: Double, promise: Promise) {
        try {
            val context = reactApplicationContext
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

            val intent = Intent(context, MaintenanceReceiver::class.java).apply {
                action = "com.lumora.app.NOTIFICATION_REFRESH"
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                REFRESH_REQUEST_CODE,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                triggerTimeMs.toLong(),
                pendingIntent
            )

            Log.d(TAG, "Notification refresh scheduled at \${triggerTimeMs.toLong()}")
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to schedule notification refresh", e)
            promise.reject("REFRESH_ERROR", "Failed to schedule notification refresh: \${e.message}", e)
        }
    }

    @ReactMethod
    fun cancelNotificationRefresh(promise: Promise) {
        try {
            val context = reactApplicationContext
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

            val intent = Intent(context, MaintenanceReceiver::class.java).apply {
                action = "com.lumora.app.NOTIFICATION_REFRESH"
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                REFRESH_REQUEST_CODE,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            alarmManager.cancel(pendingIntent)
            pendingIntent.cancel()

            Log.d(TAG, "Notification refresh cancelled")
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to cancel notification refresh", e)
            promise.reject("REFRESH_ERROR", "Failed to cancel notification refresh: \${e.message}", e)
        }
    }

    // ── Permission utilities ──

    @ReactMethod
    fun getNotificationSettings(promise: Promise) {
        try {
            val context = reactApplicationContext
            val result = Arguments.createMap()

            // Exact alarm permission (Android 12+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
                result.putBoolean("alarm", alarmManager.canScheduleExactAlarms())
            } else {
                result.putBoolean("alarm", true)
            }

            // Notification permission
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            result.putBoolean("notifications", notificationManager.areNotificationsEnabled())

            // Battery optimization
            val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            result.putBoolean("batteryOptimized", !powerManager.isIgnoringBatteryOptimizations(context.packageName))

            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get notification settings", e)
            promise.reject("SETTINGS_ERROR", "Failed to get notification settings: \${e.message}", e)
        }
    }

    @ReactMethod
    fun openBatteryOptimizationSettings(promise: Promise) {
        try {
            val context = reactApplicationContext
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:\${context.packageName}")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open battery optimization settings", e)
            promise.reject("SETTINGS_ERROR", "Failed to open battery optimization settings: \${e.message}", e)
        }
    }

    @ReactMethod
    fun openAlarmPermissionSettings(promise: Promise) {
        try {
            val context = reactApplicationContext
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                    data = Uri.parse("package:\${context.packageName}")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(intent)
            }
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open alarm permission settings", e)
            promise.reject("SETTINGS_ERROR", "Failed to open alarm permission settings: \${e.message}", e)
        }
    }

    @ReactMethod
    fun openNotificationSettings(promise: Promise) {
        try {
            val context = reactApplicationContext
            val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open notification settings", e)
            promise.reject("SETTINGS_ERROR", "Failed to open notification settings: \${e.message}", e)
        }
    }

    @ReactMethod
    fun openPowerManagerSettings(promise: Promise) {
        try {
            val context = reactApplicationContext
            val manufacturer = Build.MANUFACTURER.lowercase()

            val powerManagerIntents = mutableListOf<Intent>()

            when {
                manufacturer.contains("xiaomi") || manufacturer.contains("redmi") -> {
                    powerManagerIntents.add(Intent().apply {
                        component = ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity")
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    })
                    powerManagerIntents.add(Intent().apply {
                        component = ComponentName("com.miui.powerkeeper", "com.miui.powerkeeper.ui.HiddenAppsConfigActivity")
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    })
                }
                manufacturer.contains("samsung") -> {
                    powerManagerIntents.add(Intent().apply {
                        component = ComponentName("com.samsung.android.lool", "com.samsung.android.sm.battery.ui.BatteryActivity")
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    })
                    powerManagerIntents.add(Intent().apply {
                        component = ComponentName("com.samsung.android.sm", "com.samsung.android.sm.battery.ui.BatteryActivity")
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    })
                }
                manufacturer.contains("huawei") || manufacturer.contains("honor") -> {
                    powerManagerIntents.add(Intent().apply {
                        component = ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity")
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    })
                    powerManagerIntents.add(Intent().apply {
                        component = ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity")
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    })
                }
            }

            var launched = false
            for (intent in powerManagerIntents) {
                try {
                    context.startActivity(intent)
                    launched = true
                    break
                } catch (_: Exception) {
                    // Try next intent
                }
            }

            if (!launched) {
                // Fallback to battery saver settings
                val fallbackIntent = Intent(Settings.ACTION_BATTERY_SAVER_SETTINGS).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(fallbackIntent)
            }

            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open power manager settings", e)
            promise.reject("SETTINGS_ERROR", "Failed to open power manager settings: \${e.message}", e)
        }
    }

    @ReactMethod
    fun checkBatteryOptimization(promise: Promise) {
        try {
            val context = reactApplicationContext
            val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            val result = Arguments.createMap()

            result.putBoolean("isOptimized", !powerManager.isIgnoringBatteryOptimizations(context.packageName))

            // Check if manufacturer has custom power manager
            val manufacturer = Build.MANUFACTURER.lowercase()
            val hasPowerManager = manufacturer.contains("xiaomi") ||
                manufacturer.contains("redmi") ||
                manufacturer.contains("samsung") ||
                manufacturer.contains("huawei") ||
                manufacturer.contains("honor") ||
                manufacturer.contains("oppo") ||
                manufacturer.contains("vivo") ||
                manufacturer.contains("oneplus") ||
                manufacturer.contains("realme")

            result.putBoolean("hasPowerManager", hasPowerManager)

            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to check battery optimization", e)
            promise.reject("BATTERY_ERROR", "Failed to check battery optimization: \${e.message}", e)
        }
    }

    /**
     * Get alarmIds that were dismissed as "once" while JS was not running.
     * Returns an array of alarmIds, then clears the flags.
     */
    @ReactMethod
    fun getDismissedOnceAlarms(promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val all = prefs.all
            val dismissed = Arguments.createArray()
            val editor = prefs.edit()

            for ((key, value) in all) {
                if (key.endsWith("_dismissed_once") && value == true) {
                    // Extract alarmId from "alarm_{alarmId}_dismissed_once"
                    val alarmId = key.removePrefix("alarm_").removeSuffix("_dismissed_once")
                    dismissed.pushString(alarmId)
                    editor.remove(key)
                }
            }

            editor.apply()
            promise.resolve(dismissed)
        } catch (e: Exception) {
            promise.resolve(Arguments.createArray())
        }
    }

    // Required for NativeEventEmitter
    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}
`;

// ──────────────────────────────────────────────
// AlarmEnginePackage.kt — ReactPackage wrapper
// ──────────────────────────────────────────────
const ALARM_ENGINE_PACKAGE_KOTLIN = `package com.lumora.app.alarm

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class AlarmEnginePackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(AlarmEngineModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
`;

// ──────────────────────────────────────────────
// AlarmReceiver.kt — BroadcastReceiver for alarm trigger
// ──────────────────────────────────────────────
const ALARM_RECEIVER_KOTLIN = `package com.lumora.app.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager
import android.util.Log

class AlarmReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "AlarmReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val alarmId = intent.getStringExtra("alarmId") ?: "unknown"
        Log.d(TAG, "Alarm triggered: id=\$alarmId")

        // Acquire a partial WakeLock to ensure the service starts
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "lumora:AlarmReceiverWakeLock"
        )
        wakeLock.acquire(10_000L) // 10 seconds max

        try {
            val serviceIntent = Intent(context, AlarmService::class.java).apply {
                action = "com.lumora.app.ALARM_TRIGGER"
                putExtra("alarmId", alarmId)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start AlarmService", e)
        } finally {
            // Release WakeLock after a short delay to ensure service has started
            try {
                if (wakeLock.isHeld) {
                    wakeLock.release()
                }
            } catch (_: Exception) {}
        }
    }
}
`;

// ──────────────────────────────────────────────
// AlarmService.kt — Foreground Service
// ──────────────────────────────────────────────
const ALARM_SERVICE_KOTLIN = `package com.lumora.app.alarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

class AlarmService : Service() {

    companion object {
        private const val TAG = "AlarmService"
        private const val CHANNEL_ID = "alarm-channel-v3"
        private const val NOTIFICATION_ID = 9999
        private const val AUTO_STOP_MS = 5 * 60 * 1000L // 5 minutes
    }

    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var currentAlarmId: String? = null
    private val handler = Handler(Looper.getMainLooper())
    private val autoStopRunnable = Runnable {
        Log.d(TAG, "Auto-stopping alarm after timeout")
        handleDismiss()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        Log.d(TAG, "onStartCommand: action=\$action")

        when (action) {
            "com.lumora.app.ALARM_TRIGGER" -> {
                val alarmId = intent.getStringExtra("alarmId") ?: "unknown"
                currentAlarmId = alarmId
                startAlarm(alarmId)
            }
            "com.lumora.app.ALARM_DISMISS" -> {
                handleDismiss()
            }
            "com.lumora.app.ALARM_SNOOZE" -> {
                val alarmId = intent.getStringExtra("alarmId") ?: currentAlarmId ?: "unknown"
                handleSnooze(alarmId)
            }
            else -> {
                stopSelf()
            }
        }

        return START_NOT_STICKY
    }

    private fun startAlarm(alarmId: String) {
        // Acquire WakeLock to keep CPU awake during alarm
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "lumora:AlarmServiceWakeLock"
        ).apply {
            acquire(AUTO_STOP_MS + 10_000L)
        }

        // Read alarm metadata from SharedPreferences
        val prefs = getSharedPreferences(AlarmEngineModule.PREFS_NAME, Context.MODE_PRIVATE)
        val title = prefs.getString("alarm_\${alarmId}_title", "Alarm") ?: "Alarm"
        val body = prefs.getString("alarm_\${alarmId}_body", "Time to wake up!") ?: "Time to wake up!"
        val soundUri = prefs.getString("alarm_\${alarmId}_soundUri", null)
        val shouldVibrate = prefs.getBoolean("alarm_\${alarmId}_vibrate", true)
        val snoozeDuration = prefs.getInt("alarm_\${alarmId}_snoozeDuration", 5)

        // Build the fullscreen intent to AlarmActivity
        val fullScreenIntent = Intent(this, AlarmActivity::class.java).apply {
            putExtra("alarmId", alarmId)
            putExtra("alarmTitle", title)
            putExtra("snoozeDuration", snoozeDuration)
            this.flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val fullScreenPendingIntent = PendingIntent.getActivity(
            this,
            NOTIFICATION_ID,
            fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Dismiss action PendingIntent
        val dismissIntent = Intent(this, AlarmActionReceiver::class.java).apply {
            action = "com.lumora.app.ALARM_DISMISS"
            putExtra("alarmId", alarmId)
        }
        val dismissPendingIntent = PendingIntent.getBroadcast(
            this,
            NOTIFICATION_ID + 1,
            dismissIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Snooze action PendingIntent
        val snoozeIntent = Intent(this, AlarmActionReceiver::class.java).apply {
            action = "com.lumora.app.ALARM_SNOOZE"
            putExtra("alarmId", alarmId)
            putExtra("snoozeDuration", snoozeDuration)
        }
        val snoozePendingIntent = PendingIntent.getBroadcast(
            this,
            NOTIFICATION_ID + 2,
            snoozeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Delete intent — fires when user swipes notification away.
        // Treats swipe-away as a dismiss so the alarm stops and gets disabled.
        val deleteIntent = Intent(this, AlarmActionReceiver::class.java).apply {
            action = "com.lumora.app.ALARM_DISMISS"
            putExtra("alarmId", alarmId)
        }
        val deletePendingIntent = PendingIntent.getBroadcast(
            this,
            NOTIFICATION_ID + 3,
            deleteIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Build the notification
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(applicationInfo.icon)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(false) // Allow swipe-to-dismiss (deleteIntent handles cleanup)
            .setAutoCancel(false)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setDeleteIntent(deletePendingIntent)
            .addAction(0, "Dismiss", dismissPendingIntent)
            .addAction(0, "Snooze (\${snoozeDuration}min)", snoozePendingIntent)
            .setSound(null) // MediaPlayer handles sound directly
            .build()

        // Start foreground service with proper type
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        // Check screen state to decide behavior
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        val km = getSystemService(Context.KEYGUARD_SERVICE) as android.app.KeyguardManager
        val screenLocked = !pm.isInteractive || km.isKeyguardLocked

        // Play sound:
        // - Screen locked → alarm.mp3 (looping, full alarm sound)
        // - Screen unlocked → reminder.mp3 (single notification sound, non-intrusive)
        // User's custom sound overrides both defaults.
        startAlarmSound(soundUri, screenLocked)

        // Start vibration
        if (shouldVibrate) {
            startVibration()
        }

        // Launch strategy:
        // - Screen OFF or LOCKED → launch AlarmActivity fullscreen (over lock screen)
        // - Screen ON and UNLOCKED → persistent heads-up notification only
        if (screenLocked) {
            try {
                startActivity(fullScreenIntent)
                Log.d(TAG, "Launched AlarmActivity (screen locked/off)")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to launch AlarmActivity", e)
            }
        } else {
            Log.d(TAG, "Screen unlocked — notification with reminder sound")
        }

        // Set auto-stop timeout (5 minutes)
        handler.postDelayed(autoStopRunnable, AUTO_STOP_MS)
    }

    private fun startAlarmSound(soundUri: String?, isFullscreen: Boolean) {
        val alarmAttrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        try {
            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(alarmAttrs)

                if (!soundUri.isNullOrEmpty()) {
                    // Custom sound selected by user in settings — used for both states
                    setDataSource(this@AlarmService, Uri.parse(soundUri))
                } else if (isFullscreen) {
                    // Fullscreen (locked screen): alarm.mp3 — looping alarm sound
                    val resId = resources.getIdentifier("alarm", "raw", packageName)
                    if (resId != 0) {
                        val afd = resources.openRawResourceFd(resId)
                        setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
                        afd.close()
                    } else {
                        val fallback = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                        setDataSource(this@AlarmService, fallback)
                    }
                } else {
                    // Notification (unlocked screen): reminder.mp3 — single notification sound
                    val resId = resources.getIdentifier("reminder", "raw", packageName)
                    if (resId != 0) {
                        val afd = resources.openRawResourceFd(resId)
                        setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
                        afd.close()
                    } else {
                        val fallback = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                        setDataSource(this@AlarmService, fallback)
                    }
                }

                // Loop only for fullscreen alarms; single play for notification mode
                isLooping = isFullscreen
                prepare()
                start()
            }
            Log.d(TAG, "Alarm sound started")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start alarm sound", e)
            // Fallback: system alarm ringtone
            try {
                val fallbackUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                if (fallbackUri != null) {
                    mediaPlayer = MediaPlayer().apply {
                        setAudioAttributes(alarmAttrs)
                        setDataSource(this@AlarmService, fallbackUri)
                        isLooping = true
                        prepare()
                        start()
                    }
                }
            } catch (fallbackError: Exception) {
                Log.e(TAG, "Failed to start fallback alarm sound", fallbackError)
            }
        }
    }

    private fun startVibration() {
        try {
            vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vibratorManager.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }

            val pattern = longArrayOf(0, 500, 200, 500, 200)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(pattern, 0)
            }
            Log.d(TAG, "Vibration started")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start vibration", e)
        }
    }

    private fun isMainActivityInForeground(): Boolean {
        try {
            val am = getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
            val tasks = am.appTasks
            if (tasks.isNotEmpty()) {
                val topActivity = tasks[0].taskInfo.topActivity
                if (topActivity?.className?.contains("MainActivity") == true) {
                    // Check if the process is actually in the foreground
                    val processes = am.runningAppProcesses ?: return false
                    for (process in processes) {
                        if (process.processName == packageName &&
                            process.importance == android.app.ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND) {
                            return true
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to check foreground state", e)
        }
        return false
    }

    private fun handleDismiss() {
        val alarmId = currentAlarmId ?: "unknown"
        Log.d(TAG, "Handling dismiss for alarm: \$alarmId")

        // For "once" alarms, disable directly in SharedPreferences as safety net
        // (JS may not be running to handle the event)
        try {
            val prefs = getSharedPreferences(AlarmEngineModule.PREFS_NAME, Context.MODE_PRIVATE)
            val repeatMode = prefs.getString("alarm_\${alarmId}_repeatMode", "once")
            if (repeatMode == "once") {
                // Mark in SharedPreferences that this alarm should be disabled
                prefs.edit().putBoolean("alarm_\${alarmId}_dismissed_once", true).apply()
                Log.d(TAG, "Marked 'once' alarm \$alarmId for disable")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to check/update alarm repeat mode", e)
        }

        stopAlarmEffects()
        sendEventToJS("alarmDismissed", alarmId)
        stopSelf()
    }

    private fun handleSnooze(alarmId: String) {
        val prefs = getSharedPreferences(AlarmEngineModule.PREFS_NAME, Context.MODE_PRIVATE)
        val snoozeDuration = prefs.getInt("alarm_\${alarmId}_snoozeDuration", 5)

        Log.d(TAG, "Handling snooze for alarm: \$alarmId, duration: \${snoozeDuration}min")

        stopAlarmEffects()
        sendEventToJS("alarmSnoozed", alarmId, snoozeDuration)
        stopSelf()
    }

    private fun stopAlarmEffects() {
        handler.removeCallbacks(autoStopRunnable)

        try {
            mediaPlayer?.apply {
                if (isPlaying) stop()
                release()
            }
            mediaPlayer = null
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping MediaPlayer", e)
        }

        try {
            vibrator?.cancel()
            vibrator = null
        } catch (e: Exception) {
            Log.e(TAG, "Error cancelling vibration", e)
        }

        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
            }
            wakeLock = null
        } catch (e: Exception) {
            Log.e(TAG, "Error releasing WakeLock", e)
        }

        // Cancel the notification
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.cancel(NOTIFICATION_ID)
    }

    private fun sendEventToJS(eventName: String, alarmId: String, snoozeDuration: Int? = null) {
        try {
            val reactApplication = application as? ReactApplication ?: return
            val reactHost = reactApplication.reactHost ?: return
            val reactContext = reactHost.currentReactContext ?: run {
                Log.w(TAG, "ReactContext not available, cannot send event to JS")
                return
            }

            val params = Arguments.createMap().apply {
                putString("alarmId", alarmId)
                if (snoozeDuration != null) {
                    putInt("snoozeDuration", snoozeDuration)
                }
            }

            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)

            Log.d(TAG, "Event sent to JS: \$eventName, alarmId=\$alarmId")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send event to JS: \$eventName", e)
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Alarm Notifications",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Alarm notifications for Lumora"
                setBypassDnd(true)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                setSound(null, null) // MediaPlayer handles sound
                enableVibration(false) // Vibrator handles vibration
            }

            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        stopAlarmEffects()
        super.onDestroy()
    }
}
`;

// ──────────────────────────────────────────────
// AlarmActivity.kt — Full-screen alarm activity
// ──────────────────────────────────────────────
const ALARM_ACTIVITY_KOTLIN = `package com.lumora.app.alarm

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.util.TypedValue
import android.view.GestureDetector
import android.view.Gravity
import android.view.MotionEvent
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.abs

class AlarmActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "AlarmActivity"
        private const val SWIPE_THRESHOLD = 200
        private const val SWIPE_VELOCITY_THRESHOLD = 200
    }

    private lateinit var gestureDetector: GestureDetector

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Show OVER the lock screen without dismissing it.
        // ONLY use showWhenLocked — do NOT use turnScreenOn.
        // On Android 15, turnScreenOn causes the keyguard to transition to GONE state
        // (permanently unlocked) rather than just being occluded.
        // The screen is woken by AlarmService's notification fullScreenIntent instead.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED)
        }

        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON
        )

        val alarmId = intent.getStringExtra("alarmId") ?: "unknown"
        val alarmTitle = intent.getStringExtra("alarmTitle") ?: "Alarm"
        val snoozeDuration = intent.getIntExtra("snoozeDuration", 5)

        // Swipe-up gesture detector for dismissing the alarm
        gestureDetector = GestureDetector(this, object : GestureDetector.SimpleOnGestureListener() {
            override fun onFling(
                e1: MotionEvent?,
                e2: MotionEvent,
                velocityX: Float,
                velocityY: Float
            ): Boolean {
                val diffY = (e1?.y ?: 0f) - e2.y
                if (diffY > SWIPE_THRESHOLD && abs(velocityY) > SWIPE_VELOCITY_THRESHOLD) {
                    // Swiped up — dismiss
                    onDismiss(alarmId)
                    return true
                }
                return false
            }
        })

        buildUI(alarmId, alarmTitle, snoozeDuration)
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        return gestureDetector.onTouchEvent(event) || super.onTouchEvent(event)
    }

    private fun buildUI(alarmId: String, alarmTitle: String, snoozeDuration: Int) {
        val bgColor = Color.parseColor("#1A1A2E")
        val primaryColor = Color.parseColor("#E94560")
        val surfaceColor = Color.parseColor("#16213E")
        val sunriseColor = Color.parseColor("#FF6B35")
        val whiteColor = Color.WHITE
        val mutedColor = Color.parseColor("#666680")
        val density = resources.displayMetrics.density

        val rootLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(bgColor)
            setPadding(
                (32 * density).toInt(),
                (64 * density).toInt(),
                (32 * density).toInt(),
                (64 * density).toInt()
            )
        }

        // Time display
        val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())
        val timeText = TextView(this).apply {
            text = timeFormat.format(Date())
            setTextColor(whiteColor)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 64f)
            typeface = Typeface.create("sans-serif-light", Typeface.NORMAL)
            gravity = Gravity.CENTER
        }
        rootLayout.addView(timeText, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            bottomMargin = (16 * density).toInt()
        })

        // Alarm name
        val nameText = TextView(this).apply {
            text = alarmTitle
            setTextColor(sunriseColor)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 24f)
            gravity = Gravity.CENTER
        }
        rootLayout.addView(nameText, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            bottomMargin = (64 * density).toInt()
        })

        // Dismiss button
        val dismissButton = Button(this).apply {
            text = "Dismiss"
            setTextColor(whiteColor)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
            isAllCaps = false
            background = GradientDrawable().apply {
                setColor(primaryColor)
                cornerRadius = 28 * density
            }
            setPadding(
                (48 * density).toInt(),
                (16 * density).toInt(),
                (48 * density).toInt(),
                (16 * density).toInt()
            )
            setOnClickListener { onDismiss(alarmId) }
        }
        rootLayout.addView(dismissButton, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            bottomMargin = (16 * density).toInt()
            leftMargin = (24 * density).toInt()
            rightMargin = (24 * density).toInt()
        })

        // Snooze button
        val snoozeButton = Button(this).apply {
            text = "Snooze (\${snoozeDuration} min)"
            setTextColor(Color.parseColor("#B0B0C0"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
            isAllCaps = false
            background = GradientDrawable().apply {
                setColor(surfaceColor)
                cornerRadius = 28 * density
            }
            setPadding(
                (48 * density).toInt(),
                (16 * density).toInt(),
                (48 * density).toInt(),
                (16 * density).toInt()
            )
            setOnClickListener { onSnooze(alarmId, snoozeDuration) }
        }
        rootLayout.addView(snoozeButton, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            bottomMargin = (32 * density).toInt()
            leftMargin = (24 * density).toInt()
            rightMargin = (24 * density).toInt()
        })

        // Hint text
        val hintText = TextView(this).apply {
            text = "Swipe up to dismiss"
            setTextColor(mutedColor)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            gravity = Gravity.CENTER
        }
        rootLayout.addView(hintText)

        setContentView(rootLayout)
    }

    private fun onDismiss(alarmId: String) {
        val intent = Intent(this, AlarmService::class.java).apply {
            action = "com.lumora.app.ALARM_DISMISS"
            putExtra("alarmId", alarmId)
        }
        startService(intent)
        lockScreenAndFinish()
    }

    private fun onSnooze(alarmId: String, snoozeDuration: Int) {
        val intent = Intent(this, AlarmService::class.java).apply {
            action = "com.lumora.app.ALARM_SNOOZE"
            putExtra("alarmId", alarmId)
            putExtra("snoozeDuration", snoozeDuration)
        }
        startService(intent)
        lockScreenAndFinish()
    }

    /**
     * Turn screen off and finish the activity so the phone returns to its
     * locked state.
     *
     * Strategy (matches AOSP DeskClock):
     * 1. Clear FLAG_KEEP_SCREEN_ON so the screen is no longer forced on.
     * 2. Revoke showWhenLocked so this window no longer occludes the keyguard.
     * 3. Set screenBrightness to 0 — this forces an immediate screen-off on
     *    most devices, rather than waiting for the system timeout (which would
     *    briefly flash the launcher / home screen).
     * 4. Call finish() (not finishAndRemoveTask). With taskAffinity="" and
     *    excludeFromRecents="true", finish() already removes the task cleanly.
     *    finishAndRemoveTask() is unnecessarily aggressive and on some OEMs
     *    causes the system to briefly show the launcher before re-locking.
     *
     * The combination of FLAG_ALLOW_LOCK_WHILE_SCREEN_ON (set in onCreate)
     * and clearing KEEP_SCREEN_ON here allows the keyguard to re-engage
     * immediately once this activity is gone, even if the screen hasn't
     * timed out yet.
     */
    private fun lockScreenAndFinish() {
        // 1. Let the screen turn off naturally
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // 2. Revoke show-when-locked so keyguard is no longer occluded
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(false)
        }

        // 3. Force screen brightness to minimum to trigger immediate screen-off.
        //    This prevents the brief flash of the home screen / launcher that
        //    occurs between finish() and the system re-locking.
        val params = window.attributes
        params.screenBrightness = 0f
        window.attributes = params

        // 4. Finish the activity — keyguard un-occludes and re-locks
        finish()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        val alarmId = intent.getStringExtra("alarmId") ?: "unknown"
        onDismiss(alarmId)
    }

    override fun onDestroy() {
        super.onDestroy()
    }
}
`;

// ──────────────────────────────────────────────
// AlarmActionReceiver.kt — BroadcastReceiver for notification actions
// ──────────────────────────────────────────────
const ALARM_ACTION_RECEIVER_KOTLIN = `package com.lumora.app.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

class AlarmActionReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "AlarmActionReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        val alarmId = intent.getStringExtra("alarmId") ?: "unknown"
        Log.d(TAG, "Received action: \$action, alarmId: \$alarmId")

        when (action) {
            "com.lumora.app.ALARM_DISMISS" -> {
                val serviceIntent = Intent(context, AlarmService::class.java).apply {
                    this.action = "com.lumora.app.ALARM_DISMISS"
                    putExtra("alarmId", alarmId)
                }
                context.startService(serviceIntent)

                // Finish AlarmActivity if it's running
                finishAlarmActivity(context)
            }
            "com.lumora.app.ALARM_SNOOZE" -> {
                val snoozeDuration = intent.getIntExtra("snoozeDuration", 5)
                val serviceIntent = Intent(context, AlarmService::class.java).apply {
                    this.action = "com.lumora.app.ALARM_SNOOZE"
                    putExtra("alarmId", alarmId)
                    putExtra("snoozeDuration", snoozeDuration)
                }
                context.startService(serviceIntent)

                // Finish AlarmActivity if it's running
                finishAlarmActivity(context)
            }
            "com.lumora.app.REMINDER_DISMISS" -> {
                Log.d(TAG, "Reminder dismissed: \$alarmId")

                // Cancel the reminder notification
                val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
                val notificationId = 7000 + (alarmId.hashCode() and 0xFFF)
                notificationManager.cancel(notificationId)

                // Mark "once" reminders for disable in SharedPreferences
                val prefs = context.getSharedPreferences(AlarmEngineModule.PREFS_NAME, Context.MODE_PRIVATE)
                val repeatMode = prefs.getString("reminder_\${alarmId}_repeatMode", "once")
                if (repeatMode == "once") {
                    prefs.edit().putBoolean("alarm_\${alarmId}_dismissed_once", true).apply()
                    Log.d(TAG, "Marked 'once' reminder \$alarmId for disable")
                }

                // Send event to JS if React context is available
                try {
                    val reactApplication = context.applicationContext as? com.facebook.react.ReactApplication
                    val reactHost = reactApplication?.reactHost
                    val reactContext = reactHost?.currentReactContext
                    if (reactContext != null) {
                        val params = com.facebook.react.bridge.Arguments.createMap().apply {
                            putString("alarmId", alarmId)
                        }
                        reactContext
                            .getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                            .emit("reminderDismissed", params)
                        Log.d(TAG, "Sent reminderDismissed event to JS")
                    } else {
                        Log.w(TAG, "ReactContext not available for reminderDismissed event")
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to send reminderDismissed event", e)
                }
            }
        }
    }

    private fun finishAlarmActivity(context: Context) {
        // Send a broadcast to tell AlarmActivity to finish
        val finishIntent = Intent("com.lumora.app.FINISH_ALARM_ACTIVITY")
        context.sendBroadcast(finishIntent)
    }
}
`;

// ──────────────────────────────────────────────
// ReminderReceiver.kt — BroadcastReceiver for reminder notifications
// ──────────────────────────────────────────────
const REMINDER_RECEIVER_KOTLIN = `package com.lumora.app.alarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

class ReminderReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "ReminderReceiver"
        private const val CHANNEL_ID = "reminder-channel-v4"
        private const val NOTIFICATION_ID_BASE = 7000
    }

    override fun onReceive(context: Context, intent: Intent) {
        val alarmId = intent.getStringExtra("alarmId") ?: "unknown"
        Log.d(TAG, "Reminder triggered: id=\$alarmId")

        // No wake lock — on Android 15, any screen wake lock unlocks the device.
        // The HIGH importance notification will light up the screen naturally
        // if the user has "wake screen for notifications" enabled in system settings.

        // Read reminder metadata from SharedPreferences
        val prefs = context.getSharedPreferences(AlarmEngineModule.PREFS_NAME, Context.MODE_PRIVATE)
        val title = prefs.getString("reminder_\${alarmId}_title", "Reminder") ?: "Reminder"
        val body = prefs.getString("reminder_\${alarmId}_body", "") ?: ""
        val soundUri = prefs.getString("reminder_\${alarmId}_soundUri", null)
        val shouldVibrate = prefs.getBoolean("reminder_\${alarmId}_vibrate", true)

        // Ensure notification channel exists
        createReminderChannel(context)

        // Build launch intent (opens main activity)
        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        val contentIntent = PendingIntent.getActivity(
            context,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Dismiss action — route through AlarmActionReceiver which handles all dismiss/snooze
        val dismissIntent = Intent(context, AlarmActionReceiver::class.java).apply {
            action = "com.lumora.app.REMINDER_DISMISS"
            putExtra("alarmId", alarmId)
        }
        val dismissPendingIntent = PendingIntent.getBroadcast(
            context,
            alarmId.hashCode() + 200,
            dismissIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Delete intent — fires when user swipes the notification away.
        // Treats swipe as dismiss so the alarm gets disabled/rescheduled.
        val deleteIntent = Intent(context, AlarmActionReceiver::class.java).apply {
            action = "com.lumora.app.REMINDER_DISMISS"
            putExtra("alarmId", alarmId)
        }
        val deletePendingIntent = PendingIntent.getBroadcast(
            context,
            alarmId.hashCode() + 201,
            deleteIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(context.applicationInfo.icon)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(false)
            .setOngoing(false)  // Allow swipe (deleteIntent handles cleanup)
            .setGroup("lumora-reminders")  // Separate group from persistent notification
            .setContentIntent(contentIntent)
            .setDeleteIntent(deletePendingIntent)  // Swipe = dismiss
            // No fullScreenIntent — reminders are just notifications, not fullscreen takeovers.
            // HIGH priority + HIGH importance channel = heads-up notification that shows on lock screen.
            .addAction(0, "Dismiss", dismissPendingIntent)

        // Sound comes from the channel (reminder-channel-v4 has reminder.mp3 set).
        // Do NOT call builder.setSound() — on Android O+, it's ignored and the
        // channel sound takes precedence. Setting it here can cause double-sound
        // on older Android versions.

        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val notificationId = NOTIFICATION_ID_BASE + (alarmId.hashCode() and 0xFFF)
        notificationManager.notify(notificationId, builder.build())

        // Send event to JS
        sendEventToJS(context, "reminderDelivered", alarmId)
    }

    private fun createReminderChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Reminder Notifications",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Reminder notifications for Lumora"
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 200, 100, 200)
                // Set channel sound to bundled reminder.mp3
                val reminderResId = context.resources.getIdentifier("reminder", "raw", context.packageName)
                if (reminderResId != 0) {
                    val soundUri = android.net.Uri.parse("android.resource://\${context.packageName}/\$reminderResId")
                    setSound(soundUri, android.media.AudioAttributes.Builder()
                        .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION)
                        .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build())
                }
            }

            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun sendEventToJS(context: Context, eventName: String, alarmId: String) {
        try {
            val reactApplication = context.applicationContext as? ReactApplication ?: return
            val reactHost = reactApplication.reactHost ?: return
            val reactContext = reactHost.currentReactContext ?: run {
                Log.w(TAG, "ReactContext not available, cannot send event to JS")
                return
            }

            val params = Arguments.createMap().apply {
                putString("alarmId", alarmId)
            }

            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)

            Log.d(TAG, "Event sent to JS: \$eventName, alarmId=\$alarmId")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send event to JS: \$eventName", e)
        }
    }
}
`;

// ──────────────────────────────────────────────
// MaintenanceReceiver.kt — BroadcastReceiver for housekeeping triggers
// ──────────────────────────────────────────────
const MAINTENANCE_RECEIVER_KOTLIN = `package com.lumora.app.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

class MaintenanceReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "MaintenanceReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        Log.d(TAG, "Maintenance receiver triggered: action=\$action")

        when (action) {
            "com.lumora.app.DAILY_MAINTENANCE" -> {
                sendEventToJS(context, "maintenanceTriggered")
            }
            "com.lumora.app.NOTIFICATION_REFRESH" -> {
                sendEventToJS(context, "refreshTriggered")
            }
            else -> {
                Log.w(TAG, "Unknown action: \$action")
            }
        }
    }

    private fun sendEventToJS(context: Context, eventName: String) {
        try {
            val reactApplication = context.applicationContext as? ReactApplication ?: return
            val reactHost = reactApplication.reactHost ?: return
            val reactContext = reactHost.currentReactContext ?: run {
                Log.w(TAG, "ReactContext not available, cannot send event to JS")
                return
            }

            val params = Arguments.createMap()

            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)

            Log.d(TAG, "Event sent to JS: \$eventName")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send event to JS: \$eventName", e)
        }
    }
}
`;

// ──────────────────────────────────────────────
// Plugin implementation
// ──────────────────────────────────────────────
function withNativeAlarmEngine(config) {
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
        path.join(javaDir, 'AlarmEngineModule.kt'),
        ALARM_ENGINE_MODULE_KOTLIN,
      );
      fs.writeFileSync(
        path.join(javaDir, 'AlarmEnginePackage.kt'),
        ALARM_ENGINE_PACKAGE_KOTLIN,
      );
      fs.writeFileSync(
        path.join(javaDir, 'AlarmReceiver.kt'),
        ALARM_RECEIVER_KOTLIN,
      );
      fs.writeFileSync(
        path.join(javaDir, 'AlarmService.kt'),
        ALARM_SERVICE_KOTLIN,
      );
      fs.writeFileSync(
        path.join(javaDir, 'AlarmActivity.kt'),
        ALARM_ACTIVITY_KOTLIN,
      );
      fs.writeFileSync(
        path.join(javaDir, 'AlarmActionReceiver.kt'),
        ALARM_ACTION_RECEIVER_KOTLIN,
      );
      fs.writeFileSync(
        path.join(javaDir, 'ReminderReceiver.kt'),
        REMINDER_RECEIVER_KOTLIN,
      );
      fs.writeFileSync(
        path.join(javaDir, 'MaintenanceReceiver.kt'),
        MAINTENANCE_RECEIVER_KOTLIN,
      );

      // Copy bundled sounds to res/raw/ so native code can access them
      const rawDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'raw');
      fs.mkdirSync(rawDir, { recursive: true });

      // Alarm sound (looping, for fullscreen alarm)
      const alarmSrc = path.join(projectRoot, 'assets', 'sounds', 'alarm.mp3');
      const alarmDst = path.join(rawDir, 'alarm.mp3');
      if (fs.existsSync(alarmSrc)) {
        fs.copyFileSync(alarmSrc, alarmDst);
      }

      // Reminder sound (single play, for notification reminders)
      const reminderSrc = path.join(projectRoot, 'assets', 'sounds', 'reminder.mp3');
      const reminderDst = path.join(rawDir, 'reminder.mp3');
      if (fs.existsSync(reminderSrc)) {
        fs.copyFileSync(reminderSrc, reminderDst);
      }


      return config;
    },
  ]);

  // Step 2: Add androidx.appcompat dependency to app/build.gradle
  config = withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;
    const dep = 'androidx.appcompat:appcompat';

    if (!contents.includes(dep)) {
      config.modResults.contents = contents.replace(
        /dependencies\s*\{/,
        `dependencies {\n    implementation("${dep}:1.7.0")`,
      );
    }

    return config;
  });

  // Step 3: Register native package in MainApplication
  config = withMainApplication(config, (config) => {
    const contents = config.modResults.contents;
    const importLine = 'import com.lumora.app.alarm.AlarmEnginePackage';
    const addLine = 'add(AlarmEnginePackage())';

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

  // Step 4: Update AndroidManifest.xml — add receivers, service, and activity
  config = withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (!application) return config;

    // --- Receivers ---
    if (!application.receiver) {
      application.receiver = [];
    }

    // AlarmReceiver
    const hasAlarmReceiver = application.receiver.some(
      (r) => r.$?.['android:name'] === '.alarm.AlarmReceiver',
    );
    if (!hasAlarmReceiver) {
      application.receiver.push({
        $: {
          'android:name': '.alarm.AlarmReceiver',
          'android:exported': 'false',
        },
      });
    }

    // AlarmActionReceiver
    const hasActionReceiver = application.receiver.some(
      (r) => r.$?.['android:name'] === '.alarm.AlarmActionReceiver',
    );
    if (!hasActionReceiver) {
      application.receiver.push({
        $: {
          'android:name': '.alarm.AlarmActionReceiver',
          'android:exported': 'false',
        },
      });
    }

    // ReminderReceiver
    const hasReminderReceiver = application.receiver.some(
      (r) => r.$?.['android:name'] === '.alarm.ReminderReceiver',
    );
    if (!hasReminderReceiver) {
      application.receiver.push({
        $: {
          'android:name': '.alarm.ReminderReceiver',
          'android:exported': 'false',
        },
      });
    }

    // MaintenanceReceiver
    const hasMaintenanceReceiver = application.receiver.some(
      (r) => r.$?.['android:name'] === '.alarm.MaintenanceReceiver',
    );
    if (!hasMaintenanceReceiver) {
      application.receiver.push({
        $: {
          'android:name': '.alarm.MaintenanceReceiver',
          'android:exported': 'false',
        },
      });
    }

    // --- Service ---
    if (!application.service) {
      application.service = [];
    }

    const hasAlarmService = application.service.some(
      (s) => s.$?.['android:name'] === '.alarm.AlarmService',
    );
    if (!hasAlarmService) {
      application.service.push({
        $: {
          'android:name': '.alarm.AlarmService',
          'android:exported': 'false',
          'android:foregroundServiceType': 'mediaPlayback',
        },
      });
    }

    // --- Activity ---
    if (!application.activity) {
      application.activity = [];
    }

    const hasAlarmActivity = application.activity.some(
      (a) => a.$?.['android:name'] === '.alarm.AlarmActivity',
    );
    if (!hasAlarmActivity) {
      application.activity.push({
        $: {
          'android:name': '.alarm.AlarmActivity',
          'android:exported': 'false',
          'android:showWhenLocked': 'true',
          'android:excludeFromRecents': 'true',
          'android:taskAffinity': '',
          'android:theme': '@style/Theme.AppCompat.NoActionBar',
        },
      });
    }

    return config;
  });

  return config;
}

module.exports = withNativeAlarmEngine;
