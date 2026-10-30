# M3 Malaria Surveillance Platform

## Worker / Labourer Mobile App --- Architecture Script

**Document type:** Functional and technical architecture\
**Scope:** Worker/labourer experience only\
**Platform:** Android first; designed for a future iOS release\
**Frontend:** React Native + Expo + TypeScript\
**Backend status:** Not implemented; the first release operates offline

------------------------------------------------------------------------

## 1. Purpose and scope

The Worker App is the worker-facing part of the M3 Malaria Surveillance
Platform. It supports worker registration, association with a
construction site, one-time initial screening, access to malaria-related
records, symptom reporting, prescriptions, and follow-up responses.

This document covers only the worker/labourer role. It does not specify
the internal workflows of contractors, health workers, clinicians,
pathologists, research laboratories, or administrators. Those roles may
provide data that the worker is permitted to view.

The application is a restricted-distribution application. It is intended
for workers who are invited or enrolled through the project, rather than
unrestricted public self-registration.

## 2. Core architecture principles

1.  **Offline-first:** Worker registration and permitted worker-side
    tasks must remain usable without an internet connection.
2.  **Local relational storage:** Use SQLite rather than flat CSV files
    for operational records.
3.  **Sync-ready design:** Store changes locally and queue eligible
    records for later synchronization when a backend becomes available.
4.  **One worker identity:** A returning worker must be recognized and
    linked to the existing worker record rather than registered as a
    duplicate.
5.  **Site-linked records:** The worker's selected construction site is
    represented by a stable site ID, not only a typed site name.
6.  **One-time initial screening:** Initial screening is completed once
    for the worker. Later malaria episodes and follow-ups are separate
    records.
7.  **Verified malaria status:** Positive/negative status and diagnostic
    results come from authorized clinical or laboratory records, not
    from the worker's own symptom selection.
8.  **Historical record preservation:** Previous prescriptions and
    malaria episode records are retained; new records must not overwrite
    history.
9.  **Multilingual interface:** English, Hindi, Bengali, and Marathi are
    supported in the worker flow.
10. **Privacy by design:** Personal and health information must be
    stored and displayed only as required for the worker experience.

## 3. Worker journey

### 3.1 App distribution and first launch

-   A contractor or project/field representative shares the restricted
    app with a worker who is not yet enrolled or does not have the app
    installed.
-   The worker opens the app.
-   The app checks whether the worker is already registered.
-   A returning worker is directed to sign in and retrieve their
    existing worker profile.
-   A new worker proceeds through the registration flow.

**Important:** App distribution is not the same as worker registration.
The app must not create a new worker record merely because it has been
installed.

### 3.2 Language selection

On first entry, the worker selects one preferred language:

-   English
-   Hindi
-   Bengali
-   Marathi

The selection is saved locally and reused on subsequent launches. The
worker should be able to change the language later from the
profile/settings area.

### 3.3 Worker registration and sign-in

The registration fields confirmed for this worker flow are:

-   Name
-   Phone number
-   PIN

The application should validate the phone number and prevent accidental
duplicate registrations. A returning worker should be matched to the
existing worker identity.

The system should generate a unique, privacy-preserving internal Worker
ID. The Worker ID is the stable identifier used to connect site
association, screening, malaria episodes, prescriptions, and follow-up
records.

**Security requirement:** Do not store the PIN as plain text. Store a
secure verifier using an appropriate platform-supported secure
authentication approach. The exact phone verification and
account-recovery method remains a product/security decision to be
finalized.

### 3.4 Construction-site selection

After registration/sign-in, the worker selects the construction site
where they work.

The location selector follows this hierarchy:

1.  State --- Goa
2.  District --- North Goa, South Goa, and the third district label
    currently specified by the project as "Kushavati"
3.  Taluka
4.  Region/area under the taluka
5.  Construction site

A search facility must be available alongside the drill-down hierarchy.

Each construction site must have: - A unique Site ID - A display name -
Its approved location hierarchy - Active/inactive status, where
maintained by the site master data

The worker record stores the selected Site ID. It should not rely on a
free-text site name as its only link.

