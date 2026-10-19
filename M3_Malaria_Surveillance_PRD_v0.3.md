**M3 PLATFORM  /  PRODUCT REQUIREMENTS** 

### **M3** 

# **Malaria Surveillance Platform** 

##### **PRODUCT REQUIREMENTS DOCUMENT** 

React Native rebuild • Offline-first field operations • Centralized surveillance 

|**Document field**|**Value**|
|---|---|
|Version|0.2 — Updated with user decisions; review draft|
|Product|M3 Platform — ICMR-funded malaria surveillance project|
|Source basis|Research proposal; M3 Platform technical overview; Current State<br>Audit & React Native Migration Blueprint|
|Primary geography|Panaji, Candolim, Cortalim, Margao, Goa (initial pilot; confirm current<br>deployment scope)|
|Audience|Product owner, research team, clinical stakeholders, engineering<br>team, AI coding agent|
|Status|Not implementation-ready until P0 decisions in Section 16 are<br>confirmed|



CONFIDENTIAL WORKING DRAFT  •  v0.1  •  For stakeholder review 

**M3 PLATFORM  /  PRODUCT REQUIREMENTS** 

## **REVISION NOTE — USER DECISIONS RECEIVED (v0.2)** 

This revision records the latest user decisions and supersedes conflicting draft assumptions. The remainder remains a working draft until the blocking decisions are answered. 

#### **Confirmed decisions** 

- Platforms: Android APK plus web/desktop operations console. Keep the codebase iOS-capable, but iOS is not a launch criterion unless separately approved. 

- Backend recommendation: FastAPI + SQLAlchemy + Alembic + PostgreSQL, packaged with Docker Compose for local/self-hosted deployment. 

- Hosting: initially run API and PostgreSQL in Docker on a project-controlled machine. Cloud hosting is optional later, not required for the first local model. 

- Authentication: PIN-based. Store only a strong salted hash; enforce rate limits, lockout/backoff, server-side role/scope checks and secure reset/provisioning. Never store plaintext PINs. 

- Existing data migration: not required for MVP. Start with a clean database and synthetic development fixtures; document a future import path but do not build CSV migration now. 

- Database portability: PostgreSQL is authoritative in Docker; use versioned migrations and environment configuration so deployment can later move to an approved server/cloud. 

#### **Important deployment clarification** 

A Docker database on a workstation/server is not automatically reachable by an Android APK. The API must be reachable over the same machine, LAN, VPN or approved public endpoint. Never expose PostgreSQL directly to mobile devices or the public internet; expose the authenticated API and keep the database on a private Docker network. A physical phone's localhost is the phone itself, not the Docker host. Include configurable API_BASE_URL, health checks, persistent Docker volumes, backup/restore instructions and secure secrets handling. 

#### **Revised MVP architecture** 

React Native + Expo + TypeScript mobile app; React + TypeScript web console; FastAPI REST/OpenAPI service; PostgreSQL in Docker; SQLAlchemy/Alembic; Docker Compose; Expo SQLite for offline records and outbox; server-validated PIN authentication with RBAC; monochromatic design system with Reanimated motion. Suggested monorepo areas: apps/mobile, apps/web, services/api and infra/docker. 

The build can start with local development and synthetic data, but production use with real health data must wait for the clinical, privacy, host/network and security decisions listed in Section 19. 

## **How to use this PRD** 

This document is intended to be executable by a capable coding agent as a single implementation brief, while making unresolved product and compliance decisions explicit. Do not silently invent answers to questions marked OPEN. Implement safe defaults and feature flags where possible, and stop for approval where the decision affects clinical safety, identity, legal compliance, deployment, or data migration. 

Evidence convention: “Source-backed” means the supplied documents state it. “Proposed” means a product/engineering recommendation in this PRD. “Open” means stakeholder confirmation is required. 

## **Executive summary** 

Rebuild the existing native Android M3 application as a cross-platform React Native application that preserves the six established stakeholder workflows, replaces CSV persistence with a relational local database, and introduces secure synchronization to a central service. The product must work reliably in low-connectivity field conditions, protect sensitive 

CONFIDENTIAL WORKING DRAFT  •  v0.1  •  For stakeholder review 

**M3 PLATFORM  /  PRODUCT REQUIREMENTS** 

worker and health information, support role-scoped access, and present concise task-oriented forms with autosave and clear progress. 

The system consists of (1) mobile field app for Android first and iOS if approved, (2) a browser-based operations console for authorized administration and surveillance, (3) API/backend, (4) central relational database, and (5) offline synchronization and audit infrastructure. The browser console is a proposed requirement because the research proposal expects PHC/UHC and state-level monitoring; its exact scope requires confirmation. 

## **1. Product context and current state** 

#### **1.1 Existing product baseline** 

- Native Android application using Kotlin, Jetpack Compose and Material 3; Android 11+ in the technical overview. 

- Phone-based entry; returning/new worker detection; professionals register once and use the same entry screen. 

- Role routing supports multiple roles for one phone number. 

- Worker receives a generated privacy-preserving Patient ID used by other stakeholders. 

- Six workflows: Worker, Clinician, Pathology, Health Worker, Research Lab, Contractor. 

- Offline-only storage currently uses CSV files in application-private storage; central server integration is described as a future phase. 

- Forms preserve progress through interruptions, and worker profile commit occurs only after intake completion. 

- Current design is restricted distribution/direct APK installation rather than public app-store discovery. 

#### **1.2 Research goals that must be preserved** 

- Real-time or near-real-time capture and monitoring of malaria cases among migrant labourers. 

- Screening at construction sites and recording travel/migration history, temperature, prior malaria history and symptoms. 

- Recording diagnostic findings and Plasmodium species, including P. falciparum, P. vivax and mixed infection where confirmed by the lab. 

- Coordinating diagnosis, treatment and follow-up among workers, clinicians, labs, health workers, contractors and health authorities. 

- Support the initial four study areas and a staged scale-up, with the research proposal identifying approximately 15,000 workers for Stage 1. 

#### **1.3 Current pain points from the audit** 

- Long, vertically scrolling forms and repetitive manual entry. 

- Limited visual hierarchy across stakeholder navigation. 

- No centralized visibility while records remain on individual devices. 

- CSV files limit relational querying and increase corruption/concurrency risks. 

- No integrated sync queue, conflict handling, or central audit trail in the described current state. 

## **2. Vision, goals and non-goals** 

#### **Vision** 

A dependable, privacy-conscious malaria surveillance workflow that lets field teams capture once, share only with authorized roles, coordinate timely testing and follow-up, and produce actionable site- and area-level surveillance views— even when offline. 

CONFIDENTIAL WORKING DRAFT  •  v0.1  •  For stakeholder review 

**M3 PLATFORM  /  PRODUCT REQUIREMENTS** 

#### **Goals** 

- Preserve the current six stakeholder domains and their core data capture responsibilities. 

- Make worker intake, clinical assessment, lab entry and follow-up faster and less error-prone. 

- Guarantee that incomplete drafts survive app closure, incoming calls, navigation and device restart. 

- Use a relational schema with validation, indexes, migrations and referential integrity. 

- Provide reliable offline writes and retryable, idempotent synchronization when online. 

- Enforce least-privilege role-based access and log access to sensitive records. 

- Deliver a signed Android APK and a usable web/desktop interface for approved operational roles. 

- Make implementation reproducible through automated tests, documented setup and CI build steps. 

#### **Non-goals for the first release unless approved** 

- Autonomous diagnosis, AI-based treatment recommendations, or automated clinical decisions. 

- Replacing official clinical protocols or government reporting systems without approved integration specifications. 

- Telemedicine, drug inventory/supply-chain management, national rollout, tourist population workflows, or wholepopulation coverage. 

- Blockchain, zero-knowledge proofs, or bespoke AI security mechanisms solely because they were mentioned in the research proposal; use established, reviewable security controls unless a validated requirement and threat model justify these additions. 

- Public self-registration or public app-store distribution before the restricted pilot’s governance is approved. 

## **3. Users, roles and permissions** 

