# M3 Worker App — Android Build and Device Test Guide

Written in Simplified Technical English (ASD-STE100): short sentences, one
instruction per step, active voice, present tense.

> Read `startup.md` first. Start the backend and the web app before you build
> the mobile app. Do the steps on the machine that will build the app
> ("the build computer").

---

## 1. Purpose

This guide tells you how to build, install, and test the M3 Worker Android app.
The app already exists in `apps/mobile`. Do not rebuild the platform. Build the
app. Install the app on a physical Android phone. Test the Worker workflows.

## 2. What you build

You build the Worker app only. The app does these tasks:

1. The app opens on an Android phone.
2. The app connects to the NestJS backend over the local network.
3. The Worker signs in with a phone number and a PIN.
4. The app shows the Worker dashboard and profile.
5. The app loads construction sites.
6. The app shows the initial screening questionnaire (Sections I–V).
7. The app saves screening data.
8. The app shows malaria status, diagnostics, and prescriptions.
9. The Worker submits a "feeling unwell" report.
10. The Worker requests and answers site transfers.
11. The app keeps supported actions offline and syncs them later.

## 3. What you must not change

- Do not change the questionnaire content.
- Do not change the design tokens or the four languages.
- Do not change the transfer approval rules.
- Do not add clinical logic.
- Do not commit secrets, keystores, or passwords.

## 4. Repository facts (the source of truth)

Check these values in the repository. Do not assume other values.

| Item | Value |
| --- | --- |
| Mobile folder | `apps/mobile` |
| Framework | Expo SDK ~52, React Native 0.76, TypeScript |
| Navigation | Expo Router (typed routes) |
| Android package id | `org.m3.surveillance` (`apps/mobile/app.json`) |
| App name | `M3 Worker` |
| New architecture | enabled |
| Cleartext HTTP (Android) | enabled for the dev backend, by the `expo-build-properties` plugin |
| API URL variable | `EXPO_PUBLIC_API_BASE_URL` (see `apps/mobile/.env.example`) |
| Local database | Expo SQLite + Drizzle, with a sync outbox |
| Shared code | `@m3/shared`, consumed from source by a Babel/Metro alias |

The mobile project is standalone. It is not an npm workspace. It has its own
`node_modules`.

## 5. Required software

Install this software on the build computer:

| Software | Version |
| --- | --- |
| Node.js | 20 or later |
| Java JDK | 17 |
| Android SDK | platform 34 or 35 |
| Android build tools | 34.0.0 or later |
| Android platform tools (`adb`) | latest |
| Gradle | the version in the generated Gradle wrapper (do not install Gradle by hand) |

You do not install a global Expo CLI. You run it with `npx expo`.

Set the Android environment variables:

```bash
export ANDROID_HOME="$HOME/Android/Sdk"     # use your SDK path
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"
```

## 6. Configure the backend URL

The phone cannot use `localhost`. The phone must use the build computer's local
network address (the LAN IP).

1. Start the backend (see `startup.md`).
2. Find the LAN IP of the build computer:
   - Linux/macOS: `hostname -I` or `ipconfig getifaddr en0`
   - Windows: `ipconfig` (use the IPv4 address of the active adapter)
3. Copy the mobile environment file:

   ```bash
   cd apps/mobile
   cp .env.example .env
   ```

4. Edit `apps/mobile/.env`. Set the real LAN IP:

   ```
   EXPO_PUBLIC_API_BASE_URL=http://<HOST_LAN_IP>:8003/api/v1
   ```

   Example only: `http://192.168.1.25:8003/api/v1`. Do not copy the example.

5. Confirm the phone and the build computer use the same Wi-Fi network.
6. Confirm the backend answers on the LAN. From the build computer:

   ```bash
   curl http://<HOST_LAN_IP>:8003/api/v1/meta/health
   ```

   The response must be `{"status":"ok",...}`.

## 7. Install the mobile dependencies

```bash
cd apps/mobile
npm install --legacy-peer-deps
```

