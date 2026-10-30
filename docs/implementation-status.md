# Implementation status

Scope delivered: a complete Worker experience (mobile + web + backend), the
Contractor transfer functions, placeholder dashboards for the other five roles,
Dockerised, with 70 passing automated tests.

## Verified in this build

- **Shared** package: builds, 24 unit tests pass.
- **API**: typechecks, builds, 31 unit+integration tests pass against Postgres;
  boots in Docker; 36 OpenAPI paths; migrations + seed apply cleanly.
- **Web**: typechecks, 7 component tests pass, production build succeeds, served
  by nginx in Docker.
- **Mobile**: typechecks, 8 component/i18n tests pass.
- **Docker**: `docker compose up --build` brings up db + api + web; verified
  end-to-end (health, seeded worker + contractor logins, authenticated profile,
  contractor site listing).

## Acceptance criteria (master prompt §15)

| # | Criterion | Status |
| --- | --- | --- |
| 1 | Android Worker app builds | ◐ Source complete + typechecks + unit tests; native APK build needs Expo/Android SDK (not run in this environment) |
| 2 | New worker can register | ✅ |
| 3 | Returning worker recognized | ✅ |
| 4 | Four languages supported | ✅ mobile i18n (en/hi/bn/mr); web UI currently English-only |
| 5 | Select a construction site | ✅ |
| 6 | Complete initial screening once | ✅ |
| 7 | Resume an interrupted screening | ✅ |
| 8 | View profile | ✅ |
| 9 | Submit a symptom report | ✅ (offline-capable on mobile) |
| 10 | View authorized malaria records | ✅ |
| 11 | Current prescription by default | ✅ |
| 12 | Prescription history | ✅ |
| 13 | Respond to follow-ups | ✅ |
| 14 | Worker initiates a transfer | ✅ |
| 15 | Contractor initiates via Worker ID | ✅ (web + API) |
| 16 | Worker accepts/rejects contractor-initiated | ✅ |
| 17 | Current-site contractor approval enforced | ✅ |
| 18 | Destination-contractor approval for worker-initiated | ✅ |
| 19 | Contractor-initiated needs no destination approval | ✅ |
| 20 | Only one pending request per worker | ✅ (app + partial unique index) |
| 21 | Rejection/cancellation don't change the active site | ✅ |
| 22 | Site changes immediately after required approvals | ✅ |
| 23 | Previous assignments retained in history | ✅ |
| 24 | Other six roles have placeholder navigation | ✅ web portal (mobile is worker-only by architecture) |
| 25 | Required backend APIs work | ✅ |
| 26 | Unit tests pass | ✅ |
| 27 | Integration tests pass | ✅ |
| 28 | Mobile tests pass | ✅ |
| 29 | Documented offline functions | ✅ (`docs/offline-sync.md`) |
| 30 | Documentation matches the system | ✅ |

Legend: ✅ done · ◐ code-complete, native build not executed here.

## Deliberate scope decisions

- **Mobile = Worker only**; the other roles (contractor transfer workspace +
  five placeholders) live in the **web portal**. This matches
  `worker_architecture.md` (worker-only mobile) and the user's mobile+web request.
- **Backend stack is NestJS + Prisma + PostgreSQL** (the prompt's baseline), not
  the earlier FastAPI stack, per the from-scratch rebuild decision.
- Web UI strings are English-only in this pass (i18n was in the mobile directive);
  the web renders the questionnaire content from the shared definition.

## Open decisions (NOT hard-coded — require project confirmation)

1. **`Kushavati` district label** — kept exactly as supplied; flagged for
   master-data verification before loading production site data.
2. **Consent/ethics wording** — the consent step is a configurable placeholder;
   final approved consent/assent text must be supplied (`CONSENT_STEP.needsApproval`).
3. **Preferred-language set** — the questionnaire lists Hindi/English/Bengali/Other;
   the app i18n also offers Marathi. Confirm the official set.
4. **OTP / phone verification & account recovery** — deferred; the current flow is
   phone + PIN.
5. **Symptom questions & escalation** — the symptom list reuses the approved
   questionnaire's "Associated Symptoms"; final symptom set, recipients and
   escalation rules are to be approved.
6. **Backend hosting, backups, key rotation, HTTPS termination** — deployment-time.

## Suggested next steps

- Run a native Android build (`npx expo run:android` / EAS) on a machine with the
  Android SDK and capture device screenshots.
- Add web i18n for the four languages if parity with mobile is required.
- Translate the approved questionnaire wording into the four languages once the
  official translations are provided (not machine-invented).
