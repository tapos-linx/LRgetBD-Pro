# 06_Plan.md — 4-Phase Implementation & Verification Plan (ROADMAP.md Equivalent)
**Project:** LRgetBD Pro (LandArchive BD v2.1)  
**Official Repository:** `tapos-linx/LR_Mass_Downloader` (`bd.landarchive.lrgetbdpro`)

---

## Phase 1: Foundation, Contracts & Geographic Hierarchy
- [x] Establish the 6-Document Architecture Framework (`/docs/01_PRD.md` through `/docs/06_Plan.md`).
- [x] Define strict TypeScript contracts in `src/types/land.ts` and single-source repository coordinates in `src/config/repoConfig.ts` (`tapos-linx/LR_Mass_Downloader`, `bd.landarchive.lrgetbdpro`, `LRgetBD-Pro.apk`).
- [x] Populate the authoritative **Brahmanbaria District** (all 9 Upazilas, prioritizing **Nabinagar Upazila** with all **176 Mouzas** and **20-No Kaitala South Union** — `Goalai / গোয়ালী` JL-114, `Kaitala / কাইতলা` JL-115, etc.) and **Cumilla District** dataset in `src/data/geoHierarchy.ts`.

## Phase 2: Dual-Transport Client & Binary Verification Gate
- [x] Build `src/services/binaryValidator.ts` to inspect `ArrayBuffer` headers (`0x25 0x50 0x44 0x46 0x2D` / `%PDF-` and `byteLength > 1024`) and parse HTML/JSON Khatian & Dag tables returned by `eporcha.tech`.
- [x] Build `src/services/eporchaTechClient.ts` supporting:
  1. **Capacitor Native HTTP (`CapacitorHttp.request`)** when running inside the Android APK (`CORS-Free`).
  2. **Built-in Server Relay (`/api/eporcha-proxy`)** & **Custom Termux/Cloudflare Proxy** when running in a Web Browser.
- [x] Add unit tests (`src/services/binaryValidator.test.ts`) verified via `npx --yes tsx --test`.

## Phase 3: Polite Queue Engine, IndexedDB Streaming & MD3 Bilingual UI
- [x] Implement `src/services/storageService.ts` for `IndexedDB` (`lr_eporcha_blobs_v2` & `lr_eporcha_records_v2`) and `localStorage` queue persistence.
- [x] Implement `src/services/queueEngine.ts` and `src/services/downloadAndZipService.ts` with `450ms–900ms` polite delay jitter, Retry Failed Tasks, and `JSZip` directory bundling (`[District]/[Upazila]/[Survey]/[Filename]` + `MANIFEST_AUDIT.csv` + `MANIFEST_AUDIT.md`).
- [x] Build the Material Design 3 Bilingual (Bengali/English) interface with All Mouza Selection (`সকল মৌজা নির্বাচন`), `Select / Deselect All` toggle switch, and automatic queue generation of all Upazila Mouzas (176 Mouzas in Nabinagar) on Upazila pick.

## Phase 4: Capacitor 6 Native Config & Self-Healing GitHub Actions APK Pipeline
- [x] Configure `capacitor.config.json` with `"appId": "bd.landarchive.lrgetbdpro"`, `"appName": "LRgetBD Pro"`, and `"CapacitorHttp": { "enabled": true }`.
- [x] Configure `.github/workflows/build-apk.yml` to scaffold `/android`, compile the debug APK, verify size `> 1048576` bytes (`> 1 MB`), and publish `LRgetBD-Pro.apk` to GitHub Releases (`https://github.com/tapos-linx/LR_Mass_Downloader/releases/latest/download/LRgetBD-Pro.apk`).
- [x] Implement `src/services/apkReleaseService.ts` and `src/components/ApkInstallerModal.tsx` querying `https://api.github.com/repos/tapos-linx/LR_Mass_Downloader/releases/latest` with dynamic repo switching and graceful First Build Pending status.