Use `--legacy-peer-deps`. The test renderer pins React 18.3.1.

## 8. Check the app before you build

Run these checks. They must pass.

```bash
cd apps/mobile
npx tsc --noEmit        # TypeScript check
npm test                # 8 component/i18n tests
```

## 9. Generate the native Android project

The repository uses Expo managed configuration. Generate the native project:

```bash
cd apps/mobile
npx expo prebuild --platform android --clean
```

This step creates the `apps/mobile/android` folder. The plugin writes the
cleartext-HTTP setting into the Android manifest.

## 10. Build method A — quick on-device run (recommended first)

Use this method to test the online workflows fast. The app runs a debug build
and connects to the Metro bundler on the build computer.

1. Connect the phone with a USB cable.
2. Turn on USB debugging on the phone.
3. Confirm the phone is visible:

   ```bash
   adb devices
   ```

4. Run the app:

   ```bash
   cd apps/mobile
   npx expo run:android --device
   ```

The command builds the app, installs it, and starts it. Keep the terminal open.
Metro must stay running for this method.

## 11. Build method B — standalone APK (for hand-off and offline tests)

Use this method to make an installable APK. The APK contains the JavaScript
bundle. The app runs without Metro. You need this APK for the offline test.

1. Create a signing key one time (a prototype key):

   ```bash
   cd apps/mobile/android/app
   keytool -genkeypair -v -keystore m3-prototype.keystore \
     -alias m3 -keyalg RSA -keysize 2048 -validity 10000 \
     -storepass m3prototype -keypass m3prototype \
     -dname "CN=M3 Prototype, OU=Dev, O=M3, L=Goa, S=Goa, C=IN"
   ```

2. Tell Gradle to sign the release build with this key. Edit
   `apps/mobile/android/app/build.gradle`. In `android { signingConfigs { ... } }`
   add a `release` config, and set `buildTypes.release.signingConfig` to it:

   ```gradle
   signingConfigs {
       release {
           storeFile file('m3-prototype.keystore')
           storePassword 'm3prototype'
           keyAlias 'm3'
           keyPassword 'm3prototype'
       }
   }
   buildTypes {
       release {
           signingConfig signingConfigs.release
           // keep the other release settings that Expo generated
       }
   }
   ```

   Keep this keystore out of version control. Use a real key for production.

3. Build the release APK:

   ```bash
   cd apps/mobile/android
   ./gradlew assembleRelease
   ```

4. Find the APK:

   ```
   apps/mobile/android/app/build/outputs/apk/release/app-release.apk
   ```

5. Copy the APK to a clear name:

   ```bash
   cp app/build/outputs/apk/release/app-release.apk \
      ../../../m3-worker-android.apk
   ```

## 12. Build method C — EAS cloud build (option)

Use this method if you have an Expo account and internet access.

```bash
cd apps/mobile
npx eas-cli build --platform android --profile preview
```

Set `EXPO_PUBLIC_API_BASE_URL` in the EAS build environment. EAS returns a
download link for the APK.

## 13. Install the APK on the phone

```bash
adb install -r m3-worker-android.apk
```

Open the app on the phone. The app must open without a crash.

## 14. Backend connection test

1. Open the app.
2. The sign-in screen must appear.
3. Sign in with the seeded account:
   - Phone: `9000000001`
   - PIN: `1234`
4. The app must open the Worker dashboard.

If sign-in fails, do the network checks in Section 6 again. Do not change the
app code before you confirm the network.

## 15. Worker functional tests

Test each feature. Use the real app on the phone.

### 15.1 Profile
- The Worker ID appears.
- The phone number appears.
- The current site appears.
- The language preference appears.

### 15.2 Construction site
- The site hierarchy loads (State → District → Taluka → Area).
- The search finds a site.
- The Worker selects a site.
- The dashboard shows the active site.

### 15.3 Initial screening
- The questionnaire loads with Sections I–V.
- The required fields are validated.
- The consent step is present.
- The Worker completes the screening once.
- The app refuses a second completion.
- A draft saves and resumes.