|**Role**|**Primary responsibilities**|**Access boundaries (proposed)**|
|---|---|---|
|Worker / Patient|One-time intake; demographic, contact,<br>migration/travel, symptoms and malaria<br>history; view own digital ID/pass and<br>approved instructions.|Own profile and own permitted records only;<br>no access to other workers.|
|Clinician / Medical Officer|Clinical assessment, vitals, symptoms, co-<br>morbidities, diagnosis context, treatment<br>and admission/discharge details.|Assigned facility/area or authorized patient<br>records; no unrestricted research export.|
|Pathology / Pathologist|RDT, microscopy, smear details, diagnostic<br>status, species and scheduled slide work.|Assigned diagnostic work and minimum<br>necessary patient identifiers.|
|Health Worker|Follow-up scheduling, adherence checks,<br>patient status, outcome and overdue follow-<br>up queue.|Assigned caseload/site/area; no unrelated<br>lab or admin data unless needed.|
|Research Lab|PCR sampling, parasite density, gametocyte<br>presence, resistance markers and gene-<br>deletion status.|Research/lab fields; access governed by<br>consent, protocol and approvals.|
|Contractor / Site Manager|Site metadata, worker roster and movement,<br>employment/site association; limited status<br>view for operational follow-up.|Workers linked to managed sites only; must<br>not expose detailed clinical notes or lab data<br>by default.|
|State / District / PHC-UHC Admin|Manage sites, facilities, users, role<br>assignments, dashboards, exports and audit<br>review.<br>i|Scope-based access by jurisdiction;<br>elevated actions audited.|
|System Administrator|Technical configuration, user provisioning<br>support, monitoring and backups.|No routine clinical browsing; privileged<br>access logged and minimized.|



OPEN: confirm whether “State/District/PHC-UHC Admin” is one role or several, and whether the worker-facing workflow remains in the same app or a staff-only restricted app. 

## **4. Product surfaces and navigation** 

**<mark>Surface</mark>** React Native mobile app 

**<mark>Required areas</mark>** Phone entry/auth; role selection; home dashboard; assigned work queue; patient search/scan; worker intake; clinical assessment; <u>pathology; health-worker follow-up; research lab; contractor/site;</u> 

CONFIDENTIAL WORKING DRAFT  •  v0.1  •  For stakeholder review 

**M3 PLATFORM  /  PRODUCT REQUIREMENTS** 

||sync status; settings/language.|
|---|---|
|Web operations console — proposed|Secure sign-in; area/site/facility dashboard; patient and episode<br>search; role/user/site management; overdue queues; surveillance<br>analytics; audit viewer; controlled exports; sync/health status.|
|Backend/API|Authentication/session; authorization; patient registry; episodes;<br>clinical/lab/follow-up workflows; site/facility registry; sync API; audit<br>events; export/report API; health checks.|
|Local device storage|Relational records, draft state, outbox/sync queue, lookup caches,<br>session metadata and migration version; encrypted or platform-<br>protected according to approved threat model.|



## **5. Core workflows and functional requirements** 

#### **5.1 Authentication and role routing** 

- FR-AUTH-01: Provide one entry point for a phone number or approved staff credential flow. 

- FR-AUTH-02: Distinguish new and returning worker records without exposing whether a phone number belongs to a person to unauthorized users. 

- FR-AUTH-03: If a user has multiple authorized roles, show a role chooser after authentication. 

- FR-AUTH-04: Professional accounts require administrator/approved registration and assigned facility/site scope. 

- FR-AUTH-05: Production authentication must be server-verifiable. OTP/SMS is not assumed available until provider, sender registration, cost and connectivity behavior are approved. 

- FR-AUTH-06: Do not use Aadhaar as a default login credential or collect/store it unless the data controller explicitly approves necessity, legal basis, consent/notice, and handling. Prefer a generated Patient ID and minimum necessary identity attributes. 

- FR-AUTH-07: Lock or expire sessions according to approved policy; provide logout and device-loss revocation. 

#### **5.2 Worker intake and identity** 

- FR-WRK-01: Create a worker profile through a guided multi-step intake, with visible progress and resumable draft. 

- FR-WRK-02: Generate a unique, non-meaningful Patient ID; it must not encode phone, Aadhaar, date of birth or location. 

- FR-WRK-03: Capture approved demographic, gender, age/date-of-birth, contact, address, language, occupation, nativity, education, family relationship and consent fields. 

- FR-WRK-04: Capture current construction site/employer association and relevant migration/travel history, including the protocol-defined 21-day travel window if retained by study protocol. 

- FR-WRK-05: Capture symptoms, temperature, prior malaria in the last 12 months and treatment-seeking history as specified by approved questionnaire. 

- FR-WRK-06: Commit profile only after required fields and consent gates pass; allow explicit save-as-draft without creating a falsely complete record. 

- FR-WRK-07: Produce a QR-based digital health pass containing only an opaque identifier or signed token, never personal or clinical data. 

#### **5.3 Clinical assessment** 

- FR-CLN-01: Create a clinical encounter linked to Patient ID and, where relevant, a malaria episode. 

- FR-CLN-02: Capture clinician, facility, encounter date/time, temperature with unit, fever duration, symptoms, general condition, blood pressure, co-morbidities, pregnancy-related flag only if approved, assessment, treatment and admission/discharge details. 

- FR-CLN-03: Use controlled options for repeatable values and free text only where clinically needed. 

- FR-CLN-04: Display validation and unit labels clearly; do not infer diagnosis or recommend treatment. 

- FR-CLN-05: Support correction with reason and audit trail rather than silent overwrites. 

CONFIDENTIAL WORKING DRAFT  •  v0.1  •  For stakeholder review 

**M3 PLATFORM  /  PRODUCT REQUIREMENTS** 

#### **5.4 Pathology and diagnosis** 

- FR-LAB-01: Register a test order/sample with unique ID, patient/episode link, collection time, collector, specimen type and status. 

- FR-LAB-02: Capture RDT result, microscopy result, smear type, result date/time, laboratory, operator, species and mixed-infection flag as separate structured fields. 

- FR-LAB-03: Support P. falciparum, P. vivax, mixed, other/unspecified and pending/indeterminate states as approved by the clinical protocol. 

- FR-LAB-04: Keep screening test, microscopy confirmation and PCR/species confirmation distinct; preserve method and result provenance. 

- FR-LAB-05: Schedule or record follow-up slides where required by the approved protocol. 

- FR-LAB-06: Never convert a missing or pending result into a negative result. 

#### **5.5 Health-worker follow-up and episode closure** 

- FR-FUP-01: Generate follow-up tasks from an approved protocol; Pf/Pv timing must be configurable by authorized clinical governance, not hard-coded from this PRD. 

- FR-FUP-02: Show assigned, due soon, overdue, completed and cancelled queues with due dates and responsible worker. 

- FR-FUP-03: Record contact/visit date, patient status, adherence, adverse or concern notes where approved, next follow-up and outcome. 

- FR-FUP-04: Prevent episode closure while required tasks/results are outstanding unless an authorized user records a reason. 

- FR-FUP-05: Track missed follow-up separately from completed follow-up; sync retry must not create duplicate tasks. 

#### **5.6 Research laboratory** 

- FR-RLAB-01: Link PCR and molecular findings to sample, patient and episode with a clear chain of identifiers. 

- FR-RLAB-02: Capture PCR status, species confirmation, parasite density and unit/method, gametocyte presence, drug-resistance markers and pfhrp2/pfhrp3 deletion status when actually tested. 

- FR-RLAB-03: Distinguish not tested, pending, inconclusive, detected and not detected states. 

- FR-RLAB-04: Record assay/method, lab, operator, dates and corrections to support provenance and auditability. 

#### **5.7 Contractor and site management** 

- FR-SITE-01: Maintain site, contractor, location, operating status and facility/area mapping. 

- FR-SITE-02: Link a worker to a site through dated assignment records so movement history is retained rather than overwritten. 

- FR-SITE-03: Permit roster and site-level aggregate views; detailed clinical/lab information is restricted by default. 

- FR-SITE-04: Capture site visit/movement information only to the extent approved by protocol and privacy review. 

#### **5.8 Dashboards, search and reports** 

- FR-DASH-01: Role-specific landing pages show the user’s next actions, draft records, assigned queues and sync status. 

- FR-DASH-02: Admin dashboards filter by date range, district/area, facility, site, diagnosis status and species, subject to access scope. 

