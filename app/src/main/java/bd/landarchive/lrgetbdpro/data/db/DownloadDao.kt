package bd.landarchive.lrgetbdpro.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction

@Dao
interface DownloadDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRecord(record: DownloadedRecordEntity): Long

    @Transaction
    @Query("SELECT * FROM downloaded_records ORDER BY downloadedAt DESC")
    suspend fun getAllRecordsWithMouzas(): List<RecordWithMouza>

    @Transaction
    @Query("SELECT * FROM downloaded_records WHERE documentType = :docType ORDER BY downloadedAt DESC")
    suspend fun getRecordsByType(docType: String): List<RecordWithMouza>

    @Query("DELETE FROM downloaded_records WHERE mediaStoreUri = :uri")
    suspend fun deleteRecordByUri(uri: String)

    @Query("SELECT COUNT(*) FROM downloaded_records WHERE mouzaId = :mouzaId AND documentType = :docType")
    suspend fun isDocumentAlreadyDownloaded(mouzaId: Int, docType: String): Int
}
