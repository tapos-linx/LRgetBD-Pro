# LRgetBD Pro (LandArchive BD v2.1 — `eporcha.tech` Open-Access Edition)

[![Build, Sign & Release LRgetBD-Pro APK](https://github.com/tapos-linx/LRgetBD-Pro/actions/workflows/build-apk.yml/badge.svg)](https://github.com/tapos-linx/LRgetBD-Pro/actions)
[![Download Latest Android APK](https://img.shields.io/badge/Android_APK-LRgetBD--Pro.apk-10b981?style=flat-square&logo=android)](https://github.com/tapos-linx/LRgetBD-Pro/releases/latest/download/LRgetBD-Pro.apk)
[![GitHub Releases](https://img.shields.io/github/v/release/tapos-linx/LRgetBD-Pro?style=flat-square)](https://github.com/tapos-linx/LRgetBD-Pro/releases)

**LRgetBD Pro** (`bd.landarchive.lrgetbdpro`) is an open-access, mobile-first Web and Capacitor 6 Android application engineered to bulk-fetch, verify (`%PDF-` magic-byte inspection), index, and bundle Bangladeshi land records directly from **`https://eporcha.tech`**.

---

## Official Repository & Android APK Coordinates

| Parameter | Official Value |
| :--- | :--- |
| **GitHub Owner** | `tapos-linx` |
| **GitHub Repository Name** | `LRgetBD-Pro` |
| **Full Repository Slug** | `tapos-linx/LRgetBD-Pro` |
| **App Display Name** | `LRgetBD Pro` |
| **Android Package ID (`appId`)** | `bd.landarchive.lrgetbdpro` |
| **Exact APK Asset Filename** | `LRgetBD-Pro.apk` |
| **Direct Latest APK Download URL** | `https://github.com/tapos-linx/LRgetBD-Pro/releases/latest/download/LRgetBD-Pro.apk` |
| **GitHub Releases API URL** | `https://api.github.com/repos/tapos-linx/LRgetBD-Pro/releases/latest` |
| **GitHub Actions URL** | `https://github.com/tapos-linx/LRgetBD-Pro/actions` |

---

## Direct Android APK Download

1. **Direct Latest Release APK (`LRgetBD-Pro.apk`):**  
   [`https://github.com/tapos-linx/LRgetBD-Pro/releases/latest/download/LRgetBD-Pro.apk`](https://github.com/tapos-linx/LRgetBD-Pro/releases/latest/download/LRgetBD-Pro.apk)
2. **GitHub Actions Build Pipeline (`.github/workflows/build-apk.yml`):**  
   [`https://github.com/tapos-linx/LRgetBD-Pro/actions`](https://github.com/tapos-linx/LRgetBD-Pro/actions)

---

## Supported `https://eporcha.tech` Open-Access Endpoints

1. **Survey Khatian (`https://eporcha.tech/survey-khatian`)**: Cascading Division → District → Upazila → Survey Type (`CS`, `SA`, `RS`, `BS`) → Mouza JL lookup & Khatian extraction.
2. **Namjari / Mutation Khatian (`https://eporcha.tech/namjari-khatian`)**: Mutation Khatian, Dag, and Owner extraction.
3. **Mouza-wise Full Khatian Book PDF (`https://eporcha.tech/mouza-vittik-khatian`)**: Complete Mouza Khatian Book PDF (`পূর্ণ মৌজা খতিয়ান বই PDF`) with format variants (`নতুন/পুরনো`, `রঙিন/সাদা-কালো`).
4. **Mouza-wise Full Dag Book PDF (`https://eporcha.tech/mouza-vittik-dag`)**: Complete Mouza Dag Book PDF (`পূর্ণ মৌজা দাগ বই PDF`).
5. **Mouza Map PDF (`https://eporcha.tech/mouza-map`)**: Mouza Map sheet search and download (`মৌজা ম্যাপ PDF`).

---

## Clone & Local Development

```bash
git clone https://github.com/tapos-linx/LRgetBD-Pro.git
cd LRgetBD-Pro
npm install --legacy-peer-deps
npm run dev
```