- FR-DASH-03: Use aggregate counts for surveillance by default; do not expose personally identifiable information in map pins or broad dashboards. 

- FR-DASH-04: Search by Patient ID, QR scan, or permitted identifiers; log sensitive record access and exports. 

- FR-DASH-05: Export CSV/XLSX/PDF only to authorized roles, with purpose, scope, timestamp and audit event. Export permissions are configurable. 

- FR-DASH-06: All analytics label denominators, time ranges, missing data and data freshness; do not imply epidemiological conclusions from incomplete data. 

CONFIDENTIAL WORKING DRAFT  •  v0.1  •  For stakeholder review 

**M3 PLATFORM  /  PRODUCT REQUIREMENTS** 

#### **5.9 Language, notifications and help** 

- FR-I18N-01: English is the baseline language. Hindi and Konkani are proposed from the migration blueprint; confirm all required languages and translations. 

- FR-NOT-01: Provide in-app reminders for due/overdue follow-ups and sync failures. SMS/WhatsApp/push delivery is an integration decision and must be consent- and policy-aware. 

- FR-HELP-01: Provide plain-language instructions, validation messages and a support/contact path configured by the project owner. 

## **6. Offline-first behavior and synchronization** 

Offline-first behavior is a release-critical requirement. Local save success must not depend on network availability. The UI must always distinguish “Saved on this device” from “Synced to central server.” 

- FR-SYNC-01: Every successful local write is committed transactionally to SQLite and creates an outbox item in the same transaction. 

- FR-SYNC-02: The sync worker sends queued changes with stable client-generated UUIDs and idempotency keys. 

- FR-SYNC-03: Retry transient errors with exponential backoff and jitter; do not spin continuously or drain battery. 

- FR-SYNC-04: Show pending, syncing, synced and action-required/error states plus last successful sync time. 

- FR-SYNC-05: Support interrupted uploads, app restarts, network switching and duplicate requests without duplicate records. 

- FR-SYNC-06: Define per-entity conflict policies. Append-only clinical/lab events should be preferred over destructive last-write-wins; conflicting edits to the same profile require explicit reconciliation or version-aware merge. 

- FR-SYNC-07: Server validates authorization, schema, references and business rules independently of client validation. 

- FR-SYNC-08: Tombstones/deletions must be auditable and propagate safely; hard deletion is not the default for clinical records. 

- FR-SYNC-09: Support schema migrations and queued-data compatibility across app versions. 

- FR-SYNC-10: Do not claim real-time central visibility while a device is offline; display data freshness clearly. 

## **7. Monochromatic motion-led design system** 

Design direction: a monochromatic, fluid, refined interface with subtle motion and a calm clinical tone. “Framer-style” is interpreted as polished transitions, spring motion, responsive interactions and editorial spacing—not copying Framer branding or introducing animation that slows field work. 

|**Design area**|**Requirement**|
|---|---|
|Palette|Near-black, charcoal, neutral grey, white and warm/off-white<br>surfaces. Use semantic status treatments with accessible contrast;<br>clinical positive/urgent states may use restrained semantic accents<br>only if the monochrome rule allows.|
|Typography|Clear type scale; high legibility for outdoor field use; large numeric<br>values for vitals and queues; avoid dense text walls.|
|Layout|Short 2–3-step form sections, visible progress, clear headings, sticky<br>primary action where useful, comfortable touch targets.|
|Motion|React Native Reanimated for short spring transitions, sheet<br>presentation, success feedback and queue updates. Respect<br>reduced-motion settings; avoid blocking animations.|
|Components|Buttons, text fields, chips, segmented controls, date/time pickers,<br>search/autocomplete, QR scanner, status pills, progress indicator,<br>bottom sheets, empty/loading/error states.|
|Feedback|Autosave indicator, validation beside the field, explicit offline banner,<br>sync state, undo/correction affordances where safe.|
|Accessibility|Screen-reader labels, adequate contrast, dynamic text sizing, non-<br>colour-only status signals, focus order and large touch targets.|
|Field ergonomics|Minimize typing; use saved facility/site context and permitted<br>defaults; do not silently infer or auto-fill clinical results.|



CONFIDENTIAL WORKING DRAFT  •  v0.1  •  For stakeholder review 

**M3 PLATFORM  /  PRODUCT REQUIREMENTS** Neutral charts and tables with clear labels; colour never the sole encoding; avoid personally identifying map pins by default. 

Data visualizations 

## **8. Proposed technical stack** 

|**Layer**|**Recommendation**|**Reason / notes**<br>i|
|---|---|---|
|Mobile|React Native + Expo + TypeScript; Expo<br>Router|Single codebase; file-based routing; Android<br>APK first, iOS capability if approved.|
|Styling|NativeWind or a token-based StyleSheet<br>system|Choose one as the source of truth; do not<br>duplicate styling systems.|
|Motion|React Native Reanimated; Gesture Handler|Smooth transitions and gesture-based<br>sheets with reduced-motion support.|
|Forms|React Hook Form + Zod|Reusable, schema-driven multi-step forms<br>and validation.|
|Local database|Expo SQLite + Drizzle ORM|Relational local storage, typed queries,<br>indexes and migrations.|
|Draft/session state|Zustand; MMKV only for small non-sensitive<br>preferences/session metadata|Do not use key-value storage as the primary<br>clinical record database.|
|Sensitive storage|Platform secure storage for tokens/keys;<br>evaluate encrypted SQLite or database-level<br>encryption|Security architecture must be threat-<br>modelled and tested.|
|Backend API|Python FastAPI (recommended) or Flask if<br>the project team needs to preserve the<br>proposal stack|The proposal names Flask + SQLAlchemy;<br>choose one backend framework before<br>implementation.|
|Central database|PostgreSQL|Relational integrity, transactions, indexed<br>queries, analytics and managed backups.|
|ORM/migrations|SQLAlchemy + Alembic for Python backend|Versioned schema and controlled<br>migrations.|
|Authentication|OIDC-compatible identity provider or<br>approved custom auth service; OTP adapter<br>if required|Server-side auth, session revocation, RBAC<br>and MFA for privileged roles.|
|API contract|REST + OpenAPI; versioned endpoints|Straightforward agent implementation,<br>testability and client/server compatibility.|
|Background sync|Local transactional outbox + server<br>idempotency; platform background task API|Reliable retry and duplicate prevention;<br>background execution is OS-controlled, not<br>guaranteed at an exact time.|
|Web console|React + TypeScript (Next.js or Vite, choose<br>one)|Desktop operations dashboard; not a<br>substitute for the React Native APK.|
|Testing|Jest, React Native Testing Library, API<br>integration tests, migration tests, end-to-end<br>smoke tests|Protects clinical workflows and offline<br>synchronization.|
|CI/build|GitHub Actions or approved CI; EAS Build or<br>reproducible local Gradle build|Generate signed APK/AAB; protect signing<br>credentials as secrets.|
|Observability|Structured logs, crash reporting with PII<br>redaction, API health checks and sync<br>metrics|Do not send health/identity fields to third-<br>party analytics.|



Decision note: the migration blueprint proposes Expo, NativeWind, Reanimated, React Hook Form, Zod, SQLite/Drizzle, Zustand/MMKV and an offline queue. The original proposal names Flask and SQLAlchemy. This PRD recommends a modern relational backend but leaves the final framework as a P0 decision to avoid incompatible parallel choices. 

## **9. Database schema — proposed logical model** 

Use UUID primary keys generated client-side for sync-capable records. Use a separate opaque human-facing patient_code. Store timestamps in UTC and render in the configured local timezone. Store clinical measurements with units and method/provenance. Every mutable server record should include created_at, updated_at, version and audit metadata where appropriate. 

|**Table**<br>users|
|---|



|**Purpose and key fields**|
|---|



id UUID PK; <u>phone_e164 nullable/unique where allowed;</u> 

CONFIDENTIAL WORKING DRAFT  •  v0.1  •  For stakeholder review 

**M3 PLATFORM  /  PRODUCT REQUIREMENTS** 

