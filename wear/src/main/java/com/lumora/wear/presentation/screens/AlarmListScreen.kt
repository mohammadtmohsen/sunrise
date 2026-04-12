package com.lumora.wear.presentation.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.Card
import androidx.wear.compose.material3.Icon
import androidx.wear.compose.material3.IconButton
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Close
import com.lumora.wear.data.Alarm
import com.lumora.wear.data.DataLayerRepository
import com.lumora.wear.presentation.components.AlarmClockIcon
import com.lumora.wear.presentation.components.SunriseIcon
import com.lumora.wear.presentation.components.SunsetIcon
import com.lumora.wear.presentation.theme.LumoraColors

@Composable
fun AlarmListScreen(
    repository: DataLayerRepository,
    onAddAlarm: () -> Unit,
    onEditAlarm: (String) -> Unit,
) {
    val alarmsMap by repository.alarms.collectAsState()
    val alarms = alarmsMap.values.sortedBy { it.nextTriggerAt }
    val listState = rememberScalingLazyListState()

    ScalingLazyColumn(
        modifier = Modifier.fillMaxSize(),
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        item {
            Text(
                text = "Lumora",
                style = MaterialTheme.typography.titleSmall,
                color = LumoraColors.textPrimary,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 4.dp),
            )
        }

        if (alarms.isEmpty()) {
            item {
                Text(
                    text = "No alarms yet",
                    style = MaterialTheme.typography.bodySmall,
                    color = LumoraColors.textSecondary,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 16.dp),
                )
            }
        } else {
            items(alarms, key = { it.id }) { alarm ->
                AlarmCard(
                    alarm = alarm,
                    onTap = { onEditAlarm(alarm.id) },
                    onToggle = { repository.toggleAlarm(alarm.id) },
                )
            }
        }

        item {
            Spacer(modifier = Modifier.height(8.dp))
            Button(
                onClick = onAddAlarm,
                modifier = Modifier.size(48.dp),
            ) {
                Icon(imageVector = Icons.Default.Add, contentDescription = "Add alarm")
            }
        }
    }
}

@Composable
private fun AlarmCard(
    alarm: Alarm,
    onTap: () -> Unit,
    onToggle: () -> Unit,
) {
    val modeColor = when {
        alarm.type == "absolute" -> LumoraColors.accent
        alarm.referenceEvent == "sunrise" -> LumoraColors.sunrise
        else -> LumoraColors.sunset
    }

    Card(
        onClick = onTap,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 2.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Icon column
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(end = 8.dp),
            ) {
                when {
                    alarm.type == "absolute" -> AlarmClockIcon(size = 22.dp)
                    alarm.referenceEvent == "sunrise" -> SunriseIcon(size = 22.dp)
                    else -> SunsetIcon(size = 22.dp)
                }
            }

            // Details column
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = alarm.displayTime,
                    style = MaterialTheme.typography.titleMedium,
                    color = if (alarm.isEnabled) LumoraColors.textPrimary else LumoraColors.textMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (alarm.name.isNotBlank()) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = alarm.name,
                            style = MaterialTheme.typography.bodySmall,
                            color = if (alarm.isEnabled) LumoraColors.textSecondary else LumoraColors.textMuted,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = if (alarm.alarmStyle == "reminder") "\uD83D\uDD14" else "\u23F0",
                            style = MaterialTheme.typography.labelSmall,
                        )
                    }
                }
                Text(
                    text = alarm.repeatDaysLabel,
                    style = MaterialTheme.typography.labelSmall,
                    color = if (alarm.isEnabled) LumoraColors.textSecondary else LumoraColors.textMuted,
                )
            }

            // Toggle icon
            IconButton(
                onClick = onToggle,
                modifier = Modifier.size(32.dp),
            ) {
                Icon(
                    imageVector = if (alarm.isEnabled)
                        Icons.Default.Notifications
                    else
                        Icons.Default.Close,
                    contentDescription = if (alarm.isEnabled) "Disable" else "Enable",
                    tint = if (alarm.isEnabled) modeColor else LumoraColors.textMuted,
                    modifier = Modifier.size(18.dp),
                )
            }
        }
    }
}
