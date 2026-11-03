# 05_Schema.md — Geographic Hierarchy & Storage Schema (MEMORY.md Equivalent)
**Project:** LR Mass Downloader (LandArchive BD / LRgetBD v2.1)

---

## 1. Authoritative Geographic Dataset (`src/data/geoHierarchy.ts`)

### Division: Chittagong (`চট্টগ্রাম বিভাগ`)
1. **Brahmanbaria District (`ব্রাহ্মণবাড়িয়া জেলা` — Code `12`):**
   - **Nabinagar Upazila (`নবীনগর উপজেলা / থানা` — All 176 Mouzas Pre-Indexed across 21 Unions & Nabinagar Pourashava):**
     - **20-No Kaitala South Union (`২০নং কাইতলা দক্ষিণ ইউনিয়ন`):**
       - `JL-114`: **Goalai (`গোয়ালী`)**, `JL-115`: **Kaitala (`কাইতলা`)**, `JL-116`: **Noagaon (`নোয়াগাঁও`)**, `JL-117`: **Ramnagar (`রামনগর`)**, `JL-154`: **Kaitala Dakshin (`কাইতলা দক্ষিণ`)**, `JL-155`: **Goalai Purba (`গোয়ালী পূর্ব`)**, `JL-156`: **Goalai Paschim (`গোয়ালী পশ্চিম`)**, `JL-157`: **Matikata (`মাটিকাটা`)**, `JL-158`: **Shankarpasha (`শংকরপাশা`)**
     - **All 21 Unions & Nabinagar Pourashava (176 Total Mouzas):**
       - Covers `Nabinagar Pourashava`, `Barail`, `Birgaon`, `Krishnanagar`, `Natghar`, `Bidyakut`, `Nabinagar East`, `Nabinagar West`, `Kaitala North`, `Bitghar`, `Shibpur`, `Jinodpur`, `Laur Fatehpur`, `Ibrahimpur`, `Rasullabad`, `Satmora`, `Shampur`, `Barikandi`, `Salimganj`, `Ratanpur`, `20-No Kaitala South`, `Sreerampur`, `Mehari`, `Balia`, and `Majhigachha` Unions (**176 Mouzas** automatically counted, fetched, and selected upon choosing Nabinagar Upazila).
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
