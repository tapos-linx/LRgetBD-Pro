# 02_AppFlow.md — Application State Machine & User Flow (README.md Equivalent)
**Project:** LR Mass Downloader (LandArchive BD / LRgetBD v2.1)

---

## 1. Cascading Filter & Mode State Machine

```
[1. IDLE / GEO_INIT]
       │  Load Division (Chittagong) & Districts (Brahmanbaria, Cumilla)
       ▼
[2. DISTRICT_SELECTED]
       │  Unlock Upazilas (Nabinagar, Sadar, Kasba, etc.); reset downstream
       ▼
[3. UPAZILA_SELECTED]
       │  ALL MOUZA SELECTION (সকল মৌজা নির্বাচন) within the selected Upazila (e.g., all 176 Mouzas in Nabinagar)
       │  Filter by Union (e.g. 20-No Kaitala South Union) or JL/Name search
       ▼
[4. DOC_MODE_AND_SURVEY_CONFIGURED]
       │  Select Mode: Mouza Khatian Book | Mouza Dag Book | Survey Khatian | Namjari | Map | Khatian Index
       │  Select Surveys: CS | SA | RS | BS | MUTATION
       │  Configure Style: নতুন/পুরনো (New/Old) + রঙিন/সাদা-কালো (Color/B&W)
       ▼
[5. QUEUE_ACTIVE]
       │  7-Mouza Batches → QUEUED → FETCHING_EPORCHA_TECH → CACHED_INDEXEDDB
       │                                                   └→ FAILED_RETRY / PERMANENT_FAILURE / CANCELLED
       ▼
[6. ARCHIVE_READY]
       └── Bundle Verified PDFs + MANIFEST_AUDIT.csv + MANIFEST_AUDIT.md into .zip
```

---

## 2. Step-by-Step User Journey

1. **Step 1 — Select Extraction Mode (`EporchaEndpointType`):**
   - Choose among *Mouza Khatian Book (`পূর্ণ মৌজা খতিয়ান বই`)*, *Mouza Dag Book (`পূর্ণ মৌজা দাগ বই`)*, *Survey Khatian (`সার্ভে খতিয়ান`)*, *Namjari Khatian (`নামজারি খতিয়ান`)*, *Mouza Map (`মৌজা ম্যাপ`)*, and *Khatian Index (`খতিয়ান সূচিপত্র`)*.
2. **Step 2 — Cascading Geography & All Mouza Selection (`সকল মৌজা নির্বাচন`):**
   - Selecting an Upazila (such as **Nabinagar**) counts, fetches, and selects **all Mouzas within that Upazila** (all **176 Mouzas** in Nabinagar) and generates the 7-Mouza batched download queue.
   - Users can narrow down to **20-No Kaitala South Union** (`Goalai / গোয়ালী`, `Kaitala / কাইতলা`, etc.) with a single union filter button or search box.
3. **Step 3 — Survey & Book Format Configuration:**
   - Multi-select surveys (`CS`, `SA`, `RS`, `BS`, `MUTATION`) with full Select All / Clear All controls.
   - When downloading Full Mouza Khatian Books (`/mouza-vittik-khatian`), choose Layout (`নতুন ধরন` / `পুরনো ধরন`) and Color (`রঙিন` / `সাদা-কালো`).
4. **Step 4 — Polite Sequential Queue Execution:**
   - Enqueue deduplicated 7-Mouza batches into `lr_eporcha_queue_v2` while preserving completed downloads.
   - The Queue Engine executes concurrent workers with adaptive jitter delay via Capacitor Native HTTP (on Android APK) or Express/Termux/Cloudflare Relay (on Web).
5. **Step 5 — Binary Verification & ZIP Packaging:**
   - Every response is checked for `%PDF-` (`0x25 0x50 0x44 0x46 0x2D`), structural PDF markers (`obj`/`endobj`, `%%EOF`), `byteLength > 1024`, and SHA-256 digest calculation.
   - Verified blobs are stored in IndexedDB (`lr_eporcha_blobs_v2`) and packaged with `MANIFEST_AUDIT.csv` and `MANIFEST_AUDIT.md` into a single `.zip` download.
