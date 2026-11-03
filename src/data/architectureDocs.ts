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
      'Defines the 5 open-access eporcha.tech endpoints, forensic file naming, and %PDF- verification gate.',
    markdown: `# 01_PRD.md — Product Requirements Document (SKILL.md Equivalent)
**Project:** LRgetBD Pro (LR Mass Downloader / LandArchive BD v2.1 — \`eporcha.tech\` Open-Access Edition)  
**Target Portal:** \`https://eporcha.tech\` (Zero-Login, Open-Access Endpoints)  
**Platforms:** Mobile-First Web SPA + Capacitor 6 Android Native APK (\`bd.landarchive.lrgetbdpro\` · \`tapos-linx/LRgetBD-Pro\`)

## 1. Core Objective
Provide a 100% free, zero-payment, zero-hallucination bulk extraction, binary verification (\`%PDF-\`), and archival engine powered exclusively by **\`https://eporcha.tech\`** for Bangladesh land records. Do NOT use paid or login-walled portals (\`dlrms.land.gov.bd\` or \`eporcha.gov.bd\`).

## 2. Five Supported Document & Extraction Modes (\`EporchaDocType\`)
1. **\`SURVEY_KHATIAN\`**: Cascading lookup: Division → District → Upazila → Survey Type (CS, SA, RS, BS/BRS) → Mouza. Extracts Khatian list and individual Khatian PDFs.
2. **\`NAMJARI_KHATIAN\`**: Cascading lookup: District → Upazila → Mutation Survey → Mouza → Khatian/Dag/Owner extraction.
3. **\`MOUZA_KHATIAN_BOOK\`**: Generates and downloads the Complete Mouza Khatian Book PDF for CS, SA, RS, BS, or Mutation.
4. **\`MOUZA_DAG_BOOK\`**: Generates and downloads the Complete Mouza Dag Book PDF mapping serial Dag numbers to Khatian numbers.
5. **\`MOUZA_MAP\`**: Searches and downloads available Mouza Map sheets by Mouza and Sheet number.

## 3. Target Geography (Nationwide Discovery)
Full cascading support for all 8 Divisions and 64 Districts of Bangladesh. Verified live discovery logic fetches all Mouzas within an Upazila (e.g., 176 Mouzas in Nabinagar) automatically.

## 4. Standardized Forensic File Naming
- Full Books: \`[District]_[Upazila]_JL-[JL]_[Mouza]_[Survey]_[TYPE].pdf\`
- Single Khatian: \`[District]_[Upazila]_JL-[JL]_[Mouza]_[Survey]_Khatian-[No].pdf\``,
  },
  {
    id: 'doc-02-appflow',
    fileName: '/docs/02_AppFlow.md',
    equivalentName: 'README.md',
    titleEn: '02. Application State Machine & User Flow',
    titleBn: '০২. অ্যাপ্লিকেশন স্টেট মেশিন ও ইউজার ফ্লো',
    summary:
      'Details the 6-stage state machine including automated All Mouza Selection upon Upazila selection.',
    markdown: `# 02_AppFlow.md — Application State Machine & User Flow
## Cascading Filter & Mode State Machine
1. **\`IDLE / GEO_INIT\`**: Load Division & District hierarchy via Live Discovery.
2. **\`DISTRICT_SELECTED\`**: Unlock Upazila list; reset downstream selections.
3. **\`UPAZILA_SELECTED\`**: **All Mouza Selection** — counts, fetches, and selects all verified Mouzas within the selected Upazila automatically.
4. **\`DOC_MODE_CONFIGURED\`**: Select Document Modes and Survey Types.
5. **\`QUEUE_ACTIVE\`**: Sequential polite queue execution with 450ms–900ms jitter.
6. **\`ARCHIVE_READY\`**: Bundle all verified PDFs + forensic manifest into a single structured ZIP.`,
  },
  {
    id: 'doc-04-trd',
    fileName: '/docs/04_TRD.md',
    equivalentName: 'API_SPEC.md',
    titleEn: '04. Technical Requirements & Data Contracts',
    titleBn: '০৪. টেকনিক্যাল রিকোয়ারমেন্টস ও ডাটা কন্ট্রাক্টস',
    summary:
      'Dual-transport fetcher, %PDF- binary magic-byte gate, and polite queue engine.',
    markdown: `# 04_TRD.md — Technical Requirements & Data Contracts
## 1. Dual-Transport Fetcher
- **Android APK:** Uses \`CapacitorHttp\` to bypass CORS natively.
- **Web Browser:** Routes through Express Server Relay (\`/api/eporcha-proxy\`).

## 2. Binary Verification Gate
- Inspects \`ArrayBuffer\` first 5 bytes: must start with \`25 50 44 46 2D\` (\`%PDF-\`).
- Minimum byte gate: \`> 1024 bytes\`.

## 3. Polite Queue Engine
- Concurrency: 1-3 parallel requests.
- Delay: 450ms–900ms polite jitter.
- Persistence: \`IndexedDB\` (\`lr_eporcha_blobs_v2\`).

## 4. Official GitHub Coordinates
- **Repository:** \`tapos-linx/LRgetBD-Pro\`
- **Android Package ID:** \`bd.landarchive.lrgetbdpro\`
- **Release APK:** [\`LRgetBD-Pro.apk\`](https://github.com/tapos-linx/LRgetBD-Pro/releases/latest/download/LRgetBD-Pro.apk)`,
  },
  {
    id: 'doc-06-plan',
    fileName: '/docs/06_Plan.md',
    equivalentName: 'ROADMAP.md',
    titleEn: '06. Implementation & APK Pipeline Plan',
    titleBn: '০৬. ইমপ্লিমেন্টেশন ও APK পাইপলাইন প্ল্যান',
    summary:
      'Roadmap covering live discovery, dual-transport client, and automated APK release workflow.',
    markdown: `# 06_Plan.md — Implementation Plan
- **Phase 1:** Strict TypeScript models and Architecture documentation.
- **Phase 2:** Live Geographic Discovery Service and Firestore normalization.
- **Phase 3:** Polite Queue Engine with binary verification and structured ZIP export.
- **Phase 4:** Automated GitHub Actions APK release pipeline (\`tapos-linx/LRgetBD-Pro\`).`,
  },
];
