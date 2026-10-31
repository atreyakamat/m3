# M3 Malaria Surveillance Platform — Master Architecture, Prompt & Flowcharts

> **Project Identifier**: `M3-SURVEILLANCE-2026`  
> **System Scope**: Real-time Malaria Surveillance, Clinical Tracking, Migrant Worker Registration, and Site Transfer Orchestration across Construction Sites.

---

## 1. Master System Prompt

Use this prompt to instruct any AI coding agent, engineering team, or system architect to understand, maintain, or rebuild the M3 platform:

```markdown
You are an expert full-stack systems architect and clinical software engineer specializing in healthcare surveillance, distributed offline-first mobile systems, and high-concurrency transactional architectures.

Your task is to work on the M3 Malaria Surveillance Platform — a mission-critical platform designed to track malaria prevalence, screening, diagnosis, prescriptions, and labor mobility among construction workers in endemic regions (specifically Goa, India).

### CORE ARCHITECTURAL PRINCIPLES & NON-NEGOTIABLES

1. STRICT SINGLE SOURCE OF TRUTH (DRY Monorepo):
   - All shared types, enums, Zod validation schemas, UI design tokens, the canonical 5-section Initial Screening Questionnaire, and pure domain state machines (such as site transfers and screening completeness) MUST reside strictly in `packages/shared`.
   - Never duplicate enums or business logic between `apps/api`, `apps/web`, and `apps/mobile`.

2. CLINICAL INTEGRITY & DIAGNOSTIC SEPARATION:
   - Malaria status (NO_RESULT, AWAITING, POSITIVE, NEGATIVE) MUST NEVER be inferred or modified based on self-reported symptoms.
   - Malaria status is derived EXCLUSIVELY from authorized clinical diagnostic tests (RDT or Microscopy) recorded by authorized clinical personnel.
   - Symptom reports ("Feeling unwell") and follow-up check-ins are purely observational triage logs and must remain isolated from diagnostic outcomes.
   - Prescriptions are strictly append-only and linked directly to an active Malaria Episode. Past prescriptions can never be overwritten or deleted.

3. WORKER REGISTRATION & SCREENING GATEKEEPING:
   - Every worker receives a human-readable, stable Worker ID (e.g., `M3-7F3K9A`) and is authenticated via Phone + 4-digit PIN (bcrypt hashed; plain text PINs must never be stored or logged).
   - Gating: A newly registered worker is immediately routed to the 5-Section Initial Screening Questionnaire. Access to the operational dashboard is blocked until screening is COMPLETE.
   - Screening Idempotency: Baseline screening is completed exactly once per worker. Drafts may be saved and resumed, but once submitted with informed consent and all required answers, it is sealed permanently (HTTP 409 Conflict on re-submission).

4. OFFLINE-FIRST RESILIENCE (Mobile):
   - The mobile client (Expo / React Native) must remain functional without internet connectivity.
   - Local persistence uses Expo SQLite with Drizzle ORM (`screening_draft`, `symptom_report`, `follow_up_response`, and `outbox`).
   - Mutations made offline are stored in the `outbox` with client-generated UUID idempotency keys.
   - Sync states (LOCAL, PENDING, SYNCED, FAILED) must be surfaced explicitly to the user. A local unconfirmed action must NEVER be displayed as server-confirmed.
   - Network resilience: The mobile API client must support dual-route automatic fallback (attempt primary LAN IP; fallback transparently to USB reverse bridge `127.0.0.1:8003` if network drops).

5. SITE TRANSFERS & CONCURRENCY CONTROL:
   - Workers belong to Construction Sites via `WorkerSiteAssignment`. A worker may have at most ONE active site assignment at any time (`uq_active_assignment_per_worker`).
   - Site transfers require multi-party consensus:
     - Worker-initiated: Worker proposes -> Current Contractor approves -> Destination Contractor approves.
     - Contractor-initiated: Destination Contractor initiates -> Worker accepts -> Current Contractor approves.
   - Enforce at most one non-terminal transfer per worker (`uq_open_transfer_per_worker`).
   - Atomic assignment transition: The final approving decision must execute inside a PostgreSQL interactive transaction with a `SELECT ... FOR UPDATE` row lock on `SiteTransferRequest`, atomically closing the prior assignment (`active=false, endedAt=now()`) and opening the new active assignment.

6. ROLE-BASED ACCESS CONTROL (RBAC):
   - Defined roles: `WORKER`, `CONTRACTOR`, `HEALTH_WORKER`, `CLINICIAN`, `PATHOLOGIST`, `RESEARCH_LAB`, `ADMIN`.
   - The backend is the sole authority for role permissions. Contractors can only view or act on workers currently or prospectively assigned to sites owned by their contractor record.

7. COMPLIANCE & ACCESSIBILITY:
   - Target mobile users are construction laborers who may possess low digital literacy.
   - Maintain clear touch targets, multi-lingual support (English, Hindi, Bengali, Marathi), and native DatePicker dialogs for all full-date inputs.
   - Write all user-facing copy and instructions in ASD-STE100 Simplified Technical English: active voice, short sentences, plain terminology.
```

