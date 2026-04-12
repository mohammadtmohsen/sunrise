package com.lumora.wear.data

import android.content.Context
import android.net.Uri
import android.util.Log
import com.google.android.gms.tasks.Tasks
import com.google.android.gms.wearable.DataClient
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import com.google.gson.Gson
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant

/**
 * Repository that manages alarm data synchronization between
 * the watch and phone via the Wearable Data Layer API.
 */
class DataLayerRepository private constructor(context: Context) :
    DataClient.OnDataChangedListener {

    companion object {
        private const val TAG = "DataLayerRepo"
        private const val ALARMS_PATH = "/alarms"
        private val gson = Gson()

        @Volatile
        private var instance: DataLayerRepository? = null

        fun getInstance(context: Context): DataLayerRepository {
            return instance ?: synchronized(this) {
                instance ?: DataLayerRepository(context.applicationContext).also {
                    instance = it
                }
            }
        }
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val dataClient: DataClient = Wearable.getDataClient(context)

    private val _alarms = MutableStateFlow<Map<String, Alarm>>(emptyMap())
    val alarms: StateFlow<Map<String, Alarm>> = _alarms.asStateFlow()

    private val _sunTimes = MutableStateFlow<SyncedSunTimes?>(null)
    val sunTimes: StateFlow<SyncedSunTimes?> = _sunTimes.asStateFlow()

    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()

    init {
        dataClient.addListener(this)
        loadInitialData()
    }

    /** Load the latest alarm data from the DataLayer on startup */
    private fun loadInitialData() {
        scope.launch {
            try {
                val uri = Uri.Builder()
                    .scheme("wear")
                    .authority("*")
                    .path(ALARMS_PATH)
                    .build()

                val dataItems = Tasks.await(dataClient.getDataItems(uri))
                for (i in 0 until dataItems.count) {
                    val item = dataItems[i]
                    if (item.uri.path == ALARMS_PATH) {
                        val dataMap = DataMapItem.fromDataItem(item).dataMap
                        val json = dataMap.getString("data")
                        if (json != null) {
                            parseAndUpdateData(json)
                        }
                        break
                    }
                }
                dataItems.release()
                _isConnected.value = true
                Log.d(TAG, "Initial data loaded: ${_alarms.value.size} alarms")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to load initial data", e)
                _isConnected.value = false
            }
        }
    }

    /** Sync updated alarms back to the phone */
    fun syncAlarms(alarms: Map<String, Alarm>) {
        scope.launch {
            try {
                val payload = AlarmSyncPayload(
                    alarms = alarms,
                    sunTimes = _sunTimes.value,
                    version = System.currentTimeMillis(),
                    source = "watch"
                )
                val json = gson.toJson(payload)

                val request = PutDataMapRequest.create(ALARMS_PATH).apply {
                    dataMap.putString("data", json)
                    dataMap.putString("source", "watch")
                    dataMap.putLong("timestamp", System.currentTimeMillis())
                }.asPutDataRequest().setUrgent()

                Tasks.await(dataClient.putDataItem(request))
                _alarms.value = alarms
                Log.d(TAG, "Alarms synced to phone: ${alarms.size} alarms")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to sync alarms to phone", e)
            }
        }
    }

    /** Add a new alarm and sync to phone */
    fun addAlarm(alarm: Alarm) {
        val updated = _alarms.value.toMutableMap()
        updated[alarm.id] = alarm
        syncAlarms(updated)
    }

    /** Update an existing alarm and sync to phone */
    fun updateAlarm(alarm: Alarm) {
        val updated = _alarms.value.toMutableMap()
        updated[alarm.id] = alarm.copy(updatedAt = Instant.now().toString())
        syncAlarms(updated)
    }

    /** Delete an alarm and sync to phone */
    fun deleteAlarm(alarmId: String) {
        val updated = _alarms.value.toMutableMap()
        updated.remove(alarmId)
        syncAlarms(updated)
    }

    /** Toggle an alarm's enabled state and sync to phone */
    fun toggleAlarm(alarmId: String) {
        val current = _alarms.value[alarmId] ?: return
        val updated = _alarms.value.toMutableMap()
        updated[alarmId] = current.copy(
            isEnabled = !current.isEnabled,
            updatedAt = Instant.now().toString()
        )
        syncAlarms(updated)
    }

    /** Called when data changes on the DataLayer (phone updated alarms) */
    override fun onDataChanged(dataEvents: DataEventBuffer) {
        for (event in dataEvents) {
            if (event.type == DataEvent.TYPE_CHANGED &&
                event.dataItem.uri.path == ALARMS_PATH
            ) {
                val dataMap = DataMapItem.fromDataItem(event.dataItem).dataMap
                val json = dataMap.getString("data") ?: continue
                val source = dataMap.getString("source") ?: "unknown"

                // Only update local state if the change came from the phone
                if (source == "phone") {
                    Log.d(TAG, "Received alarm update from phone")
                    parseAndUpdateData(json)
                }
            }
        }
    }

    private fun parseAndUpdateData(json: String) {
        try {
            val payload = gson.fromJson(json, AlarmSyncPayload::class.java)
            _alarms.value = payload.alarms
            if (payload.sunTimes != null) {
                _sunTimes.value = payload.sunTimes
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse alarm data", e)
        }
    }

    fun destroy() {
        dataClient.removeListener(this)
    }
}
