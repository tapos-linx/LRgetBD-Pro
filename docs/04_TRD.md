# 04_TRD.md — Technical Requirements & Data Contracts (API_SPEC.md Equivalent)
**Project:** LRgetBD Pro (LandArchive BD v2.1)  
**Official Repository:** `tapos-linx/LR_Mass_Downloader` (`bd.landarchive.lrgetbdpro`)

---

## 1. Technology Stack & Repository Coordinates
- **Frontend:** React 19 / 18+, TypeScript (Strict Mode), Tailwind CSS v4, `lucide-react`
- **Archival & Storage:** `jszip` (ZIP packaging + Audit Manifests), `IndexedDB` (`lr_eporcha_blobs_v2`, `lr_eporcha_records_v2`), `localStorage` (`lr_eporcha_queue_v2`)
- **Hybrid Mobile Runtime:** `@capacitor/core` (`CapacitorHttp` native bridge enabled in `capacitor.config.json` for `appId: "bd.landarchive.lrgetbdpro"` and `appName: "LRgetBD Pro"`)
- **Official Release Coordinates (`src/config/repoConfig.ts`):**
  - **GitHub Owner:** `tapos-linx`
  - **GitHub Repository Name:** `LR_Mass_Downloader`
  - **Full Repository Slug:** `tapos-linx/LR_Mass_Downloader`
  - **Exact APK Asset Filename:** `LRgetBD-Pro.apk`
  - **Direct Latest APK Download URL:** `https://github.com/tapos-linx/LR_Mass_Downloader/releases/latest/download/LRgetBD-Pro.apk`
  - **GitHub Releases API URL:** `https://api.github.com/repos/tapos-linx/LR_Mass_Downloader/releases/latest`
  - **GitHub Actions URL:** `https://github.com/tapos-linx/LR_Mass_Downloader/actions`
- **Backend Relay:** Express server (`server.ts`) exposing `/api/eporcha-proxy` for server-side HTTP relay to `https://eporcha.tech` and `/api/github-release-check` for live GitHub Release inspection.

---

## 2. Target `https://eporcha.tech` Endpoint Matrix

| Endpoint Mode (`EporchaEndpointType`) | Portal URL | Payload / Query Parameters | Output Artifact |
| :--- | :--- | :--- | :--- |
| `survey-khatian` | `https://eporcha.tech/survey-khatian` | `division`, `district`, `upazila`, `survey`, `mouza_jl`, `khatian_no` | Tabular Khatian rows + Single Khatian PDF |
| `namjari-khatian` | `https://eporcha.tech/namjari-khatian` | `district`, `upazila`, `mouza_jl`, `khatian_no` | Mutation Khatian rows + Single Mutation PDF |
| `mouza-vittik-khatian` | `https://eporcha.tech/mouza-vittik-khatian` | `district`, `upazila`, `survey`, `mouza_jl`, `layout` (`new`\|`old`), `color` (`color`\|`bw`) | Full Mouza Khatian Book PDF (`পূর্ণ মৌজা PDF`) |
| `mouza-vittik-dag` | `https://eporcha.tech/mouza-vittik-dag` | `district`, `upazila`, `survey`, `mouza_jl` | Full Mouza Dag Book PDF (`পূর্ণ মৌজা দাগ বই PDF`) |
| `mouza-map` | `https://eporcha.tech/mouza-map` | `district`, `upazila`, `survey`, `mouza_jl`, `sheet_no` | Mouza Map Sheet PDF (`মৌজা ম্যাপ PDF`) |

---

## 3. Binary Verification Gate (`src/services/binaryValidator.ts` & `src/services/apkReleaseService.ts`)
- **PDF Magic-Byte Check:** Reads `new Uint8Array(buffer, 0, 5)` and verifies exact equality with `[0x25, 0x50, 0x44, 0x46, 0x2D]` (`%PDF-`) and `buffer.byteLength > 1024`.
- **APK Release Asset Gate:** Verifies `.apk` assets returned by `https://api.github.com/repos/tapos-linx/LR_Mass_Downloader/releases/latest` have `size > 1048576` (`> 1 MB`) before triggering a direct binary download (`https://github.com/tapos-linx/LR_Mass_Downloader/releases/latest/download/LRgetBD-Pro.apk`).

---

## 4. Polite Anti-Crash Sequential Queue (`src/services/queueEngine.ts`)
- **Concurrency:** Configurable `1`, `2`, or `3` concurrent workers.
- **Polite Delay Jitter:** `450ms–900ms` randomized delay between consecutive requests to prevent IP rate-limiting on `eporcha.tech`.
- **Memory Safety:** Streams verified `ArrayBuffer` payloads directly into `IndexedDB` (`lr_eporcha_blobs_v2`) rather than holding large arrays in React state.