**Configuration note:** The district label "Kushavati" is retained
exactly as supplied in the current project flow. Confirm the official
administrative label and spelling before loading production master data.

If a worker changes sites later, retain the previous site association as
history and record the new association with an effective date. Do not
silently replace the old association.

### 3.5 Initial screening --- one time

Once the worker is registered and associated with a construction site,
the app presents the initial screening.

-   Initial screening is required only once for the worker.
-   The screening questionnaire must be based on the worker
    questionnaire in the original M3 research proposal.
-   Do not invent or substitute questions.
-   Preserve the proposal's relevant demographic, migration/travel
    history, previous malaria history, symptom/history, and screening
    information.
-   The proposal specifically describes recording axillary temperature
    and previous malaria infection history as part of screening.
-   Screening/sample collection must follow the project's approved
    consent and ethics process.

The full question wording and answer options should be transcribed from
the approved proposal/questionnaire into a version-controlled form
definition before implementation. If a worker's screening is
interrupted, the app should preserve a draft locally and allow the
worker to resume. A screening record is marked complete only after all
required fields and required consent steps are completed.

**Data rule:** A completed initial screening is not edited in place as
if it never happened. Corrections should be recorded through a
controlled amendment/audit mechanism.

### 3.6 Worker dashboard

After initial screening, the worker reaches the basic dashboard.

The dashboard should provide clear access to:

-   Worker profile
-   Initial screening summary
-   Current malaria status, when an authorized result exists
-   Prescriptions
-   Follow-up questions/check-ins
-   "Feeling unwell" action
-   Relevant notifications or pending actions

Do not show a malaria status as negative merely because the worker has
no symptoms or has not reported feeling unwell. If no verified
diagnostic result exists, show an appropriate state such as **"No result
recorded"** or **"Awaiting test/result"** rather than assuming negative.

### 3.7 Feeling unwell

The worker can select **"Feeling unwell"** from the dashboard.

This opens a worker-facing symptom-reporting flow. It may use tap-based
answers and limited optional text entry. The submission is saved as a
symptom report and made available for the authorized project/health
workflow when connectivity and backend services are available.

A symptom report is not a diagnosis and must not directly change the
worker's malaria status. The exact symptom questions, escalation rules,
and notification recipients are to be defined and approved separately.

### 3.8 Malaria status and test results

The worker can view malaria status when it has been entered by an
authorized clinical/laboratory workflow.

Where available, the worker may view: - Positive or negative result -
Relevant test type, including RDT and microscopy - Test/result date -
Plasmodium species, if recorded - Link to the relevant malaria episode

The worker must not be able to enter or change an official diagnostic
result through the worker interface.

An asymptomatic worker may still have malaria infection. Symptom absence
must never be used as a substitute for a diagnostic result.

### 3.9 Prescriptions

The Prescriptions area has two views:

-   **Current prescription** --- opened by default.
-   **Prescription history** --- available when the worker chooses to
    view older prescriptions.

Each prescription is retained as a separate record and linked to the
relevant malaria episode. A new prescription must not overwrite an older
prescription.

Medication dispensing and online pharmacy integration are outside the
current scope. The app provides a digital/online prescription record
that the worker can present at a physical pharmacy. The app does not
dispense medication.

### 3.10 Follow-up check-ins

A worker may receive a follow-up check-in initiated through the project
workflow, for example a question about how they are feeling.

The worker responds primarily through tap/click options, with optional
text where appropriate. The response is stored with its timestamp and
linked to the worker and relevant malaria episode or follow-up record.

A follow-up response is not itself a diagnostic result and must not
independently change malaria status.

### 3.11 Profile and screening review

The worker can open their profile and review: - Their registered profile
information - Selected construction site - Initial screening summary -
Relevant malaria records and prescriptions available to them

The initial screening is a historical baseline record. It should not be
presented as a form that the worker is expected to complete again on
every login.

------------------------------------------------------------------------

## 4. Application architecture

