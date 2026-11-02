package bd.landarchive.lrgetbdpro.data.db

import androidx.room.Embedded
import androidx.room.Relation

data class RecordWithMouza(
    @Embedded val record: DownloadedRecordEntity,

    @Relation(
        parentColumn = "mouzaId",
        entityColumn = "id"
    )
    val mouza: MouzaEntity
)
