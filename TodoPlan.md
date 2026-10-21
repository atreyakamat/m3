# Implementation Todo Plan: M3 Malaria Surveillance Platform

This document defines the implementation tasks for the M3 platform in Simplified Technical English (ASD-STE100 standard).
Each task provides unambiguous technical instructions, exact file locations, and correlation with the existing codebase.

---

## Task 1: Add Dynamic Server URL Configuration and Tunnel Support

### 1. Context and Objective
The mobile application currently reads the API URL from build-time environment variables (`EXPO_PUBLIC_API_BASE_URL`).
When the host laptop changes its IP address or when Wi-Fi client isolation blocks communication, the application fails to connect.
The objective is to allow runtime configuration of the server address and support public tunnel URLs.

### 2. File Locations
- [apps/mobile/src/api.ts](file:///home/atreya/Work/m3/apps/mobile/src/api.ts)
- [apps/mobile/src/store.ts](file:///home/atreya/Work/m3/apps/mobile/src/store.ts)
- [apps/mobile/app/index.tsx](file:///home/atreya/Work/m3/apps/mobile/app/index.tsx)
- [scripts/tunnel.sh](file:///home/atreya/Work/m3/scripts/tunnel.sh)

### 3. Step-by-Step Instructions (STE)
1. Open file [apps/mobile/src/store.ts](file:///home/atreya/Work/m3/apps/mobile/src/store.ts).
2. Add the state property `customServerUrl: string | null` to the Zustand store.
3. Add the action `setCustomServerUrl: (url: string | null) => void`.
4. Open file [apps/mobile/src/api.ts](file:///home/atreya/Work/m3/apps/mobile/src/api.ts).
5. Modify function `resolveMobileBaseUrl()`:
   - Read the stored custom server URL from storage before reading environment variables.
   - Return the stored custom URL if the URL is valid.
6. Open file [apps/mobile/app/index.tsx](file:///home/atreya/Work/m3/apps/mobile/app/index.tsx).
7. Add a "Server Configuration" modal dialog button on the login screen.
8. Add a text input field for the IP address or the public tunnel URL.
9. Add a "Test Connection" button that calls the `/health` endpoint of the entered URL.
10. Create a new shell script [scripts/tunnel.sh](file:///home/atreya/Work/m3/scripts/tunnel.sh).
11. Add command instructions to launch `cloudflared` or `ngrok` pointing to local port `8003`.

---

## Task 2: Configure Android Build for Reduced APK Size (<25MB)

### 1. Context and Objective
The initial Android build produces an APK file larger than 100 megabytes because it contains four CPU architectures and unstripped debug symbols.
The objective is to enable ABI architecture splitting and code minification to decrease file size to less than 25 megabytes.

### 2. File Locations
- [apps/mobile/android/app/build.gradle](file:///home/atreya/Work/m3/apps/mobile/android/app/build.gradle)
- [apps/mobile/eas.json](file:///home/atreya/Work/m3/apps/mobile/eas.json)
- [scripts/build-apk.sh](file:///home/atreya/Work/m3/scripts/build-apk.sh)

### 3. Step-by-Step Instructions (STE)
1. Open file [apps/mobile/eas.json](file:///home/atreya/Work/m3/apps/mobile/eas.json).
2. In the `preview` profile, add the Gradle build arguments:
   ```json
   "gradleCommand": ":app:assembleRelease -PreactNativeArchitectures=arm64-v8a"
   ```
3. Generate native Android files by executing `npx expo prebuild --platform android` if building locally.
4. In [apps/mobile/android/app/build.gradle](file:///home/atreya/Work/m3/apps/mobile/android/app/build.gradle):
   - Set `def enableSeparateBuildPerCPUArchitecture = true`.
   - Set `def enableProguardInReleaseBuilds = true`.
5. Update file [scripts/build-apk.sh](file:///home/atreya/Work/m3/scripts/build-apk.sh) to execute the targeted `arm64-v8a` build command.

---

## Task 3: Complete Hindi Translation and Interactive Application Tour

### 1. Context and Objective
Field operators require full interface support in the Hindi language. New operators require a guided tour to understand workflow steps.

### 2. File Locations
- [apps/mobile/src/i18n.ts](file:///home/atreya/Work/m3/apps/mobile/src/i18n.ts)
- [apps/mobile/components/TourModal.tsx](file:///home/atreya/Work/m3/apps/mobile/components/TourModal.tsx)
- [apps/mobile/app/dashboard.tsx](file:///home/atreya/Work/m3/apps/mobile/app/dashboard.tsx)
- [apps/mobile/app/_layout.tsx](file:///home/atreya/Work/m3/apps/mobile/app/_layout.tsx)

### 3. Step-by-Step Instructions (STE)
1. Open file [apps/mobile/src/i18n.ts](file:///home/atreya/Work/m3/apps/mobile/src/i18n.ts).
2. Add missing Hindi translations for clinical, diagnostic, and notification terms to the `hi` dictionary.
3. Create a new component [apps/mobile/components/TourModal.tsx](file:///home/atreya/Work/m3/apps/mobile/components/TourModal.tsx).
4. Implement a multi-step modal dialog with the following steps:
   - Step 1: User Role and Responsibilities ("आपकी भूमिका").
   - Step 2: Worker Search and Single-Screening ("मज़दूर खोज और एकल जांच").
   - Step 3: Diagnostic and Lab Requests ("जांच और लैब परीक्षण").
   - Step 4: Offline Synchronization ("ऑफलाइन सिंक सुविधा").
5. Add navigation buttons: "Next" ("आगे"), "Back" ("पीछे"), and "Finish" ("समाप्त").
6. Open file [apps/mobile/app/dashboard.tsx](file:///home/atreya/Work/m3/apps/mobile/app/dashboard.tsx).
7. Check local storage key `m3_tour_completed`.
8. Show the `TourModal` automatically when the key is not present.
9. Add a "Start Tour" button in the dashboard settings to let users reopen the tour manually.

---

## Task 4: Simplified Worker Search and Selection for Health Workers

### 1. Context and Objective
Users currently must search workers by code. Health workers must be able to search workers quickly using name, phone number, or home state without remembering codes.

### 2. File Locations
- [apps/mobile/app/dashboard.tsx](file:///home/atreya/Work/m3/apps/mobile/app/dashboard.tsx)
- [apps/mobile/components/WorkerCard.tsx](file:///home/atreya/Work/m3/apps/mobile/components/WorkerCard.tsx)
- [apps/mobile/components/WorkerDetailModal.tsx](file:///home/atreya/Work/m3/apps/mobile/components/WorkerDetailModal.tsx)

### 3. Step-by-Step Instructions (STE)
1. Create a new card component [apps/mobile/components/WorkerCard.tsx](file:///home/atreya/Work/m3/apps/mobile/components/WorkerCard.tsx).
2. Design the card to show:
   - Full worker name in large font.
   - Phone number and home state.
   - Screening status badge (Green for screened, Yellow for pending).
   - "View Record" and "Action" buttons.
3. Create a bottom-sheet modal component [apps/mobile/components/WorkerDetailModal.tsx](file:///home/atreya/Work/m3/apps/mobile/components/WorkerDetailModal.tsx).
4. Show four detail tabs inside the modal:
   - Tab 1: Personal Profile (Demographics and contact).
   - Tab 2: Screening Record (Symptoms and date).
   - Tab 3: Lab Tests (Microscopy and rapid tests).
   - Tab 4: Treatment and Follow-up Schedule.
5. In [apps/mobile/app/dashboard.tsx](file:///home/atreya/Work/m3/apps/mobile/app/dashboard.tsx):
   - Update the search filter to match against: `display_name`, `phone_e164`, `nativity`, and `occupation`.
   - Render the worker list using `WorkerCard`.
   - Open `WorkerDetailModal` when the user taps a card.

---

## Task 5: Implement Single-Screening Rule and Permission Restriction

### 1. Context and Objective
Workers must only be screened once during routine intake. Once screened, duplicate screening must be blocked. Re-screening may only be executed by an authorized Health Worker or Clinician under specific conditions.

### 2. File Locations
- [services/api/app/models.py](file:///home/atreya/Work/m3/services/api/app/models.py)
- [services/api/app/main.py](file:///home/atreya/Work/m3/services/api/app/main.py)
- [apps/mobile/app/intake.tsx](file:///home/atreya/Work/m3/apps/mobile/app/intake.tsx)
- [apps/mobile/app/dashboard.tsx](file:///home/atreya/Work/m3/apps/mobile/app/dashboard.tsx)

### 3. Step-by-Step Instructions (STE)
1. Open file [services/api/app/models.py](file:///home/atreya/Work/m3/services/api/app/models.py).
2. Verify model `Patient` contains `screening_completed: Mapped[bool] = mapped_column(Boolean, default=False)`.
3. Open file [services/api/app/main.py](file:///home/atreya/Work/m3/services/api/app/main.py).
4. In the worker intake endpoint (`POST /patients`):
   - Check if an active record with the same phone or identity already exists.
   - Reject the request with HTTP error 409 if the patient has already completed screening.
5. In the clinical assessment endpoint:
   - Permit re-screening only if the user role is `health_worker` or `clinician`.
   - Record the re-screening reason in the assessment log.
6. Open file [apps/mobile/app/dashboard.tsx](file:///home/atreya/Work/m3/apps/mobile/app/dashboard.tsx):
   - If `worker.screening_completed` is true, disable the "Screen Worker" button.
   - Display label "Screening Completed" ("जांच पूर्ण").
   - Show the "Re-screen" button only for users with the `health_worker` or `clinician` role.

---

## Task 6: Modern Medical Color System and UI Overhaul

### 1. Context and Objective
The user interface currently uses dark monochromatic colors. The objective is to replace this styling with an accessible medical theme containing distinct semantic colors.

### 2. File Locations
- [apps/mobile/components/ui.tsx](file:///home/atreya/Work/m3/apps/mobile/components/ui.tsx)
- [apps/mobile/app/_layout.tsx](file:///home/atreya/Work/m3/apps/mobile/app/_layout.tsx)

### 3. Step-by-Step Instructions (STE)
1. Open file [apps/mobile/components/ui.tsx](file:///home/atreya/Work/m3/apps/mobile/components/ui.tsx).
2. Update the `colors` object with the new medical palette:
   - `primary`: `#0f766e` (Teal 700)
   - `primaryHover`: `#115e59` (Teal 800)
   - `accent`: `#0284c7` (Sky 600)
   - `bg`: `#f8fafc` (Slate 50)
   - `surface`: `#ffffff` (White)
   - `cardBorder`: `#e2e8f0` (Slate 200)
   - `positiveSevere`: `#e11d48` (Rose 600)
   - `pendingReview`: `#d97706` (Amber 600)
   - `negativeCleared`: `#059669` (Emerald 600)
3. Increase button padding and border radius to 12 pixels for better touch accessibility.
4. Update file [apps/mobile/app/_layout.tsx](file:///home/atreya/Work/m3/apps/mobile/app/_layout.tsx) header background to `#0f766e` with white text.

---

## Task 7: Kafka Event Streaming and In-App Notification Center

### 1. Context and Objective
The platform requires real-time notification dispatching when tests are positive or when an outbreak occurs.
The objective is to deploy Apache Kafka in KRaft mode and connect an in-app notification bell with an unread badge counter.

### 2. File Locations
- [docker-compose.yml](file:///home/atreya/Work/m3/docker-compose.yml)
- [services/api/requirements.txt](file:///home/atreya/Work/m3/services/api/requirements.txt)
- [services/api/app/kafka_producer.py](file:///home/atreya/Work/m3/services/api/app/kafka_producer.py)
- [apps/mobile/components/NotificationBell.tsx](file:///home/atreya/Work/m3/apps/mobile/components/NotificationBell.tsx)
- [apps/mobile/components/NotificationModal.tsx](file:///home/atreya/Work/m3/apps/mobile/components/NotificationModal.tsx)
- [apps/mobile/app/_layout.tsx](file:///home/atreya/Work/m3/apps/mobile/app/_layout.tsx)

### 3. Step-by-Step Instructions (STE)
1. Open file [docker-compose.yml](file:///home/atreya/Work/m3/docker-compose.yml).
2. Add service `kafka` using image `apache/kafka:3.7.0` configured in KRaft mode.
3. Open file [services/api/requirements.txt](file:///home/atreya/Work/m3/services/api/requirements.txt).
4. Add dependency `aiokafka==0.12.0`.
5. Create module [services/api/app/kafka_producer.py](file:///home/atreya/Work/m3/services/api/app/kafka_producer.py) to send events to topic `malaria.events`.
6. Create component [apps/mobile/components/NotificationBell.tsx](file:///home/atreya/Work/m3/apps/mobile/components/NotificationBell.tsx).
7. Show an unread count badge on top of the bell icon.
8. Create component [apps/mobile/components/NotificationModal.tsx](file:///home/atreya/Work/m3/apps/mobile/components/NotificationModal.tsx) to display notifications with filters.
9. In [apps/mobile/app/_layout.tsx](file:///home/atreya/Work/m3/apps/mobile/app/_layout.tsx), mount `NotificationBell` in the right header position.

---

## Verification Matrix

| Task ID | Verification Step | Expected Outcome |
| :--- | :--- | :--- |
| **Task 1** | Enter tunnel/LAN URL in mobile dialog and press "Test" | Dialog reports HTTP 200 health check response |
| **Task 2** | Execute `./scripts/build-apk.sh` | APK file output size is below 25 megabytes |
| **Task 3** | Switch language to Hindi and launch tour | All labels render in Hindi; tour completes without errors |
| **Task 4** | Search for worker by first name or state in dashboard | Matching worker cards display instantly |
| **Task 5** | Attempt second intake on screened worker as Contractor | Screen is disabled; re-screening only enabled for Clinician |
| **Task 6** | Inspect UI across all screens | Medical palette (Teal/Emerald/Rose) renders consistently |
| **Task 7** | Post positive diagnostic test in backend API | Notification bell displays badge `1`; tapping opens alert |
