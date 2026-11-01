export interface ArchitectureDocItem {
  id: string;
  fileName: string;
  equivalentName: string;
  titleEn: string;
  titleBn: string;
  summary: string;
  markdown: string;
}

export const ARCHITECTURE_DOCS: ArchitectureDocItem[] = [
  {
    id: 'doc-01-prd',
    fileName: '/docs/01_PRD.md',
    equivalentName: 'SKILL.md',
    titleEn: '01. Product Requirements Document (PRD)',
    titleBn: '০১. প্রোডাক্ট রিকোয়ারমেন্টস ডকুমেন্ট (eporcha.tech)',
    summary:
      'Defines the 5 open-access eporcha.tech endpoints, Brahmanbaria/Nabinagar/20-No Kaitala South Union scope, forensic file naming, and %PDF- verification gate.',
    markdown: `# 01_PRD.md — Product Requirements Document (SKILL.md Equivalent)
**Project:** LRgetBD Pro (LR Mass Downloader / LandArchive BD v2.1 — \`eporcha.tech\` Open-Access Edition)  
**Target Portal:** \`https://eporcha.tech\` (Zero-Login, Open-Access Endpoints)  
**Platforms:** Mobile-First Web SPA + Capacitor 6 Android Native APK (\`bd.landarchive.lrgetbdpro\` · \`tapos-linx/LRgetBD-Pro\`)

## 1. Core Objective
Provide a 100% free, zero-payment, zero-hallucination bulk extraction, binary verification (\`%PDF-\`), and archival engine powered exclusively by **\`https://eporcha.tech\`** for Bangladesh land records. Do NOT use paid or login-walled portals (\`dlrms.land.gov.bd\` or \`eporcha.gov.bd\`).

## 2. Five Supported Document & Extraction Modes (\`EporchaDocType\`)
1. **\`SURVEY_KHATIAN\` (\`https://eporcha.tech/survey-khatian\`)**: Cascading lookup: Division → District → Upazila → Survey Type (CS, SA, RS, BS/BRS) → Mouza (মৌজা ও JL নম্বর). Extracts Khatian list and individual Khatian PDFs.
2. **\`NAMJARI_KHATIAN\` (\`https://eporcha.tech/namjari-khatian\`)**: Cascading lookup: District → Upazila → Mutation Survey → Mouza → Khatian/Dag/Owner extraction.
3. **\`MOUZA_KHATIAN_BOOK\` (\`https://eporcha.tech/mouza-vittik-khatian\`)**: Generates and downloads the Complete Mouza Khatian Book PDF ("পূর্ণ মৌজা PDF ডাউনলোড") for CS, SA, RS, BS, or Mutation, supporting format variants (\`নতুন ধরন\` / \`পুরনো ধরন\` and \`রঙিন\` / \`সাদা-কালো\`).
4. **\`MOUZA_DAG_BOOK\` (\`https://eporcha.tech/mouza-vittik-dag\`)**: Generates and downloads the Complete Mouza Dag Book PDF ("পূর্ণ মৌজা দাগ বই PDF ডাউনলোড") mapping every serial Dag number in a Mouza to its corresponding Khatian numbers.
5. **\`MOUZA_MAP\` (\`https://eporcha.tech/mouza-map\`)**: Searches and downloads available Mouza Map sheets (\`মৌজা ম্যাপ PDF\`) by Mouza and Sheet number.

## 3. Target Geography (Primary Scope)
Full cascading support for **Chittagong Division**, prioritizing **Brahmanbaria District** (specifically **Nabinagar Upazila** — including **20-No Kaitala South Union**, **Goalai / গোয়ালী** JL-114, **Kaitala / কাইতলা** JL-115, Noagaon JL-116, Ramnagar JL-117, and all 9 Upazilas of Brahmanbaria) and **Cumilla District**.

## 4. Standardized Forensic File Naming in ZIP
- Full Books: \`[District]_[Upazila]_JL-[Mouza_JL]_[Mouza]_[Survey]_[KHATIAN_BOOK | DAG_BOOK]_[Style].pdf\`
- Single Khatian: \`[District]_[Upazila]_JL-[Mouza_JL]_[Mouza]_[Survey]_Khatian-[No].pdf\``,
  },
  {
    id: 'doc-02-appflow',
    fileName: '/docs/02_AppFlow.md',
    equivalentName: 'README.md',
    titleEn: '02. Application State Machine & User Flow',
    titleBn: '০২. অ্যাপ্লিকেশন স্টেট মেশিন ও ইউজার ফ্লো',
    summary:
      'Details the 6-stage state machine including automatic 100% Mouza selection upon Upazila selection and sequential queue execution.',
    markdown: `# 02_AppFlow.md — Application State Machine & User Flow (README.md Equivalent)

## Cascading Filter & Mode State Machine
1. **\`IDLE / GEO_INIT\`**: Load Division & District hierarchy (\`Chittagong\` → \`Brahmanbaria\`, \`Cumilla\`).
2. **\`DISTRICT_SELECTED\`**: Unlock Upazila list; reset downstream selections.
3. **\`UPAZILA_SELECTED\`**: **Automatically pre-select 100% of Mouzas** under the selected Upazila by default (with quick toggle for \`All 100%\` / \`None\` / \`20-No Kaitala South Union Filter\` / Search by JL No. or Bengali/English name).
4. **\`DOC_MODE_AND_SURVEY_CONFIGURED\`**:
   - Select Document Mode: \`Full Mouza Khatian Book PDF\`, \`Full Mouza Dag Book PDF\`, \`Survey Khatian Batch\`, \`Namjari Khatian Batch\`, or \`Mouza Map\`.
   - Select Survey Types: \`CS\`, \`SA\`, \`RS\`, \`BS/BRS\`, \`Mutation\`.
   - For Khatian Books, select Book Format (\`নতুন/পুরনো\`, \`রঙিন/সাদা-কালো\`).
5. **\`QUEUE_ACTIVE\`**: Sequential state machine (\`QUEUED\` → \`FETCHING_EPORCHA_TECH\` → \`MAGIC_BYTE_VERIFIED\` → \`CACHED_INDEXEDDB\` | \`CORS_BRIDGE_REQUIRED\`).
6. **\`ARCHIVE_READY\`**: Bundle all verified PDFs + \`MANIFEST_AUDIT.csv\` and \`MANIFEST_AUDIT.md\` into a single downloadable \`.zip\` archive.`,
  },
  {
    id: 'doc-03-uispec',
    fileName: '/docs/03_UI_Spec.md',
    equivalentName: 'UI_SPEC.md',
    titleEn: '03. Material Design 3 Mobile-First UI Spec',
    titleBn: '০৩. ম্যাটেরিয়াল ডিজাইন ৩ ইউজার ইন্টারফেস স্পেসিফিকেশন',
    summary:
      'Dark Slate & Emerald/Gold high-contrast specification optimized for Oppo A5 Pro (ColorOS 16 / Android 16) and 1440px desktop viewports.',
    markdown: `# 03_UI_Spec.md — Material Design 3 Mobile-First UI Specification

## 1. Design System
- **Palette:** Material Design 3 (MD3) Dark Slate & Emerald/Gold high-contrast palette optimized for **Oppo A5 Pro (ColorOS 16 / Android 16)** and desktop browsers.
- **Bilingual Typography:** Clean Bengali (\`Hind Siliguri\`) and English (\`Plus Jakarta Sans\` + \`JetBrains Mono\` with \`tabular-nums\`).

## 2. Core Components
- **Top App Bar:** Shows brand wordmark, single-line workspace navigation, and Android APK installer modal trigger.
- **5-Mode Selector Cards:** Quick-switch buttons for *Survey Khatian*, *Namjari Khatian*, *Mouza Khatian Book (পূর্ণ মৌজা খতিয়ান বই)*, *Mouza Dag Book (পূর্ণ মৌজা দাগ বই)*, and *Mouza Map*.
- **Cascading Geo Filter & 100% Mouza Chip Grid:** Auto-selects 100% of Mouzas when an Upazila (e.g., Nabinagar) is chosen.
- **Live Queue Console:** Displays real HTTP status codes, file size in KB/MB, \`%PDF-\` verification badge, and one-click direct open on \`https://eporcha.tech/...\`.`,
  },
  {
    id: 'doc-04-trd',
    fileName: '/docs/04_TRD.md',
    equivalentName: 'API_SPEC.md',
    titleEn: '04. Technical Requirements & Data Contracts',
    titleBn: '০৪. টেকনিক্যাল রিকোয়ারমেন্টস ও ডাটা কন্ট্রাক্টস',
    summary:
      'Dual-transport fetcher (CapacitorHttp + Express/Termux/Cloudflare proxy), %PDF- binary magic-byte gate, and polite 600–1200ms queue engine.',
    markdown: `# 04_TRD.md — Technical Requirements & Data Contracts (API_SPEC.md Equivalent)

## 1. Dual-Transport Fetcher (\`src/services/eporchaTechClient.ts\`)
- **On Android APK (Capacitor Runtime):** Uses \`CapacitorHttp.request()\` from \`@capacitor/core\` (enabled in \`capacitor.config.json\` with \`"CapacitorHttp": { "enabled": true }\`) to bypass browser CORS natively on the user's phone.
- **On Web Browser:** Routes requests through the built-in Express Server Relay (\`/api/eporcha-proxy\`), a local Termux Proxy (\`http://127.0.0.1:8787/proxy?url=\`), or a user-defined Cloudflare Worker URL.

## 2. Binary Magic-Byte & Payload Verification Gate (\`src/services/binaryValidator.ts\`)
- Inspects \`ArrayBuffer\` first 5 bytes: a valid PDF MUST start with hex \`25 50 44 46 2D\` (\`%PDF-\`) and have \`byteLength > 1024\`.
- Parses HTML/JSON Khatian & Dag tables from \`eporcha.tech\` responses into structured \`KhatianRecord\` rows.

## 3. Polite Anti-Crash Sequential Queue (\`src/services/queueEngine.ts\`)
- Concurrency limited to \`1–2\` parallel requests with \`600ms–1200ms\` polite delay jitter.
- Streams verified PDF blobs directly to \`IndexedDB\` (\`lr_eporcha_blobs_v2\`).

## 4. Official GitHub Release Coordinates (\`src/config/repoConfig.ts\`)
- **Repository:** \`tapos-linx/LRgetBD-Pro\`
- **Android Package ID:** \`bd.landarchive.lrgetbdpro\` (\`LRgetBD Pro\`)
- **Standard Release APK:** \`LRgetBD-Pro.apk\` (\`https://github.com/tapos-linx/LRgetBD-Pro/releases/latest/download/LRgetBD-Pro.apk\`)
- **Releases API:** \`https://api.github.com/repos/tapos-linx/LRgetBD-Pro/releases/latest\``,
  },
  {
    id: 'doc-05-schema',
    fileName: '/docs/05_Schema.md',
    equivalentName: 'MEMORY.md',
    titleEn: '05. Geographic Hierarchy & Storage Schema',
    titleBn: '০৫. ভৌগোলিক হায়ারার্কি ও স্টোরেজ স্কিমা',
    summary:
      'Brahmanbaria (all 9 Upazilas, Nabinagar, 20-No Kaitala South Union: Goalai JL-114, Kaitala JL-115) & Cumilla hierarchy plus IndexedDB stores.',
    markdown: `# 05_Schema.md — Geographic Hierarchy & Storage Schema (MEMORY.md Equivalent)

## 1. Authoritative Geographic Dataset (\`src/data/geoHierarchy.ts\`)
- **Brahmanbaria District (Code 12):**
  - **Nabinagar Upazila:** 24 Mouzas pre-indexed, highlighting **20-No Kaitala South Union (২০নং কাইতলা দক্ষিণ ইউনিয়ন)** — \`Goalai / গোয়ালী (JL-114)\`, \`Kaitala / কাইতলা (JL-115)\`, \`Noagaon / নোয়াগাঁও (JL-116)\`, \`Ramnagar / রামনগর (JL-117)\`, plus Balia, Mehari, Nilkhi, Tilinagar, Kedarkhola, Bitghar, Satmora, Rasullabad, Salimganj, Shyamgram, Boroikandi, Krishnanagar, Krishnanagar, Natghar, Ratanpur, Sreenagar, Vidyakut.
  - All 9 Upazilas: Nabinagar, Brahmanbaria Sadar, Kasba, Ashuganj, Sarail, Nasirnagar, Akhaura, Bancharampur, Bijoynagar.
- **Cumilla District (Code 19):** Muradnagar, Debidwar, Brahmanpara.

## 2. Persistence Schema (\`IndexedDB\` & \`localStorage\`)
- \`lr_eporcha_queue_v2\`: Active/paused download queue tasks in \`localStorage\`.
- \`lr_eporcha_blobs_v2\`: Verified \`%PDF-\` binary \`ArrayBuffer\` records in \`IndexedDB\`.
- \`lr_eporcha_records_v2\`: Extracted Khatian/Dag tabular index searchable offline inside the app.`,
  },
  {
    id: 'doc-06-plan',
    fileName: '/docs/06_Plan.md',
    equivalentName: 'ROADMAP.md',
    titleEn: '06. 4-Phase Implementation & APK Pipeline Plan',
    titleBn: '০৬. ৪-ধাপের ইমপ্লিমেন্টেশন ও APK পাইপলাইন প্ল্যান',
    summary:
      'Roadmap covering docs, dual-transport client, %PDF- validator, IndexedDB queue engine, CapacitorHttp config, and GitHub Actions APK release workflow.',
    markdown: `# 06_Plan.md — 4-Phase Implementation Plan (ROADMAP.md Equivalent)

- **Phase 1:** Generate all 6 \`/docs/*.md\` files, strict TypeScript models (\`src/types/land.ts\`), and the Brahmanbaria/Cumilla dataset (\`src/data/geoHierarchy.ts\`).
- **Phase 2:** Implement \`src/services/eporchaTechClient.ts\` (dual Capacitor Native HTTP + Web/Server Proxy transport for all 5 \`eporcha.tech\` endpoints) and \`src/services/binaryValidator.ts\` (\`%PDF-\` magic-byte verifier).
- **Phase 3:** Build the Sequential Queue Engine, \`IndexedDB\` storage service, \`JSZip\` bundler, and Material Design 3 Bilingual UI.
- **Phase 4:** Configure \`capacitor.config.json\` (\`bd.landarchive.lrgetbdpro\`, \`CapacitorHttp.enabled = true\`) and \`.github/workflows/build-apk.yml\` for automated GitHub Releases APK publishing (\`tapos-linx/LRgetBD-Pro\` -> \`LRgetBD-Pro.apk\`).`,
  },
];
