# LRgetBD-Pro (v2.1.0)

[![Build Android Debug APK](https://github.com/tapos-linx/LRgetBD-Pro/actions/workflows/build-apk.yml/badge.svg)](https://github.com/tapos-linx/LRgetBD-Pro/actions/workflows/build-apk.yml)

**LRgetBD-Pro** (`bd.landarchive.lrgetbdpro`, v2.1.0) is a **React 19 + TypeScript + Vite 8 + Express + Capacitor 8** web and Android application for structured lookup, binary verification, indexing, and ZIP archival of Bangladeshi land records (**Survey Khatians, Namjari Khatians, Mouza Khatian Books, Mouza Dag Books, Mouza Maps, and Khatian Index** across **CS, SA, RS, BS, and Mutation** surveys) from **`https://eporcha.tech`**.

---

## Architecture Overview

- **Active Web & Android Application:** Built with React 19, TypeScript, Vite 8, Tailwind CSS v4, and Express (`server.ts`), packaged for Android using **Capacitor 8** inside the **`android/`** Gradle project (`applicationId "bd.landarchive.lrgetbdpro"`, `versionCode 1`, `versionName "2.1.0"`).
- **Separate Root `/app/` Directory:** The repository also contains an uncompiled Kotlin/Jetpack Compose source tree under root `/app/`. It is **not** part of the Gradle/Capacitor build packaged into the APK and is preserved untouched as reference/legacy native source.
- **6-Document Framework:** Requirements, state machine, UI specification, technical contracts, storage schema, and implementation roadmap live in `/docs/01_PRD.md` through `/docs/06_Plan.md`.
- **Android Debug APK CI Delivery:** `.github/workflows/build-apk.yml` builds and validates the **debug-signed** APK (`LRgetBD-Pro-debug.apk`), `LRgetBD-Pro-debug.apk.sha256`, and `build-metadata.json` as GitHub Actions workflow artifacts on pushes and pull requests to `main`. Check the latest workflow run in the [Actions tab](https://github.com/tapos-linx/LRgetBD-Pro/actions/workflows/build-apk.yml).

---

## Supported Open-Access Endpoints (`https://eporcha.tech`)

| Mode | Endpoint Path | Capability |
| :--- | :--- | :--- |
| **1. Mouza Full Khatian Book** | `/mouza-vittik-khatian` | Downloads Full Mouza Khatian Book PDF (`পূর্ণ মৌজা খতিয়ান বই PDF`) in New/Old layout and Color/B&W modes. |
| **2. Mouza Full Dag Book** | `/mouza-vittik-dag` | Downloads Full Mouza Dag Book PDF (`পূর্ণ মৌজা দাগ বই PDF`). |
| **3. Survey Khatian** | `/survey-khatian` | Lookup and extraction for **CS, SA, RS, and BS** Khatians. |
| **4. Namjari Khatian** | `/namjari-khatian` | Mutation / Namjari Khatian lookup and download (`MUTATION`). |
| **5. Mouza Map PDF** | `/mouza-map` | Mouza Map sheet lookup and archival by sheet index. |
| **6. Khatian Index** | `/khatian-index` | Complete Khatian Summary Index lookup (`খতিয়ান সূচিপত্র`). |

---

## Key Behavioral & Verification Guarantees

- **Administrative Flow & Provenance:** Cascading selection (`Division → District → Upazila → Mouza`) enforces exact parent-district matching and distinguishes live portal responses (`LIVE_SOURCE`) from the bundled local dataset (`LOCAL_DATASET`) and errors (`FAILED` / `NOT_FOUND`). Saved Firestore geographic records default to `UNVERIFIED` until explicitly verified.
- **Seven-Mouza Queue Batching:** Selected unique Mouzas within an Upazila are chunked into batches of **7 Mouzas** (with a smaller final remainder) using composite task IDs, idempotent progress preservation across re-selection, crash/reload recovery of interrupted tasks, cancellation, and transient-only auto-retries.
- **Structural PDF & Checksum Verification:** Candidate downloads require both the `%PDF-` header (`25 50 44 46 2D`), structural PDF markers (`obj`/`endobj`, `xref`/`trailer`/`startxref`, `%%EOF`), size `> 1,024` bytes, and SHA-256 digest computation over the exact saved bytes. HTML login/error responses and JSON error bodies are rejected cleanly.
- **Transport Modes:** Supports Capacitor Native HTTP (`CapacitorHttp`) inside Android, built-in Express proxy (`/api/eporcha-proxy`), optional local Termux relay (`http://127.0.0.1:8787/proxy?url=`), or user-configured Cloudflare Worker relay.

---

## Local Development, Testing & Android Debug Build

```bash
# 1. Clone the repository
git clone https://github.com/tapos-linx/LRgetBD-Pro.git
cd LRgetBD-Pro

# 2. Install exact locked dependencies
bun install --frozen-lockfile

# 3. Typecheck and run all unit tests
npm run lint
npm test

# 4. Build web assets & sync Capacitor Android project
npm run build
npx cap sync android

# 5. Compile & test the Debug APK (requires JDK 21 + Android SDK)
cd android
chmod +x ./gradlew
./gradlew --version --no-daemon
./gradlew testDebugUnitTest assembleDebug --no-daemon
```

The debug APK is generated at:
`android/app/build/outputs/apk/debug/app-debug.apk`

---

## Troubleshooting

- **SDK `tools` error in legacy CI runners:** Ensure `.github/workflows/build-apk.yml` uses `android-actions/setup-android@v4` without the removed `tools` SDK package and installs `platform-tools`, `platforms;android-36`, and `build-tools;36.0.0`.
- **Stale web bundle inside APK:** Always run `npm run build && npx cap sync android` before `./gradlew assembleDebug` so `android/app/src/main/assets/public/` matches `dist/`.
- **Optional Firebase config:** `android/app/build.gradle` only enables Google Services if `android/app/google-services.json` is present; Debug APK builds succeed without private Firebase credentials.
