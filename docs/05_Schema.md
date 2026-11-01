# 05_Schema.md — Geographic Hierarchy & Storage Schema (MEMORY.md Equivalent)
**Project:** LR Mass Downloader (LandArchive BD / LRgetBD v2.1)

---

## 1. Authoritative Geographic Dataset (`src/data/geoHierarchy.ts`)

### Division: Chittagong (`চট্টগ্রাম বিভাগ`)
1. **Brahmanbaria District (`ব্রাহ্মণবাড়িয়া জেলা` — Code `12`):**
   - **Nabinagar Upazila (`নবীনগর উপজেলা`):**
     - **20-No Kaitala South Union (`২০নং কাইতলা দক্ষিণ ইউনিয়ন`):**
       - `JL-114`: **Goalai (`গোয়ালী`)**
       - `JL-115`: **Kaitala (`কাইতলা`)**
       - `JL-116`: **Noagaon (`নোয়াগাঁও`)**
       - `JL-117`: **Ramnagar (`রামনগর`)**
     - **Other Nabinagar Unions & Key Mouzas:**
       - `JL-101`: **Nabinagar Sadar (`নবীনগর সদর`)**
       - `JL-102`: **Alamnagar (`আলমনগর`)**
       - `JL-103`: **Narayanpur (`নারায়ণপুর`)**
       - `JL-104`: **Vola (`ভোলাচং`)**
       - `JL-105`: **Balia (`বালিয়া`)** — Balia Union
       - `JL-106`: **Mehari (`মেহারী`)** — Mehari Union
       - `JL-107`: **Nilkhi (`নীলখী`)** — Jinodpur Union
       - `JL-108`: **Tilinagar (`তিলীনগর`)** — Kaitala North Union
       - `JL-109`: **Kedarkhola (`কেদারখোলা`)** — Bitghar Union
       - `JL-110`: **Bitghar (`বিটঘর`)** — Bitghar Union
       - `JL-111`: **Satmora (`সাতমোড়া`)** — Satmora Union
       - `JL-112`: **Rasullabad (`রসুল্লাবাদ`)** — Rasullabad Union
       - `JL-113`: **Salimganj (`সলিমগঞ্জ`)** — Salimganj Union
       - `JL-118`: **Shyamgram (`শ্যামগ্রাম`)** — Shyamgram Union
       - `JL-119`: **Boroikandi (`বড়িকান্দি`)** — Boroikandi Union
       - `JL-120`: **Krishnanagar (`কৃষ্ণনগর`)** — Krishnanagar Union
       - `JL-121`: **Natghar (`নাটঘর`)** — Natghar Union
       - `JL-122`: **Ratanpur (`রতনপুর`)** — Ratanpur Union
       - `JL-123`: **Sreenagar (`শ্রীনগর`)** — Sreenagar Union
       - `JL-124`: **Vidyakut (`বিদ্যাকুট`)** — Vidyakut Union
   - **Other 8 Upazilas of Brahmanbaria:**
     - `Brahmanbaria Sadar (ব্রাহ্মণবাড়িয়া সদর)`
     - `Ashuganj (আশুগঞ্জ)`
     - `Sarail (সরাইল)`
     - `Nasirnagar (নাসিরনগর)`
     - `Kasba (কসবা)`
     - `Akhaura (আখাউড়া)`
     - `Bancharampur (বাঞ্ছারামপুর)`
     - `Bijoynagar (বিজয়নগর)`
2. **Cumilla District (`কুমিল্লা জেলা` — Code `19`):**
   - `Muradnagar (মুরাদনগর)`, `Debidwar (দেবিদ্বার)`, `Brahmanpara (ব্রাহ্মণপাড়া)`, `Burichang (বুড়িচং)`, `Cumilla Adarsha Sadar (কুমিল্লা আদর্শ সদর)`, `Daudkandi (দাউদকান্দি)`, `Homna (হোমনা)`, `Chandina (চান্দিনা)`.

---

## 2. Persistence Schema (`IndexedDB` & `localStorage`)

### `localStorage` Keys
- `lr_eporcha_queue_v2`: Serialized array of `QueueTask` objects (excluding raw binary blobs).
- `lr_eporcha_proxy_config_v2`: User-configured transport settings (`mode`, `customProxyUrl`, `concurrency`, `delayMs`).

### `IndexedDB` Database: `LandArchiveBD_v2`
1. **Object Store: `lr_eporcha_blobs_v2` (KeyPath: `taskId`)**
   - `taskId`: `string`
   - `fileName`: `string`
   - `mimeType`: `'application/pdf'`
   - `byteLength`: `number`
   - `magicHex`: `string` (`25 50 44 46 2D`)
   - `sha256Preview`: `string`
   - `buffer`: `ArrayBuffer`
   - `verifiedAt`: `string` (ISO-8601)
2. **Object Store: `lr_eporcha_records_v2` (KeyPath: `recordId`)**
   - `recordId`: `string` (`[mouzaId]_[survey]_[khatianNo]`)
   - `districtName`: `string`
   - `upazilaName`: `string`
   - `unionName`: `string`
   - `mouzaNameBn`: `string`
   - `mouzaJlNo`: `string`
   - `surveyType`: `SurveyType`
   - `khatianNo`: `string`
   - `ownerName`: `string`
   - `dagNo`: `string`
   - `totalLandAcres`: `string`
   - `sourceUrl`: `string`
   - `extractedAt`: `string`