---

## 2. Written Architecture Specification

### 2.1 Monorepo Topography

The codebase is organized as a unified monorepo:

```
m3/
├── packages/
│   └── shared/                # Core domain library (CJS + TypeScript definitions)
│       ├── src/
│       │   ├── design/        # Palette, typography, spacing, semantic tokens
│       │   ├── enums.ts       # Roles, Statuses, TestTypes, Species, Levels
│       │   ├── logic/         # Pure state machines (transfer.ts, screening.ts, status.ts)
│       │   ├── questionnaire.ts # Canonical 5-section screening questions & validation
│       │   ├── roles.ts       # RBAC role definitions and helpers
│       │   └── schemas/       # Zod schemas for auth, workers, sites, transfers, records
├── apps/
│   ├── api/                   # Backend REST service (NestJS 10 + Prisma + PostgreSQL 16)
│   │   ├── prisma/            # schema.prisma, migrations, seeds
│   │   └── src/
│   │       ├── auth/          # JWT strategy, bcrypt hashing, PIN authentication
│   │       ├── workers/       # Worker profile, Worker ID lookup, site assignments
│   │       ├── sites/         # Geographic tree (State->District->Taluka->Area) & site search
│   │       ├── screening/     # Draft saving, completeness evaluation, completion
│   │       ├── records/       # Episodes, diagnostics, prescriptions, symptom reports, followups
│   │       ├── transfers/     # Transactional transfer state machine & locking
│   │       ├── common/        # Idempotency, audit logger, exception filter, RBAC guard
│   │       └── meta/          # System health and questionnaire schema definition
│   ├── web/                   # Responsive web application (React 18 + Vite + React Router 6)
│   │   └── src/               # Worker self-service, contractor transfer dashboard, role placeholders
│   └── mobile/                # Physical Android / iOS app (React Native 0.76 + Expo SDK 52)
│       ├── app/               # Expo Router file-based navigation (Worker portal)
│       └── src/
│           ├── api/           # Resilient dual-route API client with LAN/USB fallback
│           ├── db/            # Expo SQLite database client and Drizzle ORM schema
│           ├── services/      # Outbox background sync and screening persistence
│           ├── components/    # Reusable UI controls, native DatePickerField, status chips
│           └── i18n/          # Locales (English, Hindi, Bengali, Marathi)
```

### 2.2 Data Layer & Concurrency Model

- **PostgreSQL 16**: Authoritative central store managed through Prisma ORM.
- **UUID Primary Keys**: Every entity uses UUID v4 as its internal identifier.
- **Human-Facing Stable Identifiers**:
  - `Worker.workerCode`: Nanoid-generated alphanumeric key prefixed with `M3-` (e.g. `M3-7F3K9A`).
  - `ConstructionSite.siteCode`: Unique site code (e.g. `SITE-CNDLM1`).
- **Partial Unique Indexes**:
  1. `uq_active_assignment_per_worker`: Ensures `WorkerSiteAssignment` has at most one record where `active = true` per worker.
  2. `uq_open_transfer_per_worker`: Enforces that each worker can have at most one pending (non-terminal) `SiteTransferRequest`.
- **Serialised State Transitions**:
  - Transfer decision endpoints lock the target transfer row using `SELECT ... FOR UPDATE` within an interactive Prisma transaction.
  - State transitions are calculated using pure shared domain logic (`computeTransferStatus`).
  - If the decision reaches final consensus (`ACCEPTED`), the active assignment switch and audit record write occur within the exact same atomic transaction.