||display_name; status; preferred_language; auth_subject_id;<br>created_at; updated_at; last_login_at.|
|---|---|
|roles|id UUID PK; code unique (worker, clinician, pathology, health_worker,<br>research_lab, contractor, admin); name.|
|user_roles|id UUID PK; user_id FK; role_id FK; scope_type; scope_id;<br>assigned_by; assigned_at; revoked_at. Unique active role/scope<br>assignment.|
|patients|id UUID PK; patient_code unique; name fields; date_of_birth or age<br>fields per approved protocol; sex/gender field per approved form;<br>contact fields; preferred_language; nativity; education; occupation;<br>consent_status; consent_version; consented_at; status; created_at;<br>updated_at; version.|
|patient_identifiers|id UUID PK; patient_id FK; identifier_type; encrypted/limited<br>identifier_value or keyed hash where appropriate; last4/display_hint;<br>verified_at; source; status. Avoid Aadhaar unless explicitly approved.|
|addresses|id UUID PK; patient_id FK; address_type; house_plot; street; village;<br>zone_block; city; state; postal_code; latitude/longitude nullable;<br>captured_at; precision_m; source.|
|sites|id UUID PK; site_code unique; name; contractor_org_id FK nullable;<br>district; area; address; latitude; longitude; status; created_at;<br>updated_at.|
|organizations|id UUID PK; name; organization_type; registration_ref nullable;<br>status; contact details as approved.|
|facilities|id UUID PK; facility_code unique; name; facility_type<br>(PHC/UHC/lab/other); district; area; address; status.|
|worker_site_assignments|id UUID PK; patient_id FK; site_id FK; start_at; end_at nullable;<br>assignment_source; recorded_by; created_at. Preserve movement<br>history.|
|migration_travel_events|id UUID PK; patient_id FK; origin_location; destination_location;<br>departure_date nullable; arrival_date nullable; travel_purpose;<br>captured_by; source; created_at.|
|consents|id UUID PK; patient_id FK; consent_type; protocol_version; status;<br>obtained_by; obtained_at; method; guardian_patient_id nullable;<br>assent_status; withdrawal_at nullable; evidence_reference nullable.|
|episodes|id UUID PK; patient_id FK; episode_code unique; opened_at;<br>closed_at nullable; episode_status; case_classification;<br>suspected_imported_status nullable; assigned_facility_id FK;<br>created_by; created_at; updated_at; version.|
|clinical_encounters|id UUID PK; patient_id FK; episode_id FK nullable; facility_id FK;<br>clinician_user_id FK; encounter_at; temperature_value;<br>temperature_unit; fever_duration; symptoms JSONB or normalized<br>symptom rows; general_condition; systolic_bp; diastolic_bp;<br>comorbidities JSONB or related rows; assessment;<br>treatment_plan/reference; admission_status; discharge_at;<br>created_at; updated_at; version.|
|samples|id UUID PK; sample_code unique; patient_id FK; episode_id FK;<br>sample_type; collection_at; collected_by; collection_site_id FK<br>nullable; transport_status; received_at nullable; lab_id FK;<br>chain_of_custody_ref nullable; status; created_at; updated_at;<br>version.|
|diagnostic_tests|id UUID PK; sample_id FK; patient_id FK; episode_id FK; test_method<br>(RDT/microscopy/PCR/other); test_name; ordered_at; performed_at;<br>result_status (pending/positive/negative/indeterminate/cancelled);<br>operator_user_id FK; lab_id FK; method_version; notes; created_at;<br>updated_at; version.|
|diagnostic_results|id UUID PK; diagnostic_test_id FK; result_code; result_value;<br>result_unit; species (Pf/Pv/mixed/other/unknown); smear_type;<br>parasite_count; parasite_count_denominator;<br>gametocyte_presence; confirmed_at; confirmed_by; is_final;<br>supersedes_result_id FK nullable.|
|molecular_results|<br>id UUID PK; sample_id FK; episode_id FK; assay_name; PCR_status;<br>species_confirmation; parasite_density_value; parasite_density_unit;<br>gametocyte_presence; resistance_markers JSONB;<br>pfhrp2_deletion_status; pfhrp3_deletion_status; lab_id FK;<br>performed_by; performed_at; result_version; notes.|
||id UUID PK; episodeid FK; patientid FK; prescribedby; facilityid|
|treatment_records|_  _  _ _<br>FK; regimen_code/reference; started_at; ended_at nullable;<br>adherence_status;outcome;notes; protocol_version;created_at;|



CONFIDENTIAL WORKING DRAFT  •  v0.1  •  For stakeholder review 

**M3 PLATFORM  /  PRODUCT REQUIREMENTS** 

||updated_at.|
|---|---|
|follow_up_tasks|id UUID PK; episode_id FK; patient_id FK; assigned_user_id FK;<br>task_type; protocol_code; due_at; status; priority; created_by;<br>completed_at nullable; completion_reason nullable; created_at;<br>updated_at; version.|
|follow_up_events|id UUID PK; follow_up_task_id FK; patient_id FK; episode_id FK;<br>performed_by FK; occurred_at; contact_method; patient_status;<br>adherence_status; outcome; next_due_at nullable; notes;<br>created_at.|
|consent_protocols|id UUID PK; protocol_code; version; locale; content_hash;<br>effective_from; retired_at nullable.|
|audit_events|id UUID PK; actor_user_id FK nullable; action; entity_type; entity_id;<br>occurred_at; reason nullable; request_id; device_id;<br>before_hash/after_hash or approved diff; source; access_scope.|
|devices|id UUID PK; device_install_id; user_id FK nullable; platform;<br>app_version; last_seen_at; revoked_at; public_key_ref nullable.|
|sync_outbox|id UUID PK; device_id FK; entity_type; entity_id; operation;<br>payload_version; idempotency_key unique; queued_at;<br>attempt_count; last_attempt_at; last_error_code; status;<br>server_ack_at nullable.|
|sync_cursors|id UUID PK; device_id FK; stream_name; last_server_cursor;<br>last_success_at; schema_version.|
|attachments|id UUID PK; entity_type; entity_id; storage_key; mime_type;<br>size_bytes; checksum; encryption_key_ref; uploaded_at;<br>retention_class. Include only if attachments are approved; current<br>M3 overview says no image data.|
|notification_events|id UUID PK; recipient_user_id FK; event_type; related_entity_type;<br>related_entity_id; channel; scheduled_at; delivered_at nullable;<br>status; template_version; redacted_payload.|



#### **9.1 Relationships and integrity** 

- One patient can have multiple episodes; an episode can have multiple encounters, samples/tests, treatment records and follow-up tasks. 

- A diagnostic test is linked to a sample; a result is linked to a test. PCR/molecular results remain separate from routine RDT/microscopy results. 

- A patient can have multiple dated site assignments and travel events. 

- Users can have multiple roles, each constrained by a scope such as facility, area, district or site. 

- Use foreign keys, unique constraints, CHECK constraints for controlled status values, and indexes on patient_code, episode_code, site/facility, due_at/status, sample_code and timestamps. 

- Keep clinical/lab results append-only or versioned; corrections should supersede prior results with a reason. 

- Use JSONB only for evolving secondary details; core query fields and clinical results must be typed relational columns. 

- Do not store authentication secrets, raw OTPs or plaintext access tokens in business tables. 

#### **9.2 Suggested indexes** 

- patients(patient_code) UNIQUE; patient_identifiers(identifier_type, identifier_value_hash) where approved. 

- episodes(patient_id, opened_at DESC); episodes(episode_status, opened_at). 

- worker_site_assignments(site_id, start_at, end_at); migration_travel_events(patient_id, arrival_date). 

- diagnostic_tests(episode_id, performed_at DESC); diagnostic_tests(lab_id, result_status, ordered_at). 

- follow_up_tasks(status, due_at); follow_up_tasks(assigned_user_id, status, due_at); follow_up_tasks(site_id) via approved query path. 

- sync_outbox(status, queued_at); audit_events(entity_type, entity_id, occurred_at DESC); audit_events(actor_user_id, occurred_at DESC). 

CONFIDENTIAL WORKING DRAFT  •  v0.1  •  For stakeholder review 

**M3 PLATFORM  /  PRODUCT REQUIREMENTS** 

## **10. Security, privacy, ethics and governance** 

- Treat all identifiable, clinical, travel, location and research records as sensitive. Collect only approved fields and document each field’s purpose and access policy. 

