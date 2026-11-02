package bd.landarchive.lrgetbdpro.data.db

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * Migration strategy for LRgetBD Pro Room Database.
 * Handles schema updates between application versions.
 */

val MIGRATION_1_2 = object : Migration(1, 2) {
    override fun migrate(database: SupportSQLiteDatabase) {
        // Schema evolution from version 1 to 2
    }
}

val MIGRATION_2_3 = object : Migration(2, 3) {
    override fun migrate(database: SupportSQLiteDatabase) {
        database.execSQL(
            """
            CREATE TABLE IF NOT EXISTS `downloaded_records` (
                `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                `mouzaId` INTEGER NOT NULL,
                `documentType` TEXT NOT NULL,
                `mediaStoreUri` TEXT NOT NULL,
                `fileName` TEXT NOT NULL,
                `sizeBytes` INTEGER NOT NULL,
                `downloadedAt` INTEGER NOT NULL,
                FOREIGN KEY(`mouzaId`) REFERENCES `mouzas`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
            )
            """.trimIndent()
        )
        database.execSQL(
            "CREATE INDEX IF NOT EXISTS `index_downloaded_records_mouzaId` ON `downloaded_records` (`mouzaId`)"
        )
    }
}
