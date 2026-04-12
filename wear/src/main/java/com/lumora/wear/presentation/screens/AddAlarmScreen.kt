package com.lumora.wear.presentation.screens

import android.app.RemoteInput
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.FilledTonalButton
import androidx.wear.compose.material3.Icon
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Edit
import androidx.wear.input.RemoteInputIntentHelper
import com.lumora.wear.data.Alarm
import com.lumora.wear.data.DataLayerRepository
import com.lumora.wear.presentation.components.AlarmClockIcon
import com.lumora.wear.presentation.components.SunriseIcon
import com.lumora.wear.presentation.components.SunsetIcon
import com.lumora.wear.presentation.theme.LumoraColors
import java.time.Instant
import java.util.UUID

private const val NAME_INPUT_KEY = "alarm_name"

@Composable
fun AddAlarmScreen(
    repository: DataLayerRepository,
    onSaved: () -> Unit,
    onCancel: () -> Unit,
) {
    var alarmTypeSelection by remember { mutableStateOf("fixed") }
    var direction by remember { mutableStateOf("before") }
    var hour by remember { mutableIntStateOf(7) }
    var minute by remember { mutableIntStateOf(0) }
    var offsetHours by remember { mutableIntStateOf(0) }
    var offsetMinutes by remember { mutableIntStateOf(30) }
    var alarmStyle by remember { mutableStateOf("alarm") }
    var repeatMode by remember { mutableStateOf("once") }
    var alarmName by remember { mutableStateOf("") }
    val selectedDays = remember { mutableStateListOf<Int>() }

    val sunTimes by repository.sunTimes.collectAsState()
    val listState = rememberScalingLazyListState()

    val nameLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val results = RemoteInput.getResultsFromIntent(result.data ?: return@rememberLauncherForActivityResult)
        alarmName = results?.getCharSequence(NAME_INPUT_KEY)?.toString() ?: alarmName
    }

    ScalingLazyColumn(
        modifier = Modifier.fillMaxSize(),
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Title
        item {
            Text(
                text = "New Alarm",
                style = MaterialTheme.typography.titleSmall,
                color = LumoraColors.textPrimary,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        // Alarm name input
        item {
            Spacer(modifier = Modifier.height(4.dp))
            NameInputButton(
                name = alarmName,
                onRequestInput = {
                    val intent = RemoteInputIntentHelper.createActionRemoteInputIntent()
                    val remoteInput = RemoteInput.Builder(NAME_INPUT_KEY)
                        .setLabel("Alarm name")
                        .build()
                    RemoteInputIntentHelper.putRemoteInputsExtra(intent, listOf(remoteInput))
                    nameLauncher.launch(intent)
                },
            )
        }

        // Sun times info
        item {
            if (sunTimes != null) {
                Spacer(modifier = Modifier.height(4.dp))
                SunTimesRow(
                    sunriseFormatted = sunTimes!!.sunriseFormatted,
                    sunsetFormatted = sunTimes!!.sunsetFormatted,
                )
            }
        }

        // Alarm type selector with drawn icons
        item {
            Spacer(modifier = Modifier.height(4.dp))
            AlarmTypeSelector(
                selected = alarmTypeSelection,
                onSelect = { alarmTypeSelection = it },
            )
        }

        // Direction selector
        if (alarmTypeSelection != "fixed") {
            item {
                Spacer(modifier = Modifier.height(6.dp))
                DirectionSelector(
                    direction = direction,
                    onSelect = { direction = it },
                    eventColor = if (alarmTypeSelection == "sunrise") LumoraColors.sunrise else LumoraColors.sunset,
                )
            }

            item {
                Spacer(modifier = Modifier.height(6.dp))
                TimeSelector(
                    hour = offsetHours,
                    minute = offsetMinutes,
                    onHourChange = { offsetHours = it },
                    onMinuteChange = { offsetMinutes = it },
                )
            }

            item {
                OffsetPreviewText(offsetHours, offsetMinutes, direction, alarmTypeSelection)
            }
        }

        if (alarmTypeSelection == "fixed") {
            item {
                Spacer(modifier = Modifier.height(6.dp))
                TimeSelector(
                    hour = hour,
                    minute = minute,
                    onHourChange = { hour = it },
                    onMinuteChange = { minute = it },
                )
            }
        }

        // Alarm style
        item {
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
            ) {
                PillButton("\u23F0 Alarm", alarmStyle == "alarm", LumoraColors.surfaceLight) { alarmStyle = "alarm" }
                PillButton("\uD83D\uDD14 Reminder", alarmStyle == "reminder", LumoraColors.surfaceLight) { alarmStyle = "reminder" }
            }
        }

        // Repeat mode
        item {
            Spacer(modifier = Modifier.height(6.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
            ) {
                PillButton("\u2460 Once", repeatMode == "once", LumoraColors.surfaceLight, LumoraColors.accent) {
                    repeatMode = "once"
                    selectedDays.clear()
                }
                PillButton("\u221E Repeat", repeatMode == "repeat", LumoraColors.surfaceLight, LumoraColors.success) {
                    repeatMode = "repeat"
                }
            }
        }

        // Day selector
        if (repeatMode == "repeat") {
            item {
                Spacer(modifier = Modifier.height(6.dp))
                DaySelector(
                    selectedDays = selectedDays,
                    onToggleDay = { day ->
                        if (selectedDays.contains(day)) selectedDays.remove(day)
                        else selectedDays.add(day)
                    },
                    onToggleAll = {
                        val allDays = listOf(0, 1, 2, 3, 4, 5, 6)
                        if (selectedDays.size == 7) selectedDays.clear()
                        else { selectedDays.clear(); selectedDays.addAll(allDays) }
                    },
                )
            }
        }

        // Save
        item {
            Spacer(modifier = Modifier.height(12.dp))
            Button(
                onClick = {
                    val now = Instant.now().toString()
                    val isRelative = alarmTypeSelection != "fixed"
                    val totalOffset = (offsetHours * 60 + offsetMinutes) *
                            (if (direction == "before") -1 else 1)
                    val alarm = Alarm(
                        id = "${System.currentTimeMillis()}-${UUID.randomUUID().toString().take(8)}",
                        name = alarmName,
                        type = if (isRelative) "relative" else "absolute",
                        referenceEvent = if (isRelative) alarmTypeSelection else "sunrise",
                        offsetMinutes = if (isRelative) totalOffset else 0,
                        absoluteHour = hour,
                        absoluteMinute = minute,
                        alarmStyle = alarmStyle,
                        repeatMode = repeatMode,
                        repeatDays = selectedDays.toList(),
                        isEnabled = true,
                        createdAt = now,
                        updatedAt = now,
                    )
                    repository.addAlarm(alarm)
                    onSaved()
                },
                modifier = Modifier.size(48.dp),
            ) {
                Icon(imageVector = Icons.Default.Check, contentDescription = "Save")
            }
        }
    }
}

// ─── Shared Components ───────────────────────────────────────────

@Composable
fun NameInputButton(name: String, onRequestInput: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(LumoraColors.surface)
            .clickable { onRequestInput() }
            .padding(horizontal = 12.dp, vertical = 10.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(
                text = name.ifBlank { "Alarm name..." },
                style = MaterialTheme.typography.bodyMedium,
                color = if (name.isBlank()) LumoraColors.textMuted else LumoraColors.textPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Icon(
                imageVector = Icons.Default.Edit,
                contentDescription = "Edit name",
                modifier = Modifier.size(14.dp),
                tint = LumoraColors.textMuted,
            )
        }
    }
}

@Composable
fun SunTimesRow(sunriseFormatted: String, sunsetFormatted: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp),
        horizontalArrangement = Arrangement.SpaceEvenly,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            SunriseIcon(size = 14.dp)
            Spacer(modifier = Modifier.width(4.dp))
            Text(text = sunriseFormatted, style = MaterialTheme.typography.bodySmall, color = LumoraColors.sunrise)
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            SunsetIcon(size = 14.dp)
            Spacer(modifier = Modifier.width(4.dp))
            Text(text = sunsetFormatted, style = MaterialTheme.typography.bodySmall, color = LumoraColors.sunset)
        }
    }
}

