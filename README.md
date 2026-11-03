# LR Mass Downloader (LRgetBD Pro v2.1)

[![Build, Sign & Release LRgetBD-Pro APK](https://github.com/tapos-linx/LR_Mass_Downloader/actions/workflows/build-apk.yml/badge.svg)](https://github.com/tapos-linx/LR_Mass_Downloader/actions/workflows/build-apk.yml)
[![Latest Release](https://img.shields.io/github/v/release/tapos-linx/LR_Mass_Downloader?label=Latest%20APK&color=10B981)](https://github.com/tapos-linx/LR_Mass_Downloader/releases/latest)
[![Download LRgetBD-Pro.apk](https://img.shields.io/badge/Download_Android_APK-LRgetBD--Pro.apk-059669?style=for-the-badge&logo=android&logoColor=white)](https://github.com/tapos-linx/LR_Mass_Downloader/releases/latest/download/LRgetBD-Pro.apk)

**LRgetBD Pro** is a production-grade Android (Jetpack Compose, Room v3, MediaStore Scoped Storage, Foreground `dataSync` Service) and Web/Capacitor application engineered for automated bulk-fetching, `%PDF-` binary verification, relational indexing, and ZIP archival of Bangladeshi land records (**CS, SA, RS, BS/BRS Khatians, Full Mouza Khatian Books, Full Mouza Dag Books, Namjari Khatians, and Mouza Maps**) from the open-access **`https://eporcha.tech`** portal.

---

## 📲 Direct Android APK Download (Zero-404 Standardized Links)

All GitHub Actions release artifacts and in-app updater links are strictly standardized to **`LRgetBD-Pro.apk`**:

* **Primary Direct APK Download (`tapos-linx/LR_Mass_Downloader`):**  
  👉 **[https://github.com/tapos-linx/LR_Mass_Downloader/releases/latest/download/LRgetBD-Pro.apk](https://github.com/tapos-linx/LR_Mass_Downloader/releases/latest/download/LRgetBD-Pro.apk)**
* **Mirror Repository APK Download (`tapos-linx/LRgetBD-Pro`):**  
  👉 **[https://github.com/tapos-linx/LRgetBD-Pro/releases/latest/download/LRgetBD-Pro.apk](https://github.com/tapos-linx/LRgetBD-Pro/releases/latest/download/LRgetBD-Pro.apk)**
* **All Releases & Changelog:**  
  👉 **[https://github.com/tapos-linx/LR_Mass_Downloader/releases](https://github.com/tapos-linx/LR_Mass_Downloader/releases)**
* **GitHub Actions Build Pipeline:**  
  👉 **[https://github.com/tapos-linx/LR_Mass_Downloader/actions](https://github.com/tapos-linx/LR_Mass_Downloader/actions)**

---

## ⚙️ User Setup, Transport & Android Permissions Guide

### 1. Proxy / Scrapfly Relay & Direct `eporcha.tech` Configuration
* **Direct Open-Access Mode (Default):** On Android (`CapacitorHttp` / Native `HttpURLConnection`), requests connect directly to `https://eporcha.tech` without browser CORS restrictions.
* **Scrapfly / Custom Relay Configuration (Optional for High-Volume IP Rotation):**
  * Copy `.env.example` to `.env` for server-side relay or select **Transport Mode** inside the **Live Queue Console** (`Server Express Relay`, `Capacitor Native HTTP`, `Termux Local Relay 127.0.0.1:8787`, `Cloudflare Worker Relay`, or `Scrapfly Residential Proxy Pool`).
  * All network requests enforce a **3x Exponential Backoff** (`1s → 2s → 4s`) and a **Zero Hallucination `%PDF-` Gate** (`25 50 44 46 2D` header + `> 1,024 bytes`).

### 2. Android 10–14 Permissions & Scoped Storage Architecture
* **Android 13+ (`API 33+`) Notification Permission (`POST_NOTIFICATIONS`):**
  * When you tap **Start Queue**, the app automatically requests `android.permission.POST_NOTIFICATIONS` so the `QueueDownloadService` foreground notification (`Pause` / `Resume` / `Cancel`) remains visible in the notification shade.
* **Android 14 (`API 34+`) Foreground Service (`FOREGROUND_SERVICE_DATA_SYNC`):**
  * Declared with `android:foregroundServiceType="dataSync"` and promoted via `ServiceCompat.startForeground(..., ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)` to prevent OS background termination when the app is minimized or swiped away.
* **Scoped Storage (`MediaStore.Downloads` — Zero Legacy Storage Permission Needed on Android 10+):**
  * Verified PDFs are written directly to `Download/LRgetBD-Pro/` using `MediaStore.Downloads.EXTERNAL_CONTENT_URI` and `IS_PENDING = 1 -> 0`.
  * If you reinstall the app and delete a previously downloaded PDF that the app no longer owns, Android 10 (`RecoverableSecurityException`) and Android 11–14 (`MediaStore.createDeleteRequest`) automatically display a native system confirmation dialog via `IntentSender`.

---

## 🌐 Supported Open-Access Endpoints (`https://eporcha.tech`)

| Mode | Endpoint URL | Capability |
| :--- | :--- | :--- |
| **1. Mouza Full Khatian Book** | `https://eporcha.tech/mouza-vittik-khatian` | Downloads the complete Mouza Khatian Book PDF (`পূর্ণ মৌজা খতিয়ান বই PDF`) in New/Old and Color/B&W formats. |
| **2. Mouza Full Dag Book** | `https://eporcha.tech/mouza-vittik-dag` | Downloads the complete Mouza Dag Book PDF (`পূর্ণ মৌজা দাগ বই PDF`) mapping every serial Dag to its Khatian numbers. |
| **3. Survey Khatian** | `https://eporcha.tech/survey-khatian` | Cascading lookup and extraction for **CS, SA, RS, and BS/BRS** Khatians by Mouza, JL No., Khatian No., Dag No., or Owner Name. |
| **4. Namjari Khatian** | `https://eporcha.tech/namjari-khatian` | Mutation / Namjari Khatian lookup and download. |
| **5. Mouza Map PDF** | `https://eporcha.tech/mouza-map` | Mouza Map sheet lookup and PDF/Image archival. |

---

## 🏗️ 6-Document Architecture Framework

1. **`/docs/01_PRD.md`:** Product Requirements & Geographic Scope (prioritizing **Brahmanbaria District** — **Nabinagar Upazila**, **20-No Kaitala South Union**, **Goalai / গোয়ালী**, **Kaitala / কাইতলা**, and **Cumilla District**).
2. **`/docs/02_AppFlow.md`:** Cascading Filter State Machine & 100% Auto-Mouza Selection workflow.
3. **`/docs/03_UI_Spec.md`:** Material Design 3 (MD3) Bilingual UI Specification.
4. **`/docs/04_TRD.md`:** Technical Requirements, Anti-Crash Sequential Queue Engine, and `%PDF-` Magic-Byte Binary Validator.
5. **`/docs/05_Schema.md`:** Authoritative Geographic Hierarchy (`Division -> District -> Upazila -> Union -> Mouza`), Room v3 Relational Schema (`DownloadedRecordEntity` + `RecordWithMouza`), and `IndexedDB` Storage Schema.
6. **`/docs/06_Plan.md`:** 4-Phase Modular Implementation & Self-Healing GitHub Actions APK Pipeline.

---

## 🚀 Local Development & Build

```bash
# 1. Clone the repository
git clone https://github.com/tapos-linx/LR_Mass_Downloader.git
cd LR_Mass_Downloader

# 2. Install & build the Web / Capacitor bundle
npm install --legacy-peer-deps
npm run build

# 3. Compile the Android Debug APK via Gradle
chmod +x ./gradlew
./gradlew assembleDebug
```