### 2.3 Resilient Networking & Offline-First Strategy

1. **Local Outbox Pattern**:
   - When a worker reports symptoms while offline, a record is inserted into local SQLite (`symptom_report` and `outbox`).
   - The outbox stores the endpoint, HTTP method, JSON payload, and a persistent client-generated `idempotencyKey`.
2. **Sync Drainage**:
   - `runSync(token)` processes outbox items sequentially.
   - The backend validates the `IdempotencyKey` table. If the server already processed that key, it returns the cached result without creating a duplicate record.
3. **Dual-Route Client Fallback**:
   - In physical field test deployments (e.g. Android tablets connected to local developer workstations via ADB or Wi-Fi):
   - The mobile client attempts the configured LAN endpoint (`http://<LAN_IP>:8003/api/v1`).
   - If a network error or connection timeout occurs, it automatically retries against `http://127.0.0.1:8003/api/v1` via the active `adb reverse tcp:8003 tcp:8003` tunnel.

---

## 3. Visual Flowcharts (Mermaid)

### Diagram 1: System Topology & Monorepo Interactions

```mermaid
flowchart TD
    subgraph Shared["packages/shared (Single Source of Truth)"]
        SharedSchemas["Zod Validation Schemas"]
        SharedEnums["Domain Enums & Roles"]
        SharedLogic["Pure State Machines (Transfer / Screening)"]
        SharedQuest["Canonical 5-Section Questionnaire"]
        SharedTokens["UI Design Tokens"]
    end

    subgraph Backend["apps/api (NestJS 10 + Prisma)"]
        API_Auth["Auth Module (JWT / bcrypt PIN)"]
        API_Workers["Worker & Screening Module"]
        API_Sites["Site Master & Geographic Hierarchy"]
        API_Transfers["Transfer Engine (Locked Transactions)"]
        API_Records["Clinical Records & Symptom Reports"]
        API_Idemp["Idempotency & Audit Logging"]
    end

    subgraph Storage["Central Database"]
        PG[("PostgreSQL 16 (Authoritative)")]
    end

    subgraph MobileClient["apps/mobile (React Native / Expo SDK 52)"]
        MobUI["Worker UI (Expo Router)"]
        MobDate["Native DatePicker Dialogs"]
        MobSQLite[("Expo SQLite (Drizzle ORM)")]
        MobOutbox["Outbox Queue Service"]
        MobClient["Dual-Route API Client (LAN / USB Bridge)"]
    end

    subgraph WebClient["apps/web (React 18 + Vite)"]
        WebWorker["Worker Self-Service Portal"]
        WebContractor["Contractor Transfer Workspace"]
        WebDashboards["Stakeholder Placeholder Dashboards"]
    end

    %% Shared dependencies
    Shared --> Backend
    Shared --> MobileClient
    Shared --> WebClient

    %% Client API connections
    MobClient -->|"REST /api/v1 (Bearer JWT)"| Backend
    WebClient -->|"REST /api/v1 (Bearer JWT)"| Backend

    %% Mobile local storage
    MobUI --> MobSQLite
    MobSQLite --> MobOutbox
    MobOutbox --> MobClient

    %% Backend database operations
    Backend --> PG
```

---

### Diagram 2: End-to-End Worker Journey & Registration Gate