@Composable
fun AlarmTypeSelector(selected: String, onSelect: (String) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceEvenly,
    ) {
        val iconSize = 14.dp
        TypeChip(
            icon = { c -> SunriseIcon(size = iconSize, color = c) },
            label = "Rise",
            isSelected = selected == "sunrise",
            activeColor = LumoraColors.sunrise,
        ) { onSelect("sunrise") }
        TypeChip(
            icon = { c -> SunsetIcon(size = iconSize, color = c) },
            label = "Set",
            isSelected = selected == "sunset",
            activeColor = LumoraColors.sunset,
        ) { onSelect("sunset") }
        TypeChip(
            icon = { c -> AlarmClockIcon(size = iconSize, color = c) },
            label = "Fixed",
            isSelected = selected == "fixed",
            activeColor = LumoraColors.accent,
        ) { onSelect("fixed") }
    }
}

@Composable
private fun TypeChip(
    icon: @Composable (Color) -> Unit,
    label: String,
    isSelected: Boolean,
    activeColor: Color,
    onClick: () -> Unit,
) {
    val iconColor = if (isSelected) Color.White else activeColor
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(if (isSelected) activeColor else LumoraColors.surfaceLight)
            .clickable { onClick() }
            .padding(horizontal = 10.dp, vertical = 6.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            icon(iconColor)
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = if (isSelected) Color.White else activeColor,
            )
        }
    }
}