- Require approved participant information and consent workflow before study data collection; support consent withdrawal and protocol/version traceability. 

- For participants under 18, implement the approved parent/guardian consent and assent process. The research proposal mentions adults and participants under 17; the exact age bands and consent wording require ethics-owner confirmation. 

- Do not assume Aadhaar collection is legally or operationally appropriate. Make government-ID collection disabled by default until the data controller and legal/ethics reviewers approve it. 

- Encrypt transport with TLS; use managed secrets; protect local databases and device tokens; support device revocation and remote session invalidation. 

- Enforce RBAC and row/scope-level authorization server-side. Hiding a screen is not authorization. 

- Audit logins, role changes, sensitive record access, exports, edits, result corrections and administrative actions. 

- Use least privilege for contractors and system administrators. Contractor access must not reveal detailed diagnoses or research results unless explicitly approved. 

- Backups must be encrypted, access-controlled, tested for restoration and retained according to an approved retention schedule. 

- Avoid sensitive data in logs, analytics, crash reports, push payloads, QR codes and notification previews. 

- Conduct threat modelling, dependency scanning, secret scanning, static analysis, API authorization tests, penetration testing and backup-restore tests before production deployment. 

- The original proposal references 128-bit encryption, blockchain/ZKP and AI security concepts. Treat those as proposal ideas, not a complete security specification; select standard, audited controls based on a threat model and institutional approval. 

## **11. Non-functional requirements and acceptance targets** 

|**ID**|**Requirement / acceptance target**|
|---|---|
|NFR-01|Offline: user can create/edit allowed records with airplane mode<br>enabled; local save confirmation appears within 500 ms on<br>supported pilot devices under normal load.|
|NFR-02|Durability: force-close/restart during a draft does not lose previously<br>autosaved fields; final submit is atomic.|
|NFR-03|Sync correctness: repeating the same queued request produces one<br>server-side mutation; retries do not duplicate patients, tests or<br>follow-up tasks.|
|NFR-04|Performance: common local patient lookup and task queue queries<br>target <500 ms at pilot-scale test data; record actual results on low-<br>end devices.|
|NFR-05|Security: all API endpoints enforce authorization; automated tests<br>prove users cannot access out-of-scope patients, sites, facilities or<br>exports.|
|NFR-06|Accessibility: core flows support screen readers, dynamic text and<br>high contrast; critical state is not communicated by colour alone.|
|NFR-07|Reliability: sync errors are visible and retryable; app remains usable<br>during API outage.|
|NFR-08|Scale: test at minimum 15,000 patient profiles and representative<br>related-record volumes; load target and concurrency must be<br>confirmed.|
|NFR-09|Auditability: critical changes are attributable to an authenticated<br>actor/device or explicitly marked as an unverified local event pending<br>sync.|
|NFR-10|Build: clean checkout can install dependencies, run<br>lint/typecheck/tests, build an APK and produce documented signing<br>instructions without manual source edits.|
|NFR-11|Privacy: production logs and telemetry contain no raw names, phone<br>numbers, government IDs, patient IDs or clinical values unless|



CONFIDENTIAL WORKING DRAFT  •  v0.1  •  For stakeholder review 

**M3 PLATFORM  /  PRODUCT REQUIREMENTS** 

NFR-12 

specifically approved and redacted. Updates: schema changes are migration-backed; old queued events are handled safely or rejected with a recoverable, documented state. 

## **12. Release scope and roadmap** 

|**Milestone**|**Deliverables**|**Exit criteria**|
|---|---|---|
|M0 — Decisions & governance|Confirm roles, clinical forms, consent,<br>hosting, auth, languages, distribution and<br>data ownership.|P0 questions resolved; approved field<br>dictionary and workflow diagrams.|
|M1 — Foundation|Expo RN TypeScript app; routing; design<br>tokens; component library;<br>lint/typecheck/test/build pipeline.|Signed debug/release-candidate APK builds<br>from clean checkout; basic navigation and<br>design QA pass.|
|M2 — Local data and forms|SQLite/Drizzle schema; migrations; draft<br>autosave; worker intake; patient code;<br>site/facility lookups.|Offline create/edit/restart tests pass; atomic<br>commit and field validation proven.|
|M3 — Clinical/lab/follow-up|Clinical encounter, sample/test/result,<br>molecular result, treatment and follow-up<br>workflows.|Role workflows and cross-entity integrity<br>tests pass; protocol-driven timing approved.|
|M4 — Auth and role security|Server authentication, role/scope checks,<br>device/session management, audit events.|Authorization matrix tests pass; no bypass<br>via direct API requests.|
|M5 — Sync and backend|API, PostgreSQL, transactional outbox,<br>idempotency, conflict handling, admin web<br>console minimum viable scope.|Airplane-mode and retry suites pass;<br>server/device records reconcile correctly.|
|M6 — Pilot hardening|Data migration/import plan, accessibility,<br>performance, security review, training,<br>backup/restore and operational runbook.|Pilot acceptance signed by product, clinical,<br>data protection and technical owners.|
|M7 — Restricted deployment|Signed APK distribution, version<br>management, crash/sync monitoring,<br>support and rollback procedure.|Pilot site deployment completed; support<br>and incident paths tested.|



## **13. Testing strategy** 

- Unit tests: validators, patient code generation, status transitions, due-date calculation, role policy, conflict merge rules. 

- Form tests: required/conditional fields, draft resume, validation errors, consent gating, keyboard/rotation interruption. 

- Database tests: migrations from every supported version, foreign keys, uniqueness, transaction rollback and index/query performance. 

- Sync tests: airplane mode, intermittent network, duplicate requests, server 500/429, token expiry, out-of-order updates, conflict resolution, app upgrade with queued changes. 

- Security tests: role/scope matrix, direct API authorization, session revocation, export controls, QR token inspection, local storage inspection, log redaction. 

- End-to-end journeys: worker registration → clinician encounter → sample/test → lab result → follow-up → closure; include pending and inconclusive results. 

- Build/release tests: signed APK install/update on supported Android devices; offline cold start; restore after crash; migration from previous release. 

- Operational tests: backup restore, database failover procedure, monitoring alerts, support triage and data incident playbook. 

## **14. AI coding agent execution contract** 

The coding agent should implement the repository as a production-minded, testable application—not a UI mockup. It should work in vertical slices and leave a runnable state at every milestone. 

CONFIDENTIAL WORKING DRAFT  •  v0.1  •  For stakeholder review 

**M3 PLATFORM  /  PRODUCT REQUIREMENTS** 

1. Inspect the repository and existing application files first. Inventory current routes, forms, fields, enums, identifiers, sample data and any existing exports before replacing anything. 

2. Create a source-to-target feature and field mapping. Preserve existing semantics unless a change is explicitly approved; mark unknown fields rather than silently dropping them. 

3. Create a README, architecture decision records, .env.example without secrets, schema diagrams, API OpenAPI contract and local setup instructions. 

4. Implement typed database schema and migrations before connecting complex forms. Include realistic synthetic fixtures only; never commit real patient records. 

5. Implement each workflow end-to-end: UI → validation → local transaction → sync outbox → API → server database → response reconciliation. 

6. Use feature flags for web console, external notifications, QR, GPS and any nonessential integration until approved. 

7. Use stable IDs, idempotency keys, explicit status enums, version fields and auditable corrections. 

8. Do not claim external integrations work without credentials and end-to-end tests. Provide adapters, mocks and clear setup instructions where credentials are absent. 

9. Run formatting, lint, typecheck, unit, integration and build checks. Fix failures rather than suppressing checks. 

10. Generate a signed APK only when signing credentials and distribution policy are supplied. Otherwise produce a release-candidate APK and exact signing instructions; never embed secrets in source. 

11. At completion, report implemented features, deferred decisions, tests executed/results, APK path, backend deployment steps, known limitations and data migration risks. 

## **15. Definition of done** 

- All six stakeholder workflows are represented and access-controlled. 

- Approved forms and field dictionary are implemented with validation and translation keys. 

- Worker profile, episodes, samples, results and follow-ups use relational references and migrations. 

- Offline creation/editing works, drafts survive restart, and queued changes sync idempotently. 

- Conflicts, permission failures and sync errors have clear recovery paths. 

- A role/scope authorization matrix is implemented and automated tests pass. 