### 4.1 Technology baseline

  ---------------------------------------------------------------------
  Layer                              Selected approach
  ---------------------------------- ----------------------------------
  Mobile application                 React Native

  Runtime/tooling                    Expo

  Language                           TypeScript

  Navigation                         Expo Router

  Forms                              React Hook Form

  Validation                         Zod

  Local relational database          Expo SQLite

  ORM/schema management              Drizzle ORM

  App/session state                  Zustand

  Local key-value persistence        MMKV, where compatible with the
                                     selected Expo build

  Localization                       i18n solution supporting English,
                                     Hindi, Bengali, Marathi

  Initial target                     Android

  Future target                      iOS using the same React Native
                                     codebase
  ---------------------------------------------------------------------

The implementation should use Expo's development build/prebuild approach
if required by selected native modules. Confirm Expo SDK and
native-module compatibility when dependencies are pinned.

### 4.2 High-level architecture

``` text
                    WORKER
                      |
                      v
             React Native / Expo App
                      |
              Expo Router Screens
                      |
          Worker UI + Form Components
                      |
       React Hook Form + Zod Validation
                      |
              Worker Domain Layer
                      |
          Zustand (session/UI state)
                      |
          Repository / Data Access Layer
                      |
              Expo SQLite + Drizzle
                 |             |
                 |             +--> Local worker records
                 |             +--> Site master data
                 |             +--> Screening records
                 |             +--> Episodes/results
                 |             +--> Prescriptions
                 |             +--> Follow-up records
                 |
                 +--> Outbox / Sync Queue
                              |
                      [Future Backend]
                              |
                     Authorized APIs
```

**Current implementation reality:** There is no backend yet. The first
working version must not depend on a live API to complete its offline
worker journey. The future backend connection is an integration
boundary, not an assumed existing service.

### 4.3 Suggested code organization

``` text
src/
├── app/
│   ├── (entry)/
│   │   ├── language.tsx
│   │   ├── index.tsx
│   │   └── sign-in.tsx
│   └── (worker)/
│       ├── dashboard.tsx
│       ├── registration/
│       ├── site-selection/
│       ├── screening/
│       ├── profile/
│       ├── malaria-status/
│       ├── prescriptions/
│       ├── feeling-unwell/
│       └── follow-ups/
├── components/
│   ├── ui/
│   └── forms/
├── features/
│   └── worker/
│       ├── registration/
│       ├── site/
│       ├── screening/
│       ├── dashboard/
│       ├── episodes/
│       ├── prescriptions/
│       └── follow-ups/
├── database/
│   ├── schema/
│   ├── migrations/
│   ├── repositories/
│   └── seed/
├── services/
│   ├── identity/
│   ├── sync/
│   └── notifications/
├── store/
├── i18n/
├── security/
└── types/
```

This is a worker-only module layout. Other role-specific app groups
should be added separately when their scope is designed.

------------------------------------------------------------------------

## 5. Core data model

The following is a logical model, not a final SQL migration. Exact
fields should be confirmed against the approved questionnaire and
project data dictionary.

  ------------------------------------------------------------------------
  Entity                 Purpose                      Key relationship
  ---------------------- ---------------------------- --------------------
  Worker                 Stable worker identity and   One worker can have
                         profile                      many related records

  WorkerSiteAssignment   Current and historical site  Worker ID + Site ID
                         association                  

  ConstructionSite       Site master data and unique  Referenced by
                         Site ID                      assignments

  SiteLocation           State/district/taluka/area   Parent-child
                         hierarchy                    location hierarchy

  InitialScreening       One-time baseline screening  Worker ID

  MalariaEpisode         A distinct                   Worker ID
                         suspected/confirmed episode  

  DiagnosticResult       Authorized RDT/microscopy    Episode ID
                         result                       

  Prescription           A prescription record        Episode ID; history
                                                      retained

  SymptomReport          Worker-submitted unwell      Worker ID;
                         report                       optionally episode
                                                      ID

  FollowUp               Check-in question and worker Worker ID;
                         response                     optionally episode
                                                      ID

  SyncOutbox             Pending changes for future   Local record type
                         backend sync                 and ID
  ------------------------------------------------------------------------

### Data integrity rules

-   Use an internally generated Worker ID as the stable primary
    identifier.
-   Do not use phone number as the only relational key.
-   A worker may have multiple site assignments over time.
-   A worker has one completed initial screening baseline; subsequent
    episodes are separate.
