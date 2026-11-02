package bd.landarchive.lrgetbdpro.data.db

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "downloaded_records",
    foreignKeys = [
        ForeignKey(
            entity = MouzaEntity::class,
            parentColumns = ["id"],
            childColumns = ["mouzaId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    // Indexing the foreign key improves JOIN query performance
    indices = [Index("mouzaId")]
)
data class DownloadedRecordEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val mouzaId: Int,
    val documentType: String, // e.g., "CS", "SA", "RS"
    val mediaStoreUri: String, // Stringified content:// URI
    val fileName: String,
    val sizeBytes: Long,
    val downloadedAt: Long = System.currentTimeMillis()
)
