# M3 Mobile App — Screenshot Index (Android phone view)

Captured **2026-10-21**, purpose: UI/UX review of the M3 Malaria Surveillance Platform mobile app across all seven roles.

## Access method — IMPORTANT

**No physical Android device was available or used.** `adb` is not installed, no USB Android device was attached, and wireless ADB was not reachable (no listening device found on :5555). No emulator was used either.

These are quiet captures of the **real Expo web build** (`apps/mobile`, served by Docker at `http://localhost:8081`, live API `http://localhost:8003/api/v1`) rendered in **headless Chromium v154** at an Android phone viewport (**412 × 915 CSS px, 2× DPR, mobile + touch flags**) — i.e. what Chrome-on-phone renders. Every screen, form validation chip, modal, QR code and network round-trip is the genuine app logic talking to the real dev backend; the rendering engine and input stack (fiber-press harness) differ from React Native on Android, where noted below.

Driver: puppeteer-core (`/tmp/opencode/m3-cap`), synthetic test accounts only, no DB resets/migrations, no app code modified, nothing committed.

## Accounts used (seeded in `m3_compose_dev`)

| Role | Phone | PIN |
|---|---|---|
| worker (Routing Worker, assigned to Routing Site) | `+919010874676` | 2468 |
| contractor (SITE-A / SITE-1 / P1-SN) | `+919000000001` | 1234 |
| contractor (Routing Site owner, roster with worker) | `+919019911232` | 2468 |
| clinician | `+919000000003` | 1234 |
| pathologist (role string `pathology`) | `+919000000004` | 1234 |
| health_worker | `+919000000006` | 1234 |
| research_lab | `+919000000007` | 1234 |
| admin | `+919000000008` | 1234 |

Note the demo quick-sign-in chips on the sign-in screen say “PIN 2468” for every role, but the seeded non-worker roles only accept **1234** (mismatch is a defect; see below).

## Shots

### Shared / pre-login (01–05)
| File | What it shows |
|---|---|
| `01-sign-in.png` | Sign-in screen: tabs, phone + PIN fields, demo quick-sign-in chips, “Synthetic data only” banner |
| `02-sign-up-registration.png` | “Register / Sign up” tab |
| `03-server-configuration.png` | Server Configuration screen (API base + connection test state) |
| `04-sign-in-validation-errors.png` | Inline sign-in validation errors on empty submit |
| `05-guided-tour-step-1..4.png` | 4 steps of the first-launch guided tour (fresh browser profile) |

### Worker (09–27)
| File | What it shows |
|---|---|
| `09-worker-dashboard.png` | Worker dashboard top: role chip, stat tiles, Surveillance Actions, case queue (server data) |
| `10-worker-dashboard-lower.png` | Lower dashboard: cached record card, last sync, System Diagnostics (API config, Local Outbox), tour/log-out actions |
| `12-worker-qr-pass.png` | “My Worker QR Pass” modal with QR image + token |
| `13-worker-notifications-modal.png` | Notifications modal (bell icon) |
| `14-worker-intake-step1-demographics.png` | Screening form step 1 (Demographics) filled |
| `15-worker-intake-step1-validation.png` | Step 1 inline validation errors after clearing required fields and pressing “Malaria History →” |
| `16-worker-intake-step2-malaria-history.png` | Step 2 (Malaria History) with “Ever diagnosed” chip selection |
| `17-worker-intake-step3-clinical-signs.png` | Step 3 (Clinical Signs): temperature, danger-sign chips, symptoms picker (empty + filled states in same file — first capture unsigned, second filled) |
| `18-worker-intake-step4-mobility.png` | Step 4 (Mobility & Migration) chips |
| `19-worker-intake-step5-travel.png` | Step 5 (Planned Travel) chips |
| `20-worker-intake-step6-review.png` | Step 6 Review & Final Submission summary (submitted intentionally **not** pressed — see gaps) |
| `21-worker-symptom-form.png` | “I feel unwell” form (empty then filled: symptoms, onset, temperature, location, facility) |
| `22-worker-symptom-report-confirmation.png` | Inline **“Report received”** confirmation with case reference `M3-CA-96B8AA52` (real POST `/symptom-reports` → 201) |
| `23-worker-mycases.png` | “My cases” with status history links, incl. the newly created case awaiting clinical review |
| `24-worker-dashboard-offline-banner.png` | Dashboard with **“Offline Mode Active”** banner + OFFLINE chip (network emulated offline) |
| `25-worker-symptom-offline-queued.png` | Offline submit → inline **“Saved for sync”** state |
| `27-worker-intake-offline-pending-sync-banner.png` | Intake header **“Pending sync” / 1 record queued** banner while offline |

