package bd.landarchive.lrgetbdpro.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.IBinder
import android.provider.MediaStore
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import bd.landarchive.lrgetbdpro.LRDownloaderApp
import bd.landarchive.lrgetbdpro.MainActivity
import bd.landarchive.lrgetbdpro.data.db.AppDatabase
import bd.landarchive.lrgetbdpro.data.db.DownloadedRecordEntity
import bd.landarchive.lrgetbdpro.receiver.QueueActionReceiver
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.collectLatest
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import kotlin.random.Random

class QueueDownloadService : Service() {

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var queueJob: Job? = null
    private var notificationObserverJob: Job? = null

    private val CHANNEL_ID = "LR_Queue_Channel"
    private val NOTIFICATION_ID = 1

    private var currentNotifText = "Starting engine..."
    private var currentProgress = 0
    private var maxProgress = 0

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action

        when (action) {
            "START" -> startQueue()
            "STOP" -> stopQueue()
        }

        return START_NOT_STICKY
    }

    private fun startQueue() {
        val tasks = QueueStateManager.pendingTasks
        if (tasks.isEmpty()) {
            stopSelf()
            return
        }

        currentNotifText = "Engine Started..."
        currentProgress = 0
        maxProgress = tasks.size

        QueueStateManager.updateState {
            it.copy(isProcessing = true, totalTasks = tasks.size, currentTaskIndex = 0)
        }

        // 1. Promote Service to Foreground immediately with Android 14 (API 34) dataSync compliance
        val initialNotification = buildNotification("Engine Started...", 0, tasks.size, false)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceCompat.startForeground(
                this,
                NOTIFICATION_ID,
                initialNotification,
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                } else {
                    0
                }
            )
        } else {
            startForeground(NOTIFICATION_ID, initialNotification)
        }

        // 2. Observe QueueStateManager without leaking duplicate collectors
        observeQueueStateForNotifications()

        // 3. Launch the Nested Execution Loop using the singleton applicationScope for Room DB
        queueJob?.cancel()
        queueJob = serviceScope.launch {
            val appScope = (application as? LRDownloaderApp)?.applicationScope ?: serviceScope
            val downloadDao = AppDatabase.getDatabase(applicationContext, appScope).downloadDao()

            for ((index, task) in tasks.withIndex()) {

                // Spin-lock for pause (cancellation-cooperative via delay)
                while (QueueStateManager.queueState.value.isPaused && isActive) {
                    delay(500)
                }
                if (!isActive) break

                // Update Singleton State
                val currentIndex = index + 1
                QueueStateManager.updateState {
                    it.copy(
                        currentTaskIndex = currentIndex,
                        activeMouzaName = task.mouza.name,
                        activeDocType = task.docType
                    )
                }

                // Update Notification UI
                updateNotification("Processing ${task.docType} for ${task.mouza.name}", currentIndex, tasks.size)

                // Run the pre-check here to decide if we need jitter
                val existingCount = downloadDao.isDocumentAlreadyDownloaded(task.mouza.id, task.docType)

                if (existingCount > 0) {
                    // SKIP LOGIC: bypasses network call and long jitter delay
                    QueueStateManager.updateState { it.copy(activeDocType = "${task.docType} (Skipped)") }
                    delay(300) // Micro-delay for UI smoothness only
                } else {
                    // DOWNLOAD LOGIC
                    executeDownloadTask(task) // Executes network call & saves to MediaStore + Room DB

                    // Apply Polite Jitter Delay (1.5s - 3.5s) ONLY after an actual network hit
                    if (index < tasks.size - 1 && isActive) {
                        delay(Random.nextLong(1500, 3500))
                    }
                }
            }

            // Loop Finished
            notificationObserverJob?.cancel()
            QueueStateManager.updateState {
                it.copy(isProcessing = false, isPaused = false, activeMouzaName = "Completed", activeDocType = "")
            }
            updateNotification("All Tasks Completed", tasks.size, tasks.size)
            stopForeground(STOP_FOREGROUND_DETACH)
            stopSelf()
        }
    }

    private suspend fun executeDownloadTask(task: DownloadTask) {
        val appScope = (application as? LRDownloaderApp)?.applicationScope ?: serviceScope
        val downloadDao = AppDatabase.getDatabase(applicationContext, appScope).downloadDao()

        try {
            QueueStateManager.updateState {
                it.copy(activeDocType = "Fetching ${task.docType}...")
            }

            val pdfBytes = fetchPdfBytesWithRetry(task.targetUrl, maxRetries = 3)
            if (pdfBytes.isEmpty()) return

            val uri: Uri = savePdfToMediaStoreAndGetUri(
                context = applicationContext,
                mouzaName = task.mouza.name,
                docType = task.docType,
                pdfBytes = pdfBytes
            ) ?: return

            // Sync to Room Database after successful download
            downloadDao.insertRecord(
                DownloadedRecordEntity(
                    mouzaId = task.mouza.id,
                    documentType = task.docType,
                    mediaStoreUri = uri.toString(),
                    fileName = "${task.mouza.name}_${task.docType}.pdf",
                    sizeBytes = pdfBytes.size.toLong()
                )
            )
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            Log.e("QueueDownloadService", "Failed task ${task.fileName}: ${e.message}", e)
        }
    }

    /**
     * Executes HTTP fetch with 3x exponential backoff (1s -> 2s -> 4s) for transient 429/5xx errors
     * and enforces the 5-byte %PDF- (25 50 44 46 2D) magic-header gate.
     */
    private suspend fun fetchPdfBytesWithRetry(targetUrl: String, maxRetries: Int = 3): ByteArray {
        var attempt = 0
        var backoffMs = 1000L

        while (attempt < maxRetries) {
            attempt++
            val bytes = fetchPdfBytesViaScrapfly(targetUrl)
            if (bytes.isNotEmpty()) {
                return bytes
            }
            if (attempt < maxRetries) {
                delay(backoffMs)
                backoffMs *= 2
            }
        }
        return ByteArray(0)
    }

    private fun fetchPdfBytesViaScrapfly(targetUrl: String): ByteArray {
        var connection: HttpURLConnection? = null
        return try {
            val url = URL(targetUrl)
            connection = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 15_000
                readTimeout = 20_000
                setRequestProperty("Accept", "application/pdf,application/octet-stream,*/*")
                setRequestProperty("User-Agent", "LRgetBD-Pro/2.1 (Android; LandArchiveBD)")
            }

            val code = connection.responseCode
            if (code == HttpURLConnection.HTTP_OK) {
                val bytes = connection.inputStream.use(InputStream::readBytes)
                // Zero Hallucination Gate: verify %PDF- (25 50 44 46 2D) and > 1024 bytes
                if (isValidPdfPayload(bytes)) {
                    bytes
                } else {
                    Log.w("QueueDownloadService", "Rejected non-PDF payload (${bytes.size}B) from $targetUrl")
                    ByteArray(0)
                }
            } else {
                Log.w("QueueDownloadService", "HTTP $code from $targetUrl")
                ByteArray(0)
            }
        } catch (e: Exception) {
            Log.e("QueueDownloadService", "Network error fetching $targetUrl: ${e.message}")
            ByteArray(0)
        } finally {
            connection?.disconnect()
        }
    }

    private fun isValidPdfPayload(bytes: ByteArray): Boolean {
        if (bytes.size <= 1024) return false
        return bytes[0] == 0x25.toByte() && // %
                bytes[1] == 0x50.toByte() && // P
                bytes[2] == 0x44.toByte() && // D
                bytes[3] == 0x46.toByte() && // F
                bytes[4] == 0x2D.toByte()    // -
    }

    private fun savePdfToMediaStoreAndGetUri(
        context: Context,
        mouzaName: String,
        docType: String,
        pdfBytes: ByteArray
    ): Uri? {
        val resolver = context.contentResolver
        val collection = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        } else {
            MediaStore.Files.getContentUri("external")
        }

        val fileName = "${mouzaName}_${docType}.pdf"
        val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
            put(MediaStore.MediaColumns.MIME_TYPE, "application/pdf")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                put(MediaStore.MediaColumns.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/LRgetBD-Pro")
                put(MediaStore.MediaColumns.IS_PENDING, 1)
            }
        }

        val uri = resolver.insert(collection, values) ?: return null
        return try {
            resolver.openOutputStream(uri)?.use { out ->
                out.write(pdfBytes)
                out.flush()
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val completeValues = ContentValues().apply {
                    put(MediaStore.MediaColumns.IS_PENDING, 0)
                }
                resolver.update(uri, completeValues, null, null)
            }
            uri
        } catch (e: Exception) {
            resolver.delete(uri, null, null)
            null
        }
    }

    private fun stopQueue() {
        notificationObserverJob?.cancel()
        queueJob?.cancel()
        serviceScope.coroutineContext.cancelChildren()
        QueueStateManager.reset()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    // --- NOTIFICATION HELPERS ---

    private fun observeQueueStateForNotifications() {
        notificationObserverJob?.cancel()
        notificationObserverJob = serviceScope.launch {
            QueueStateManager.queueState.collectLatest { state ->
                if (!state.isProcessing && !state.isPaused) return@collectLatest
                val displayText = if (state.isPaused) "Paused - $currentNotifText" else currentNotifText

                // Re-render the notification immediately when the pause state changes
                // so the button swaps from "Pause" to "Resume"
                val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                notificationManager.notify(
                    NOTIFICATION_ID,
                    buildNotification(displayText, currentProgress, maxProgress, state.isPaused)
                )
            }
        }
    }

    private fun buildNotification(contentText: String, progress: Int, max: Int, isPaused: Boolean): Notification {

        // 1. Base App Intent (Tapping the notification body opens the app)
        val appIntent = Intent(this, MainActivity::class.java)
        val pendingAppIntent = PendingIntent.getActivity(
            this, 0, appIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        // 2. Dynamic Pause/Resume Action Button
        val pauseResumeAction = if (isPaused) {
            val resumeIntent = Intent(this, QueueActionReceiver::class.java).apply { action = "ACTION_RESUME" }
            val resumePending = PendingIntent.getBroadcast(
                this, 1, resumeIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
            NotificationCompat.Action(android.R.drawable.ic_media_play, "Resume", resumePending)
        } else {
            val pauseIntent = Intent(this, QueueActionReceiver::class.java).apply { action = "ACTION_PAUSE" }
            val pausePending = PendingIntent.getBroadcast(
                this, 2, pauseIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
            NotificationCompat.Action(android.R.drawable.ic_media_pause, "Pause", pausePending)
        }

        // 3. Cancel Action Button
        val cancelIntent = Intent(this, QueueActionReceiver::class.java).apply { action = "ACTION_CANCEL" }
        val cancelPending = PendingIntent.getBroadcast(
            this, 3, cancelIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val cancelAction = NotificationCompat.Action(android.R.drawable.ic_menu_close_clear_cancel, "Cancel", cancelPending)

        // 4. Assemble Notification
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("LR Mass Downloader")
            .setContentText(contentText)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setProgress(max, progress, false)
            .setOngoing(true) // Prevents swiping away
            .setOnlyAlertOnce(true)
            .setContentIntent(pendingAppIntent)
            .addAction(pauseResumeAction) // Adds button 1
            .addAction(cancelAction)      // Adds button 2
            .build()
    }

    private fun updateNotification(text: String, progress: Int, max: Int) {
        currentNotifText = text
        currentProgress = progress
        maxProgress = max

        val isPaused = QueueStateManager.queueState.value.isPaused
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, buildNotification(text, progress, max, isPaused))
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Queue Engine Progress",
                NotificationManager.IMPORTANCE_LOW // Low importance prevents sound/vibration on every progress update
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        notificationObserverJob?.cancel()
        queueJob?.cancel()
        serviceScope.cancel()
        super.onDestroy()
    }
}