@Composable
fun DirectionSelector(direction: String, onSelect: (String) -> Unit, eventColor: Color) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceEvenly,
    ) {
        PillButton("Before", direction == "before", eventColor) { onSelect("before") }
        PillButton("After", direction == "after", eventColor) { onSelect("after") }
    }
}

@Composable
fun PillButton(
    label: String,
    isSelected: Boolean,
    activeColor: Color = LumoraColors.primary,
    selectedTextColor: Color = Color.White,
    onClick: () -> Unit,
) {
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .clip(RoundedCornerShape(16.dp))
            .background(if (isSelected) activeColor else LumoraColors.surface)
            .clickable { onClick() }
            .padding(horizontal = 14.dp, vertical = 6.dp),
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = if (isSelected) selectedTextColor else LumoraColors.textMuted,
        )
    }
}

@Composable
fun OffsetPreviewText(hours: Int, minutes: Int, direction: String, event: String) {
    val timeStr = when {
        hours > 0 && minutes > 0 -> "${hours}h${minutes}m"
        hours > 0 -> "${hours}h"
        else -> "${minutes}m"
    }
    Text(
        text = "$timeStr $direction $event",
        style = MaterialTheme.typography.labelSmall.copy(fontSize = 11.sp),
        color = LumoraColors.accent,
        textAlign = TextAlign.Center,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 2.dp, start = 12.dp, end = 12.dp),
    )
}

@Composable
fun TimeSelector(
    hour: Int,
    minute: Int,
    onHourChange: (Int) -> Unit,
    onMinuteChange: (Int) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        NumberPicker(value = hour, range = 0..23, onValueChange = onHourChange)
        Text(
            text = ":",
            style = MaterialTheme.typography.displaySmall,
            color = LumoraColors.textPrimary,
            modifier = Modifier.padding(horizontal = 4.dp),
        )
        NumberPicker(value = minute, range = 0..59, step = 5, onValueChange = onMinuteChange)
    }
}

@Composable
private fun NumberPicker(
    value: Int,
    range: IntRange,
    step: Int = 1,
    onValueChange: (Int) -> Unit,
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        FilledTonalButton(
            onClick = {
                val next = value + step
                onValueChange(if (next > range.last) range.first else next)
            },
            modifier = Modifier.size(32.dp),
        ) { Text("+", style = MaterialTheme.typography.labelLarge) }
        Text(
            text = String.format("%02d", value),
            style = MaterialTheme.typography.displaySmall,
            color = LumoraColors.textPrimary,
            modifier = Modifier.padding(vertical = 2.dp),
        )
        FilledTonalButton(
            onClick = {
                val prev = value - step
                onValueChange(if (prev < range.first) range.last else prev)
            },
            modifier = Modifier.size(32.dp),
        ) { Text("-", style = MaterialTheme.typography.labelLarge) }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun DaySelector(
    selectedDays: List<Int>,
    onToggleDay: (Int) -> Unit,
    onToggleAll: (() -> Unit)? = null,
) {
    val dayLabels = listOf("S", "M", "T", "W", "T", "F", "S")
    val allSelected = selectedDays.size == 7

    FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(5.dp, Alignment.CenterHorizontally),
        verticalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        dayLabels.forEachIndexed { index, label ->
            val isSelected = selectedDays.contains(index)
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(30.dp)
                    .background(
                        color = if (isSelected) LumoraColors.primary else LumoraColors.surface,
                        shape = CircleShape,
                    )
                    .clickable { onToggleDay(index) },
            ) {
                Text(
                    text = label,
                    style = MaterialTheme.typography.labelSmall,
                    color = if (isSelected) Color.White else LumoraColors.textMuted,
                )
            }
        }

        // "All" pill
        if (onToggleAll != null) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .height(30.dp)
                    .clip(RoundedCornerShape(15.dp))
                    .background(if (allSelected) LumoraColors.primary else LumoraColors.surface)
                    .clickable { onToggleAll() }
                    .padding(horizontal = 12.dp),
            ) {
                Text(
                    text = "All",
                    style = MaterialTheme.typography.labelSmall,
                    color = if (allSelected) Color.White else LumoraColors.textMuted,
                )
            }
        }
    }
}
