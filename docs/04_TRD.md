# 04_TRD.md — Technical Requirements & Data Contracts (API_SPEC.md Equivalent)
**Project:** LRgetBD Pro (LandArchive BD v2.1)  
**Official Repository:** `tapos-linx/LRgetBD-Pro` (`bd.landarchive.lrgetbdpro`)

---

## 1. Technology Stack & Repository Coordinates
- **Frontend:** React 19, TypeScript (Strict Mode), Tailwind CSS v4, Vite 8, `lucide-react`
- **Archival & Storage:** `jszip` (ZIP packaging + Audit Manifests), `IndexedDB` (`lr_eporcha_blobs_v2`, `lr_eporcha_records_v2`), `localStorage` (`lr_eporcha_queue_v2`), Cloud Firestore (provenance-tracked metadata with `UNVERIFIED` default status)
- **Hybrid Mobile Runtime:** `@capacitor/core` / `@capacitor/android` v8 (`CapacitorHttp` native bridge enabled in `capacitor.config.json` for `appId: "bd.landarchive.lrgetbdpro"` and `appName: "LRgetBD Pro"`)
- **Official Repository Coordinates (`src/config/repoConfig.ts`):**
  - **GitHub Owner:** `tapos-linx`
  - **GitHub Repository Name:** `LRgetBD-Pro`
  - **Full Repository Slug:** `tapos-linx/LRgetBD-Pro`
  - **GitHub Actions CI Debug APK Artifact:** `LRgetBD-Pro-debug.apk` (+ `.sha256` + `build-metadata.json`)
  - **GitHub Actions URL:** `https://github.com/tapos-linx/LRgetBD-Pro/actions`
- **Backend Relay:** Express server (`server.ts`) exposing `/api/eporcha-proxy` for server-side HTTP relay to `https://eporcha.tech` and `/api/github-release-check` for release metadata inspection.

---

## 2. Target `https://eporcha.tech` Endpoint Matrix (6 Modes)

| Endpoint Mode (`EporchaEndpointType`) | Portal URL | Payload / Query Parameters | Output Artifact |
| :--- | :--- | :--- | :--- |
| `survey-khatian` | `https://eporcha.tech/survey-khatian` | `division`, `district`, `upazila`, `survey`, `mouza_jl`, `khatian_no` | Tabular Khatian rows + Single Khatian PDF |
| `namjari-khatian` | `https://eporcha.tech/namjari-khatian` | `district`, `upazila`, `mouza_jl`, `khatian_no` | Mutation Khatian rows + Single Mutation PDF |
| `mouza-vittik-khatian` | `https://eporcha.tech/mouza-vittik-khatian` | `district`, `upazila`, `survey`, `mouza_jl`, `layout` (`new`\|`old`), `color` (`color`\|`bw`) | Full Mouza Khatian Book PDF (`পূর্ণ মৌজা PDF`) |
| `mouza-vittik-dag` | `https://eporcha.tech/mouza-vittik-dag` | `district`, `upazila`, `survey`, `mouza_jl` | Full Mouza Dag Book PDF (`পূর্ণ মৌজা দাগ বই PDF`) |
| `mouza-map` | `https://eporcha.tech/mouza-map` | `district`, `upazila`, `survey`, `mouza_jl`, `sheet_no` | Mouza Map Sheet PDF (`মৌজা ম্যাপ PDF`) |
| `khatian-index` | `https://eporcha.tech/khatian-index` | `district`, `upazila`, `survey`, `mouza_jl`, `khatian_no` | Khatian Index Summary (`খতিয়ান সূচিপত্র`) |

---

## 3. Binary Verification Gate (`src/services/binaryValidator.ts`)
- **PDF Magic-Byte & Structural Check:** Verifies `%PDF-` header (`25 50 44 46 2D`), structural markers (`obj`/`endobj`, `xref`/`trailer`/`startxref`, `%%EOF`), `byteLength > 1024`, and records SHA-256 hex digest over exact raw bytes.
- **Honest Payload Classification:** Rejects HTML login/error pages and JSON responses as non-PDFs without fabricating binary artifacts.

---

## 4. Polite Anti-Crash Batch Queue (`src/services/queueEngine.ts`)
- **Seven-Mouza Batching:** Deduplicates selected Mouzas and splits them into batches of 7 unique Mouzas within an Upazila boundary.
- **Durability & Recovery:** Persists queue state in `localStorage` and verified PDF blobs in `IndexedDB` (`lr_eporcha_blobs_v2`), recovering interrupted `FETCHING_EPORCHA_TECH` tasks back to `QUEUED` after browser reload or Android process restart.
- **Transient-Only Auto-Retry:** Automatically retries transient network/5xx/429 errors within the retry budget while immediately flagging permanent 4xx failures as `PERMANENT_FAILURE`.
