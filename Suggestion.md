# Suggestions & Roadmap for M3 Surveillance Platform

This document outlines structural recommendations and actionable architectural improvements for the M3 Malaria Surveillance Platform, covering APK size optimization, LAN & public tunneling connectivity, Hindi localization, interactive guided tours, simplified patient matching for health workers, single-screening governance, and Apache Kafka real-time event streaming.

---

## 1. Laptop IP Connectivity & Network Tunneling

### Why connecting to the laptop LAN IP fails on physical Android devices:
1. **Host Firewall & Port Binding**: Linux/UFW firewall blocking incoming connections on port `8003` from non-localhost interfaces.
2. **Wi-Fi Router AP Isolation (Client Isolation)**: Many office/home Wi-Fi routers prevent wireless clients (e.g. your Android phone) from directly communicating with other wireless devices (your laptop) on the same subnet.
3. **Dynamic IP Changes**: If your laptop is assigned a new IP via DHCP, the APK hardcoded to the old IP stops communicating.

### Recommended Solutions:
* **Option A: Free Public Tunnel (ngrok / Cloudflare Tunnel) (Zero Configuration, Works Everywhere)**:
  - Run a lightweight tunnel on your laptop:
    ```bash
    cloudflared tunnel --url http://localhost:8003
    # or
    ngrok http 8003
    ```
  - Use the resulting public HTTPS URL (e.g., `https://m3-api.trycloudflare.com`) in `EXPO_PUBLIC_API_BASE_URL`.
  - **Advantage**: The installed APK works seamlessly whether the phone is on 4G/5G cellular data or on the same Wi-Fi, completely bypassing router AP isolation and firewall blocks.
* **Option B: Subnet Discovery & Firewall Allow**:
  - Run `sudo ufw allow 8003/tcp` and verify API binds to `0.0.0.0` instead of `127.0.0.1`.
  - In the mobile app, add an **"API Settings / Server IP"** button on the sign-in screen allowing you to type or scan the current laptop IP without rebuilding the APK.

---

## 2. Authentication, Sign-In & Role Profiles

### Current Limitations:
- The app uses numeric phone + PIN login, with developer demo accounts (`+919000000001` - `007`).
- Role profiles often lack display information, organization linkage, or assigned sites.

### Proposed Authentication Overhaul:
1. **Interactive Role Switcher for Testing & Demo**:
   - Add a quick 1-tap "Sign in as Demo Role" selector (Health Worker, Clinician, Pathologist, Contractor, Worker) to easily test role-specific workflows without typing PINs each time.
2. **Proper Token Refresh & Secure Session**:
   - Store encrypted JWT in `SecureStore` (Android KeyStore).
   - Display a clean user profile card in the top bar showing: `[Avatar] Name (Role: Health Worker) • Site: North Goa Yard 3`.
3. **Incomplete Role Data Resolution**:
   - Define a mandatory onboarding step for profiles with missing fields (e.g. contractor site assignments, clinician license number, health worker sub-center).
   - Show a non-intrusive alert card on the dashboard: *"Profile incomplete: Tap to set your assigned clinic/construction site."*

---

## 3. Native Hindi Support & Guided Interactive Tour (English / Hindi)

### A. Comprehensive Hindi Localization
- Full translation for all field workflows:
  - Worker Intake: *"मज़दूर पंजीकरण"*
  - Clinical Assessment: *"चिकित्सीय जांच"*
  - Pathology / Slide Test: *"रक्त जांच एवं स्लाइड रिपोर्ट"*
  - Follow-up: *"फॉलो-अप और उपचार"*
  - Symptoms: *"लक्षण (बुखार, ठंड लगना, सिरदर्द)"*
- Language toggle (`EN` | `हिंदी`) accessible directly in the top header on every screen with persistent preference.

### B. Interactive App Tour (Hindi & English)
- **First-Launch Walkthrough**:
  - Step 1: **Welcome & Role Overview** - Explanation of the user's role and capabilities.
  - Step 2: **Worker Intake / Search** - How to quickly look up a worker by name or scan a QR code.
  - Step 3: **Screening Policy** - Explanation that workers only need to be screened once.
  - Step 4: **Offline Mode** - How offline cache and syncing work when network coverage drops.
- A permanent **"Help / Start Tour" ("सहायता / ऐप टूर")** button in the dashboard settings to replay the tour at any time.

---

## 4. Simplified Worker Search & Selection for Health Workers

### The Problem:
- Health workers are forced to remember or type complicated alphanumeric codes (e.g., `M3-2026-00492`).

