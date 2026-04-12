package com.lumora.wear.data

/**
 * Mirrors the phone app's Alarm interface from src/models/types.ts.
 * Used for JSON serialization/deserialization via Gson.
 */
data class Alarm(
    val id: String,
    val name: String,
    val type: String,                        // "relative" | "absolute"

    // Relative alarm fields
    val referenceEvent: String = "sunrise",   // "sunrise" | "sunset"
    val offsetMinutes: Int = 0,               // Negative = before, positive = after

    // Absolute alarm fields
    val absoluteHour: Int = 6,                // 0-23
    val absoluteMinute: Int = 0,              // 0-59

    val alarmStyle: String = "alarm",         // "alarm" | "reminder"
    val repeatMode: String = "once",          // "once" | "repeat"
    val repeatDays: List<Int> = emptyList(),  // 0=Sun, 1=Mon, ..., 6=Sat
    val isEnabled: Boolean = true,
    val soundUri: String? = null,
    val vibrate: Boolean = true,
    val snoozeDurationMinutes: Int = 5,
    val createdAt: String = "",
    val updatedAt: String = "",
    val nextTriggerAt: String? = null,
    val notificationId: String? = null,
) {
    /** Human-readable time string for display on watch */
    val displayTime: String
        get() = if (type == "absolute") {
            String.format("%02d:%02d", absoluteHour, absoluteMinute)
        } else {
            val absMin = kotlin.math.abs(offsetMinutes)
            val h = absMin / 60
            val m = absMin % 60
            val dir = if (offsetMinutes < 0) "before" else "after"
            val event = referenceEvent.replaceFirstChar { it.uppercase() }
            val time = if (h > 0) "${h}h ${m}m" else "${m}m"
            "$time $dir $event"
        }

    /** Short mode label for list display */
    val modeLabel: String
        get() = when {
            type == "absolute" -> "Fixed"
            referenceEvent == "sunrise" && offsetMinutes < 0 -> "Before Sunrise"
            referenceEvent == "sunrise" -> "After Sunrise"
            referenceEvent == "sunset" && offsetMinutes < 0 -> "Before Sunset"
            else -> "After Sunset"
        }

    /** The alarm mode string matching phone app's AlarmMode type */
    val alarmMode: String
        get() = when {
            type == "absolute" -> "fixed"
            offsetMinutes < 0 -> "before-$referenceEvent"
            else -> "after-$referenceEvent"
        }

    /** Short label for the alarm style */
    val styleLabel: String
        get() = alarmStyle.replaceFirstChar { it.uppercase() }

    /** Days of week as short labels */
    val repeatDaysLabel: String
        get() {
            if (repeatDays.isEmpty()) return if (repeatMode == "once") "Once" else "Every day"
            val dayNames = listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")
            return repeatDays.sorted().joinToString(", ") { dayNames[it] }
        }
}

/**
 * Sun times synced from the phone.
 */
data class SyncedSunTimes(
    val sunriseISO: String?,
    val sunsetISO: String?,
    val date: String?,
) {
    val sunriseFormatted: String
        get() {
            if (sunriseISO == null) return "--:--"
            return try {
                val instant = java.time.Instant.parse(sunriseISO)
                val local = java.time.LocalTime.ofInstant(instant, java.time.ZoneId.systemDefault())
                String.format("%02d:%02d", local.hour, local.minute)
            } catch (_: Exception) { "--:--" }
        }

    val sunsetFormatted: String
        get() {
            if (sunsetISO == null) return "--:--"
            return try {
                val instant = java.time.Instant.parse(sunsetISO)
                val local = java.time.LocalTime.ofInstant(instant, java.time.ZoneId.systemDefault())
                String.format("%02d:%02d", local.hour, local.minute)
            } catch (_: Exception) { "--:--" }
        }
}

/**
 * Payload format for DataLayer sync.
 * Matches the phone app's AlarmSyncPayload in wearDataLayer.ts.
 */
data class AlarmSyncPayload(
    val alarms: Map<String, Alarm>,
    val sunTimes: SyncedSunTimes?,
    val version: Long,
    val source: String,   // "phone" | "watch"
)
