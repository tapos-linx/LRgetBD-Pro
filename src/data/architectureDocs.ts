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
      'Defines the 6 open-access eporcha.tech endpoints, forensic file naming, and structural %PDF- verification gate.',
    markdown: `# 01_PRD.md — Product Requirements Document (SKILL.md Equivalent)
**Project:** LRgetBD Pro (LandArchive BD v2.1 — \`eporcha.tech\` Open-Access Edition)  
**Target Portal:** \`https://eporcha.tech\` (Zero-Login, Open-Access Endpoints)  
**Platforms:** React/Vite/Express Web App + Capacitor 8 Android APK (\`bd.landarchive.lrgetbdpro\` · \`tapos-linx/LRgetBD-Pro\`)

## 1. Core Objective
Provide a 100% free, zero-payment, zero-hallucination bulk extraction, binary verification (\`%PDF-\`), and archival engine powered exclusively by **\`https://eporcha.tech\`** for Bangladesh land records.

## 2. Six Supported Document & Extraction Modes (\`EporchaEndpointType\`)
1. **\`SURVEY_KHATIAN\`**: Cascading lookup: Division → District → Upazila → Survey Type (CS, SA, RS, BS) → Mouza.
2. **\`NAMJARI_KHATIAN\`**: Cascading lookup: District → Upazila → Mutation Survey → Mouza.
3. **\`MOUZA_KHATIAN_BOOK\`**: Generates and downloads the Complete Mouza Khatian Book PDF for CS, SA, RS, BS, or Mutation.
4. **\`MOUZA_DAG_BOOK\`**: Generates and downloads the Complete Mouza Dag Book PDF mapping serial Dag numbers to Khatian numbers.
5. **\`MOUZA_MAP\`**: Searches and downloads available Mouza Map sheets by Mouza and Sheet number.
6. **\`KHATIAN_INDEX\`**: Generates and downloads the Complete Mouza Khatian Index summary.

## 3. Target Geography & Provenance
Cascading support across Bangladesh divisions/districts with strict parent-child validation and explicit provenance (\`LIVE_SOURCE\` vs \`LOCAL_DATASET\` vs \`FAILED\`/\`NOT_FOUND\`).`,
  },
  {
    id: 'doc-02-appflow',
    fileName: '/docs/02_AppFlow.md',
    equivalentName: 'README.md',
    titleEn: '02. Application State Machine & User Flow',
    titleBn: '০২. অ্যাপ্লিকেশন স্টেট মেশিন ও ইউজার ফ্লো',
    summary:
      'Details the 6-stage state machine including 7-Mouza batching and durable queue recovery.',
    markdown: `# 02_AppFlow.md — Application State Machine & User Flow
## Cascading Filter & Mode State Machine
1. **\`IDLE / GEO_INIT\`**: Load Division & District hierarchy with honest provenance.
2. **\`DISTRICT_SELECTED\`**: Discover District Upazilas; reset downstream selections cleanly.
3. **\`UPAZILA_SELECTED\`**: Count and fetch Mouzas within the selected Upazila.
4. **\`DOC_MODE_CONFIGURED\`**: Select among 6 Document Modes and 5 Survey Types (Select All / Clear All supported).
5. **\`QUEUE_ACTIVE\`**: Group unique Mouzas into 7-Mouza batches and run durable queue execution with transient-only retries.
6. **\`ARCHIVE_READY\`**: Bundle structurally verified PDFs + SHA-256 forensic manifest into a structured ZIP.`,
  },
  {
    id: 'doc-04-trd',
    fileName: '/docs/04_TRD.md',
    equivalentName: 'API_SPEC.md',
    titleEn: '04. Technical Requirements & Data Contracts',
    titleBn: '০৪. টেকনিক্যাল রিকোয়ারমেন্টস ও ডাটা কন্ট্রাক্টস',
    summary:
      'Dual-transport fetcher, structural %PDF- + SHA-256 verification gate, and 7-Mouza queue engine.',
    markdown: `# 04_TRD.md — Technical Requirements & Data Contracts
## 1. Dual-Transport Fetcher
- **Android APK (Capacitor 8):** Uses \`CapacitorHttp\` to bypass browser CORS natively.
- **Web Browser:** Routes through Express Server Relay (\`/api/eporcha-proxy\`).

## 2. Structural Binary Verification Gate
- Verifies \`%PDF-\` magic header (\`25 50 44 46 2D\`), PDF object/EOF markers, and \`> 1024 bytes\`.
- Computes SHA-256 over exact downloaded bytes and rejects HTML/JSON error responses cleanly.

## 3. Repository Coordinates
- **Repository:** \`tapos-linx/LRgetBD-Pro\`
- **Android Package ID:** \`bd.landarchive.lrgetbdpro\`
- **CI Debug APK Artifact:** \`LRgetBD-Pro-debug.apk\``,
  },
  {
    id: 'doc-06-plan',
    fileName: '/docs/06_Plan.md',
    equivalentName: 'ROADMAP.md',
    titleEn: '06. Implementation & APK Pipeline Plan',
    titleBn: '০৬. ইমপ্লিমেন্টেশন ও APK পাইপলাইন প্ল্যান',
    summary:
      'Roadmap covering honest geographic discovery, 7-Mouza queue engine, and GitHub Actions Debug APK CI.',
    markdown: `# 06_Plan.md — Implementation Plan
- **Phase 1:** Strict TypeScript models and 6-Document architecture documentation.
- **Phase 2:** Geographic Discovery Service with strict parent-child validation and honest Firestore provenance.
- **Phase 3:** 7-Mouza Batched Queue Engine with structural PDF validation, SHA-256 digests, and ZIP export.
- **Phase 4:** Capacitor 8 Android packaging (\`android/\`) and deterministic GitHub Actions Debug APK CI (\`tapos-linx/LRgetBD-Pro\`).`,
  },
];