- Consent, audit and privacy controls are in place according to approved governance. 

- The UI follows the monochromatic motion-led design system and passes accessibility review for core flows. 

- Android APK builds reproducibly and installs on the agreed minimum Android version/device matrix. 

- Web operations console is delivered if confirmed in scope; otherwise mobile-only operational limitations are documented. 

- README, environment setup, deployment, backups, rollback, support runbook and API docs are included. 

- No known critical/high security defects remain; all remaining risks are documented and accepted by the appropriate owner. 

## **16. Stakeholder questions — answer before implementation lock** 

These are the decisions most likely to change architecture, schema or launch readiness. The draft can guide planning now, but a one-shot build should not invent answers to these. 

**P0-01 | Product surface —** Do you want (A) Android APK + web admin console, (B) Android APK only for the first release, or (C) Android + iOS + web? My recommendation: Android APK + web console; iOS-ready React Native codebase. 

**P0-02 | Server and hosting —** Where must the central API/database run: an institution-managed server, Indian cloud region, or another approved environment? Who owns the domain, certificates, backups and operations? 

**P0-03 | Backend stack —** Should we keep the proposal’s Flask + SQLAlchemy, or approve FastAPI + SQLAlchemy + PostgreSQL? Recommendation: choose one Python backend; avoid splitting services for the first release. 

CONFIDENTIAL WORKING DRAFT  •  v0.1  •  For stakeholder review 

**M3 PLATFORM  /  PRODUCT REQUIREMENTS** 

**P0-04 | Authentication —** Will workers and staff use SMS OTP, phone number plus PIN, institution SSO, or a hybrid? Which SMS provider and sender setup exist? Must the app work when OTP cannot be delivered? 

**P0-05 | Identity and Aadhaar —** Is Aadhaar genuinely required, approved by the data controller and ethics/legal reviewers, and already collected in the current pilot? Can we exclude it and use the generated Patient ID plus minimal verification instead? 

**P0-06 | Current data migration —** Does the existing Android app contain real pilot records? If yes, can you provide a redacted CSV export and exact current headers/sample rows so the migration mapping can be specified and tested? 

**P0-07 | Clinical protocol —** Please provide the approved forms/data dictionary and current follow-up schedule for Pf/Pv, test methods, episode closure and treatment fields. Which fields are mandatory and which roles may edit them? 

**P0-08 | Ethics and consent —** What are the approved consent/assent text, languages, protocol version, under-18 handling, withdrawal procedure and retention period? Who is the data controller and who approves access? 

**P0-09 | Role policy —** Confirm the six roles and whether state, district, PHC/UHC administrators and system administrators are separate roles. What scope can each role view/edit/export? 

**P0-10 | Deployment —** Will APKs be installed manually, through managed devices/MDM, or via a private distribution portal? Who signs the APK and controls updates/rollback? 

**P1-11 | Languages —** Which launch languages are mandatory: English, Hindi, Konkani, Kannada, Odia, Bengali or others? Who will approve medical translations? 

**P1-12 | QR and camera —** Should QR scanning be in MVP? Is there an existing patient card/QR format to preserve, or should we create a new opaque token format? 

**P1-13 | GPS and maps —** Should location be captured only at a site/encounter, or continuously? Recommendation: no continuous worker tracking; capture only purpose-bound, consented location events. 

**P1-14 | Notifications —** Are in-app reminders enough for MVP, or are SMS/WhatsApp/push notifications required? Who receives reminders and what content may be shown on lock screens? 

**P1-15 | Attachments —** Does the current workflow require photographs, scanned documents, consent evidence or lab reports? The current technical overview says no image data is collected; default is no attachments. 

**P1-16 | Web console —** Which reports are essential at launch: case counts, imported/local classification, species distribution, overdue follow-ups, site-level summaries, data exports, maps? 

**P1-17 | Scale and service levels —** How many staff/devices may be online concurrently, how often should sync run, and what is the acceptable central visibility delay after connectivity returns? 

**P1-18 | Budget and delivery —** What is the deadline, available engineering/hosting budget, and is there an existing repo/CI/server/domain? Is one-shot generation a strict requirement or is agent-run automated verification acceptable before shipping? 

## **17. Recommended default decisions if you want the fewest blockers** 

|**Decision**|**Suggested default**<br>i|
|---|---|
|Product|React Native Expo app, Android-first signed APK, and a minimal<br>secure web admin console.|
|Backend|FastAPI or Flask (choose one), SQLAlchemy, PostgreSQL;<br>REST/OpenAPI.|
|Offline database|Expo SQLite + Drizzle; local outbox; explicit sync states; schema<br>migrations.<br>f|
|Auth|Server-validated staff accounts with scoped RBAC; worker phone<br>OTP only after SMS and fallback policy are confirmed.|
|Sensitive ID|Do not collect Aadhaar by default; use opaque Patient ID/QR and<br>minimal approved identity fields.|
|GPS|Site/encounter-level only, opt-in/purpose-bound; no continuous<br>tracking.|



CONFIDENTIAL WORKING DRAFT  •  v0.1  •  For stakeholder review 

||**M3 PLATFORM  /  PRODUCT REQUIREMENTS**|
|---|---|
|Clinical safety|No automated diagnosis/treatment; follow-up schedules<br>configurable from approved protocol.|
|Design|Monochrome neutral palette, concise wizard forms, Reanimated<br>micro-interactions, accessibility and reduced-motion support.|
|Rollout|Restricted pilot first; synthetic data in development; migrate real data<br>only after mapping, approval and backup.|



## **18. Source traceability** 

|**Source**|**What it supports in this PRD**|
|---|---|
|Project proposal on mobile app based malaria surveillance, pp. 1–14|Research objectives, study areas, approximately 15,000 Stage 1<br>target, stakeholder roles, screening/travel-history requirements,<br>diagnostic and species data, ethics/consent, staged scale-up.<br>f|
|M3 Platform – Technical Overview, pp. 1–5|Current Kotlin/Compose Android baseline, offline CSV storage,<br>phone-based login, generated Patient ID, six stakeholder workflows,<br>current privacy posture and planned hosted-server phase.|
|Work-To-be-Done / Current State Audit & React Native Migration<br>Blueprint|Pain points, proposed Expo/React Native stack, schema-driven<br>forms, SQLite/Drizzle, Zustand/MMKV, QR pass, role dashboards,<br>offline sync engine and phased migration roadmap.|



End of PRD v0.1. This is a review draft, not a statement that the system has already been built, security-certified, or approved for clinical deployment. 

CONFIDENTIAL WORKING DRAFT  •  v0.1  •  For stakeholder review 

**M3 PLATFORM  /  PRODUCT REQUIREMENTS** 

## **19. Updated decision register and remaining blockers** 

Confirmed decisions are authoritative for this revision. Items marked BLOCKING prevent a safe production-ready build; items marked CAN DEFER can be configured later while implementing the local prototype. 

