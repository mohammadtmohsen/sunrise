package com.lumora.wear.presentation.screens

import android.app.RemoteInput
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.Icon
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Delete
import androidx.wear.input.RemoteInputIntentHelper
import com.lumora.wear.data.DataLayerRepository
import com.lumora.wear.presentation.theme.LumoraColors
import kotlin.math.abs

private const val NAME_INPUT_KEY = "alarm_name"

@Composable
fun EditAlarmScreen(
    repository: DataLayerRepository,
    alarmId: String,
    onSaved: () -> Unit,
    onDelete: () -> Unit,
) {
    val alarmsMap by repository.alarms.collectAsState()
    val sunTimes by repository.sunTimes.collectAsState()
    val alarm = alarmsMap[alarmId]

    if (alarm == null) {
        Text(
            text = "Alarm not found",
            textAlign = TextAlign.Center,
            color = LumoraColors.textMuted,
            modifier = Modifier.fillMaxSize().padding(16.dp),
        )
        return
    }

    val initialType = when {
        alarm.type == "absolute" -> "fixed"
        else -> alarm.referenceEvent
    }
    val initialDirection = if (alarm.offsetMinutes < 0) "before" else "after"
    val absOffset = abs(alarm.offsetMinutes)

    var alarmTypeSelection by remember(alarm.id) { mutableStateOf(initialType) }
    var direction by remember(alarm.id) { mutableStateOf(initialDirection) }
    var hour by remember(alarm.id) { mutableIntStateOf(alarm.absoluteHour) }
    var minute by remember(alarm.id) { mutableIntStateOf(alarm.absoluteMinute) }
    var offsetHours by remember(alarm.id) { mutableIntStateOf(absOffset / 60) }
    var offsetMinutes by remember(alarm.id) { mutableIntStateOf(absOffset % 60) }
    var alarmStyle by remember(alarm.id) { mutableStateOf(alarm.alarmStyle) }
    var repeatMode by remember(alarm.id) { mutableStateOf(alarm.repeatMode) }
    var alarmName by remember(alarm.id) { mutableStateOf(alarm.name) }
    val selectedDays = remember(alarm.id) { mutableStateListOf(*alarm.repeatDays.toTypedArray()) }
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
                text = "Edit Alarm",
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

        // Alarm type selector
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

        // Save and Delete
        item {
            Spacer(modifier = Modifier.height(12.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
            ) {
                Button(
                    onClick = {
                        repository.deleteAlarm(alarmId)
                        onDelete()
                    },
                    modifier = Modifier.size(44.dp),
                ) {
                    Icon(imageVector = Icons.Default.Delete, contentDescription = "Delete")
                }

                Button(
                    onClick = {
                        val isRelative = alarmTypeSelection != "fixed"
                        val totalOffset = (offsetHours * 60 + offsetMinutes) *
                                (if (direction == "before") -1 else 1)
                        val updated = alarm.copy(
                            name = alarmName,
                            type = if (isRelative) "relative" else "absolute",
                            referenceEvent = if (isRelative) alarmTypeSelection else alarm.referenceEvent,
                            offsetMinutes = if (isRelative) totalOffset else 0,
                            absoluteHour = hour,
                            absoluteMinute = minute,
                            alarmStyle = alarmStyle,
                            repeatMode = repeatMode,
                            repeatDays = selectedDays.toList(),
                        )
                        repository.updateAlarm(updated)
                        onSaved()
                    },
                    modifier = Modifier.size(44.dp),
                ) {
                    Icon(imageVector = Icons.Default.Check, contentDescription = "Save")
                }
            }
        }
    }
}
