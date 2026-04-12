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
 * Wear OS Tile that shows the next upcoming alarm.
 * Users can add this tile to their watch face carousel.
 * Tapping it opens the full watch app.
 */
class AlarmTileService : TileService() {

    companion object {
        private const val RESOURCES_VERSION = "1"
    }

    override fun onTileRequest(requestParams: RequestBuilders.TileRequest): ListenableFuture<TileBuilders.Tile> {
        val repository = DataLayerRepository.getInstance(this)
        val alarms = repository.alarms.value

        // Find the next enabled alarm
        val nextAlarm = alarms.values
            .filter { it.isEnabled && it.nextTriggerAt != null }
            .minByOrNull { it.nextTriggerAt ?: "" }

        val layout = if (nextAlarm != null) {
            buildAlarmTileLayout(nextAlarm.displayTime, nextAlarm.name)
        } else {
            buildEmptyTileLayout()
        }

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

    private fun buildAlarmTileLayout(time: String, label: String): LayoutElementBuilders.LayoutElement {
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
                    .addContent(
                        LayoutElementBuilders.Text.Builder()
                            .setText("Next Alarm")
                            .setFontStyle(
                                LayoutElementBuilders.FontStyle.Builder()
                                    .setSize(DimensionBuilders.sp(12f))
                                    .setColor(
                                        ColorBuilders.argb(0xFFAAAAAA.toInt())
                                    )
                                    .build()
                            )
                            .build()
                    )
                    .addContent(
                        LayoutElementBuilders.Text.Builder()
                            .setText(time)
                            .setFontStyle(
                                LayoutElementBuilders.FontStyle.Builder()
                                    .setSize(DimensionBuilders.sp(28f))
                                    .setWeight(LayoutElementBuilders.FONT_WEIGHT_BOLD)
                                    .setColor(
                                        ColorBuilders.argb(0xFFFFFFFF.toInt())
                                    )
                                    .build()
                            )
                            .build()
                    )
                    .addContent(
                        LayoutElementBuilders.Text.Builder()
                            .setText(label.ifBlank { "Lumora" })
                            .setFontStyle(
                                LayoutElementBuilders.FontStyle.Builder()
                                    .setSize(DimensionBuilders.sp(14f))
                                    .setColor(
                                        ColorBuilders.argb(0xFFCCCCCC.toInt())
                                    )
                                    .build()
                            )
                            .build()
                    )
                    .build()
            )
            .build()
    }

    private fun buildEmptyTileLayout(): LayoutElementBuilders.LayoutElement {
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
                    .addContent(
                        LayoutElementBuilders.Text.Builder()
                            .setText("Lumora")
                            .setFontStyle(
                                LayoutElementBuilders.FontStyle.Builder()
                                    .setSize(DimensionBuilders.sp(20f))
                                    .setWeight(LayoutElementBuilders.FONT_WEIGHT_BOLD)
                                    .setColor(
                                        ColorBuilders.argb(0xFFFFFFFF.toInt())
                                    )
                                    .build()
                            )
                            .build()
                    )
                    .addContent(
                        LayoutElementBuilders.Text.Builder()
                            .setText("No alarms set")
                            .setFontStyle(
                                LayoutElementBuilders.FontStyle.Builder()
                                    .setSize(DimensionBuilders.sp(14f))
                                    .setColor(
                                        ColorBuilders.argb(0xFFAAAAAA.toInt())
                                    )
                                    .build()
                            )
                            .build()
                    )
                    .build()
            )
            .build()
    }
}
