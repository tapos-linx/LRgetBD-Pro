# 06_Plan.md — 4-Phase Implementation & Verification Plan (ROADMAP.md Equivalent)
**Project:** LRgetBD Pro (LandArchive BD v2.1)  
**Official Repository:** `tapos-linx/LRgetBD-Pro` (`bd.landarchive.lrgetbdpro`)

---

## Phase 1: Foundation, Contracts & Geographic Hierarchy
- [x] Establish the 6-Document Architecture Framework (`/docs/01_PRD.md` through `/docs/06_Plan.md`).
- [x] Define strict TypeScript contracts in `src/types/land.ts` and repository coordinates in `src/config/repoConfig.ts` (`tapos-linx/LRgetBD-Pro`, `bd.landarchive.lrgetbdpro`, `LRgetBD-Pro-debug.apk`).
- [x] Populate the bundled Brahmanbaria District (prioritizing Nabinagar Upazila with 176 Mouzas) and Cumilla District hierarchy in `src/data/geoHierarchy.ts`, plus strict parent-child geographic discovery in `src/services/geoDiscoveryService.ts`.

## Phase 2: Dual-Transport Client & Structural Binary Verification Gate
- [x] Build `src/services/binaryValidator.ts` to inspect `ArrayBuffer` headers (`25 50 44 46 2D` / `%PDF-`), structural markers (`obj`/`endobj`, `%%EOF`), `byteLength > 1024`, SHA-256 digests, and HTML/JSON rejection.
- [x] Build `src/services/eporchaTechClient.ts` supporting Capacitor Native HTTP (`CapacitorHttp`) inside Android and built-in Express Server Relay (`/api/eporcha-proxy`) + Termux/Cloudflare relay in browsers.
- [x] Maintain comprehensive test coverage across `binaryValidator.test.ts`, `queueEngine.test.ts`, and `geoDiscovery.test.ts`.

## Phase 3: Seven-Mouza Batch Queue, IndexedDB Streaming & Bilingual UI
- [x] Implement `src/services/storageService.ts` for `IndexedDB` (`lr_eporcha_blobs_v2` & `lr_eporcha_records_v2`) and `localStorage` queue persistence.
- [x] Implement `src/services/queueEngine.ts` with 7-Mouza batching (`batchMouzasForQueue` / `buildBatchedQueueTasks`), idempotent progress preservation, stale task recovery, cancellation, transient-only retries, and `JSZip` export (`MANIFEST_AUDIT.csv` & `MANIFEST_AUDIT.md`).
- [x] Build the dark-slate/emerald bilingual interface supporting all 6 e-Porcha document categories, Select All / Clear All controls, and Mouza selection.

## Phase 4: Capacitor 8 Android Packaging & Deterministic GitHub Actions Debug APK CI
- [x] Configure `capacitor.config.json` (`appId: "bd.landarchive.lrgetbdpro"`, `appName: "LRgetBD Pro"`, `webDir: "dist"`, `CapacitorHttp.enabled: true`) and the active Gradle project under `android/`.
- [x] Harden `.github/workflows/build-apk.yml` using `android-actions/setup-android@v4` (no obsolete `tools`), JDK 21, Bun locked install, lint/test/build/cap-sync gates, Gradle unit tests + `assembleDebug`, `apksigner`/`aapt2` verification, and workflow artifact upload (`LRgetBD-Pro-debug.apk`, `.sha256`, `build-metadata.json`).