|**Item**|**Status**|**Decision / required answer**|
|---|---|---|
|Platforms|CONFIRMED|Android APK + web/desktop console; iOS<br>future-compatible, not MVP requirement.|
|Backend|PROPOSED DEFAULT|FastAPI + SQLAlchemy + Alembic +<br>PostgreSQL; Docker Compose local/self-<br>hosted.|
|Hosting|PARTLY CONFIRMED|Docker on a project-controlled machine;<br>confirm exact host and how devices reach it.|
|Authentication|PARTLY CONFIRMED|PIN-based; account identifier, PIN<br>reset/provisioning and offline login policy<br>remain open.|
|Legacy migration|CONFIRMED|No migration in MVP; fresh schema and<br>synthetic fixtures.|
|BLOCKER 1 — Host/network|BLOCKING FOR DEVICE TESTING|Where will Docker run: developer laptop,<br>dedicated office PC, lab server or other<br>always-on machine? Same LAN/VPN for<br>phones?|
|BLOCKER 2 — PIN identity|BLOCKING FOR AUTH DESIGN|Phone + PIN, staff ID + PIN, username + PIN,<br>or generated account ID + PIN? Who creates<br>accounts and resets forgotten PINs?|
|BLOCKER 3 — Offline access|BLOCKING FOR FIELD SAFETY|Must previously authenticated users capture<br>records without internet? Suggested: limited<br>offline session on trusted devices, local<br>queue and periodic online re-authentication.|
|BLOCKER 4 — Roles/scopes|BLOCKING FOR AUTHORIZATION|Confirm six roles and whether<br>district/state/PHC-UHC/system admins are<br>separate; define each role's site/facility/area<br>scope.|
|BLOCKER 5 — Clinical forms/protocol|BLOCKING FOR CLINICAL RELEASE|Approve field dictionary, required fields,<br>diagnosis/result states, treatment fields,<br>Pf/Pv follow-up schedules and episode<br>closure rules.|
|BLOCKER 6 — Consent/privacy|BLOCKING FOR REAL DATA|Confirm data controller, ethics approval,<br>consent/assent, age handling,<br>retention/deletion policy; Aadhaar excluded<br>by default unless specifically approved.|
|BLOCKER 7 — Deployment security|BLOCKING FOR PRODUCTION|Who owns host, firewall, TLS/domain, OS<br>patching, Docker secrets, backups and<br>restore tests? Never expose PostgreSQL<br>publicly.|
|BLOCKER 8 — Web access|CAN DEFER FOR LOCAL PROTOTYPE|Console only on host, LAN, or remote<br>VPN/domain? Remote access requires TLS<br>and stronger operational controls.|
|BLOCKER 9 — Languages|CAN DEFER IF ENGLISH MVP APPROVED|Confirm launch languages and approver for<br>clinical translations.|
|BLOCKER 10 — Notifications/GPS/QR|CAN DEFER|SMS/push, GPS and QR requirements?<br>Suggested default: in-app reminders, no<br>continuous GPS, QR contains opaque token.|
|BLOCKER 11 — Backup/recovery|BLOCKING BEFORE PILOT|Set backup frequency, retention, acceptable<br>data loss/downtime, and test restoration.|
|BLOCKER 12 — Build/signing|BLOCKING FOR DISTRIBUTION|Who controls Android signing key and APK<br>distribution? A debug APK can be built before<br>credentials exist.|



CONFIDENTIAL WORKING DRAFT  •  v0.1  •  For stakeholder review 

**M3 PLATFORM  /  PRODUCT REQUIREMENTS** 

## **20. Docker-first local deployment requirements** 

- Provide docker-compose.yml for PostgreSQL and API, with health checks, restart policies and named persistent volumes. 

- Keep PostgreSQL on a private Docker network by default. Do not publish port 5432 broadly; allow local developer access only by explicit opt-in. 

- Provide .env.example with placeholders only; never commit secrets. Fail startup clearly if required secrets are missing. 

- Provide commands/scripts for start, stop, logs, migrations, synthetic seed, backup, restore and health checks. 

- Use configurable API_BASE_URL for emulator, physical device on LAN/VPN and future hosted deployment. Document that localhost on a physical phone points to the phone, not the Docker host. 

- Provide a first-run admin bootstrap requiring an explicit one-time setup secret or CLI command; never ship a default admin PIN. 

- Provide reverse proxy/TLS configuration for non-local deployment. Remote access must not be enabled by default. 

- Document Docker volume persistence and warn that removing volumes destroys the database. 

- Add integration tests for migrations, user creation, RBAC and data persistence across container restart. 

## **21. Revised one-shot build prompt for the coding agent** 

Build M3 as a runnable, testable monorepo: Android-first React Native + Expo + TypeScript app and React/TypeScript web operations console; FastAPI + SQLAlchemy + Alembic + PostgreSQL backend; Docker Compose local/self-hosted deployment with persistent volumes, health checks, private database networking, environment configuration, migrations, synthetic seed data, backup/restore scripts and setup docs. 

The mobile app must be offline-first using Expo SQLite with a transactional outbox and idempotent sync. Preserve the six M3 stakeholder workflows described in this PRD. Enforce role- and scope-based authorization on the server. Use PIN authentication without plaintext storage. Apply the monochromatic motion-led design system with accessibility and reduced-motion support. 

Do not migrate legacy CSV data in MVP. Use synthetic records only. Do not collect Aadhaar by default. Do not implement automated diagnosis/treatment recommendations or hard-code unapproved clinical schedules. Mark protocol-specific rules for approval/configuration. 

Inspect any existing repository before modifying it. Create architecture notes, OpenAPI contract, database 

schema/migrations, permission matrix, .env.example, README, Docker runbook and test plan. Implement vertical slices end-to-end. Run lint, typecheck, unit, API integration, migration, offline/sync tests and a reproducible Android build. Never claim a test/build passed unless actually run. Never expose PostgreSQL directly to mobile clients. If production host, TLS, secrets or signing keys are missing, provide local development deployment and documented release/signing steps. 

At completion report repository layout, workflows, schema tables, Docker commands, API URL setup for emulator/physical devices, test results, APK artifact path, and unresolved clinical/security/deployment blockers. 

CONFIDENTIAL WORKING DRAFT  •  v0.1  •  For stakeholder review 

**M3 PLATFORM  /  PRODUCT REQUIREMENTS** 

## **REVISION NOTE — USER DECISIONS CONFIRMED (v0.3)** 

This section supersedes conflicting defaults and open questions in earlier sections of v0.2. Treat the choices below as the current product decisions. It separates what is needed to build and test the local pilot from what must be resolved before real-world production use. 

## **22. Confirmed decisions** 

|**Docker host**|**Office computer / office-hosted machine. The host**<br>**must remain powered on and reachable for shared**<br>**central access.**|
|---|---|
|**Identity and PIN**|Phone number + PIN (“phonepin”). Store only a strong<br>salted PIN hash; apply rate limiting, lockout/backoff,<br>session expiry and device/session revocation. Do not use<br>the PIN as an encryption key or store it in plaintext.|
|**Offline behavior**|Offline viewing only. A user may view previously<br>synchronized and locally cached records when offline.<br>New record creation, edits, submission and sync require<br>connectivity. Do not implement offline capture or an<br>offline-write queue in this release. Clearly label cached<br>data and last-sync time.|
|**Roles**|Use the six stakeholder roles already defined in the<br>source/product materials. Do not add extra role classes<br>unless later approved. The server must enforce<br>permissions and record scope; exact per-role permissions<br>should follow the source materials and be documented in<br>a matrix.|
|**Clinical forms**|Use the provided project/source documents as the<br>baseline for forms and workflows. Do not silently invent<br>missing clinical fields, thresholds, treatment rules or<br>follow-up schedules. Where source material is incomplete<br>or inconsistent, create a clearly marked configurable<br>placeholder and list the unresolved decision.|
|**Web console access**|LAN access only for the pilot. No public exposure or<br>remote internet access by default. Restrict API and web<br>console to the intended office network; keep PostgreSQL<br>private inside Docker networking.|
|**Languages**|English and Hindi. All user-facing text must use translation<br>keys, and forms/layouts must support Hindi text without<br>clipping. Medical translations require review before<br>production.|
|**APK distribution**|Manual distribution of a signed Android APK for the pilot.<br>Keep signing credentials outside source control and<br>document repeatable build/signing/update steps.|
|**Data migration**|No migration of existing live data for the initial build. Use<br>synthetic seed data only.|
|**Backend/deployment baseline**|React Native + Expo + TypeScript mobile app; React +<br>TypeScript web console; FastAPI REST/OpenAPI;<br>PostgreSQL; SQLAlchemy/Alembic; Docker Compose.<br>Keep the deployment portable so the office host can later<br>be replaced by an approved server/hosting environment.|



CONFIDENTIAL WORKING DRAFT  •  v0.1  •  For stakeholder review 

**M3 PLATFORM  /  PRODUCT REQUIREMENTS** 

## **23. Decision status: development blockers vs production** 

## **blockers** 

Interpret “development” as a local, synthetic-data prototype and pilot build. Development can proceed with safe placeholders where noted. Production means use with real identifiable or clinical data, operational surveillance decisions, or deployment beyond a controlled test environment. 

