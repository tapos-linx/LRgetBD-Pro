# LRgetBD Pro (LandArchive BD)

[![Build, Sign & Release LRgetBD-Pro APK](https://github.com/tapos-linx/LRgetBD-Pro/actions/workflows/build-apk.yml/badge.svg)](https://github.com/tapos-linx/LRgetBD-Pro/actions/workflows/build-apk.yml)
[![Latest Release](https://img.shields.io/github/v/release/tapos-linx/LRgetBD-Pro?label=Latest%20APK&color=10B981)](https://github.com/tapos-linx/LRgetBD-Pro/releases/latest)
[![Download LRgetBD-Pro.apk](https://img.shields.io/badge/Download_Android_APK-LRgetBD--Pro.apk-059669?style=for-the-badge&logo=android&logoColor=white)](https://github.com/tapos-linx/LRgetBD-Pro/releases/latest/download/LRgetBD-Pro.apk)

**LRgetBD Pro** is a mobile-first Android and Web application engineered for automated bulk-fetching, binary verification, indexing, and ZIP archival of Bangladeshi historical and modern land records (**CS, SA, RS, BS/BRS Khatians, Full Mouza Khatian Books, Full Mouza Dag Books, Namjari Khatians, and Mouza Maps**) powered by the open-access, zero-payment **`https://eporcha.tech`** portal.

---

## 📲 Direct Android APK Download & Installation

All release artifacts and in-app updater links are standardized to **`LRgetBD-Pro.apk`** (zero spaces or broken `%20` URL encodings):

* **Direct 1-Click APK Download (Latest Release):**  
  👉 **[https://github.com/tapos-linx/LRgetBD-Pro/releases/latest/download/LRgetBD-Pro.apk](https://github.com/tapos-linx/LRgetBD-Pro/releases/latest/download/LRgetBD-Pro.apk)**
* **All Releases & Build Logs:**  
  👉 **[https://github.com/tapos-linx/LRgetBD-Pro/releases](https://github.com/tapos-linx/LRgetBD-Pro/releases)**
* **GitHub Actions CI/CD Status:**  
  👉 **[https://github.com/tapos-linx/LRgetBD-Pro/actions](https://github.com/tapos-linx/LRgetBD-Pro/actions)**

---

## 🌐 Supported Open-Access Endpoints (`https://eporcha.tech`)

Unlike paid/login-walled portals, **LRgetBD Pro** integrates directly with the 5 free public modules on `https://eporcha.tech`:

| Mode | Endpoint URL | Capability |
| :--- | :--- | :--- |
| **1. Mouza Full Khatian Book** | `https://eporcha.tech/mouza-vittik-khatian` | Downloads the complete Mouza Khatian Book PDF (`পূর্ণ মৌজা খতিয়ান বই PDF`) in New/Old and Color/B&W formats. |
| **2. Mouza Full Dag Book** | `https://eporcha.tech/mouza-vittik-dag` | Downloads the complete Mouza Dag Book PDF (`পূর্ণ মৌজা দাগ বই PDF`) mapping every serial Dag to its Khatian numbers. |
| **3. Survey Khatian** | `https://eporcha.tech/survey-khatian` | Cascading lookup and extraction for **CS, SA, RS, and BS/BRS** Khatians by Mouza, JL No., Khatian No., Dag No., or Owner Name. |
| **4. Namjari Khatian** | `https://eporcha.tech/namjari-khatian` | Mutation / Namjari Khatian lookup and download. |
| **5. Mouza Map PDF** | `https://eporcha.tech/mouza-map` | Mouza Map sheet lookup and PDF/Image archival. |

---

## 🏗️ 6-Document Architecture Framework

This repository enforces a strict **Context-First 6-Document Architecture** inside `/docs`:

1. **`/docs/01_PRD.md` (`SKILL.md`):** Product Requirements & Geographic Scope (prioritizing **Brahmanbaria District** — **Nabinagar Upazila**, **20-No Kaitala South Union**, **Goalai / গোয়ালী**, **Kaitala / কাইতলা**, and **Cumilla District**).
2. **`/docs/02_AppFlow.md` (`README.md`):** Cascading Filter State Machine & 100% Auto-Mouza Selection workflow.
3. **`/docs/03_UI_Spec.md`:** Material Design 3 (MD3) Bilingual UI Specification optimized for Android 16 / ColorOS 16 viewports.
4. **`/docs/04_TRD.md` (`API_SPEC.md`):** Technical Requirements, Anti-Crash Sequential Queue Engine, and `%PDF-` Magic-Byte Binary Validator.
5. **`/docs/05_Schema.md` (`MEMORY.md`):** Authoritative Geographic Hierarchy (`Division -> District -> Upazila -> Union -> Mouza`) & `IndexedDB` Storage Schema.
6. **`/docs/06_Plan.md` (`ROADMAP.md`):** 4-Phase Modular Implementation & Self-Healing GitHub Actions APK Pipeline.

---

## 🛠️ Standardized Repository & Artifact Constants

| Property | Standardized Value |
| :--- | :--- |
| **GitHub Repository Slug** | `tapos-linx/LRgetBD-Pro` |
| **Application Name** | `LRgetBD Pro` |
| **Android Package ID (`appId`)** | `bd.landarchive.lrgetbdpro` |
| **APK Binary Asset Name** | `LRgetBD-Pro.apk` |
| **Latest APK Download URL** | `https://github.com/tapos-linx/LRgetBD-Pro/releases/latest/download/LRgetBD-Pro.apk` |
| **GitHub Releases API** | `https://api.github.com/repos/tapos-linx/LRgetBD-Pro/releases/latest` |

---

## 🚀 Local Development & Build

```bash
# 1. Clone the repository
git clone [https://github.com/tapos-linx/LRgetBD-Pro.git](https://github.com/tapos-linx/LRgetBD-Pro.git)
cd LRgetBD-Pro

# 2. If running the Web / Capacitor layer:
npm install --legacy-peer-deps
npm run build

# 3. Compile the Android Debug APK via Gradle:
chmod +x ./gradlew
./gradlew assembleDebug