-   A worker may have multiple malaria episodes over time.
-   A malaria episode may have multiple diagnostic records if the
    clinical workflow records them.
-   A prescription belongs to the relevant episode and is never
    overwritten by a later prescription.
-   Preserve created-at, updated-at, and source/status metadata where
    appropriate.
-   Use database transactions for multi-record operations so partially
    saved records are not treated as complete.

------------------------------------------------------------------------

## 6. Offline behaviour and future synchronization

### First release --- offline

-   Store worker profile, site master data, screening, and worker-side
    records in application-private SQLite storage.
-   Allow the worker to complete supported flows without a network
    connection.
-   Show whether information is saved locally and whether it is pending
    synchronization.
-   Preserve incomplete form drafts safely.
-   Do not display a record as centrally submitted when it exists only
    on the device.

### Future backend phase

When a backend is implemented:

1.  The app authenticates the worker/session through the agreed identity
    mechanism.
2.  Local changes are written to an outbox.
3.  The sync service submits queued changes to authorized APIs.
4.  The server validates and acknowledges accepted records.
5.  The app marks acknowledged records as synchronized.
6.  Failed items remain queued with retry metadata.
7.  Conflicts are handled by explicit domain rules; do not use blind
    last-write-wins for clinical results, prescriptions, or completed
    screening records.

The sync design must be idempotent so retrying a request does not create
duplicate worker, screening, episode, or prescription records.

------------------------------------------------------------------------

## 7. Privacy, security, and safety requirements

-   Keep personal and health data in application-private storage.
-   Protect sensitive local data using platform-appropriate encryption
    and secure key storage.
-   Never store a PIN in plain text.
-   Use role- and record-level authorization when the backend is
    introduced.
-   Avoid exposing phone numbers or other direct identifiers in
    diagnostic/laboratory references where a Worker ID is sufficient.
-   Keep an audit trail for changes to sensitive clinical data.
-   Collect only fields required by the approved study protocol.
-   Obtain and record the required informed consent/assent before
    relevant study procedures, following the approved ethics process.
-   Do not let the worker self-assign a positive/negative malaria
    diagnosis.
-   Do not equate "no symptoms" with "malaria negative."
-   Clearly distinguish local-only, pending-sync, and server-confirmed
    information.

The original technical overview describes confidential handling of
personal and health information and identifies authentication,
role-based access, audit logging, and backups as requirements for the
planned server phase.

------------------------------------------------------------------------

## 8. Main screens

  ---------------------------------------------------------------------
                        Order Screen               Main responsibility
  --------------------------- -------------------- --------------------
                            1 App entry / language Select preferred
                                                   language

                            2 Returning worker     Identify existing
                              check                worker

                            3 Sign in /            Name, phone number,
                              registration         PIN for new
                                                   registration;
                                                   returning-worker
                                                   access

                            4 Site selection       Select site through
                                                   hierarchy or search

                            5 Initial screening    Complete approved
                                                   one-time
                                                   questionnaire

                            6 Worker dashboard     Show worker's key
                                                   information and
                                                   actions

                            7 Profile              View profile and
                                                   site association

                            8 Screening summary    Review completed
                                                   initial screening

                            9 Feeling unwell       Submit a symptom
                                                   report

                           10 Malaria status       View authorized
                                                   status and test
                                                   results

                           11 Prescriptions        Current prescription
                                                   by default

                           12 Prescription history View older
                                                   prescriptions

                           13 Follow-up check-in   Answer a worker
                                                   follow-up
  ---------------------------------------------------------------------

------------------------------------------------------------------------

## 9. Implementation sequence

### Phase 1 --- App foundation

-   Initialize the existing repository with Expo, React Native, and
    TypeScript.
-   Configure Expo Router.
-   Establish design tokens, reusable components, and the four worker
    languages.
-   Build the worker-only navigation structure.

### Phase 2 --- Local data and identity

-   Define SQLite/Drizzle schema and migrations.
-   Implement Worker ID generation.
-   Implement registration and returning-worker recognition.
-   Implement secure PIN handling.
-   Seed and display construction-site master data.