### The Solution:
1. **Fuzzy Search by Name, Phone & Native State**:
   - Single unified search bar with instant autocomplete.
   - Typing `"Ramesh"` or `"Bihar"` or the last 4 digits of their phone immediately displays a matching candidate list.
2. **Candidate Identification Card**:
   - Rather than just displaying a code, show an intuitive card:
     ```
     ┌─────────────────────────────────────────────────────────┐
     │ 👤 Ramesh Kumar                    [Already Screened ✅] │
     │ 📞 +91 98765 43210  •  Age: 28  •  From: Bihar          │
     │ 📍 Assigned Site: Panaji Tower Phase 2                  │
     │ [View Health Record]              [Re-screen (Doctor)]  │
     └─────────────────────────────────────────────────────────┘
     ```
3. **One-Tap Patient Selection**: Selecting a card immediately loads their records, past tests, and pending actions without needing manual code entry.

---

## 5. Single-Screening Governance (Once Screened, Cannot Be Re-screened Unless Authorized)

### Business Logic Rule:
- **Primary Rule**: Once a worker completes their initial intake screening, their status transitions to `screened`. They **cannot be re-screened** by routine field workers or contractors to prevent duplicate records and skewed surveillance data.
- **Exception / Override**:
  - Re-screening is **locked** and only available to designated **Health Workers** or **Clinicians** if:
    1. A new fever / symptomatic episode is reported (`symptom_report`), OR
    2. More than 90 days have elapsed since the prior screening.
- **UI Feedback**:
  - If a worker is already screened, the "Screen Worker" button is replaced with **"Already Screened on [Date] — View Details"**.
  - A lock icon with tooltip: *"This worker has already completed initial screening. Only authorized Health Workers can initiate a clinical re-assessment."*

---

## 6. Card & Button-Driven UI with Modal Detail Views

### Visual Redesign:
- Transform raw text lists into **touch-friendly action buttons and expandable cards**:
  - Large tap targets (minimum 48x48dp) suitable for rugged field conditions.
  - High-contrast status badges (Green = Cleared, Yellow = Test Pending, Red = Malaria Positive).
- **Bottom-Sheet Modal Inspection**:
  - Tapping any worker or diagnostic record opens a smooth bottom-sheet modal with full structured tabs:
    1. **Overview**: Photo, Name, Age, State, Contact.
    2. **Screening Status**: Initial symptoms, date screened, screening worker.
    3. **Diagnostic History**: RDT and Microscopy results.
    4. **Treatment Plan**: Medication dosage, completion status, and next scheduled follow-up.

---

## 7. APK Size Optimization (From >100MB to ~25MB)

1. **Enable ABI Splitting in Gradle**:
   - Build dedicated `arm64-v8a` binaries rather than bundling all 4 Android architectures into one APK.
2. **Enable ProGuard & R8 Code / Resource Shrinking**:
   - Strip unused native libraries, unreferenced Java classes, and debug symbols.
3. **Configured `eas.json`**:
   - Target preview builds for direct APK installation on physical phones.

---

## 8. Apache Kafka Real-Time Event Hub & Top-Bar Notification Bell

```
[Events: Intake, Positive Test, Outbreak]
                     │
                     ▼
             [FastAPI Backend]
                     │
          (Kafka KRaft Producer)
                     │
                     ▼
           [Apache Kafka Broker]
                     │
       ┌─────────────┴─────────────┐
       ▼                           ▼
[Notification Worker]     [Analytics Engine]
       │
   Push to:
   - Mobile In-App Bell (Unread count badge)
   - Web Console Alerts
```

- **Top Bar Notification Bell**:
  - Displays unread counter badge.
  - Tapping opens a notification drawer with critical alerts (e.g. *"Positive Falciparum detected at Site B - 3 workers requiring follow-up"*).

---

## 9. Implementation Roadmap & Priority Matrix

| Phase | Feature | Impact | Area |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Cloudflare / ngrok tunnel & Server IP selector | Resolves phone connection issues instantly | Mobile, API |
| **Phase 2** | Hindi translation & English/Hindi interactive tour | Usability for on-ground health workers | Mobile UI |
| **Phase 3** | Worker name/phone search & single-screening lock | Eliminates duplicate entries and code memorization | Mobile, Backend |
| **Phase 4** | Card-and-button redesign with bottom sheet details | Modern, intuitive user experience | Mobile UI |
| **Phase 5** | APK ABI split (<25MB) & Kafka notification pipeline | Performance & enterprise scalability | Docker, Gradle |
