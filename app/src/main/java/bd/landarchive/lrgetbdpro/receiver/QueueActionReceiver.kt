package bd.landarchive.lrgetbdpro.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import bd.landarchive.lrgetbdpro.service.QueueDownloadService
import bd.landarchive.lrgetbdpro.service.QueueStateManager

class QueueActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            "ACTION_PAUSE" -> QueueStateManager.pause()
            "ACTION_RESUME" -> QueueStateManager.resume()
            "ACTION_CANCEL" -> {
                // Route the stop command back to the active service
                val stopIntent = Intent(context, QueueDownloadService::class.java).apply {
                    action = "STOP"
                }
                context.startService(stopIntent)
            }
        }
    }
}
