package com.lumora.wear.tile

import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import androidx.wear.protolayout.ResourceBuilders
import androidx.wear.protolayout.LayoutElementBuilders
import androidx.wear.protolayout.DimensionBuilders
import androidx.wear.protolayout.ModifiersBuilders
import androidx.wear.protolayout.ActionBuilders
import androidx.wear.protolayout.ColorBuilders
import androidx.wear.protolayout.TimelineBuilders
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import com.lumora.wear.data.DataLayerRepository

/**
 * Wear OS Tile that shows sunrise/sunset times and the next upcoming alarm.
 * Users can add this tile to their watch face carousel.
 * Tapping it opens the full watch app.
 */
class AlarmTileService : TileService() {

    companion object {
        private const val RESOURCES_VERSION = "2"

        // Colors matching LumoraColors
        private const val COLOR_SUNRISE = 0xFFFF6B35.toInt()
        private const val COLOR_SUNSET = 0xFFC44569.toInt()
        private const val COLOR_ACCENT = 0xFFF5A623.toInt()
        private const val COLOR_TEXT_PRIMARY = 0xFFFFFFFF.toInt()
        private const val COLOR_TEXT_SECONDARY = 0xFFA0A0B0.toInt()
        private const val COLOR_TEXT_MUTED = 0xFF6B6B80.toInt()
    }

    override fun onTileRequest(requestParams: RequestBuilders.TileRequest): ListenableFuture<TileBuilders.Tile> {
        val repository = DataLayerRepository.getInstance(this)
        val alarms = repository.alarms.value
        val sunTimes = repository.sunTimes.value

        // Find the next enabled alarm
        val nextAlarm = alarms.values
            .filter { it.isEnabled && it.nextTriggerAt != null }
            .minByOrNull { it.nextTriggerAt ?: "" }

        val layout = buildTileLayout(
            sunriseTime = sunTimes?.sunriseFormatted,
            sunsetTime = sunTimes?.sunsetFormatted,
            nextAlarmTime = nextAlarm?.displayTime,
            nextAlarmName = nextAlarm?.name,
        )

        val tile = TileBuilders.Tile.Builder()
            .setResourcesVersion(RESOURCES_VERSION)
            .setTileTimeline(
                TimelineBuilders.Timeline.Builder()
                    .addTimelineEntry(
                        TimelineBuilders.TimelineEntry.Builder()
                            .setLayout(
                                LayoutElementBuilders.Layout.Builder()
                                    .setRoot(layout)
                                    .build()
                            )
                            .build()
                    )
                    .build()
            )
            .build()

        return Futures.immediateFuture(tile)
    }

    override fun onTileResourcesRequest(
        requestParams: RequestBuilders.ResourcesRequest
    ): ListenableFuture<ResourceBuilders.Resources> {
        return Futures.immediateFuture(
            ResourceBuilders.Resources.Builder()
                .setVersion(RESOURCES_VERSION)
                .build()
        )
    }

    private fun buildTileLayout(
        sunriseTime: String?,
        sunsetTime: String?,
        nextAlarmTime: String?,
        nextAlarmName: String?,
    ): LayoutElementBuilders.LayoutElement {
        val hasSunTimes = sunriseTime != null && sunsetTime != null
        val hasAlarm = nextAlarmTime != null

        return LayoutElementBuilders.Box.Builder()
            .setWidth(DimensionBuilders.expand())
            .setHeight(DimensionBuilders.expand())
            .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
            .setVerticalAlignment(LayoutElementBuilders.VERTICAL_ALIGN_CENTER)
            .setModifiers(
                ModifiersBuilders.Modifiers.Builder()
                    .setClickable(
                        ModifiersBuilders.Clickable.Builder()
                            .setOnClick(
                                ActionBuilders.LaunchAction.Builder()
                                    .setAndroidActivity(
                                        ActionBuilders.AndroidActivity.Builder()
                                            .setPackageName("com.lumora.wear")
                                            .setClassName("com.lumora.wear.MainActivity")
                                            .build()
                                    )
                                    .build()
                            )
                            .setId("open_app")
                            .build()
                    )
                    .build()
            )
            .addContent(
                LayoutElementBuilders.Column.Builder()
                    .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
                    // App title
                    .addContent(
                        LayoutElementBuilders.Text.Builder()
                            .setText("Lumora")
                            .setFontStyle(
                                LayoutElementBuilders.FontStyle.Builder()
                                    .setSize(DimensionBuilders.sp(12f))
                                    .setColor(ColorBuilders.argb(COLOR_TEXT_MUTED))
                                    .build()
                            )
                            .build()
                    )
                    // Spacer
                    .addContent(
                        LayoutElementBuilders.Spacer.Builder()
                            .setHeight(DimensionBuilders.dp(6f))
                            .build()
                    )
                    // Sunrise / Sunset row
                    .addContent(
                        if (hasSunTimes) {
                            buildSunTimesRow(sunriseTime!!, sunsetTime!!)
                        } else {
                            LayoutElementBuilders.Text.Builder()
                                .setText("No sun data")
                                .setFontStyle(
                                    LayoutElementBuilders.FontStyle.Builder()
                                        .setSize(DimensionBuilders.sp(12f))
                                        .setColor(ColorBuilders.argb(COLOR_TEXT_MUTED))
                                        .build()
                                )
                                .build()
                        }
                    )
                    // Spacer
                    .addContent(
                        LayoutElementBuilders.Spacer.Builder()
                            .setHeight(DimensionBuilders.dp(8f))
                            .build()
                    )
                    // Next alarm section
                    .addContent(
                        if (hasAlarm) {
                            buildNextAlarmSection(nextAlarmTime!!, nextAlarmName)
                        } else {
                            LayoutElementBuilders.Text.Builder()
                                .setText("No alarms set")
                                .setFontStyle(
                                    LayoutElementBuilders.FontStyle.Builder()
                                        .setSize(DimensionBuilders.sp(14f))
                                        .setColor(ColorBuilders.argb(COLOR_TEXT_MUTED))
                                        .build()
                                )
                                .build()
                        }
                    )
                    .build()
            )
            .build()
    }

