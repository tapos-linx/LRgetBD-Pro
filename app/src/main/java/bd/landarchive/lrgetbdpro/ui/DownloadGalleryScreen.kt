package bd.landarchive.lrgetbdpro.ui

import android.app.Activity
import android.net.Uri
import android.text.format.Formatter
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import bd.landarchive.lrgetbdpro.data.db.RecordWithMouza
import bd.landarchive.lrgetbdpro.util.PdfUtils.openPdfWithExternalViewer
import bd.landarchive.lrgetbdpro.util.PdfUtils.sharePdfViaShareSheet
import bd.landarchive.lrgetbdpro.viewmodel.PdfGalleryViewModel

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun DownloadGalleryScreen(viewModel: PdfGalleryViewModel) {
    val context = LocalContext.current

    // Use the derived filtered list from Room RecordWithMouza
    val displayedPdfs = viewModel.filteredRecordList

    // --- ACTIVITY RESULT LAUNCHER FOR MEDIASTORE PERMISSIONS ---
    val deleteLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartIntentSenderForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            viewModel.onPermissionGrantedForDelete(context)
        } else {
            viewModel.clearPendingDelete()
        }
    }

    LaunchedEffect(viewModel.pendingDeleteIntentSender) {
        viewModel.pendingDeleteIntentSender?.let { intentSender ->
            deleteLauncher.launch(
                IntentSenderRequest.Builder(intentSender).build()
            )
        }
    }

    // --- STATE FOR DELETION DIALOG ---
    var pdfToDelete by remember { mutableStateOf<RecordWithMouza?>(null) }

    // --- DELETION CONFIRMATION DIALOG ---
    if (pdfToDelete != null) {
        AlertDialog(
            onDismissRequest = { pdfToDelete = null },
            title = { Text("Delete Record") },
            text = {
                Text(
                    "Are you sure you want to delete '${pdfToDelete?.record?.fileName}' (${pdfToDelete?.mouza?.nameBn})? This action cannot be undone."
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.deleteRecord(context, pdfToDelete!!)
                        pdfToDelete = null
                    }
                ) {
                    Text("Delete", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { pdfToDelete = null }) {
                    Text("Cancel")
                }
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Archived Records", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                ),
                actions = {
                    // Zip and Share Button
                    IconButton(
                        onClick = {
                            viewModel.zipAndSharePdfs(context, displayedPdfs)
                        },
                        enabled = displayedPdfs.isNotEmpty() && !viewModel.isLoading
                    ) {
                        Icon(
                            imageVector = Icons.Default.Archive,
                            contentDescription = "Zip and Share Displayed Records"
                        )
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .padding(paddingValues)
                .fillMaxSize()
        ) {
            // --- FILTER CHIPS ROW ---
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                items(viewModel.filterOptions) { filterOption ->
                    val isSelected = viewModel.selectedFilter == filterOption

                    FilterChip(
                        selected = isSelected,
                        onClick = { viewModel.setFilter(filterOption) },
                        label = { Text(filterOption) },
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

            // --- GRID CONTENT ---
            if (viewModel.isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else if (displayedPdfs.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        text = if (viewModel.selectedFilter == "All")
                            "No downloaded land records found."
                        else
                            "No ${viewModel.selectedFilter} records found.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                LazyVerticalGrid(
                    columns = GridCells.Adaptive(minSize = 150.dp),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(displayedPdfs, key = { it.record.id }) { item ->
                        val pdfUri = Uri.parse(item.record.mediaStoreUri)

                        RecordGridItem(
                            item = item,
                            onClick = { openPdfWithExternalViewer(context, pdfUri) },
                            onLongClick = { pdfToDelete = item },
                            onShareClick = { sharePdfViaShareSheet(context, pdfUri, item.record.fileName) }
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun RecordGridItem(
    item: RecordWithMouza,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
    onShareClick: () -> Unit
) {
    val context = LocalContext.current
    val record = item.record
    val mouza = item.mouza
    val formattedSize = Formatter.formatShortFileSize(context, record.sizeBytes)

    val cardShape = RoundedCornerShape(12.dp)

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clip(cardShape)
            .combinedClickable(
                onClick = onClick,
                onLongClick = onLongClick
            ),
        shape = cardShape,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        ),
        elevation = CardDefaults.cardElevation(2.dp)
    ) {
        Box(modifier = Modifier.fillMaxWidth()) {

            // Document Type Badge (e.g., "CS")
            Box(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .background(
                        color = MaterialTheme.colorScheme.primary,
                        shape = RoundedCornerShape(bottomEnd = 8.dp)
                    )
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            ) {
                Text(
                    text = record.documentType,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onPrimary,
                    fontWeight = FontWeight.Bold
                )
            }

            // Share Button
            IconButton(
                onClick = onShareClick,
                modifier = Modifier.align(Alignment.TopEnd)
            ) {
                Icon(
                    imageVector = Icons.Default.Share,
                    contentDescription = "Share",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Column(
                modifier = Modifier
                    .padding(top = 32.dp, bottom = 16.dp, start = 16.dp, end = 16.dp)
                    .fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Icon(
                    imageVector = Icons.Default.Description,
                    contentDescription = "PDF Document",
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(40.dp)
                )

                Spacer(modifier = Modifier.height(8.dp))

                // Display the Mouza Name in Bangla
                Text(
                    text = mouza.nameBn,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                // Display English Name & JL Number
                Text(
                    text = "${mouza.nameEn} | JL: ${mouza.jlNo}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = formattedSize,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.outline
                )
            }
        }
    }
}
