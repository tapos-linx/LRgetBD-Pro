# 03_UI_Spec.md — Material Design 3 Mobile-First UI Specification
**Project:** LR Mass Downloader (LandArchive BD / LRgetBD v2.1)

---

## 1. Design System & Visual Tokens
- **Palette:** Material Design 3 (MD3) Dark Slate (`#020617` / `#0F172A`) & Emerald (`#10B981`) / Gold (`#F59E0B`) high-contrast surfaces optimized for outdoor daylight readability on **Oppo A5 Pro (ColorOS 16 / Android 16)** and 1440px desktop workspaces.
- **Typography:**
  - **Display & UI Structure:** `Plus Jakarta Sans` (Weights: 500, 600, 700)
  - **Bengali Script:** `Hind Siliguri` (Weights: 400, 500, 600, 700) for crisp rendering of `খতিয়ান`, `মৌজা`, `দাগ বই`, `গোয়ালী`, `কাইতলা`
  - **Telemetry, JL Numbers & Byte Sizes:** `JetBrains Mono` with `font-variant-numeric: tabular-nums`

---

## 2. Core Component Specifications

1. **Top App Bar (Strict 3-Zone Contract):**
   - **Zone 1 (Brand):** Single-line wordmark `LRgetBD v2.1 · LandArchive BD`.
   - **Zone 2 (Navigation):** 4 single-line workspace tabs (`Extractor`, `Live Queue`, `Tabular Index`, `6-Doc Architecture`).
   - **Zone 3 (Primary Action):** `Download Android APK` trigger opening `ApkInstallerModal`.
2. **Workspace Status Strip:**
   - Displays active transport mode (`Native Capacitor HTTP (CORS-Free)` vs `Server/Web Proxy Relay`), active `eporcha.tech` endpoint path, and queue progress counters.
3. **5-Mode Selector Cards:**
   - Interactive button cards for `mouza-vittik-khatian`, `mouza-vittik-dag`, `survey-khatian`, `namjari-khatian`, and `mouza-map`.
4. **Cascading Geo Filter & All Mouza Selection Grid (`সকল মৌজা নির্বাচন`):**
   - Division → District → Upazila → Union Filter (`All Unions`, `20-No Kaitala South Union`, etc.).
   - Selecting an Upazila immediately counts, fetches, and selects **all Mouzas within that Upazila** (e.g., all **176 Mouzas** in Nabinagar Upazila).
   - Instant `Select All Mouzas`, `Clear All`, and `Kaitala South Union Only` controls.
   - Mouza cards displaying JL Number (`JL-114`), Bengali Name (`গোয়ালী`), English Name (`Goalai`), Union name, and available survey records.
5. **Live Queue Console:**
   - Displays real HTTP status codes, byte lengths in KB/MB, `%PDF-` magic-byte verification status, transport mode used, and a direct external link (`https://eporcha.tech/...`) to inspect or download on the source portal.
