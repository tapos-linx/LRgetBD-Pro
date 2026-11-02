package bd.landarchive.lrgetbdpro.util

import android.content.Context
import android.content.Intent
import android.net.Uri

object PdfUtils {
    fun openPdfWithExternalViewer(context: Context, uri: Uri) {
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/pdf")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION) // Crucial for scoped storage
        }
        context.startActivity(Intent.createChooser(intent, "Open Land Record"))
    }

    fun sharePdfViaShareSheet(context: Context, pdfUri: Uri, pdfName: String) {
        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            type = "application/pdf"
            putExtra(Intent.EXTRA_STREAM, pdfUri)
            putExtra(Intent.EXTRA_SUBJECT, "Land Record: $pdfName")
            putExtra(Intent.EXTRA_TEXT, "Here is the downloaded land record: $pdfName")
            
            // CRITICAL: Grants the receiving app permission to read this specific file
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        
        val chooser = Intent.createChooser(shareIntent, "Share Record")
        context.startActivity(chooser)
    }
}
