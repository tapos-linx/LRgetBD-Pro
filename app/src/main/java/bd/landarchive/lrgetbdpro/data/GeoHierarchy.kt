package bd.landarchive.lrgetbdpro.data

data class Division(val id: Int, val nameBn: String, val nameEn: String)
data class District(val id: Int, val divisionId: Int, val nameBn: String, val nameEn: String)
data class Upazila(val id: Int, val districtId: Int, val nameBn: String, val nameEn: String)
data class Mouza(
    val id: Int,
    val upazilaId: Int,
    val nameBn: String,
    val nameEn: String,
    val jlNo: String
) {
    val name: String get() = nameEn
}

object GeoHierarchy {
    val divisions = listOf(
        Division(1, "চট্টগ্রাম", "Chattogram"),
        Division(2, "ঢাকা", "Dhaka")
    )

    val districts = listOf(
        District(1, 1, "ব্রাহ্মণবাড়িয়া", "Brahmanbaria"),
        District(2, 1, "কুমিল্লা", "Cumilla"),
        District(3, 2, "গাজীপুর", "Gazipur")
    )

    val upazilas = listOf(
        Upazila(1, 1, "নবীনগর", "Nabinagar"),
        Upazila(2, 1, "কসবা", "Kasba"),
        Upazila(3, 3, "কালিয়াকৈর", "Kaliakair")
    )

    val mouzas = listOf(
        Mouza(1, 1, "কাইতলা", "Kaitola", "123"),
        Mouza(2, 1, "গোয়ালী", "Goali", "124"),
        Mouza(3, 1, "শ্রীরামপুর", "Srirampur", "125"),
        Mouza(4, 2, "কুটি", "Kuti", "45"),
        Mouza(5, 3, "মৌচাক", "Mouchak", "15"),
        Mouza(6, 3, "সফিপুর", "Safipur", "16")
    )
}
