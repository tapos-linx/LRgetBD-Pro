package bd.landarchive.lrgetbdpro.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import bd.landarchive.lrgetbdpro.service.QueueState
import bd.landarchive.lrgetbdpro.ui.viewmodels.NationwideViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NationwideProcessingScreen(viewModel: NationwideViewModel) {
    val queueState by viewModel.queueState.collectAsState()
    val context = LocalContext.current

    // Android 13+ (API 33) POST_NOTIFICATIONS runtime permission launcher
    val notificationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { _ ->
        // Start the foreground queue service once the user responds to the permission prompt
        viewModel.startProcessingQueue(context)
    }

    val triggerStartQueue = {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val hasPermission = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED

            if (hasPermission) {
                viewModel.startProcessingQueue(context)
            } else {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        } else {
            viewModel.startProcessingQueue(context)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "Nationwide Bulk Extraction (${viewModel.selectedDistrict.nameEn} · ${viewModel.selectedUpazila.nameEn})",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )

        // Survey / DocType Filter Chips
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(viewModel.allSurveyTypes) { survey ->
                val isSelected = viewModel.selectedSurveyTypes.contains(survey)
                FilterChip(
                    selected = isSelected,
                    onClick = { viewModel.toggleSurveyType(survey) },
                    label = { Text(survey) },
                    leadingIcon = if (isSelected) {
                        {
                            Icon(
                                imageVector = Icons.Default.Check,
                                contentDescription = "Selected",
                                modifier = Modifier.size(FilterChipDefaults.IconSize)
                            )
                        }
                    } else null
                )
            }
        }

        // Mouza Selection Summary & Start Button
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Selected Mouzas: ${viewModel.selectedMouzas.size}/${viewModel.availableMouzas.size}",
                style = MaterialTheme.typography.bodyMedium
            )

            Button(
                onClick = triggerStartQueue,
                enabled = !queueState.isProcessing && viewModel.selectedMouzas.isNotEmpty()
            ) {
                Icon(imageVector = Icons.Default.PlayArrow, contentDescription = null)
                Spacer(modifier = Modifier.width(6.dp))
                Text("Start Queue")
            }
        }

        // Pass queueState down to the Monitor
        if (queueState.isProcessing || queueState.isPaused) {
            NationwideQueueMonitor(
                state = queueState,
                onPause = { viewModel.pauseQueue() },
                onResume = { viewModel.resumeQueue() },
                onReset = { viewModel.stopQueue(context) }
            )
        }
    }
}

@Composable
fun NationwideQueueMonitor(
    state: QueueState,
    onPause: () -> Unit,
    onResume: () -> Unit,
    onReset: () -> Unit
) {
    val progressFraction = if (state.totalTasks > 0) {
        (state.currentTaskIndex.toFloat() / state.totalTasks.toFloat()).coerceIn(0f, 1f)
    } else {
        0f
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = if (state.isPaused) "Queue Paused" else "Downloading Records...",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Mouza: ${state.activeMouzaName.ifEmpty { "Initializing..." }} · Doc: ${state.activeDocType}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Text(
                    text = "${state.currentTaskIndex} / ${state.totalTasks}",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold
                )
            }

            LinearProgressIndicator(
                progress = { progressFraction },
                modifier = Modifier.fillMaxWidth()
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (state.isPaused) {
                    FilledTonalButton(onClick = onResume) {
                        Icon(imageVector = Icons.Default.PlayArrow, contentDescription = "Resume")
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Resume")
                    }
                } else {
                    FilledTonalButton(onClick = onPause) {
                        Icon(imageVector = Icons.Default.Pause, contentDescription = "Pause")
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Pause")
                    }
                }

                Spacer(modifier = Modifier.width(8.dp))

                OutlinedButton(onClick = onReset) {
                    Icon(imageVector = Icons.Default.Refresh, contentDescription = "Reset")
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Stop & Reset")
                }
            }
        }
    }
}
