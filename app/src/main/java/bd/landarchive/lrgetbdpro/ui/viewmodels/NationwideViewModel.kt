package bd.landarchive.lrgetbdpro.ui.viewmodels

import android.content.Context
import android.content.Intent
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModel
import bd.landarchive.lrgetbdpro.data.District
import bd.landarchive.lrgetbdpro.data.Division
import bd.landarchive.lrgetbdpro.data.GeoHierarchy
import bd.landarchive.lrgetbdpro.data.Mouza
import bd.landarchive.lrgetbdpro.data.Upazila
import bd.landarchive.lrgetbdpro.service.DownloadTask
import bd.landarchive.lrgetbdpro.service.QueueDownloadService
import bd.landarchive.lrgetbdpro.service.QueueState
import bd.landarchive.lrgetbdpro.service.QueueStateManager
import kotlinx.coroutines.flow.StateFlow

class NationwideViewModel : ViewModel() {

    // Expose singleton QueueStateManager StateFlow directly to the Composable UI
    val queueState: StateFlow<QueueState> = QueueStateManager.queueState

    // Cascading Geographic Hierarchy State
    val divisions: List<Division> = GeoHierarchy.divisions
    var selectedDivision by mutableStateOf(divisions.first())
        private set

    val availableDistricts: List<District>
        get() = GeoHierarchy.districts.filter { it.divisionId == selectedDivision.id }

    var selectedDistrict by mutableStateOf(availableDistricts.first())
        private set

    val availableUpazilas: List<Upazila>
        get() = GeoHierarchy.upazilas.filter { it.districtId == selectedDistrict.id }

    var selectedUpazila by mutableStateOf(availableUpazilas.first())
        private set

    val availableMouzas: List<Mouza>
        get() = GeoHierarchy.mouzas.filter { it.upazilaId == selectedUpazila.id }

    // 100% auto-selected Mouzas for the active Upazila
    var selectedMouzas by mutableStateOf(availableMouzas)
        private set

    val allSurveyTypes = listOf("CS", "SA", "RS", "BS")
    var selectedSurveyTypes by mutableStateOf(listOf("RS", "BS"))
        private set

    fun onDivisionSelected(division: Division) {
        selectedDivision = division
        val firstDistrict = GeoHierarchy.districts.first { it.divisionId == division.id }
        onDistrictSelected(firstDistrict)
    }

    fun onDistrictSelected(district: District) {
        selectedDistrict = district
        val firstUpazila = GeoHierarchy.upazilas.first { it.districtId == district.id }
        onUpazilaSelected(firstUpazila)
    }

    fun onUpazilaSelected(upazila: Upazila) {
        selectedUpazila = upazila
        // Auto-select 100% of Mouzas in the newly selected Upazila
        selectedMouzas = GeoHierarchy.mouzas.filter { it.upazilaId == upazila.id }
    }

    fun toggleMouzaSelection(mouza: Mouza) {
        selectedMouzas = if (selectedMouzas.any { it.id == mouza.id }) {
            selectedMouzas.filterNot { it.id == mouza.id }
        } else {
            selectedMouzas + mouza
        }
    }

    fun selectAllMouzas() {
        selectedMouzas = availableMouzas
    }

    fun toggleSurveyType(survey: String) {
        selectedSurveyTypes = if (selectedSurveyTypes.contains(survey)) {
            if (selectedSurveyTypes.size > 1) selectedSurveyTypes - survey else selectedSurveyTypes
        } else {
            selectedSurveyTypes + survey
        }
    }

    /**
     * Builds the Cartesian queue (Selected Mouzas x Selected Survey/Doc Types),
     * populates QueueStateManager.pendingTasks, and starts QueueDownloadService in the foreground.
     */
    fun startProcessingQueue(context: Context) {
        val tasks = mutableListOf<DownloadTask>()
        for (mouza in selectedMouzas) {
            for (docType in selectedSurveyTypes) {
                tasks.add(
                    DownloadTask(
                        mouza = mouza,
                        docType = docType
                    )
                )
            }
        }
        if (tasks.isEmpty()) return

        QueueStateManager.pendingTasks = tasks

        val serviceIntent = Intent(context, QueueDownloadService::class.java).apply {
            action = "START"
        }
        ContextCompat.startForegroundService(context, serviceIntent)
    }

    fun pauseQueue() {
        QueueStateManager.pause()
    }

    fun resumeQueue() {
        QueueStateManager.resume()
    }

    fun stopQueue(context: Context) {
        val stopIntent = Intent(context, QueueDownloadService::class.java).apply {
            action = "STOP"
        }
        context.startService(stopIntent)
    }
}