```mermaid
flowchart TD
    Start(["Worker Opens Application"]) --> Lang["Select Language (en / hi / bn / mr)"]
    Lang --> CheckPhone{"Returning Worker?"}

    CheckPhone -->|"Yes"| SignIn["Enter Phone & 4-Digit PIN"]
    CheckPhone -->|"No"| Register["Register: Name, Phone, 4-Digit PIN"]

    Register --> CreateWorker["Backend: Create Worker & User Record\nGenerate Worker ID (M3-XXXXXX)"]
    SignIn --> AuthVal{"Validate Credentials"}
    CreateWorker --> AuthVal

    AuthVal -->|"Invalid"| SignInFail["Display Error Dialog"] --> SignIn
    AuthVal -->|"Valid"| IssueJWT["Issue Bearer JWT Token"]

    IssueJWT --> GateCheck{"Initial Screening Completed?"}

    GateCheck -->|"No / Incomplete"| ForceScreening["Gatekeeper: Route to Initial Screening\n(Dashboard Access Blocked)"]
    GateCheck -->|"Yes (Complete)"| Dashboard["Load Worker Dashboard"]

    subgraph ScreeningProcess["Initial Screening (One-Time Baseline)"]
        ForceScreening --> Sec1["Section I: Socio-Demographic Profile\n(Native DatePicker for DOB)"]
        Sec1 --> Sec2["Section II: Malaria History"]
        Sec2 --> Sec3["Section III: Current Symptoms & Vitals"]
        Sec3 --> Sec4["Section IV: Travel & Mobility History"]
        Sec4 --> Sec5["Section V: Future Travel & Informed Consent"]
        Sec5 --> CheckConsent{"Informed Consent Checked?"}
        CheckConsent -->|"No"| PreventSubmit["Block Submission"] --> Sec5
        CheckConsent -->|"Yes"| SubmitScreening["Submit Screening (POST /screening/complete)"]
    end

    SubmitScreening --> MarkComplete["Backend: Set Status = COMPLETE\nLock Screening Permanently"]
    MarkComplete --> AssignSitePrompt["Prompt Construction Site Selection"]

    subgraph SiteSelection["Geographic Hierarchy Drill-Down"]
        AssignSitePrompt --> PickState["State: Goa"]
        PickState --> PickDistrict["District: North Goa / South Goa"]
        PickDistrict --> PickTaluka["Taluka: Bardez, etc."]
        PickTaluka --> PickArea["Area: Candolim, etc."]
        PickArea --> PickSite["Select Specific Site (e.g. Candolim Tower)"]
    end

    PickSite --> CreateAssign["POST /workers/site\nCreate WorkerSiteAssignment"]
    CreateAssign --> Dashboard

    subgraph WorkerDashboard["Worker Operational Dashboard"]
        Dashboard --> TileStatus["View Malaria Status Chip (Positive/Negative/Awaiting)"]
        Dashboard --> TileUnwell["Report Unwell (Symptom Checklist)"]
        Dashboard --> TileRx["View Active Prescriptions & History"]
        Dashboard --> TileTransfer["Request / Accept Site Transfer"]
        Dashboard --> TileFollowup["Answer Follow-Up Check-Ins"]
    end
```

---

### Diagram 3: Offline-First Synchronization & Outbox Engine

```mermaid
flowchart TD
    subgraph MobileDevice["Physical Android Device (Worker Mobile App)"]
        Action["Worker Submits Mutation\n(e.g. Symptom Report / Draft)"]
        CheckNet{"Is Network Reachable?"}
        
        Action --> CheckNet
        
        CheckNet -->|"Offline"| WriteLocal["Write to Local SQLite via Drizzle ORM"]
        WriteLocal --> EnqueueOutbox["Insert into Outbox Table\n(idempotencyKey, payload, syncState = PENDING)"]
        EnqueueOutbox --> DisplayPending["UI Badge: Sync Status = PENDING"]
        
        CheckNet -->|"Online"| TryLAN["Attempt Primary Endpoint:\nhttp://LAN_IP:8003/api/v1"]
        
        TryLAN --> LANSuccess{"HTTP Success?"}
        LANSuccess -->|"Yes"| DirectDone["Mark Record SYNCED\nDisplay Confirmation"]
        LANSuccess -->|"Network Timeout / Error"| TryUSB["Fallback to Local USB Tunnel:\nhttp://127.0.0.1:8003/api/v1"]
        
        TryUSB --> USBSuccess{"HTTP Success?"}
        USBSuccess -->|"Yes"| DirectDone
        USBSuccess -->|"No"| WriteLocal
        
        DisplayPending --> NetRestored["Network Connectivity Restored"]
        NetRestored --> DrainOutbox["Outbox Sync Service Triggered (runSync)"]
        DrainOutbox --> DequeueItem["Fetch Oldest PENDING Outbox Item"]
        DequeueItem --> SendPayload["POST /api/v1/... with X-Idempotency-Key"]
    end

    subgraph BackendAPI["Backend REST Service (apps/api)"]
        SendPayload --> CheckIdemp{"Exists in IdempotencyKey Table?"}
        CheckIdemp -->|"Yes (Already Processed)"| ReturnCached["Return 200 OK + Cached Response\n(No Duplicate Created)"]
        CheckIdemp -->|"No (Fresh Mutation)"| RunTx["Execute DB Mutation Transaction"]
        RunTx --> SaveIdemp["Insert into IdempotencyKey Table"]
        SaveIdemp --> ReturnFresh["Return 201 Created"]
    end

    ReturnCached --> AckOutbox["Remove Item from Outbox\nUpdate Local Sync State to SYNCED"]
    ReturnFresh --> AckOutbox
    AckOutbox --> UpdateUI["UI Badge: Sync Status = SYNCED"]
```