### Contractor (30–42)
| File | What it shows |
|---|---|
| `30-contractor-dashboard.png` / `31-…-lower.png` | Contractor dashboard (top / lower). Contractor has **no role-specific stat tiles or ActionCards other than “Sites”** — dashboard is mostly the generic record-search view |
| `32-contractor-sites-list.png` | “Contractor Site Scoping” + site list (view 1) |
| `33-contractor-site-create-form.png` | “Create Construction Site” form (Name / District default North Goa / Area default Panaji / optional Site Code, Cancel + Create Site) |
| `34-contractor-site-details-roster.png` | SITE-A “Contractor A site” detail: **empty** roster, “No Workers Assigned”, “+ Add Worker” |
| `35-contractor-addworker-modal.png` | “Add Worker to Site” modal (empty) |
| `36-contractor-addworker-filled.png` | Same modal with worker code filled via Quick Pick |
| `38-contractor-with-worker-dashboard.png` | Routing Site contractor (`+919019911232`) dashboard |
| `39-contractor-site-roster-with-worker.png` | Routing Site roster with M3-AB01D699 “Routing Worker” (assigned 2026-10-01) |
| `40-contractor-health-status-modal.png` | “OPERATIONAL HEALTH CHECK / Reported Status” modal — Record Health Status chips (malaria species incl. P. vivax/Pf/Mixed/Other/Unknown; treatment Treated/Untreated/Unknown) |
| `41-contractor-addworker-modal-with-quickpick.png` | Add Worker modal listing cached workers |
| `42-contractor-addworker-after-assign-attempt.png` | Roster after Assign Worker attempt (POST 200). The duplicate-assignment / transfer dialogs are `Alert.alert`, which **does not render on web** — not catchable |

### Clinician (45–51) — card order on this dashboard: Clinical assessment, Diagnostics, Follow-ups, Research lab
| File | What it shows |
|---|---|
| `45-clinician-dashboard.png` / `46-…-lower.png` | Clinician dashboard: stat tiles (Workers 49 / Diagnostics 12 / Follow-ups 3), 4 ActionCards, live notification list (includes the case from `22`) with “Mark read” |
| `47-clinician-assessment-form.png` / `…-lower.png` | “Clinical Observation Assessment” form (Case ID, temp, fever days, symptoms, follow-up date, notes; not submitted) |
| `48-clinician-diagnostics-sample-tab.png` | “Laboratory Protocol & Isolation” — Diagnostic Sample tab |
| `49-clinician-diagnostics-slide-followup-tab.png` | Slide Follow-Up tab (longitudinal post-treatment slides) |
| `50-clinician-followup-schedule-form.png` / `…-lower.png` | “Schedule Follow-up Visit” (clinician-only) + preset selector |
| `51-clinician-research.png` | Research lab read-only screen |

### Pathologist (55–57)
| File | What it shows |
|---|---|
| `55-pathologist-dashboard.png` | Pathology role dashboard |
| `56-pathologist-diagnostics-sample-tab.png` | Diagnostic Sample tab |
| `57-pathologist-diagnostics-slide-followup-tab.png` | Slide Follow-Up tab |

### Health worker (60–62)
| File | What it shows |
|---|---|
| `60-healthworker-dashboard.png` / `61-…-lower.png` | Health worker dashboard (top / lower) |
| `62-healthworker-followups.png` | Follow-ups, **Read-Only View** banner, “My Assignments” (DUE row) |

### Research lab (65–67)
| File | What it shows |
|---|---|
| `65-researchlab-dashboard.png` / `66-…-lower.png` | Research role dashboard |
| `67-researchlab-screen.png` | Research lab screen: “Read-only throughout the initial release” + “No authorized cached records” |