    /** Row showing: ☀↑ HH:MM  |  ☀↓ HH:MM */
    private fun buildSunTimesRow(
        sunrise: String,
        sunset: String,
    ): LayoutElementBuilders.LayoutElement {
        return LayoutElementBuilders.Row.Builder()
            .setVerticalAlignment(LayoutElementBuilders.VERTICAL_ALIGN_CENTER)
            // Sunrise
            .addContent(
                LayoutElementBuilders.Text.Builder()
                    .setText("\u2600\u2191") // ☀↑
                    .setFontStyle(
                        LayoutElementBuilders.FontStyle.Builder()
                            .setSize(DimensionBuilders.sp(13f))
                            .setColor(ColorBuilders.argb(COLOR_SUNRISE))
                            .build()
                    )
                    .build()
            )
            .addContent(
                LayoutElementBuilders.Spacer.Builder()
                    .setWidth(DimensionBuilders.dp(3f))
                    .build()
            )
            .addContent(
                LayoutElementBuilders.Text.Builder()
                    .setText(sunrise)
                    .setFontStyle(
                        LayoutElementBuilders.FontStyle.Builder()
                            .setSize(DimensionBuilders.sp(16f))
                            .setWeight(LayoutElementBuilders.FONT_WEIGHT_BOLD)
                            .setColor(ColorBuilders.argb(COLOR_SUNRISE))
                            .build()
                    )
                    .build()
            )
            // Separator
            .addContent(
                LayoutElementBuilders.Spacer.Builder()
                    .setWidth(DimensionBuilders.dp(12f))
                    .build()
            )
            // Sunset
            .addContent(
                LayoutElementBuilders.Text.Builder()
                    .setText("\u2600\u2193") // ☀↓
                    .setFontStyle(
                        LayoutElementBuilders.FontStyle.Builder()
                            .setSize(DimensionBuilders.sp(13f))
                            .setColor(ColorBuilders.argb(COLOR_SUNSET))
                            .build()
                    )
                    .build()
            )
            .addContent(
                LayoutElementBuilders.Spacer.Builder()
                    .setWidth(DimensionBuilders.dp(3f))
                    .build()
            )
            .addContent(
                LayoutElementBuilders.Text.Builder()
                    .setText(sunset)
                    .setFontStyle(
                        LayoutElementBuilders.FontStyle.Builder()
                            .setSize(DimensionBuilders.sp(16f))
                            .setWeight(LayoutElementBuilders.FONT_WEIGHT_BOLD)
                            .setColor(ColorBuilders.argb(COLOR_SUNSET))
                            .build()
                    )
                    .build()
            )
            .build()
    }

    /** Next alarm: header label + time + name */
    private fun buildNextAlarmSection(
        time: String,
        label: String?,
    ): LayoutElementBuilders.LayoutElement {
        return LayoutElementBuilders.Column.Builder()
            .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
            .addContent(
                LayoutElementBuilders.Text.Builder()
                    .setText("Next Alarm")
                    .setFontStyle(
                        LayoutElementBuilders.FontStyle.Builder()
                            .setSize(DimensionBuilders.sp(11f))
                            .setColor(ColorBuilders.argb(COLOR_TEXT_MUTED))
                            .build()
                    )
                    .build()
            )
            .addContent(
                LayoutElementBuilders.Text.Builder()
                    .setText(time)
                    .setFontStyle(
                        LayoutElementBuilders.FontStyle.Builder()
                            .setSize(DimensionBuilders.sp(22f))
                            .setWeight(LayoutElementBuilders.FONT_WEIGHT_BOLD)
                            .setColor(ColorBuilders.argb(COLOR_TEXT_PRIMARY))
                            .build()
                    )
                    .build()
            )
            .addContent(
                LayoutElementBuilders.Text.Builder()
                    .setText(label?.ifBlank { "Lumora" } ?: "Lumora")
                    .setFontStyle(
                        LayoutElementBuilders.FontStyle.Builder()
                            .setSize(DimensionBuilders.sp(12f))
                            .setColor(ColorBuilders.argb(COLOR_TEXT_SECONDARY))
                            .build()
                    )
                    .build()
            )
            .build()
    }
}
