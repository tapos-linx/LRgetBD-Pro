package bd.landarchive.lrgetbdpro

import android.app.Application
import android.util.Log
import bd.landarchive.lrgetbdpro.data.db.AppDatabase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class LRDownloaderApp : Application() {

    // Application-wide CoroutineScope tied to the app's lifecycle
    val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    // Lazy initialization for the Room Database
    val database by lazy { AppDatabase.getDatabase(this, applicationScope) }

    override fun onCreate() {
        super.onCreate()

        // Trigger the cleanup immediately when the app starts
        cleanupTemporaryZips()
    }

    /**
     * Silently sweeps the cache directory on a background thread
     * and deletes any leftover .zip files from previous ShareSheet actions.
     */
    private fun cleanupTemporaryZips() {
        // Launch on the IO dispatcher because file deletion is a disk operation
        applicationScope.launch(Dispatchers.IO) {
            try {
                val cacheDirectory = cacheDir

                if (cacheDirectory.exists() && cacheDirectory.isDirectory) {
                    // Filter for files that are specifically .zip
                    val zipFiles = cacheDirectory.listFiles { file ->
                        file.isFile && file.name.endsWith(".zip")
                    }

                    // Since these are purely temporary for the ShareSheet,
                    // deleting all of them on app startup is the safest way to save space.
                    zipFiles?.forEach { file ->
                        val deleted = file.delete()
                        if (deleted) {
                            Log.d("LRDownloaderApp", "🧹 Cleaned up temporary cache file: ${file.name}")
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e("LRDownloaderApp", "⚠️ Failed to clean up cache: ${e.message}")
            }
        }
    }
}