|**Item**|**Status**|**Required action / boundary**|
|---|---|---|
|**Project architecture, local Docker**<br>**Compose, schema scaffolding, API,**<br>**web console, Android navigation**|NOT BLOCKING|Proceed now using the confirmed<br>stack and synthetic data.|
|**Six-role permission matrix**|BLOCKS role-complete acceptance;<br>not basic scaffolding|Implement role names from source<br>materials, but mark any missing per-<br>role actions/scope as unresolved. Do<br>not grant broad access by default.|
|**Source-based clinical forms and**<br>**protocol rules**|BLOCKS clinical-workflow sign-off;<br>not generic UI/API scaffolding|Implement only fields and workflow<br>rules supported by the provided<br>sources. Clinical thresholds,<br>treatment fields, mandatory values,<br>follow-up timing and closure rules<br>that are not specified must remain<br>disabled/configurable placeholders<br>until approved.|
|**Phone-number account**<br>**provisioning and recovery**|Can start with a development<br>bootstrap; BLOCKS production<br>authentication readiness|Build phone+PIN sign-in and secure<br>PIN handling. Before production,<br>approve who creates/verifies<br>accounts, phone-number ownership<br>checks, PIN reset/recovery, account<br>deactivation and lost-device<br>procedure.|
|**Office host and LAN connectivity**|Not blocking local development;<br>BLOCKS reliable shared pilot use until<br>tested|Document host address, firewall<br>rules, static/reserved LAN IP or stable<br>DNS, device/emulator API URL and<br>startup/restart procedure. Verify<br>supported Android devices can reach<br>the API over LAN.|
|**Offline viewing cache policy**|Can implement now; BLOCKS real-<br>data use until privacy policy is<br>approved|Cache only records authorized for<br>that user. Decide cache expiry,<br>logout/device-loss clearing, local<br>encryption and whether sensitive<br>fields can be shown on a shared<br>device before loading real data.|
|**Ethics, consent, data controller,**<br>**permitted purposes, retention and**<br>**deletion**|NOT a blocker for synthetic prototype;<br>BLOCKS production with real data|Obtain approved consent/assent text,<br>participant age handling, withdrawal,<br>retention/deletion rules and<br>governance sign-off.|
|**Security hardening and transport**<br>**protection**|Basic controls can be built now;<br>BLOCKS production|Require TLS for any non-loopback<br>traffic carrying real data, secure<br>secrets, rate limits, least privilege,<br>audit logs, dependency review, threat<br>review and no public DB port. LAN-<br>only does not by itself make clinical<br>data safe.|



CONFIDENTIAL WORKING DRAFT  •  v0.1  •  For stakeholder review 

**M3 PLATFORM  /  PRODUCT REQUIREMENTS** 

|**Backups, restore and recovery**<br>**objectives**|Can build scripts now; BLOCKS<br>production readiness|Implement and test encrypted<br>backup/restore, access control,<br>retention and a documented recovery<br>procedure before real data is stored.|
|---|---|---|
|**Hindi translation review**|English/Hindi infrastructure is not<br>blocking; BLOCKS Hindi clinical<br>release sign-off|Provide Hindi strings now, but have<br>qualified reviewers approve clinical<br>wording before field use.|
|**APK signing and distribution**<br>**process**|Does not block development builds;<br>BLOCKS controlled pilot distribution|Configure reproducible signed builds,<br>key custody, versioning,<br>update/rollback instructions and<br>device installation guidance.|
|**Production hosting/domain/remote**<br>**access**|Not blocking; explicitly out of current<br>scope|The current decision is office host +<br>LAN only. A hosted or remote-access<br>deployment requires a separate<br>approval, network/security design,<br>TLS/domain, ownership and<br>operations plan.|
|**Live data migration**|Not applicable to initial build|Do not import legacy records. Use<br>synthetic data; revisit only if a<br>separately approved migration is<br>requested.|
|**SMS/OTP, GPS, notifications, QR**<br>**and attachments**|Not blocking unless source workflows<br>require them|Keep out of scope by default; do not<br>add providers or collection without an<br>explicit requirement.|



## **24. Updated functional requirements and acceptance criteria** 

- Authentication: phone number + PIN. PINs are salted and hashed server-side; responses do not reveal whether a phone number exists; apply throttling/backoff and audit authentication failures without logging PINs. 

- Offline mode is read-only. After a successful online sign-in and sync, authorized cached records may be browsed offline. Offline forms must be non-editable; hide/disable create, edit, submit and sync actions and explain that connectivity is required. 

- Cache boundaries: cache only the minimum data required for approved viewing. Respect the logged-in user’s role and record scope. Display “Offline / cached data” and last successful sync timestamp. Clear or protect cached data on logout according to an explicit policy; do not imply the cache is current. 

- Office LAN deployment: Compose starts the API and database with persistent storage, health checks and restart policies. The web console and mobile app connect to the API; neither client connects directly to PostgreSQL. Database port remains unexposed to the LAN by default. 

- Forms: every field and rule must trace to a source document or be labelled “pending clinical approval.” Do not implement autonomous diagnosis, treatment recommendations or unapproved protocol schedules. 

- Localization: English and Hindi use centralized translation resources; no hard-coded user-facing strings in feature components. Check navigation, validation, empty states, date/number rendering and longer Hindi strings. 

- Roles: maintain a documented matrix for the six source-defined roles. Enforce access at API/service level, not only by hiding controls in the UI. Include automated tests for allow and deny cases. 

- APK: document debug build for development and signed release build for manual pilot distribution. Never commit signing keys or production secrets. 

## **25. Build sequence and release gates** 

12. Phase A — Build now: inspect source files and repository; map the six roles and source-backed workflows; create monorepo, Compose, migrations, synthetic seed, phone+PIN auth, API, web console, Android screens, English/Hindi resources and read-only offline cache. 

CONFIDENTIAL WORKING DRAFT  •  v0.1  •  For stakeholder review 

**M3 PLATFORM  /  PRODUCT REQUIREMENTS** 

13. Phase B — Local verification: run migrations from a clean database; test persistence across container restart; test role authorization; test sign-in throttling; test LAN reachability from a physical Android device; test offline cached viewing and confirm all writes are blocked offline; test Hindi layouts; build an APK. 

14. Phase C — Controlled pilot gate: resolve account provisioning/recovery, cache/privacy policy, role matrix gaps, source form gaps, signed APK key custody and office-host operational ownership. Keep synthetic data until these are approved. 

15. Phase D — Production gate: formal clinical workflow approval; ethics/consent/data governance; security and threat review; TLS for any non-loopback real-data traffic; backup/restore drill; retention/deletion policy; monitoring and incident response; reviewed Hindi clinical translations; operational acceptance. Remote hosting remains a separate change. 

## **26. Updated one-shot coding-agent instruction** 

Implement the M3 malaria surveillance prototype using the confirmed decisions in Section 22, which supersede earlier contradictory defaults. Build Android APK + LAN-only web console; office-hosted Docker Compose; FastAPI + PostgreSQL; phone-number + PIN authentication; the six source-defined roles; English and Hindi; source-derived forms; manual signed APK distribution; no legacy data migration. Offline behavior is read-only viewing of authorized cached data only: no offline creation, editing, submission or queued writes. Seed only synthetic data. Do not invent missing clinical protocols or role permissions; mark gaps and produce a blocker register. Keep PostgreSQL private and never expose it directly to clients. Provide setup/runbook, .env.example, migrations, health checks, backup/restore scripts, permission matrix, source-toform traceability, tests and APK build instructions. Clearly report which tests actually ran and separate local prototype readiness from pilot/production blockers. 

## **27. Current unresolved items** 

- Confirm exact phone-number account provisioning, verification and PIN recovery workflow before real staff accounts are created. 

- Approve role-to-action and data-scope matrix for all six source-defined roles if the supplied source materials do not fully define it. 

- Approve local cached-data security, expiry, logout clearing and lost-device handling before real records are cached on phones. 

- Resolve all source-document gaps or contradictions for clinical forms, mandatory fields, follow-up rules and episode closure before clinical workflow sign-off. 

- Approve data-controller, ethics/consent, age/assent, retention, withdrawal and deletion policies before real participant data is entered. 

- Name the office-host owner and approve LAN firewall/IP configuration, physical-device testing, power/restart expectations and backup responsibility. 

- Approve security review, backup/restore drill, audit/incident procedures and Hindi clinical translation review before production use. 

CONFIDENTIAL WORKING DRAFT  •  v0.1  •  For stakeholder review 