---

### Diagram 4: Multi-Party Site Transfer State Machine

```mermaid
stateDiagram-v2
    [*] --> Initiation

    state Initiation {
        [*] --> WorkerInitiated : Worker submits transfer to Target Site
        [*] --> ContractorInitiated : Target Contractor requests Worker
    }

    WorkerInitiated --> PENDING_CURRENT_CONTRACTOR : Worker pre-approved
    ContractorInitiated --> PENDING_WORKER_RESPONSE : Destination Contractor pre-approved

    PENDING_WORKER_RESPONSE --> PENDING_CURRENT_CONTRACTOR : Worker accepts request
    PENDING_WORKER_RESPONSE --> REJECTED : Worker declines request
    PENDING_WORKER_RESPONSE --> CANCELLED : Contractor withdraws request

    PENDING_CURRENT_CONTRACTOR --> PENDING_DESTINATION_CONTRACTOR : Current Contractor approves (Worker-initiated)
    PENDING_CURRENT_CONTRACTOR --> ACCEPTED : Current Contractor approves (Contractor-initiated)
    PENDING_CURRENT_CONTRACTOR --> REJECTED : Current Contractor rejects
    PENDING_CURRENT_CONTRACTOR --> CANCELLED : Initiator cancels

    PENDING_DESTINATION_CONTRACTOR --> ACCEPTED : Destination Contractor approves
    PENDING_DESTINATION_CONTRACTOR --> REJECTED : Destination Contractor rejects
    PENDING_DESTINATION_CONTRACTOR --> CANCELLED : Initiator cancels

    state ACCEPTED {
        [*] --> AtomicTransition : SELECT ... FOR UPDATE Lock Transfer Row
        AtomicTransition --> CloseOld : Close existing WorkerSiteAssignment (active=false, endedAt=now)
        CloseOld --> CreateNew : Insert new active WorkerSiteAssignment
        CreateNew --> WriteAudit : Record AuditLog event
        WriteAudit --> [*]
    }

    REJECTED --> [*] : Active site assignment remains unchanged
    CANCELLED --> [*] : Active site assignment remains unchanged
    ACCEPTED --> [*] : Worker officially transferred
```

---

### Diagram 5: Clinical Safety & Diagnostic Separation

```mermaid
flowchart LR
    subgraph ObservationalData["Worker Observational Triage (Non-Clinical)"]
        Symp["Worker Self-Report\n'Feeling Unwell'\n(Fever, Headache, Chills)"]
        Follow["Follow-Up Check-In Responses\n('Taking medication: Yes')"]
        ObsNote["Worker Free-Text Notes"]
    end

    subgraph IsolationBarrier["Strict Clinical Safety Isolation Boundary"]
        Barrier{"MALARIA STATUS ENGINE\nStatus is NEVER inferred\nfrom worker symptoms"}
    end

    subgraph AuthorizedClinicalData["Authorized Clinical & Lab Diagnostics"]
        RDT["Rapid Diagnostic Test (RDT)\n(Authorized Staff Entry)"]
        Micro["Microscopy Test\n(Species: P. Falciparum / P. Vivax)"]
        LabAuth["Authorized Lab Result Entry\n(Clinician / Pathologist / Health Worker)"]
    end

    subgraph AuthoritativeOutputs["Authoritative Clinical Status"]
        StatusNode["Malaria Status Chip:\n• POSITIVE\n• NEGATIVE\n• AWAITING\n• NO_RESULT"]
        EpisodeNode["Malaria Episode Record\n(SUSPECTED / CONFIRMED / RESOLVED)"]
        RxNode["Prescription Record\n(Append-Only, Locked to Episode)"]
    end

    Symp -.->|"Stored as Triage Info ONLY\n(Does NOT alter status)"| Barrier
    Follow -.->|"Stored as Adherence Info ONLY\n(Does NOT alter status)"| Barrier

    RDT --> LabAuth
    Micro --> LabAuth
    LabAuth ==>|"Authoritative Input"| Barrier

    Barrier ==>|"Derives"| StatusNode
    Barrier ==>|"Manages"| EpisodeNode
    EpisodeNode ==>|"Links to"| RxNode
```

