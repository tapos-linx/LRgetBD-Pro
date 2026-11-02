package bd.landarchive.lrgetbdpro.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import com.google.gson.Gson
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import bd.landarchive.lrgetbdpro.data.*

// Increment version from 2 to 3
@Database(
    entities = [
        DivisionEntity::class,
        DistrictEntity::class,
        UpazilaEntity::class,
        MouzaEntity::class,
        DownloadedRecordEntity::class // Add the new entity here
    ],
    version = 3,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun locationDao(): LocationDao
    abstract fun downloadDao(): DownloadDao // Expose the new DAO

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        // This determines if we need to parse the JSON again
        private const val CURRENT_JSON_VERSION = 3

        fun getDatabase(context: Context, scope: CoroutineScope): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "lrgetbd_offline_database"
                )
                .addMigrations(MIGRATION_1_2, MIGRATION_2_3)
                .addCallback(AppDatabaseCallback(context, scope))
                .build()

                INSTANCE = instance
                instance
            }
        }
    }

    private class AppDatabaseCallback(
        private val context: Context,
        private val scope: CoroutineScope
    ) : RoomDatabase.Callback() {
        
        // onCreate fires ONLY on fresh installs
        override fun onCreate(db: SupportSQLiteDatabase) {
            super.onCreate(db)
            syncJsonData()
        }

        // onOpen fires EVERY time the app starts. 
        // We use SharedPreferences to ensure we only parse the JSON when the version bumps.
        override fun onOpen(db: SupportSQLiteDatabase) {
            super.onOpen(db)
            
            val prefs = context.getSharedPreferences("app_prefs", Context.MODE_PRIVATE)
            val savedVersion = prefs.getInt("json_data_version", 0)

            if (savedVersion < CURRENT_JSON_VERSION) {
                syncJsonData(prefs)
            }
        }

        private fun syncJsonData(prefs: android.content.SharedPreferences? = null) {
            INSTANCE?.let { database ->
                scope.launch(Dispatchers.IO) {
                    try {
                        val inputStream = context.assets.open("bd_locations.json")
                        val jsonString = inputStream.bufferedReader().use { it.readText() }
                        val locationData = Gson().fromJson(jsonString, LocationDataWrapper::class.java)

                        val dao = database.locationDao()
                        
                        // Because your DAO uses @Insert(onConflict = OnConflictStrategy.REPLACE),
                        // existing IDs are safely overwritten (updating names if they changed),
                        // and new IDs are appended without destroying the database.
                        locationData.divisions.let { dao.insertDivisions(it) }
                        locationData.districts.let { dao.insertDistricts(it) }
                        locationData.upazilas.let { dao.insertUpazilas(it) }
                        locationData.mouzas.let { dao.insertMouzas(it) }

                        // Update the tracker so this doesn't run again until version 3
                        prefs?.edit()?.putInt("json_data_version", CURRENT_JSON_VERSION)?.apply()
                        
                        println("✅ Database successfully synced with updated JSON data!")
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }
        }
    }
}
