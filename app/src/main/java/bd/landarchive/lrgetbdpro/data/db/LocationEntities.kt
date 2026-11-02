package bd.landarchive.lrgetbdpro.data.db

import androidx.room.Dao
import androidx.room.Embedded
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Relation
import androidx.room.Transaction
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "divisions")
data class DivisionEntity(
    @PrimaryKey val id: Int,
    val nameBn: String,
    val nameEn: String
)

@Entity(
    tableName = "districts",
    foreignKeys = [
        ForeignKey(
            entity = DivisionEntity::class,
            parentColumns = ["id"],
            childColumns = ["divisionId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("divisionId")]
)
data class DistrictEntity(
    @PrimaryKey val id: Int,
    val divisionId: Int,
    val nameBn: String,
    val nameEn: String
)

@Entity(
    tableName = "upazilas",
    foreignKeys = [
        ForeignKey(
            entity = DistrictEntity::class,
            parentColumns = ["id"],
            childColumns = ["districtId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("districtId")]
)
data class UpazilaEntity(
    @PrimaryKey val id: Int,
    val districtId: Int,
    val nameBn: String,
    val nameEn: String
)

@Entity(
    tableName = "mouzas",
    foreignKeys = [
        ForeignKey(
            entity = UpazilaEntity::class,
            parentColumns = ["id"],
            childColumns = ["upazilaId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("upazilaId")]
)
data class MouzaEntity(
    @PrimaryKey val id: Int,
    val upazilaId: Int,
    val nameBn: String,
    val nameEn: String,
    val jlNo: String
)

data class LocationDataWrapper(
    val divisions: List<DivisionEntity> = emptyList(),
    val districts: List<DistrictEntity> = emptyList(),
    val upazilas: List<UpazilaEntity> = emptyList(),
    val mouzas: List<MouzaEntity> = emptyList()
)

data class MouzaWithDownloadedRecords(
    @Embedded val mouza: MouzaEntity,
    @Relation(
        parentColumn = "id",
        entityColumn = "mouzaId"
    )
    val downloadedRecords: List<DownloadedRecordEntity>
)

@Dao
interface LocationDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDivisions(divisions: List<DivisionEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDistricts(districts: List<DistrictEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertUpazilas(upazilas: List<UpazilaEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMouzas(mouzas: List<MouzaEntity>)

    @Query("SELECT * FROM divisions ORDER BY id ASC")
    fun getAllDivisions(): Flow<List<DivisionEntity>>

    @Query("SELECT * FROM districts WHERE divisionId = :divisionId ORDER BY id ASC")
    fun getDistrictsForDivision(divisionId: Int): Flow<List<DistrictEntity>>

    @Query("SELECT * FROM upazilas WHERE districtId = :districtId ORDER BY id ASC")
    fun getUpazilasForDistrict(districtId: Int): Flow<List<UpazilaEntity>>

    @Query("SELECT * FROM mouzas WHERE upazilaId = :upazilaId ORDER BY jlNo ASC")
    fun getMouzasForUpazila(upazilaId: Int): Flow<List<MouzaEntity>>
}

@Dao
interface DownloadedRecordDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDownloadedRecord(record: DownloadedRecordEntity): Long

    @Query("SELECT * FROM downloaded_records ORDER BY downloadedAt DESC")
    fun getAllDownloadedRecords(): Flow<List<DownloadedRecordEntity>>

    @Transaction
    @Query("SELECT * FROM downloaded_records ORDER BY downloadedAt DESC")
    fun getAllRecordsWithMouza(): Flow<List<RecordWithMouza>>

    @Transaction
    @Query("SELECT * FROM downloaded_records WHERE documentType = :documentType ORDER BY downloadedAt DESC")
    fun getRecordsWithMouzaByDocType(documentType: String): Flow<List<RecordWithMouza>>

    @Query("SELECT * FROM downloaded_records WHERE mouzaId = :mouzaId ORDER BY downloadedAt DESC")
    fun getRecordsForMouza(mouzaId: Int): Flow<List<DownloadedRecordEntity>>

    @Transaction
    @Query("SELECT * FROM mouzas WHERE upazilaId = :upazilaId ORDER BY jlNo ASC")
    fun getMouzasWithRecordsForUpazila(upazilaId: Int): Flow<List<MouzaWithDownloadedRecords>>

    @Query("DELETE FROM downloaded_records WHERE mediaStoreUri = :mediaStoreUri")
    suspend fun deleteByMediaStoreUri(mediaStoreUri: String)
}