### Phase 3 --- Initial screening

-   Extract the exact worker screening questionnaire from the approved
    research proposal.
-   Convert it into versioned form definitions and Zod validation.
-   Implement draft persistence, consent handling, completion, and
    screening review.
-   Enforce one-time baseline screening behaviour.

### Phase 4 --- Worker dashboard and records

-   Build profile and dashboard.
-   Display authorized malaria status and diagnostic results.
-   Implement current prescription as the default view and separate
    prescription history.
-   Link prescriptions and diagnostic results to malaria episodes.

### Phase 5 --- Worker interactions

-   Implement the "Feeling unwell" report.
-   Implement tap-based follow-up responses and optional text.
-   Add local notifications or in-app indicators only where the final
    requirements support them.

### Phase 6 --- Sync readiness and testing

-   Implement the local outbox and sync interfaces without assuming a
    live backend.
-   Test airplane-mode operation, interrupted forms, duplicate
    registration attempts, app restarts, and local database migrations.
-   Prepare API contracts and backend integration requirements for a
    later phase.

------------------------------------------------------------------------

## 10. Acceptance criteria

The worker architecture is ready for its first release when:

-   A new worker can register and receive one stable Worker ID.
-   A returning worker is recognized rather than duplicated.
-   The worker can select English, Hindi, Bengali, or Marathi.
-   The worker can find and select a construction site through hierarchy
    or search.
-   The selected site is stored by Site ID.
-   The worker can complete the approved initial screening once.
-   An interrupted screening can be resumed without creating a false
    completed record.
-   The worker can review their profile and initial screening.
-   The worker can submit a symptom report without changing their
    official malaria status.
-   Only authorized diagnostic records determine displayed malaria
    status.
-   No-result and awaiting-result states are distinguishable from
    negative.
-   The current prescription opens by default.
-   Older prescriptions remain available in history and are not
    overwritten.
-   Prescription records are linked to the relevant malaria episode.
-   The supported worker flows operate without internet access.
-   The app clearly distinguishes locally saved records from
    synchronized records.

------------------------------------------------------------------------

## 11. Decisions still requiring confirmation

These points are intentionally left open rather than assumed:

1.  **Identity verification:** The worker flow specifies phone number
    and PIN. The original proposal also describes OTP-based phone
    verification. Confirm whether OTP is required, optional, or deferred
    for the worker release.
2.  **District master data:** Confirm the official spelling/name
    corresponding to "Kushavati" before production site data is entered.
3.  **Questionnaire source:** Import the exact approved worker
    questionnaire and answer options from the final research-proposal
    version; do not reconstruct missing questions from memory.
4.  **Consent capture:** Confirm the exact consent/assent screens and
    evidence required by the ethics approval.
5.  **Worker account recovery:** Define what happens if a worker changes
    phone number or forgets their PIN.
6.  **Backend/API:** Not yet available. Define hosting, authentication,
    API contracts, access controls, audit logs, backups, and sync
    conflict rules before enabling central synchronization.
7.  **Symptom escalation:** Confirm the symptom questions, notification
    destination, and escalation rules with the project team.

------------------------------------------------------------------------

## 12. Source basis and boundaries

This worker architecture is based on:

-   **Project proposal on mobile app based malaria surveillance (V6):**
    project purpose, migrant construction-worker screening,
    migration/travel history, previous malaria history, axillary
    temperature, malaria surveillance objectives, and consent/ethics
    context.
-   **M3 Platform technical overview:** phone-based worker identity,
    generated Patient ID concept, offline local storage baseline,
    stakeholder data separation, and confidentiality requirements.
-   **Work-To-be-Done / React Native Migration Blueprint:** React
    Native + Expo + TypeScript direction, Expo Router, React Hook Form +
    Zod, Expo SQLite + Drizzle, Zustand/MMKV, modular code organization,
    and future offline synchronization.

The worker journey details confirmed during architecture
discussions---four worker languages, name/phone/PIN registration, site
hierarchy and search, one-time screening, dashboard, symptom reporting,
worker-visible malaria records, current-prescription default,
prescription history, and worker follow-up responses---are incorporated
as the current product requirements.

