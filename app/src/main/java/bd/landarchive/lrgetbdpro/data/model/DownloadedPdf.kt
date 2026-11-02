package bd.landarchive.lrgetbdpro.data.model

import android.content.Context
import android.net.Uri
import android.text.format.Formatter

data class DownloadedPdf(
    val id: Long,
    val uri: Uri,
    val displayName: String,
    val sizeBytes: Long,
    val dateAdded: Long
) {
    // Formats bytes into KB/MB automatically
    fun getFormattedSize(context: Context): String = Formatter.formatShortFileSize(context, sizeBytes)
}
