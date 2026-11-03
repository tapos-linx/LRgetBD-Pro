package bd.landarchive.lrgetbdpro.viewmodel

import android.app.Application
import android.app.RecoverableSecurityException
import android.content.Context
import android.content.Intent
import android.content.IntentSender
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import androidx.compose.runtime.*
import androidx.core.content.FileProvider
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import bd.landarchive.lrgetbdpro.LRDownloaderApp
import bd.landarchive.lrgetbdpro.data.db.AppDatabase
import bd.landarchive.lrgetbdpro.data.db.RecordWithMouza
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class PdfGalleryViewModel(application: Application) : AndroidViewModel(application) {

    // Reuse the singleton applicationScope from LRDownloaderApp to prevent CoroutineScope leaks
    private val downloadDao = AppDatabase.getDatabase(
        application,
        (application as? LRDownloaderApp)?.applicationScope ?: viewModelScope
    ).downloadDao()

    var recordList by mutableStateOf<List<RecordWithMouza>>(emptyList())
        private set

    var isLoading by mutableStateOf(true)
        private set

    // State for Android 10/11+ MediaStore deletion permission dialogs
    var pendingDeleteIntentSender by mutableStateOf<IntentSender?>(null)
        private set
    var pendingDeleteRecord by mutableStateOf<RecordWithMouza?>(null)
        private set

    val filterOptions = listOf("All", "CS", "SA", "RS", "S.A", "B.R.S", "Diara")

    var selectedFilter by mutableStateOf("All")
        private set

    // Real-time filtering using the Room entity's documentType field
    val filteredRecordList by derivedStateOf {
        if (selectedFilter == "All") {
            recordList
        } else {
            recordList.filter {
                it.record.documentType.equals(selectedFilter, ignoreCase = true)
            }
        }
    }

    init {
        loadDownloadedRecords()
    }

    /**
     * Loads all joined RecordWithMouza rows from Room and reconciles them against
     * MediaStore on Dispatchers.IO so externally deleted files are automatically pruned.
     */
    fun loadDownloadedRecords() {
        viewModelScope.launch {
            isLoading = true
            val context = getApplication<Application>().applicationContext
            val verifiedRecords = withContext(Dispatchers.IO) {
                val allRecords = downloadDao.getAllRecordsWithMouzas()
                val validList = mutableListOf<RecordWithMouza>()
                for (item in allRecords) {
                    val uri = Uri.parse(item.record.mediaStoreUri)
                    if (doesFileExist(context, uri)) {
                        validList.add(item)
                    } else {
                        // Auto-prune orphaned Room rows if user deleted the PDF via system Files app
                        downloadDao.deleteRecordByUri(item.record.mediaStoreUri)
                    }
                }
                validList
            }
            withContext(Dispatchers.Main) {
                recordList = verifiedRecords
                isLoading = false
            }
        }
    }

    fun setFilter(filter: String) {
        selectedFilter = filter
    }

    fun deleteRecord(context: Context, recordWithMouza: RecordWithMouza) {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val uri = Uri.parse(recordWithMouza.record.mediaStoreUri)

                // 1. Delete the physical file from MediaStore
                val deletedRows = context.contentResolver.delete(uri, null, null)

                // 2. If successful (or if the file was already manually deleted by the user)
                if (deletedRows > 0 || !doesFileExist(context, uri)) {
                    // 3. Delete from Room DB
                    downloadDao.deleteRecordByUri(recordWithMouza.record.mediaStoreUri)

                    // 4. Update UI State
                    withContext(Dispatchers.Main) {
                        recordList = recordList.filter { it.record.id != recordWithMouza.record.id }
                        clearPendingDelete()
                    }
                }
            } catch (e: SecurityException) {
                // Handled via the IntentSender logic for Android 10/11+
                triggerPermissionDialog(recordWithMouza, e, context)
            }
        }
    }

    private suspend fun triggerPermissionDialog(
        recordWithMouza: RecordWithMouza,
        securityException: SecurityException? = null,
        context: Context = getApplication<Application>().applicationContext
    ) {
        val uri = Uri.parse(recordWithMouza.record.mediaStoreUri)
        withContext(Dispatchers.Main) {
            pendingDeleteRecord = recordWithMouza
            pendingDeleteIntentSender = when {
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.R -> {
                    MediaStore.createDeleteRequest(
                        context.contentResolver,
                        listOf(uri)
                    ).intentSender
                }
                Build.VERSION.SDK_INT == Build.VERSION_CODES.Q -> {
                    val recoverableException = securityException as? RecoverableSecurityException
                    recoverableException?.userAction?.actionIntent?.intentSender
                }
                else -> null
            }
        }
    }

    fun onPermissionGrantedForDelete(context: Context) {
        val target = pendingDeleteRecord ?: return
        clearPendingDelete()
        deleteRecord(context, target)
    }

    fun clearPendingDelete() {
        pendingDeleteIntentSender = null
        pendingDeleteRecord = null
    }

    private fun doesFileExist(context: Context, uri: Uri): Boolean {
        return try {
            context.contentResolver.query(uri, null, null, null, null)?.use {
                it.moveToFirst()
            } ?: false
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Zips a list of RecordWithMouza items in the background and launches the ShareSheet.
     */
    fun zipAndSharePdfs(context: Context, records: List<RecordWithMouza>) {
        if (records.isEmpty()) return

        viewModelScope.launch {
            isLoading = true

            val zipFile = createZipFromMediaStore(context, records)

            isLoading = false

            if (zipFile != null) {
                shareZipFile(context, zipFile)
            }
        }
    }

    private suspend fun createZipFromMediaStore(
        context: Context,
        records: List<RecordWithMouza>
    ): File? {
        return withContext(Dispatchers.IO) {
            try {
                val zipFileName = "Land_Records_${System.currentTimeMillis()}.zip"
                val zipFile = File(context.cacheDir, zipFileName)

                ZipOutputStream(BufferedOutputStream(FileOutputStream(zipFile))).use { zos ->
                    for (item in records) {
                        val uri = Uri.parse(item.record.mediaStoreUri)
                        context.contentResolver.openInputStream(uri)?.use { inputStream ->
                            val entryName = item.record.fileName.ifBlank {
                                "${item.mouza.nameEn}_${item.record.documentType}.pdf"
                            }
                            val entry = ZipEntry(entryName)
                            zos.putNextEntry(entry)
                            inputStream.copyTo(zos)
                            zos.closeEntry()
                        }
                    }
                }
                zipFile
            } catch (e: Exception) {
                e.printStackTrace()
                null
            }
        }
    }

    private fun shareZipFile(context: Context, zipFile: File) {
        val authority = "${context.packageName}.fileprovider"
        val uri = FileProvider.getUriForFile(context, authority, zipFile)

        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            type = "application/zip"
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_SUBJECT, "Archived Land Records")
            putExtra(Intent.EXTRA_TEXT, "Attached is a zip file containing ${zipFile.name}.")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }

        context.startActivity(Intent.createChooser(shareIntent, "Share Zip File"))
    }
}
