package com.lumora.wear.presentation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.wear.compose.navigation.SwipeDismissableNavHost
import androidx.wear.compose.navigation.composable
import androidx.wear.compose.navigation.rememberSwipeDismissableNavController
import com.lumora.wear.data.DataLayerRepository
import com.lumora.wear.presentation.screens.AddAlarmScreen
import com.lumora.wear.presentation.screens.AlarmListScreen
import com.lumora.wear.presentation.screens.EditAlarmScreen
import com.lumora.wear.presentation.theme.LumoraWearTheme

object Routes {
    const val ALARM_LIST = "alarm_list"
    const val ADD_ALARM = "add_alarm"
    const val EDIT_ALARM = "edit_alarm/{alarmId}"

    fun editAlarm(alarmId: String) = "edit_alarm/$alarmId"
}

@Composable
fun WearApp() {
    val context = LocalContext.current
    val repository = remember { DataLayerRepository.getInstance(context) }
    val navController = rememberSwipeDismissableNavController()

    LumoraWearTheme {
        SwipeDismissableNavHost(
            navController = navController,
            startDestination = Routes.ALARM_LIST,
        ) {
            composable(Routes.ALARM_LIST) {
                AlarmListScreen(
                    repository = repository,
                    onAddAlarm = { navController.navigate(Routes.ADD_ALARM) },
                    onEditAlarm = { alarmId ->
                        navController.navigate(Routes.editAlarm(alarmId))
                    },
                )
            }

            composable(Routes.ADD_ALARM) {
                AddAlarmScreen(
                    repository = repository,
                    onSaved = { navController.popBackStack() },
                    onCancel = { navController.popBackStack() },
                )
            }

            composable(Routes.EDIT_ALARM) { backStackEntry ->
                val alarmId = backStackEntry.arguments?.getString("alarmId") ?: return@composable
                EditAlarmScreen(
                    repository = repository,
                    alarmId = alarmId,
                    onSaved = { navController.popBackStack() },
                    onDelete = { navController.popBackStack() },
                )
            }
        }
    }
}
