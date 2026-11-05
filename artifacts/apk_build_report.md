# M3 Platform — Android APK Build and Installation Report

## 1. Executive Summary

This report documents the compilation, signing, checksum verification, and physical device installation of the latest M3 Surveillance Android application (`m3-simulation.apk`).

The application incorporates all Worker, Contractor, and Health Worker features, the complete Worker Visual Guidance System with 18 native vector SVG illustrations, multi-lingual audio guidance across 18 Indic languages, offline SQLite storage, QR Worker Pass generation and camera scanning, and role-based access control.

---

## 2. Build Specifications

| Parameter | Value |
| :--- | :--- |
| **Application Name** | M3 Worker |
| **Package Identifier** | `org.m3.surveillance` |
| **Version Name** | `2.0.0` |
| **Version Code** | `1` |
| **Min SDK / Target SDK** | `24` (Android 7.0) / `34` (Android 14) |
| **Build Architecture** | React Native 0.76.3 / Expo SDK 52 (New Architecture Enabled) |
| **Build Date** | 2026-11-05 15:29:55 IST |
| **Signing Configuration** | Release (`m3-prototype.keystore`, RSA 2048-bit, APK Signature Scheme v2) |
| **APK File Path** | [`artifacts/m3-simulation.apk`](file:///home/nimr/Projects/m3/artifacts/m3-simulation.apk) |
| **APK File Size** | **113 MB** (118,488,400 bytes) |
| **SHA-256 Checksum** | `299e5e3f9d7bdee99a9a4ddc96b70670cb723f0dae9f8eb32abf1e7e9042fba7` |

---

## 3. Build Command and Toolchain

- **JDK Version**: OpenJDK 17.0.21 (Temurin-17.0.21+9, 64-Bit Server VM)
- **Android SDK Path**: `/home/nimr/Android/Sdk` (Build Tools 34.0.0)
- **Prebuild Command**:
  ```bash
  cd apps/mobile && npx expo prebuild --platform android --no-install
  ```
- **Gradle Build Command**:
  ```bash
  cd apps/mobile/android && ANDROID_HOME=/home/nimr/Android/Sdk ./gradlew assembleRelease
  ```
- **Output Artifact**:
  `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` copied to `artifacts/m3-simulation.apk`.

---

## 4. API and Network Configuration

- **Target API Base URL**: `http://192.168.1.120:8003/api/v1`
- **Fallback URL (USB ADB reverse)**: `http://127.0.0.1:8003/api/v1`
- **Port Forwarding**: Active via `adb reverse tcp:8003 tcp:8003`
- **Cleartext Traffic**: Enabled via `expo-build-properties` for local IP HTTP communication during testing.

---

## 5. Requested Android Permissions

Verified from package dump (`dumpsys package org.m3.surveillance`):
1. `android.permission.CAMERA` — QR code scanning for Contractor workforce verification.
2. `android.permission.INTERNET` — Network connectivity to backend NestJS API.
3. `android.permission.MODIFY_AUDIO_SETTINGS` — Text-to-speech volume and audio guide output.
4. `android.permission.RECORD_AUDIO` — Voice note recording.
5. `android.permission.SYSTEM_ALERT_WINDOW` — Critical travel and symptom alerts.
6. `android.permission.VIBRATE` — Haptic feedback for tactile low-literacy guidance.
7. `android.permission.READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` — Offline media storage.
8. `queriesIntents: android.intent.action.TTS_SERVICE` — Native Text-To-Speech engine binding.

---

## 6. Physical Device Installation Verification

- **Device Model**: Samsung Galaxy Tab A7 Lite (Model SM-T225, gta7litexx)
- **OS Version**: Android 14
- **Connection Mode**: USB ADB (`transport_id: 1`)
- **Installation Command**:
  ```bash
  adb install -r artifacts/m3-simulation.apk
  ```
- **Installation Output**:
  ```
  Performing Streamed Install
  Success
  ```
- **Package Status**: Installed and verified as active package `org.m3.surveillance` on device.
