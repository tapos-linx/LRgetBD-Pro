# 01_PRD.md — Product Requirements Document (SKILL.md Equivalent)
**Project:** LRgetBD Pro (LR Mass Downloader / LandArchive BD v2.1 — `eporcha.tech` Open-Access Edition)  
**Target Portal:** `https://eporcha.tech` (Zero-Login, Open-Access Endpoints)  
**Platforms:** Mobile-First Web SPA + Capacitor 8 Android Native APK (`bd.landarchive.lrgetbdpro` · `tapos-linx/LRgetBD-Pro`)

---

## 1. Core Objective
Provide a 100% free, zero-payment, zero-hallucination bulk extraction, binary verification (`%PDF-`), and archival engine powered exclusively by **`https://eporcha.tech`** for Bangladesh land records. Do NOT use paid or login-walled portals (`dlrms.land.gov.bd` or `eporcha.gov.bd`).

---

## 2. Six Supported Document & Extraction Modes (`EporchaDocType`)

1. **`SURVEY_KHATIAN` (`https://eporcha.tech/survey-khatian`)**
   - Cascading lookup: `Division (বিভাগ)` → `District (জেলা)` → `Upazila (উপজেলা)` → `Survey Type (CS, SA, RS, BS/BRS)` → `Mouza (মৌজা ও JL নম্বর)`.
   - Extracts Khatian list (`খতিয়ান নম্বর`, `মালিক/দলিলধারী`, `দাগ নম্বর`, `মোট জমি (একর)`) and individual Khatian PDFs.
2. **`NAMJARI_KHATIAN` (`https://eporcha.tech/namjari-khatian`)**
   - Cascading lookup: `District` → `Upazila` → `Mutation Survey` → `Mouza` → Khatian/Dag/Owner extraction.
3. **`MOUZA_KHATIAN_BOOK` (`https://eporcha.tech/mouza-vittik-khatian`)**
   - Generates and downloads the **Complete Mouza Khatian Book PDF ("পূর্ণ মৌজা PDF ডাউনলোড")** for `CS`, `SA`, `RS`, `BS`, or `Mutation`.
   - Supports format variants: Layout (`নতুন ধরন` / `পুরনো ধরন`) and Color Mode (`রঙিন` / `সাদা-কালো`).
4. **`MOUZA_DAG_BOOK` (`https://eporcha.tech/mouza-vittik-dag`)**
   - Generates and downloads the **Complete Mouza Dag Book PDF ("পূর্ণ মৌজা দাগ বই PDF ডাউনলোড")** mapping every serial Dag number in a Mouza to its corresponding Khatian numbers for `CS`, `SA`, `RS`, `BS`, or `Mutation`.
5. **`MOUZA_MAP` (`https://eporcha.tech/mouza-map`)**
   - Searches and downloads available Mouza Map sheets (`মৌজা ম্যাপ PDF`) by Mouza and Sheet number.
6. **`KHATIAN_INDEX` (`https://eporcha.tech/khatian-index`)**
   - Generates and downloads the **Complete Mouza Khatian Summary Index (`খতিয়ান সূচিপত্র`)**.

---

## 3. Target Geography (Primary Scope) & All Mouza Selection
Full cascading support for **Chittagong Division (চট্টগ্রাম বিভাগ)** and all 8 Divisions of Bangladesh, prioritizing:
- **Brahmanbaria District (ব্রাহ্মণবাড়িয়া জেলা):**
  - **Nabinagar Upazila (নবীনগর উপজেলা / থানা — All 176 Mouzas Pre-Indexed)** — including **20-No Kaitala South Union (২০নং কাইতলা দক্ষিণ ইউনিয়ন)** (`Goalai / গোয়ালী` JL-114, `Kaitala / কাইতলা` JL-115, `Noagaon / নোয়াগাঁও` JL-116, `Ramnagar / রামনগর` JL-117), plus all 21 Unions & Nabinagar Pourashava (Balia, Mehari, Nilkhi, Tilinagar, Kedarkhola, Bitghar, Jinodpur, Satmora, Rasullabad, Salimganj, Shyamgram, Boroikandi, Krishnanagar, Natghar, Ratanpur, Sreenagar, Vidyakut, etc. — **176 Mouzas total**).
  - **All Mouza Selection (`সকল মৌজা নির্বাচন`):** Selecting any Upazila counts, fetches, and selects **all Mouzas** within that Upazila (e.g., all **176 Mouzas** in Nabinagar Upazila) and generates the 7-Mouza batched download queue automatically.
  - All 9 Upazilas of Brahmanbaria: `Nabinagar`, `Brahmanbaria Sadar`, `Ashuganj`, `Sarail`, `Nasirnagar`, `Kasba`, `Akhaura`, `Bancharampur`, `Bijoynagar`.
- **Cumilla District (কুমিল্লা জেলা):**
  - `Muradnagar`, `Debidwar`, `Brahmanpara`, `Burichang`, `Cumilla Adarsha Sadar`, `Daudkandi`, `Homna`, `Chandina`.
- **Dynamic Mouza Discovery:** Live e-Porcha API discovery with strict parent-district validation and honest provenance (`LIVE_SOURCE` vs `LOCAL_DATASET` vs `FAILED` / `NOT_FOUND`).

---

## 4. Standardized Forensic File Naming in ZIP
- **Full Books:** `[District]_[Upazila]_[Mouza_JL]_[Survey]_[KHATIAN_BOOK | DAG_BOOK]_[Style].pdf`  
  *Example:* `Brahmanbaria_Nabinagar_JL-114_Goalai_RS_KHATIAN_BOOK_new-color.pdf`
- **Single Khatian:** `[District]_[Upazila]_[Mouza_JL]_[Survey]_Khatian-[No].pdf`  
  *Example:* `Brahmanbaria_Nabinagar_JL-114_Goalai_BS_Khatian-101.pdf`
- **Mouza Map:** `[District]_[Upazila]_[Mouza_JL]_[Survey]_MAP_Sheet-[No].pdf`

---

## 5. Anti-Hallucination & Binary Verification Gate
- **Zero Synthetic PDFs:** No mock blobs or fabricated files are ever created.
- **Structural PDF & Checksum Inspection (`src/services/binaryValidator.ts`):** Every PDF `ArrayBuffer` must begin with hex `25 50 44 46 2D` (`%PDF-`), include structural PDF markers (`obj`/`endobj`, `%%EOF`), exceed `1024` bytes, and record SHA-256 checksums over exact raw bytes before entering `IndexedDB` or `JSZip`.
- **Explicit Transport States:** If a request fails CORS or returns HTML/4xx/5xx from `eporcha.tech`, the task transitions to `CORS_BRIDGE_REQUIRED`, `NOT_AVAILABLE_ON_EPORCHA_TECH`, `FAILED_RETRY`, or `PERMANENT_FAILURE` with exact HTTP status code and diagnostics.