---

### Diagram 6: Database Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    User ||--o| Worker : "authenticates as"
    User ||--o| Contractor : "authenticates as"

    Contractor ||--o{ ConstructionSite : "owns"
    LocationNode ||--o{ LocationNode : "parent/child"
    LocationNode ||--o{ ConstructionSite : "contains"

    Worker ||--o{ WorkerSiteAssignment : "assigned via"
    ConstructionSite ||--o{ WorkerSiteAssignment : "hosts"

    Worker ||--o| InitialScreening : "completes (1:1)"

    Worker ||--o{ MalariaEpisode : "experiences"
    MalariaEpisode ||--o{ DiagnosticResult : "diagnosed by"
    MalariaEpisode ||--o{ Prescription : "treated by"
    Worker ||--o{ Prescription : "receives"

    Worker ||--o{ SymptomReport : "submits"
    Worker ||--o{ FollowUp : "responds to"

    Worker ||--o{ SiteTransferRequest : "subject of"
    ConstructionSite ||--o{ SiteTransferRequest : "transfers from"
    ConstructionSite ||--o{ SiteTransferRequest : "transfers to"

    User {
        string id PK
        enum role
        string displayName
        string username UK
        string passwordHash
        string phone UK
        string pinHash
        string workerId FK
        string contractorId FK
        datetime createdAt
    }

    Worker {
        string id PK
        string workerCode UK "e.g. M3-7F3K9A"
        string name
        string phone UK
        enum preferredLanguage
        datetime createdAt
    }

    Contractor {
        string id PK
        string name
        datetime createdAt
    }

    LocationNode {
        string id PK
        enum level "STATE, DISTRICT, TALUKA, AREA"
        string name
        string parentId FK
    }

    ConstructionSite {
        string id PK
        string siteCode UK "e.g. SITE-CNDLM1"
        string name
        string areaId FK
        string contractorId FK
        boolean active
    }

    WorkerSiteAssignment {
        string id PK
        string workerId FK
        string siteId FK
        boolean active "Max 1 true per worker"
        datetime startedAt
        datetime endedAt
        string transferId
    }

    InitialScreening {
        string id PK
        string workerId FK "Unique (1:1)"
        enum status "DRAFT / COMPLETE"
        string version
        boolean consentGiven
        json answers
        datetime completedAt
    }

    MalariaEpisode {
        string id PK
        string workerId FK
        enum status "SUSPECTED / CONFIRMED / RESOLVED"
        datetime onsetDate
        datetime createdAt
    }

    DiagnosticResult {
        string id PK
        string episodeId FK
        enum testType "RDT / MICROSCOPY"
        enum result "POSITIVE / NEGATIVE / INCONCLUSIVE"
        enum species "P_FALCIPARUM / P_VIVAX / MIXED"
        datetime testDate
        string createdById
    }

    Prescription {
        string id PK
        string episodeId FK
        string workerId FK
        string details "Append-only"
        datetime issuedAt
    }

    SymptomReport {
        string id PK
        string workerId FK
        string episodeId FK
        json symptoms
        string note
        datetime createdAt
    }

    FollowUp {
        string id PK
        string workerId FK
        string episodeId FK
        string question
        string response
        datetime respondedAt
    }

    SiteTransferRequest {
        string id PK
        string workerId FK
        string fromSiteId FK
        string toSiteId FK
        enum initiatorType "WORKER / CONTRACTOR"
        enum status "PENDING_*, ACCEPTED, REJECTED, CANCELLED"
        enum workerDecision
        enum fromContractorDecision
        enum toContractorDecision
        datetime effectiveAt
    }
```
