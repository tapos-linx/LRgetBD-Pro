package bd.landarchive.lrgetbdpro.service

import bd.landarchive.lrgetbdpro.data.Mouza
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

// Represents an individual task in the download queue
data class DownloadTask(
    val mouza: Mouza,
    val docType: String,
    val targetUrl: String = "https://eporcha.tech/mouza-vittik-khatian?jl_no=${mouza.jlNo}&survey=$docType",
    val fileName: String = "JL_${mouza.jlNo}_${mouza.name}_${docType}.pdf"
)

// Represents the real-time state of the queue
data class QueueState(
    val isProcessing: Boolean = false,
    val isPaused: Boolean = false,
    val totalTasks: Int = 0,
    val currentTaskIndex: Int = 0,
    val activeMouzaName: String = "",
    val activeDocType: String = ""
)

object QueueStateManager {
    private val _queueState = MutableStateFlow(QueueState())
    val queueState: StateFlow<QueueState> = _queueState.asStateFlow()

    // The raw queue list passed from the UI
    var pendingTasks: List<DownloadTask> = emptyList()

    fun updateState(modifier: (QueueState) -> QueueState) {
        _queueState.value = modifier(_queueState.value)
    }

    fun pause() = updateState { it.copy(isPaused = true) }
    fun resume() = updateState { it.copy(isPaused = false) }
    fun reset() {
        pendingTasks = emptyList()
        _queueState.value = QueueState()
    }
}