### Admin (70–71)
| File | What it shows |
|---|---|
| `70-admin-dashboard.png` | Admin dashboard: Case queue (20 recent) with awaiting-clinical-review badges |
| `71-admin-dashboard-lower.png` | Lower admin dashboard |

## Screens / states that could NOT be captured (honest list)

- **Screening submit confirmation (`Alert.alert('Screening Submitted')`)** — `Alert.alert` is a no-op on react-native-web: the dialog (and its OK → dashboard callback) never appears. Submit was therefore not pressed; step 6 review (`20`) is the furthest verified state. On a real Android device this would show the native alert.
- **Contractor QR *camera* scan screen — not implemented.** Assignment is by pasted QR payload/token or the “Quick Pick from Cached Workers” helper; there is no camera dependency in the mobile app.
- **Duplicate-assignment (“Worker Already Assigned”) and transfer dialogs — not renderable on web.** They are `Alert.alert`. Instead, `42` captures the roster after the Assign Worker POST returned 200.
- **Offline sign-in submission attempt** — button renders disabled/greyed (`26` shows the state); no network write attempted.
- **Questionnaire `Pending sync`/`Queued & needs attention` banner variants other than “Pending sync”** (e.g. retry/failure states) — not triggered; only the 1-record-queued state was captured (`27`).
- **Hindi locale screens** — out of scope for this pass; switch available on `_dashboards` (“Switch to हिंदी”).

## UI defects observed (captured or reproducible — none fixed)

1. **Nested interactive `<button>`s** — `components/WorkerCard.tsx:39` renders a `Pressable` (accessibilityRole="button") inside a `Button`. React logs a hydration/DOM-validation error; the Expo dev “Console Error” overlay pops up repeatedly, and a `0×0` `<div id="error-toast">` (position:absolute, pointer-events:auto) sits at the bottom of the page and **eats clicks/taps** — invisible 0-size elements still win Chromium hit-testing, so touches landing at the bottom edge of the screen are swallowed.
2. **Trusted mouse/touch clicks do not fire React press handlers** on RN-web `Pressable`/`Text` elements (they only respond to the fiber `onPress` dispatch or native `<button>` click). On a real phone (React Native thread-driven presses) this is not an issue, but it makes the whole web build effectively mouse-dead for many controls — worth noting if web deployment is ever considered.
3. **Demo quick-sign-in labels vs seeded roles mismatch** — chips claim “PIN 2468” for all roles, but 003–008 accept 1234; contractor-with-worker (`+919019911232`) isn't listed at all.
4. **Case-queue card date wraps mid-token**: “Site: Routing Site · 2026-/10-21 11:31” breaks after the year (admin/clinician dashboards, `70`).
5. **Follow-up assignment row text truncates badly**: “Health Worker · +?” and “Worker patient-” cut without ellipsis (health worker follow-ups, `62`).
6. **Contractor roster row horizontally clipped**: “Update Status” button renders as “Upda…” off the card edge (`42`, `39`).
7. **Intake draft auto-restore with no “clear” affordance** — every intake open hydrates the partially-filled draft (server-synced); repeat visits show previous data silently. Captured states reflect this on 14–20.
8. **Full page reload loses role context** — after a browser reload the dashboard degrades to a generic “Authorized User” (no role chip/cards) until re-data; observed during automation, no screenshot (avoided by in-page navigation).
9. **PIN input not wrapped in a `<form>`** (DOM a11y warning) — Enter-key submission likely unsupported on web.

## Reproduce / driver

- Library: `/tmp/opencode/m3-cap/lib.mjs` (fiber `onPress` dispatch, real-keystroke typing with verification, DOM-button click, modal close with gate text, CDP offline emulation).
- Scripts: `worker7.mjs`, `contractor.mjs`, `contractor2.mjs`, `clinician2.mjs`, `roles.mjs`, `pend27.mjs`, `offline26.mjs`.
- Screenshots land here automatically; every file in this dir is a single named capture — none are duplicates (SHA-1 verified unique).