### 15.4 Dashboard and malaria status
- The dashboard shows the Worker information.
- The malaria status shows one of: No result, Awaiting, Positive, Negative.
- The app does not show "negative" only because there are no symptoms.

### 15.5 Malaria records and prescriptions
- The diagnostics list shows authorized results only.
- The current prescription opens by default.
- The history keeps older prescriptions.
- The Worker cannot create a diagnosis.

### 15.6 Feeling unwell
- The Worker selects symptoms with taps.
- The Worker adds an optional note.
- The app submits the report.
- The report does not change the malaria status.

### 15.7 Transfers
- The Worker sees the current site as "From".
- The Worker requests a transfer to another site.
- The status follows the approval steps.
- The Worker accepts or rejects a contractor request.
- A rejected or cancelled request does not change the site.

## 16. Offline test

1. Open the app with Wi-Fi on. Sign in.
2. Open the dashboard and the records.
3. Turn off Wi-Fi on the phone.
4. Open the cached Worker information. It must still appear.
5. Submit a "feeling unwell" report.
6. Confirm the app shows "Pending sync".
7. Turn on Wi-Fi.
8. Open the app again.
9. Confirm the report syncs. The status changes to "Synced".
10. Confirm the server did not create a duplicate report.

The app must not show a local-only record as server-confirmed. The app must not
complete a transfer from an offline action.

## 17. Physical device checklist

Test and record the result for each item: install, first launch, permissions,
login, navigation, form entry, keyboard, scrolling, layout, back navigation,
network, offline, sync, app restart, session persistence, logout.

Record the Android version and the phone model.

## 18. Acceptance table

Fill one mark for each row: PASS, FAIL, NOT TESTED, or BLOCKED. Add evidence.

| Requirement | Mark | Evidence |
| --- | --- | --- |
| APK builds | | |
| APK installs on the phone | | |
| App opens without a crash | | |
| Phone reaches the backend | | |
| Worker login works | | |
| Profile loads | | |
| Site selection works | | |
| Screening loads and saves | | |
| Dashboard works | | |
| Malaria status rules correct | | |
| Prescriptions (current + history) | | |
| Transfer workflow works | | |
| Offline actions enter the outbox | | |
| Sync works, no duplicates | | |
| Four languages work | | |

## 19. Common errors and fixes

| Problem | Likely cause | Fix |
| --- | --- | --- |
| Login request fails, "network error" | Wrong API URL or different Wi-Fi | Re-check Section 6; use the LAN IP, not localhost |
| "Cleartext HTTP not permitted" | Manifest did not get the cleartext setting | Re-run `npx expo prebuild --clean`; confirm the `expo-build-properties` plugin in `app.json` |
| `adb: no devices` | USB debugging off, or no driver | Turn on USB debugging; run `adb devices` |
| Gradle fails: SDK not found | `ANDROID_HOME` not set | Set `ANDROID_HOME` (Section 5) |
| Gradle fails: JDK version | Wrong Java version | Use JDK 17 |
| Release build fails: no signing | No keystore configured | Do Section 11 step 1 and 2 |
| App shows old API URL | `.env` read at bundle time | Rebuild after you change `apps/mobile/.env` |

## 20. Rebuild commands (summary)

```bash
# 1. backend (see startup.md), then:
cd apps/mobile
cp .env.example .env            # set EXPO_PUBLIC_API_BASE_URL to the host LAN IP
npm install --legacy-peer-deps
npx tsc --noEmit && npm test
npx expo prebuild --platform android --clean

# quick on-device run:
npx expo run:android --device

# standalone APK (after the one-time keystore step in Section 11):
cd android && ./gradlew assembleRelease
cp app/build/outputs/apk/release/app-release.apk ../../../m3-worker-android.apk
adb install -r ../../../m3-worker-android.apk
```

## 21. Production notes

- Use a real, protected keystore. Do not use the prototype keystore.
- Use HTTPS for the backend. Do not use cleartext HTTP in production.
- Keep development and production API URLs separate.