This document does not define the other six role workflows, a backend
implementation, a final database migration, clinical decision logic, or
unapproved questionnaire content.

## 13. Construction-site transfer workflow (updated requirement)

A worker's construction-site association must be changed through the
**Transfer** feature. The active site must never be changed by directly
editing the worker profile.

### 13.1 Worker-initiated transfer

1.  The worker opens **Transfer** from the app.
2.  The app displays the worker's current construction site as the
    **From** site.
3.  The worker selects the requested **To** construction site.
4.  The worker submits the transfer request.
5.  The contractor linked to the destination construction site
    receives/reviews the request.
6.  The destination contractor accepts or rejects the request.
7.  If accepted, the worker's active site association changes to the
    destination Site ID. If rejected, the current site remains
    unchanged.

### 13.2 Contractor-initiated transfer

1.  A contractor enters the worker's unique Worker ID.
2.  The contractor selects/proposes the destination construction site
    and sends a transfer request to the worker.
3.  The worker opens **Transfer → Requests**.
4.  The worker reviews the proposed transfer, including the From and To
    site details.
5.  The worker accepts or rejects the request.
6.  The app records the worker's decision and updates the active site
    only after the required approvals are complete.

**Approval detail to confirm:** The worker's description explicitly
requires destination-contractor acceptance for a worker-initiated
transfer and worker acceptance for a contractor-initiated request. It is
not yet confirmed whether contractor-initiated requests also require
destination-contractor acceptance after the worker accepts. The
implementation must follow the final agreed approval rule.

### 13.3 Transfer screen requirements

The worker's Transfer area should display:

-   Current/From construction site
-   To construction site for each request
-   Requests initiated by the worker
-   Requests sent by a contractor using the worker's Worker ID
-   Request initiator and request date
-   Approval/response status
-   Accept and Reject actions for requests awaiting the worker's
    decision
-   Final outcome and transfer history

Use clear statuses such as **Pending worker response**, **Pending
destination contractor approval**, **Accepted**, and **Rejected**, as
applicable to the agreed approval sequence.

### 13.4 Transfer data and integrity rules

Add a `SiteTransferRequest` record with, at minimum:

-   Transfer Request ID
-   Worker ID
-   From Site ID
-   To Site ID
-   Initiator type (worker or contractor)
-   Initiator reference/ID
-   Request created timestamp
-   Worker decision and timestamp, when applicable
-   Destination contractor decision and timestamp, when applicable
-   Overall status
-   Effective timestamp for the completed transfer

The existing `WorkerSiteAssignment` record remains the historical record
of site membership. A transfer creates a new assignment period; it does
not overwrite or delete the previous assignment.

Rules:

-   A pending or rejected request must not change the worker's active
    site.
-   A completed transfer closes the previous assignment and
    creates/activates the new assignment.
-   Every request and decision must be retained for audit/history.
-   A contractor-initiated request must target a valid Worker ID.
-   The app must distinguish a transfer request from a completed
    transfer.
-   Duplicate or conflicting pending requests should be handled
    according to a rule agreed by the project team; do not silently
    create multiple conflicting active transfers.

------------------------------------------------------------------------

## 14. Updated worker journey and screen list

The complete worker journey now includes both directions of
site-transfer initiation:

1.  Restricted app distribution and first launch.
2.  Returning-worker recognition or new-worker registration.
3.  Preferred language selection: English, Hindi, Bengali, or Marathi.
4.  Worker registration/sign-in using name, phone number, and PIN for
    new registration.
5.  Construction-site selection through State → District → Taluka →
    Region/Area → Site, with search.
6.  One-time initial screening using the approved worker questionnaire.
7.  Worker dashboard.
8.  Site transfer through the Transfer area:
    -   Worker selects From and To and requests a transfer; destination
        contractor reviews it.
    -   Contractor sends a request using Worker ID; worker reviews and
        accepts/rejects it in the app.
9.  Profile and initial-screening review.
10. Feeling-unwell symptom report.
11. View authorized malaria status and available diagnostic results.
12. View current prescription by default and older prescriptions through
    prescription history.
13. Respond to worker follow-up check-ins.

