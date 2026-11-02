package bd.landarchive.lrgetbdpro.ui.viewmodels

import androidx.lifecycle.ViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

data class QueueItem(val id: String, val mouza: String, val status: String)

sealed class ProcessingState {
    object Idle : ProcessingState()
    data class Active(val queue: List<QueueItem>, val progress: Float) : ProcessingState()
}

class ProcessingViewModel : ViewModel() {
    private val _state = MutableStateFlow<ProcessingState>(ProcessingState.Idle)
    val state: StateFlow<ProcessingState> = _state

    fun startProcessing(mouzas: List<String>) {
        // Logic for queue generation and jitter delay loop
    }
}
