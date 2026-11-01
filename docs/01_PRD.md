# 01_PRD.md — Product Requirements Document (SKILL.md Equivalent)
**Project:** LRgetBD Pro (LR Mass Downloader / LandArchive BD v2.1 — `eporcha.tech` Open-Access Edition)  
**Target Portal:** `https://eporcha.tech` (Zero-Login, Open-Access Endpoints)  
**Platforms:** Mobile-First Web SPA + Capacitor 6 Android Native APK (`bd.landarchive.lrgetbdpro` · `tapos-linx/LR_Mass_Downloader`)

---

## 1. Core Objective
Provide a 100% free, zero-payment, zero-hallucination bulk extraction, binary verification (`%PDF-`), and archival engine powered exclusively by **`https://eporcha.tech`** for Bangladesh land records. Do NOT use paid or login-walled portals (`dlrms.land.gov.bd` or `eporcha.gov.bd`).

---

## 2. Five Supported Document & Extraction Modes (`EporchaDocType`)

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

---

## 3. Target Geography (Primary Scope)
Full cascading support for **Chittagong Division (চট্টগ্রাম বিভাগ)**, prioritizing:
- **Brahmanbaria District (ব্রাহ্মণবাড়িয়া জেলা):**
  - **Nabinagar Upazila (নবীনগর উপজেলা)** — including **20-No Kaitala South Union (২০নং কাইতলা দক্ষিণ ইউনিয়ন)** (`Goalai / গোয়ালী` JL-114, `Kaitala / কাইতলা` JL-115, `Noagaon / নোয়াগাঁও` JL-116, `ramnagar / রামনগর` JL-117), plus Balia, Mehari, Nilkhi, Tilinagar, Kedarkhola, Bitghar, Jinodpur, Satmora, Rasullabad, Salimganj, Shyamgram, Boroikandi, Krishnanagar, Natghar, Ratanpur, Sreenagar, Vidyakut, etc.
  - All 9 Upazilas of Brahmanbaria: `Nabinagar`, `Brahmanbaria Sadar`, `Ashuganj`, `Sarail`, `Nasirnagar`, `Kasba`, `Akhaura`, `Bancharampur`, `Bijoynagar`.
- **Cumilla District (কুমিল্লা জেলা):**
  - `Muradnagar`, `Debidwar`, `Brahmanpara`, `Burichang`, `Cumilla Adarsha Sadar`, `Daudkandi`, `Homna`, `Chandina`.
- **Dynamic Mouza Discovery:** Custom JL Number & Mouza registration directly bound to `eporcha.tech` query paths.

---

## 4. Standardized Forensic File Naming in ZIP
- **Full Books:** `[District]_[Upazila]_[Mouza_JL]_[Survey]_[KHATIAN_BOOK | DAG_BOOK]_[Style].pdf`  
  *Example:* `Brahmanbaria_Nabinagar_JL-114_Goalai_RS_KHATIAN_BOOK_new-color.pdf`
- **Single Khatian:** `[District]_[Upazila]_[Mouza_JL]_[Survey]_Khatian-[No].pdf`  
  *Example:* `Brahmanbaria_Nabinagar_JL-114_Goalai_BS_Khatian-101.pdf`
- **Mouza Map:** `[District]_[Upazila]_[Mouza_JL]_[Survey]_MAP_Sheet-[No].pdf`

---

## 5. Anti-Hallucination & Binary Verification Gate
- **Zero Synthetic PDFs:** No mock blobs or LLM-fabricated files are ever created.
- **Magic-Byte Inspection (`src/services/binaryValidator.ts`):** Every PDF `ArrayBuffer` must begin with hex `25 50 44 46 2D` (`%PDF-`) and exceed `1024` bytes before entering `IndexedDB` or `JSZip`.
- **Explicit Transport States:** If a request fails CORS or returns HTML/404 from `eporcha.tech`, the task transitions to `CORS_BRIDGE_REQUIRED` or `NOT_AVAILABLE_ON_EPORCHA_TECH` with the exact HTTP status code and response header diagnostics.