The Transfer feature is available after the worker has an established
worker identity and site association. It does not repeat initial
registration or initial screening.

## 15. Updated core data model

  ---------------------------------------------------------------------
  Entity                             Purpose
  ---------------------------------- ----------------------------------
  Worker                             Stable worker identity and profile

  ConstructionSite                   Construction-site master data and
                                     unique Site ID

  WorkerSiteAssignment               Current and historical
                                     worker-to-site association, with
                                     effective dates

  SiteTransferRequest                Worker- or contractor-initiated
                                     transfer request, approvals,
                                     decisions, and status

  InitialScreening                   One-time baseline screening

  MalariaEpisode                     A distinct malaria episode for the
                                     worker

  DiagnosticResult                   Authorized RDT/microscopy result
                                     linked to an episode

  Prescription                       Prescription linked to the
                                     relevant episode; history retained

  SymptomReport                      Worker-submitted unwell report

  FollowUp                           Follow-up prompt and worker
                                     response

  SyncOutbox                         Local changes awaiting future
                                     backend synchronization
  ---------------------------------------------------------------------

------------------------------------------------------------------------

## 16. Additional project decisions to settle

These are the remaining questions I recommend resolving before
finalizing the transfer feature and implementation rules:

1.  **Contractor-initiated approval:** After the worker accepts a
    contractor's request, must the destination contractor also approve
    it, or is the worker's acceptance sufficient?
2.  **Current contractor:** Does the contractor linked to the
    From/current site need to approve or simply receive a notification?
3.  **Rejection and cancellation:** Can either party reject a request?
    Can the initiator cancel a request while it is pending?
4.  **Multiple requests:** Should only one transfer request be pending
    for a worker at a time?
5.  **Effective date:** Does the new site become active immediately
    after approval, or from a future date?
6.  **Worker ID confirmation:** When a contractor enters a Worker ID,
    what minimum worker details may be shown to confirm they selected
    the correct person?
7.  **Offline behaviour:** Should a transfer request be saved as a local
    draft while offline, or should the Transfer action require
    connectivity? Approvals cannot be considered complete until the
    relevant party has received and responded to the request.
8.  **Site not listed:** What should the worker do if the destination
    construction site does not appear in search or the hierarchy?

These are product-policy questions, not assumptions to be hard-coded.
The rest of the worker workflow can proceed while these rules are
confirmed.

## 17. Confirmed site-transfer rules

The following rules incorporate the project's answers to the transfer
questions:

1.  **Contractor-initiated request:** Once the worker accepts the
    request, no additional approval from the destination contractor is
    required.
2.  **Current-site contractor:** The contractor linked to the worker's
    current/from site must be involved in the transfer approval process.
    This document interprets the answer "yes" as requiring that
    contractor's approval, rather than notification only.
3.  **Reject/cancel:** A pending transfer can be rejected, and the
    request can be cancelled by the relevant party before completion.
    The system must record who rejected or cancelled it and when.
4.  **One pending request:** A worker may have only one pending transfer
    request at a time. The app must prevent creation of another until
    the existing request is completed, rejected, or cancelled.
5.  **Effective date:** The site change takes effect immediately once
    all approvals required for that transfer path are complete.

### 17.1 Approval sequence

  -------------------------------------------------------------------------------------------
  Request        Worker         Current/from-site   Destination/to-site   Completion
  initiated by   decision       contractor          contractor            condition
  -------------- -------------- ------------------- --------------------- -------------------
  Worker         Request is     Approves            Approves              Both contractor
                 already                                                  approvals are
                 submitted by                                             complete
                 worker                                                   

  Contractor     Worker must    Approves            No additional         Worker and
                 accept                             approval required     current/from-site
                                                                          contractor have
                                                                          approved
  -------------------------------------------------------------------------------------------

A rejected or cancelled request does not change the worker's active
site. Once the completion condition is met, the app closes the previous
site assignment and activates the new site assignment immediately. The
transfer history remains available.

**One interpretation to verify:** The answer "yes" to whether the
current-site contractor should approve or only be notified has been
implemented here as **approval required**. If "yes" meant notification
only, this approval matrix should be adjusted before coding.
