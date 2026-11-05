--
-- PostgreSQL database dump
--

\restrict wrbrNwYn1xNCn39p4IzeMDwAEMYfiymC9XAqb57HmPHn1KJe2jUK4EgZZcVAzLK

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: AssignmentStatus; Type: TYPE; Schema: public; Owner: m3
--

CREATE TYPE public."AssignmentStatus" AS ENUM (
    'ACTIVE',
    'ENDED',
    'TRANSFERRED'
);


ALTER TYPE public."AssignmentStatus" OWNER TO m3;

--
-- Name: Decision; Type: TYPE; Schema: public; Owner: m3
--

CREATE TYPE public."Decision" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


ALTER TYPE public."Decision" OWNER TO m3;

--
-- Name: DiagnosticResultValue; Type: TYPE; Schema: public; Owner: m3
--

CREATE TYPE public."DiagnosticResultValue" AS ENUM (
    'POSITIVE',
    'NEGATIVE',
    'INCONCLUSIVE'
);


ALTER TYPE public."DiagnosticResultValue" OWNER TO m3;

--
-- Name: EpisodeStatus; Type: TYPE; Schema: public; Owner: m3
--

CREATE TYPE public."EpisodeStatus" AS ENUM (
    'SUSPECTED',
    'CONFIRMED',
    'RESOLVED'
);


ALTER TYPE public."EpisodeStatus" OWNER TO m3;

--
-- Name: JoinRequestStatus; Type: TYPE; Schema: public; Owner: m3
--

CREATE TYPE public."JoinRequestStatus" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'DECLINED',
    'CANCELLED'
);


ALTER TYPE public."JoinRequestStatus" OWNER TO m3;

--
-- Name: Language; Type: TYPE; Schema: public; Owner: m3
--

CREATE TYPE public."Language" AS ENUM (
    'en',
    'hi',
    'bn',
    'mr',
    'kok',
    'kn',
    'or',
    'te',
    'ta',
    'ml',
    'bho',
    'as',
    'gu',
    'pa',
    'ur',
    'mai',
    'sat',
    'hne'
);


ALTER TYPE public."Language" OWNER TO m3;

--
-- Name: LocationLevel; Type: TYPE; Schema: public; Owner: m3
--

CREATE TYPE public."LocationLevel" AS ENUM (
    'STATE',
    'DISTRICT',
    'TALUKA',
    'AREA'
);


ALTER TYPE public."LocationLevel" OWNER TO m3;

--
-- Name: PlasmodiumSpecies; Type: TYPE; Schema: public; Owner: m3
--

CREATE TYPE public."PlasmodiumSpecies" AS ENUM (
    'P_FALCIPARUM',
    'P_VIVAX',
    'MIXED',
    'OTHER',
    'UNKNOWN'
);


ALTER TYPE public."PlasmodiumSpecies" OWNER TO m3;

--
-- Name: Role; Type: TYPE; Schema: public; Owner: m3
--

CREATE TYPE public."Role" AS ENUM (
    'WORKER',
    'HEALTH_WORKER',
    'CONTRACTOR',
    'CLINICIAN',
    'PATHOLOGIST',
    'RESEARCH_LAB',
    'ADMIN'
);


ALTER TYPE public."Role" OWNER TO m3;

--
-- Name: ScreeningStatus; Type: TYPE; Schema: public; Owner: m3
--

CREATE TYPE public."ScreeningStatus" AS ENUM (
    'DRAFT',
    'COMPLETE'
);


ALTER TYPE public."ScreeningStatus" OWNER TO m3;

--
-- Name: TestType; Type: TYPE; Schema: public; Owner: m3
--

CREATE TYPE public."TestType" AS ENUM (
    'RDT',
    'MICROSCOPY'
);


ALTER TYPE public."TestType" OWNER TO m3;

--
-- Name: TransferInitiator; Type: TYPE; Schema: public; Owner: m3
--

CREATE TYPE public."TransferInitiator" AS ENUM (
    'WORKER',
    'CONTRACTOR'
);


ALTER TYPE public."TransferInitiator" OWNER TO m3;

--
-- Name: TransferStatus; Type: TYPE; Schema: public; Owner: m3
--

CREATE TYPE public."TransferStatus" AS ENUM (
    'PENDING_WORKER_RESPONSE',
    'PENDING_CURRENT_CONTRACTOR',
    'PENDING_DESTINATION_CONTRACTOR',
    'ACCEPTED',
    'REJECTED',
    'CANCELLED'
);


ALTER TYPE public."TransferStatus" OWNER TO m3;

--
-- Name: TravelReportStatus; Type: TYPE; Schema: public; Owner: m3
--

CREATE TYPE public."TravelReportStatus" AS ENUM (
    'OPEN',
    'REVIEWED',
    'RESOLVED'
);


ALTER TYPE public."TravelReportStatus" OWNER TO m3;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: m3
--

CREATE TABLE public."AuditLog" (
    id text NOT NULL,
    "actorId" text,
    action text NOT NULL,
    "entityType" text NOT NULL,
    "entityId" text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."AuditLog" OWNER TO m3;

--
-- Name: ConstructionSite; Type: TABLE; Schema: public; Owner: m3
--

CREATE TABLE public."ConstructionSite" (
    id text NOT NULL,
    "siteCode" text NOT NULL,
    name text NOT NULL,
    "areaId" text NOT NULL,
    "contractorId" text,
    active boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    address text,
    landmark text,
    "contactPhone" text
);


ALTER TABLE public."ConstructionSite" OWNER TO m3;

--
-- Name: Contractor; Type: TABLE; Schema: public; Owner: m3
--

CREATE TABLE public."Contractor" (
    id text NOT NULL,
    name text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Contractor" OWNER TO m3;

--
-- Name: ContractorSite; Type: TABLE; Schema: public; Owner: m3
--

CREATE TABLE public."ContractorSite" (
    id text NOT NULL,
    "contractorId" text NOT NULL,
    "siteId" text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "assignedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "removedAt" timestamp(3) without time zone
);


ALTER TABLE public."ContractorSite" OWNER TO m3;

--
-- Name: DiagnosticResult; Type: TABLE; Schema: public; Owner: m3
--

CREATE TABLE public."DiagnosticResult" (
    id text NOT NULL,
    "episodeId" text NOT NULL,
    "testType" public."TestType" NOT NULL,
    result public."DiagnosticResultValue" NOT NULL,
    species public."PlasmodiumSpecies",
    "testDate" timestamp(3) without time zone NOT NULL,
    "createdById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."DiagnosticResult" OWNER TO m3;

--
-- Name: FollowUp; Type: TABLE; Schema: public; Owner: m3
--

CREATE TABLE public."FollowUp" (
    id text NOT NULL,
    "workerId" text NOT NULL,
    "episodeId" text,
    question text NOT NULL,
    response text,
    note text,
    "respondedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."FollowUp" OWNER TO m3;

--
-- Name: IdempotencyKey; Type: TABLE; Schema: public; Owner: m3
--

CREATE TABLE public."IdempotencyKey" (
    id text NOT NULL,
    key text NOT NULL,
    scope text NOT NULL,
    "userId" text,
    "entityId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."IdempotencyKey" OWNER TO m3;

--
-- Name: InitialScreening; Type: TABLE; Schema: public; Owner: m3
--

CREATE TABLE public."InitialScreening" (
    id text NOT NULL,
    "workerId" text NOT NULL,
    status public."ScreeningStatus" DEFAULT 'DRAFT'::public."ScreeningStatus" NOT NULL,
    version text NOT NULL,
    "consentGiven" boolean DEFAULT false NOT NULL,
    answers jsonb DEFAULT '{}'::jsonb NOT NULL,
    "completedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."InitialScreening" OWNER TO m3;

--
-- Name: LocationNode; Type: TABLE; Schema: public; Owner: m3
--

CREATE TABLE public."LocationNode" (
    id text NOT NULL,
    level public."LocationLevel" NOT NULL,
    name text NOT NULL,
    "parentId" text
);


ALTER TABLE public."LocationNode" OWNER TO m3;

--
-- Name: MalariaEpisode; Type: TABLE; Schema: public; Owner: m3
--

CREATE TABLE public."MalariaEpisode" (
    id text NOT NULL,
    "workerId" text NOT NULL,
    status public."EpisodeStatus" DEFAULT 'SUSPECTED'::public."EpisodeStatus" NOT NULL,
    "onsetDate" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."MalariaEpisode" OWNER TO m3;

--
-- Name: Notification; Type: TABLE; Schema: public; Owner: m3
--

CREATE TABLE public."Notification" (
    id text NOT NULL,
    "audienceRole" public."Role",
    "audienceUserId" text,
    type text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    "entityType" text,
    "entityId" text,
    "dedupeKey" text NOT NULL,
    "readAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Notification" OWNER TO m3;

--
-- Name: Prescription; Type: TABLE; Schema: public; Owner: m3
--

CREATE TABLE public."Prescription" (
    id text NOT NULL,
    "episodeId" text NOT NULL,
    "workerId" text NOT NULL,
    details text NOT NULL,
    "issuedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "issuedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Prescription" OWNER TO m3;

--
-- Name: SiteJoinRequest; Type: TABLE; Schema: public; Owner: m3
--

CREATE TABLE public."SiteJoinRequest" (
    id text NOT NULL,
    "workerId" text NOT NULL,
    "siteId" text NOT NULL,
    status public."JoinRequestStatus" DEFAULT 'PENDING'::public."JoinRequestStatus" NOT NULL,
    "decidedById" text,
    "decidedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."SiteJoinRequest" OWNER TO m3;

--
-- Name: SiteTransferRequest; Type: TABLE; Schema: public; Owner: m3
--

CREATE TABLE public."SiteTransferRequest" (
    id text NOT NULL,
    "workerId" text NOT NULL,
    "fromSiteId" text,
    "toSiteId" text NOT NULL,
    "initiatorType" public."TransferInitiator" NOT NULL,
    "initiatorId" text NOT NULL,
    status public."TransferStatus" DEFAULT 'PENDING_WORKER_RESPONSE'::public."TransferStatus" NOT NULL,
    "workerDecision" public."Decision" DEFAULT 'PENDING'::public."Decision" NOT NULL,
    "workerDecisionAt" timestamp(3) without time zone,
    "fromContractorDecision" public."Decision" DEFAULT 'PENDING'::public."Decision" NOT NULL,
    "fromContractorDecisionAt" timestamp(3) without time zone,
    "toContractorDecision" public."Decision" DEFAULT 'PENDING'::public."Decision" NOT NULL,
    "toContractorDecisionAt" timestamp(3) without time zone,
    "cancelledById" text,
    "cancelledAt" timestamp(3) without time zone,
    "effectiveAt" timestamp(3) without time zone,
    note text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "fromContractorId" text,
    "toContractorId" text
);


ALTER TABLE public."SiteTransferRequest" OWNER TO m3;

--
-- Name: SymptomReport; Type: TABLE; Schema: public; Owner: m3
--

CREATE TABLE public."SymptomReport" (
    id text NOT NULL,
    "workerId" text NOT NULL,
    "episodeId" text,
    symptoms jsonb DEFAULT '[]'::jsonb NOT NULL,
    note text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "voiceData" text
);


ALTER TABLE public."SymptomReport" OWNER TO m3;

--
-- Name: TravelRecord; Type: TABLE; Schema: public; Owner: m3
--

CREATE TABLE public."TravelRecord" (
    id text NOT NULL,
    "workerId" text NOT NULL,
    "planningTravel" boolean DEFAULT false NOT NULL,
    "departureDate" timestamp(3) without time zone,
    "returnDate" timestamp(3) without time zone,
    destination text,
    state text,
    "hadFeverOrMalaria" boolean DEFAULT false NOT NULL,
    "treatmentGiven" boolean DEFAULT false NOT NULL,
    "completedCourse" boolean DEFAULT false NOT NULL,
    "treatmentPlace" text,
    status text DEFAULT 'SUBMITTED'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."TravelRecord" OWNER TO m3;

--
-- Name: TravelReport; Type: TABLE; Schema: public; Owner: m3
--

CREATE TABLE public."TravelReport" (
    id text NOT NULL,
    "travelRecordId" text NOT NULL,
    "workerId" text NOT NULL,
    "departureDate" timestamp(3) without time zone,
    "destinationState" text,
    reason text NOT NULL,
    status public."TravelReportStatus" DEFAULT 'OPEN'::public."TravelReportStatus" NOT NULL,
    "reviewNote" text,
    "reviewedById" text,
    "reviewedAt" timestamp(3) without time zone,
    "submittedByContractorId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."TravelReport" OWNER TO m3;

--
-- Name: User; Type: TABLE; Schema: public; Owner: m3
--

CREATE TABLE public."User" (
    id text NOT NULL,
    role public."Role" NOT NULL,
    "displayName" text NOT NULL,
    username text,
    "passwordHash" text,
    phone text,
    "pinHash" text,
    "workerId" text,
    "contractorId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "stakeholderCode" text,
    "mustChangeCredential" boolean DEFAULT false NOT NULL,
    active boolean DEFAULT true NOT NULL
);


ALTER TABLE public."User" OWNER TO m3;

--
-- Name: Worker; Type: TABLE; Schema: public; Owner: m3
--

CREATE TABLE public."Worker" (
    id text NOT NULL,
    "workerCode" text NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    "preferredLanguage" public."Language" DEFAULT 'en'::public."Language" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Worker" OWNER TO m3;

--
-- Name: WorkerPassToken; Type: TABLE; Schema: public; Owner: m3
--

CREATE TABLE public."WorkerPassToken" (
    id text NOT NULL,
    "tokenHash" text NOT NULL,
    "tokenPrefix" text NOT NULL,
    "workerId" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "usedAt" timestamp(3) without time zone,
    "usedById" text,
    "revokedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."WorkerPassToken" OWNER TO m3;

--
-- Name: WorkerSiteAssignment; Type: TABLE; Schema: public; Owner: m3
--

CREATE TABLE public."WorkerSiteAssignment" (
    id text NOT NULL,
    "workerId" text NOT NULL,
    "siteId" text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "endedAt" timestamp(3) without time zone,
    "transferId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "contractorId" text,
    status public."AssignmentStatus" DEFAULT 'ACTIVE'::public."AssignmentStatus" NOT NULL
);


ALTER TABLE public."WorkerSiteAssignment" OWNER TO m3;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: m3
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO m3;

--
-- Data for Name: AuditLog; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."AuditLog" (id, "actorId", action, "entityType", "entityId", metadata, "createdAt") FROM stdin;
5b818dde-1c57-4483-8049-a71449326e17	939038bf-ee3a-4d23-8d6c-cd9b1fe224b1	SYMPTOM_REPORTED	SymptomReport	3ca8ca53-890c-4c1a-9ede-92a6c20cd476	{"workerId": "2ec7835e-d53c-4b23-9ffb-c583a6e84fd7"}	2026-10-30 09:44:25.244
5efec219-0150-43e2-b953-691c1dfa31c8	9d10296a-b6c2-44da-af1f-d84be00beb38	WORKER_REGISTERED	Worker	3412eb86-5df0-4031-9f33-d24708f16559	{"workerCode": "M3-U2ARGS"}	2026-10-30 09:49:17.196
20aa5e10-6a57-4c24-bdba-c23a8df2cc56	939038bf-ee3a-4d23-8d6c-cd9b1fe224b1	TRANSFER_CREATED_BY_WORKER	SiteTransferRequest	d2e8a49e-4a94-41f2-adc6-091f148894b4	{"toSiteId": "18774408-09f3-47c5-ba44-a3c69af52d6d", "fromSiteId": "445b4b1f-eb76-4075-a062-9dd0407c149e"}	2026-10-30 10:30:49.78
6d5f8b56-5044-47a2-853a-b3d8793b2813	939038bf-ee3a-4d23-8d6c-cd9b1fe224b1	SYMPTOM_REPORTED	SymptomReport	170ee8c2-d3c3-4374-8869-3b9efb13e2e0	{"workerId": "2ec7835e-d53c-4b23-9ffb-c583a6e84fd7"}	2026-10-30 10:31:11.69
e7fd3dc9-458b-40b1-8459-88210c923344	6e7e8943-ebbb-49bf-b013-d67c22abf579	WORKER_REGISTERED	Worker	d214bc04-e5c3-4868-a17d-17448ec2ad1d	{"workerCode": "M3-TH8NMU"}	2026-10-30 10:55:59.156
77c4b0e6-a01e-40b0-89c0-fb414383264f	\N	SCREENING_COMPLETED	InitialScreening	2027997e-b4d3-4799-a4ac-ed747b538a0a	{"version": "worker-screening-2026-09-01", "workerId": "d214bc04-e5c3-4868-a17d-17448ec2ad1d"}	2026-10-30 11:09:46.937
8b9399be-e230-4baa-ac10-f6bf18020d45	232afa3c-ff8c-42c4-b531-fb9eb86ee8e9	WORKER_REGISTERED	Worker	b21c3c2b-dcd8-44b1-9eea-b50897918469	{"workerCode": "M3-N5YJ56"}	2026-10-30 11:30:04.888
365f048c-6a3c-435f-85b0-94181e504eb4	\N	INITIAL_SITE_ASSIGNED	WorkerSiteAssignment	9b722df8-1a8e-49b9-849b-bdad99e5f1f0	{"siteId": "445b4b1f-eb76-4075-a062-9dd0407c149e", "workerId": "b21c3c2b-dcd8-44b1-9eea-b50897918469"}	2026-10-30 11:30:05.013
c4f12beb-6f73-4569-b13c-071352221d12	\N	SCREENING_COMPLETED	InitialScreening	0d8bd602-67c6-48ae-86d0-9485bd36bb42	{"version": "worker-screening-2026-09-01", "workerId": "b21c3c2b-dcd8-44b1-9eea-b50897918469"}	2026-10-30 11:30:05.043
2002fcb8-38ce-4d3d-acb0-f4704e734200	b19a8ebb-5560-4965-978d-7bc36c7aeda3	DIAGNOSTIC_RECORDED	DiagnosticResult	a1e1dd20-15c9-47d8-8e1b-9c518a3d6c18	{"result": "NEGATIVE", "episodeId": "fbd168e5-75c3-4af4-bb5a-92b4f3492a11"}	2026-10-30 11:30:05.334
40bf4f5b-d267-4d69-a66c-292be6849caf	8b51db1b-f81d-42d1-9b3d-c2133c1808b4	WORKER_REGISTERED	Worker	de2d16af-ea48-4087-9bf1-cd90e1b059a8	{"workerCode": "M3-2SVACK"}	2026-10-30 11:30:05.512
c1a0e682-54ea-48a7-9891-c5a98bf4d02b	\N	INITIAL_SITE_ASSIGNED	WorkerSiteAssignment	6431a4e0-437e-447a-bb3a-4646c1360130	{"siteId": "18774408-09f3-47c5-ba44-a3c69af52d6d", "workerId": "de2d16af-ea48-4087-9bf1-cd90e1b059a8"}	2026-10-30 11:30:05.624
91e39d43-317f-4f78-9919-e89426f3c9c2	\N	SCREENING_COMPLETED	InitialScreening	198a0c72-af97-4f63-bb0a-f8d34fc0c16c	{"version": "worker-screening-2026-09-01", "workerId": "de2d16af-ea48-4087-9bf1-cd90e1b059a8"}	2026-10-30 11:30:05.652
6f3a21a2-75fb-47b5-b354-4adf3fb9e18f	b19a8ebb-5560-4965-978d-7bc36c7aeda3	DIAGNOSTIC_RECORDED	DiagnosticResult	92b44f03-8aba-4e92-9900-50074e489f3b	{"result": "NEGATIVE", "episodeId": "229a1a67-d047-4719-a08a-0b133b79577d"}	2026-10-30 11:30:05.928
cebdb915-0cb9-4fa6-819f-2dffbe4652f4	3f237d2c-ebb6-4bff-afd7-9b11c399abb1	WORKER_REGISTERED	Worker	66cd6653-1b00-4678-8bc4-21d00b8ae592	{"workerCode": "M3-3UT8M3"}	2026-10-30 11:30:06.107
6ac5547a-4698-499f-9e62-1ed8b3fca78e	\N	INITIAL_SITE_ASSIGNED	WorkerSiteAssignment	b299c41a-56a3-4aaf-ad58-5b3228c89753	{"siteId": "bdf12666-3c9e-450a-976e-24b8620bcdaf", "workerId": "66cd6653-1b00-4678-8bc4-21d00b8ae592"}	2026-10-30 11:30:06.22
4702c344-0017-486c-8891-d49d692c896c	\N	SCREENING_COMPLETED	InitialScreening	034d71b8-024e-4bbb-acb3-97afcb61c5e8	{"version": "worker-screening-2026-09-01", "workerId": "66cd6653-1b00-4678-8bc4-21d00b8ae592"}	2026-10-30 11:30:06.248
be60fef1-cb25-419a-8450-8cf2412d54ab	b19a8ebb-5560-4965-978d-7bc36c7aeda3	DIAGNOSTIC_RECORDED	DiagnosticResult	69d8330c-887a-4079-8831-73d90424da48	{"result": "NEGATIVE", "episodeId": "a108a04e-033e-43b7-8d25-541dde3b0c10"}	2026-10-30 11:30:06.515
b87584c1-4883-4154-acb1-3b418e429260	4a297881-7fad-4e44-991c-ee9eb83badff	WORKER_REGISTERED	Worker	08b7aa12-da12-441c-abbd-80cccf01651d	{"workerCode": "M3-92QUPZ"}	2026-10-30 11:30:06.689
00d30be4-97a3-4f5f-a929-a42057121ef4	\N	INITIAL_SITE_ASSIGNED	WorkerSiteAssignment	9858cd8b-15fe-4ad3-ab05-e2eb51e3d70a	{"siteId": "fa7397cc-94f2-4f93-91af-67e44e61220a", "workerId": "08b7aa12-da12-441c-abbd-80cccf01651d"}	2026-10-30 11:30:06.802
ccb6702e-a8dd-4155-b24b-8d119fbc0115	\N	SCREENING_COMPLETED	InitialScreening	f4286e39-4896-4a53-8f16-fc35cad8be0a	{"version": "worker-screening-2026-09-01", "workerId": "08b7aa12-da12-441c-abbd-80cccf01651d"}	2026-10-30 11:30:06.828
ea105611-e355-4b2a-b898-b339e02f0297	b19a8ebb-5560-4965-978d-7bc36c7aeda3	DIAGNOSTIC_RECORDED	DiagnosticResult	91eee800-6376-47da-bcbc-64ac7151e9bb	{"result": "NEGATIVE", "episodeId": "75ce6b00-fe72-4428-8769-2a844ecc5dae"}	2026-10-30 11:30:07.092
305d12f3-1d14-437f-92d8-770ce0a4edba	4a297881-7fad-4e44-991c-ee9eb83badff	SYMPTOM_REPORTED	SymptomReport	9e120694-005b-4d39-8609-6e41a74fd79e	{"workerId": "08b7aa12-da12-441c-abbd-80cccf01651d"}	2026-10-30 11:30:07.196
d0a5dc60-b04f-4fd5-bc2c-7c3fea3d7a44	e61c9ed0-5301-46ce-b191-efad2b10623a	WORKER_REGISTERED	Worker	36932a50-29b4-4749-9b14-f3a4cb706b1a	{"workerCode": "M3-YCEQEY"}	2026-10-30 11:30:07.332
fd1732f8-12b4-4956-9be0-8ca81a209ce1	\N	INITIAL_SITE_ASSIGNED	WorkerSiteAssignment	cac2fb7a-95ad-48a6-ab3d-bcf018c6f0ce	{"siteId": "3bddf887-6712-4c1c-9b60-ed15c17ef0ad", "workerId": "36932a50-29b4-4749-9b14-f3a4cb706b1a"}	2026-10-30 11:30:07.439
39fdc371-2f71-45e2-acee-d86f134065c0	\N	SCREENING_COMPLETED	InitialScreening	33021e3d-ce80-4bd3-9e3a-55fcc17cba0f	{"version": "worker-screening-2026-09-01", "workerId": "36932a50-29b4-4749-9b14-f3a4cb706b1a"}	2026-10-30 11:30:07.463
b96e0e12-7ae8-4e04-a722-0722f799cd4e	b19a8ebb-5560-4965-978d-7bc36c7aeda3	DIAGNOSTIC_RECORDED	DiagnosticResult	0c1c2df1-ffda-49ab-ad0d-98d1d513d69e	{"result": "NEGATIVE", "episodeId": "423a51f4-f414-410f-8547-0335e081d029"}	2026-10-30 11:30:07.724
a9aed783-a0ba-4031-818b-eb43444fb894	df1e6af3-f6c5-4988-b283-f05a70da344b	WORKER_REGISTERED	Worker	bda9958e-53ba-443f-ab19-eaf6c7125362	{"workerCode": "M3-GFEC3B"}	2026-10-30 11:30:07.872
cba1f466-e9ca-4169-9037-4621807fb716	\N	INITIAL_SITE_ASSIGNED	WorkerSiteAssignment	20bccf6c-7a0d-4b75-958f-40a44bbde0fe	{"siteId": "445b4b1f-eb76-4075-a062-9dd0407c149e", "workerId": "bda9958e-53ba-443f-ab19-eaf6c7125362"}	2026-10-30 11:30:07.98
ba521e2b-05b5-4c2a-a10b-0f293ac60cbf	\N	SCREENING_COMPLETED	InitialScreening	4e4b16e8-2fd5-4941-a3f4-ce9ac48f3d80	{"version": "worker-screening-2026-09-01", "workerId": "bda9958e-53ba-443f-ab19-eaf6c7125362"}	2026-10-30 11:30:08.007
233d5a0d-a9dc-4e04-88c6-292757ab6dbd	b19a8ebb-5560-4965-978d-7bc36c7aeda3	DIAGNOSTIC_RECORDED	DiagnosticResult	82a0b477-a2e6-45b5-b5eb-8e4a395fa9af	{"result": "POSITIVE", "episodeId": "3637deef-426d-4019-a235-ff73e6c83591"}	2026-10-30 11:30:08.292
20b5238a-c5e3-425f-9678-1e940f491bca	f55733d8-430b-4a63-90a4-0c7715c014ed	WORKER_REGISTERED	Worker	bb9ac4e7-e779-498f-90c5-e3b5b68ab0d1	{"workerCode": "M3-Q6XFD7"}	2026-10-30 11:30:08.7
39ec0b89-b4fa-4d2f-9cc7-6138cd92d337	\N	INITIAL_SITE_ASSIGNED	WorkerSiteAssignment	dea24c39-be10-46fb-af40-221b9585e9f5	{"siteId": "18774408-09f3-47c5-ba44-a3c69af52d6d", "workerId": "bb9ac4e7-e779-498f-90c5-e3b5b68ab0d1"}	2026-10-30 11:30:08.81
259fe87a-d0b6-4b9d-8b88-c99959b1ff5d	\N	SCREENING_COMPLETED	InitialScreening	a7d7c706-aa30-4fe8-bebd-38756220b445	{"version": "worker-screening-2026-09-01", "workerId": "bb9ac4e7-e779-498f-90c5-e3b5b68ab0d1"}	2026-10-30 11:30:08.836
8353465b-add5-46c2-950d-af96d14d007a	b19a8ebb-5560-4965-978d-7bc36c7aeda3	DIAGNOSTIC_RECORDED	DiagnosticResult	b8087910-ce03-445e-925b-6b6abdc1fbba	{"result": "POSITIVE", "episodeId": "7b351471-106a-45ea-8bda-646c13a980ee"}	2026-10-30 11:30:09.104
29c495f5-2228-488b-8a7f-a710dd679660	4013abe2-23bd-4b40-8929-3c1e12ddef89	WORKER_REGISTERED	Worker	8e0afb26-f00f-4eda-8174-90e33a21c947	{"workerCode": "M3-QMRJ48"}	2026-10-30 11:30:10.064
e8f3623f-289f-4030-8b46-724fb0309b6c	\N	INITIAL_SITE_ASSIGNED	WorkerSiteAssignment	cf542e21-ef9d-46d5-a896-57083ac0182e	{"siteId": "fa7397cc-94f2-4f93-91af-67e44e61220a", "workerId": "8e0afb26-f00f-4eda-8174-90e33a21c947"}	2026-10-30 11:30:10.195
fb6253ea-5e9d-4000-a1ae-550b79c16e12	037e1d5c-ae8d-4776-b411-d6f2de1c78e3	WORKER_REGISTERED	Worker	37ef28f5-66ce-45cb-ae44-4a062424e841	{"workerCode": "M3-ZY3J7G"}	2026-10-30 11:30:09.401
00afd1c2-ef2d-4d7b-ad90-e1c60c401c00	\N	INITIAL_SITE_ASSIGNED	WorkerSiteAssignment	b772e9df-1101-4b94-b29f-ec4772bcdb23	{"siteId": "bdf12666-3c9e-450a-976e-24b8620bcdaf", "workerId": "37ef28f5-66ce-45cb-ae44-4a062424e841"}	2026-10-30 11:30:09.511
fa727ec6-52a6-4380-ace1-83f41ec3cd46	\N	SCREENING_COMPLETED	InitialScreening	a902f1ad-20f3-44df-ae46-448536cb0b3a	{"version": "worker-screening-2026-09-01", "workerId": "37ef28f5-66ce-45cb-ae44-4a062424e841"}	2026-10-30 11:30:09.538
95889a78-67d2-460b-97b2-7b679fb10b1c	b19a8ebb-5560-4965-978d-7bc36c7aeda3	DIAGNOSTIC_RECORDED	DiagnosticResult	53ed37b7-6cc3-4c84-8ae3-cd1f179887d9	{"result": "POSITIVE", "episodeId": "6b564fbf-668e-4269-9c53-7a376c53abdf"}	2026-10-30 11:30:09.818
76123b18-4235-4464-8589-2d07cf3076ff	203a7c4f-0172-458e-84a5-6e957be1fcd8	WORKER_REGISTERED	Worker	0a64e705-dbc6-4248-9256-c055d108f0fa	{"workerCode": "M3-ZXMS4D"}	2026-10-30 11:30:10.812
facc2c08-b249-4c75-a0a4-ce9710b5b161	\N	INITIAL_SITE_ASSIGNED	WorkerSiteAssignment	fd848d71-e3a2-4079-89f5-021925a1dfbb	{"siteId": "3bddf887-6712-4c1c-9b60-ed15c17ef0ad", "workerId": "0a64e705-dbc6-4248-9256-c055d108f0fa"}	2026-10-30 11:30:10.937
7745ba39-4b9e-4968-9bee-a99c15751ba0	\N	SCREENING_COMPLETED	InitialScreening	8c1839c7-3c56-4ce4-873f-e74c48917bc7	{"version": "worker-screening-2026-09-01", "workerId": "0a64e705-dbc6-4248-9256-c055d108f0fa"}	2026-10-30 11:30:10.961
acec040b-8593-446a-b73d-c6280b007c9e	b19a8ebb-5560-4965-978d-7bc36c7aeda3	DIAGNOSTIC_RECORDED	DiagnosticResult	45ee1816-f909-4ded-8fc7-1cc6e67dee79	{"result": "POSITIVE", "episodeId": "2363a97f-3799-4e8e-8cf6-c07d70e6a30a"}	2026-10-30 11:30:11.249
3ad396c3-4b44-4674-8020-4d17babe69e8	\N	SCREENING_COMPLETED	InitialScreening	1e948179-ab0d-4f2a-b047-ac0b895740b0	{"version": "worker-screening-2026-09-01", "workerId": "8e0afb26-f00f-4eda-8174-90e33a21c947"}	2026-10-30 11:30:10.223
538c4eff-8f74-44de-b89c-f92a432e190a	b19a8ebb-5560-4965-978d-7bc36c7aeda3	DIAGNOSTIC_RECORDED	DiagnosticResult	b09341ee-416a-40d2-ad35-e1957d70d00c	{"result": "POSITIVE", "episodeId": "a431ab87-ee3b-4c8d-a758-b5f7a76c9fe5"}	2026-10-30 11:30:10.546
62584c82-0e7f-4f3a-bbaa-9ab32eddf3d0	232afa3c-ff8c-42c4-b531-fb9eb86ee8e9	SYMPTOM_REPORTED	SymptomReport	89b1de28-caa8-42d0-832e-f37dfcd682ce	{"workerId": "b21c3c2b-dcd8-44b1-9eea-b50897918469"}	2026-10-31 07:04:54.343
705c10b5-e8e2-4fda-bb09-065f5957cfdb	2f86c02f-4e5c-4f13-8ea1-c6d6f1b8a5b0	WORKER_REGISTERED	Worker	7e989751-6b32-41c5-b2b3-e3ddb348117e	{"workerCode": "M3-8YZTWY"}	2026-10-31 07:05:40.786
aa543873-5686-4503-9fde-ea80efd77ff8	\N	SCREENING_COMPLETED	InitialScreening	a5ddc6fe-6045-4bf0-89ab-e36ddc870226	{"version": "worker-screening-2026-09-01", "workerId": "7e989751-6b32-41c5-b2b3-e3ddb348117e"}	2026-10-31 07:15:21.042
795e7f00-48c1-485c-a3e8-89f5e8154328	\N	INITIAL_SITE_ASSIGNED	WorkerSiteAssignment	79689ea4-820f-435b-89f3-140301c3f671	{"siteId": "445b4b1f-eb76-4075-a062-9dd0407c149e", "workerId": "7e989751-6b32-41c5-b2b3-e3ddb348117e"}	2026-10-31 07:18:16.166
85f496b9-87fc-4603-b0a7-1473b64a93e0	e3737134-7776-41c5-91a7-709f4e0e7b60	WORKER_REGISTERED	Worker	1ec4187f-7e06-4ca1-bb21-4626e25012f0	{"workerCode": "M3-EAEGYD"}	2026-10-31 07:26:38.943
e1ccf969-6f23-4d28-b529-76d3bdf608ef	\N	SCREENING_COMPLETED	InitialScreening	91f1a48d-9de2-4543-a6cf-2df5055b5748	{"version": "worker-screening-2026-09-01", "workerId": "1ec4187f-7e06-4ca1-bb21-4626e25012f0"}	2026-10-31 07:37:48.362
496a9369-1c3c-4ca6-b5ed-a83b25e86a08	\N	INITIAL_SITE_ASSIGNED	WorkerSiteAssignment	b98ad670-5c87-4711-9f58-9d07ac83794c	{"siteId": "445b4b1f-eb76-4075-a062-9dd0407c149e", "workerId": "1ec4187f-7e06-4ca1-bb21-4626e25012f0"}	2026-10-31 07:38:28.277
39dbdcab-aaa4-4ebf-b47a-b737c61ff5be	e3737134-7776-41c5-91a7-709f4e0e7b60	TRANSFER_CREATED_BY_WORKER	SiteTransferRequest	f7d7c787-b589-409e-80a8-dc6b2478de00	{"toSiteId": "18774408-09f3-47c5-ba44-a3c69af52d6d", "fromSiteId": "445b4b1f-eb76-4075-a062-9dd0407c149e"}	2026-10-31 07:39:05.986
2a7748a3-433d-45ea-964c-cefc45abd15e	e3737134-7776-41c5-91a7-709f4e0e7b60	SYMPTOM_REPORTED	SymptomReport	a40bdc9f-d628-46ca-a0d5-39280cee1884	{"workerId": "1ec4187f-7e06-4ca1-bb21-4626e25012f0"}	2026-10-31 07:40:40.769
07300a39-5ae2-4f78-b2bf-158723543aff	5691c8f1-f036-4986-a592-5a01dfe4e469	WORKER_REGISTERED	Worker	160f6d93-c491-49d9-85e5-dad04ef070fd	{"workerCode": "M3-59K8W4"}	2026-10-31 08:37:09.628
6ef07983-0ca1-43c6-88b8-3b55c58125bb	\N	SCREENING_COMPLETED	InitialScreening	896a9798-0f37-41a4-b60d-6123588e3a7c	{"version": "worker-screening-2026-09-01", "workerId": "160f6d93-c491-49d9-85e5-dad04ef070fd"}	2026-10-31 08:54:29.455
38d67feb-d3ee-4176-94ad-493362e40a82	\N	INITIAL_SITE_ASSIGNED	WorkerSiteAssignment	9bbbbd61-089e-4ebc-9bbe-49d0f9ea94ea	{"siteId": "18774408-09f3-47c5-ba44-a3c69af52d6d", "workerId": "160f6d93-c491-49d9-85e5-dad04ef070fd"}	2026-10-31 09:41:21.444
4219cb55-756c-49dd-9353-a9175594d440	5691c8f1-f036-4986-a592-5a01dfe4e469	TRAVEL_RECORDED	TravelRecord	dd83605a-8b1b-434f-af86-bb0bd6f3db20	{"workerId": "160f6d93-c491-49d9-85e5-dad04ef070fd"}	2026-10-31 09:46:03.693
30bccc9f-bb86-43ab-9b66-b806991cf823	5691c8f1-f036-4986-a592-5a01dfe4e469	SYMPTOM_REPORTED	SymptomReport	3140a21a-1bb2-4432-88de-ac2e4b628e65	{"workerId": "160f6d93-c491-49d9-85e5-dad04ef070fd"}	2026-10-31 09:48:01.783
5fddd020-22af-479b-a8b6-3764a4c4b39f	5691c8f1-f036-4986-a592-5a01dfe4e469	SYMPTOM_REPORTED	SymptomReport	c4ea6575-1e5b-4773-8c28-96300cea04b1	{"workerId": "160f6d93-c491-49d9-85e5-dad04ef070fd"}	2026-10-31 09:50:07.152
d12c46a2-b30b-4994-9059-1cd8322ed187	8b51db1b-f81d-42d1-9b3d-c2133c1808b4	TRANSFER_CREATED_BY_WORKER	SiteTransferRequest	cd001598-b779-4892-9c0f-707e24a6503a	{"toSiteId": "bdf12666-3c9e-450a-976e-24b8620bcdaf", "fromSiteId": "18774408-09f3-47c5-ba44-a3c69af52d6d"}	2026-11-02 04:53:03.66
287bcf3d-46e1-4e2a-80c6-7e8f7319bf54	11e4a072-93c9-47a7-9157-bcca817f2dad	ADMIN_PASSWORD_CHANGED	User	11e4a072-93c9-47a7-9157-bcca817f2dad	{}	2026-11-02 07:59:55.267
17199fbe-8942-4bfc-877b-2b15a4e17bd8	11e4a072-93c9-47a7-9157-bcca817f2dad	ADMIN_PASSWORD_CHANGED	User	11e4a072-93c9-47a7-9157-bcca817f2dad	{}	2026-11-02 08:03:03.466
34d61978-9f54-4219-95d3-dde62747364c	11e4a072-93c9-47a7-9157-bcca817f2dad	ADMIN_PASSWORD_CHANGED	User	11e4a072-93c9-47a7-9157-bcca817f2dad	{}	2026-11-02 08:04:54.325
a6342f31-18ad-495b-9921-bcb3331a3406	11e4a072-93c9-47a7-9157-bcca817f2dad	SITE_CREATED	ConstructionSite	ed1a5513-f2bb-4f78-87e4-a9d7c7918eca	{"name": "Mandovi Estuary Project", "siteCode": "SITE-WZM83B"}	2026-11-02 08:04:55.523
cc0fab6b-6c6e-401e-96de-1e49f2303004	11e4a072-93c9-47a7-9157-bcca817f2dad	SITE_UPDATED	ConstructionSite	ed1a5513-f2bb-4f78-87e4-a9d7c7918eca	{"changes": {"name": "Mandovi Estuary Project", "areaId": "57f1d151-0337-4f37-98a5-f61caed833ce", "address": "Betim Jetty Terminal, Bardez, North Goa - Updated", "contractorId": null}, "siteCode": "SITE-WZM83B"}	2026-11-02 08:04:55.904
9dfa2752-af26-43c9-888a-48cd3fa63e41	11e4a072-93c9-47a7-9157-bcca817f2dad	CONTRACTOR_ASSIGNED_TO_SITE	ConstructionSite	ed1a5513-f2bb-4f78-87e4-a9d7c7918eca	{"userId": "b80e60d3-c092-4473-8290-1aa2a72c56cc", "siteCode": "SITE-WZM83B", "contractorId": "8b0412cf-64b0-46a6-9ef4-b42edbf0005e"}	2026-11-02 08:04:56.575
dc1fc6d1-4116-4126-9d60-d7c2d9c6d117	11e4a072-93c9-47a7-9157-bcca817f2dad	USER_CREATED	User	b80e60d3-c092-4473-8290-1aa2a72c56cc	{"role": "CONTRACTOR", "contractorId": "8b0412cf-64b0-46a6-9ef4-b42edbf0005e", "stakeholderCode": "C000001"}	2026-11-02 08:04:56.577
247855e0-c277-4940-a8a9-77b197e56abd	11e4a072-93c9-47a7-9157-bcca817f2dad	USER_CREATED	User	0165147c-ead6-441d-89c7-a55a6ace7538	{"role": "CONTRACTOR", "contractorId": "5f598791-41ad-45f3-8ede-10c0c7282037", "stakeholderCode": "C000002"}	2026-11-02 08:04:56.999
e8cfcc5c-3c93-43ce-8d8c-6894f5d88dbe	11e4a072-93c9-47a7-9157-bcca817f2dad	ADMIN_PASSWORD_CHANGED	User	11e4a072-93c9-47a7-9157-bcca817f2dad	{}	2026-11-02 08:06:51.806
de4f303a-b542-4b37-b4b7-358d7585401c	11e4a072-93c9-47a7-9157-bcca817f2dad	SITE_CREATED	ConstructionSite	a8b34e26-9296-46a5-8532-ccd5d0c19320	{"name": "Mandovi Estuary Project", "siteCode": "SITE-NV8LXK"}	2026-11-02 08:06:53.015
65e76517-dad0-4a09-9adb-bc8d224c6c52	11e4a072-93c9-47a7-9157-bcca817f2dad	SITE_UPDATED	ConstructionSite	a8b34e26-9296-46a5-8532-ccd5d0c19320	{"changes": {"name": "Mandovi Estuary Project", "areaId": "57f1d151-0337-4f37-98a5-f61caed833ce", "address": "Betim Jetty Terminal, Bardez, North Goa - Updated", "contractorId": null}, "siteCode": "SITE-NV8LXK"}	2026-11-02 08:06:53.335
97114d68-189c-42a9-b97a-b5a821349a4c	11e4a072-93c9-47a7-9157-bcca817f2dad	CONTRACTOR_ASSIGNED_TO_SITE	ConstructionSite	a8b34e26-9296-46a5-8532-ccd5d0c19320	{"userId": "4dcc3a36-bd3c-4c9c-9cfc-517e57602295", "siteCode": "SITE-NV8LXK", "contractorId": "59add45c-31ed-46bf-add0-84224ecc6a82"}	2026-11-02 08:06:53.971
204da1cb-20ad-4db0-bfa1-2e5420527bc8	11e4a072-93c9-47a7-9157-bcca817f2dad	USER_CREATED	User	4dcc3a36-bd3c-4c9c-9cfc-517e57602295	{"role": "CONTRACTOR", "contractorId": "59add45c-31ed-46bf-add0-84224ecc6a82", "stakeholderCode": "C000001"}	2026-11-02 08:06:53.972
d5b8b49d-fa71-4443-94ad-27e036158b4d	11e4a072-93c9-47a7-9157-bcca817f2dad	USER_CREATED	User	cece933d-8149-4d44-94e1-6ca9dfc16a55	{"role": "CONTRACTOR", "contractorId": "69b44e85-35e0-4cbb-a4ff-82c75c2d4f5a", "stakeholderCode": "C000002"}	2026-11-02 08:06:54.411
7c109e0d-d7f2-4a94-b8a2-1719016c8e90	11e4a072-93c9-47a7-9157-bcca817f2dad	ADMIN_PASSWORD_CHANGED	User	11e4a072-93c9-47a7-9157-bcca817f2dad	{}	2026-11-02 08:08:53.453
53c6007f-6704-4797-b11f-311bd6cd3826	11e4a072-93c9-47a7-9157-bcca817f2dad	SITE_CREATED	ConstructionSite	3780b459-decc-4788-a8dc-46dd850defae	{"name": "Mandovi Estuary Project", "siteCode": "SITE-APZRZ6"}	2026-11-02 08:08:54.652
90ac2811-57e9-4af0-a61c-c029f6d16bb9	11e4a072-93c9-47a7-9157-bcca817f2dad	SITE_UPDATED	ConstructionSite	3780b459-decc-4788-a8dc-46dd850defae	{"changes": {"name": "Mandovi Estuary Project", "areaId": "57f1d151-0337-4f37-98a5-f61caed833ce", "address": "Betim Jetty Terminal, Bardez, North Goa - Updated", "contractorId": null}, "siteCode": "SITE-APZRZ6"}	2026-11-02 08:08:55.023
be789610-2d57-43bc-8616-25321501b7eb	11e4a072-93c9-47a7-9157-bcca817f2dad	CONTRACTOR_ASSIGNED_TO_SITE	ConstructionSite	3780b459-decc-4788-a8dc-46dd850defae	{"userId": "ddb0c3a2-a9d6-4025-9c29-8ddf5658d3c3", "siteCode": "SITE-APZRZ6", "contractorId": "1219e6bb-03d9-4b6a-8f77-20b1f86a8356"}	2026-11-02 08:08:55.758
db1e9c7d-0a5e-46ec-a1ed-c04f026a51d9	11e4a072-93c9-47a7-9157-bcca817f2dad	USER_CREATED	User	ddb0c3a2-a9d6-4025-9c29-8ddf5658d3c3	{"role": "CONTRACTOR", "contractorId": "1219e6bb-03d9-4b6a-8f77-20b1f86a8356", "stakeholderCode": "C000001"}	2026-11-02 08:08:55.76
eef95a80-afd5-49cf-93e0-5da6ba1aad08	11e4a072-93c9-47a7-9157-bcca817f2dad	ADMIN_PASSWORD_CHANGED	User	11e4a072-93c9-47a7-9157-bcca817f2dad	{}	2026-11-02 08:09:48.588
c63d5d6a-33b9-4868-9ef2-e3be4c037be8	11e4a072-93c9-47a7-9157-bcca817f2dad	SITE_UPDATED	ConstructionSite	89dcf8b9-beb9-4bbc-bf3b-8d182968bd9d	{"changes": {"name": "Mandovi Estuary Project", "areaId": "57f1d151-0337-4f37-98a5-f61caed833ce", "address": "Betim Jetty Terminal, Bardez, North Goa - Updated", "contractorId": null}, "siteCode": "SITE-D7PCH2"}	2026-11-02 08:09:50.207
50c022d8-8a0f-4d91-82b4-b5136a319f15	11e4a072-93c9-47a7-9157-bcca817f2dad	CONTRACTOR_ASSIGNED_TO_SITE	ConstructionSite	89dcf8b9-beb9-4bbc-bf3b-8d182968bd9d	{"userId": "1796e3b2-1fae-451a-a320-9bdff531353d", "siteCode": "SITE-D7PCH2", "contractorId": "54b3fb7d-c281-436e-be4d-20635dcb649b"}	2026-11-02 08:09:50.912
d7a6346f-301a-421b-af9f-b1d89cccba2a	11e4a072-93c9-47a7-9157-bcca817f2dad	USER_CREATED	User	1796e3b2-1fae-451a-a320-9bdff531353d	{"role": "CONTRACTOR", "contractorId": "54b3fb7d-c281-436e-be4d-20635dcb649b", "stakeholderCode": "C000001"}	2026-11-02 08:09:50.914
8dad2701-91ba-477a-bafc-525eba109e71	11e4a072-93c9-47a7-9157-bcca817f2dad	SITE_CREATED	ConstructionSite	89dcf8b9-beb9-4bbc-bf3b-8d182968bd9d	{"name": "Mandovi Estuary Project", "siteCode": "SITE-D7PCH2"}	2026-11-02 08:09:49.787
b71d3642-9417-4e41-9df1-d50b3ebf0657	11e4a072-93c9-47a7-9157-bcca817f2dad	ADMIN_PASSWORD_CHANGED	User	11e4a072-93c9-47a7-9157-bcca817f2dad	{}	2026-11-02 08:16:18.72
2534b888-2cae-48d8-a2ca-38b8807dc585	11e4a072-93c9-47a7-9157-bcca817f2dad	ADMIN_PASSWORD_CHANGED	User	11e4a072-93c9-47a7-9157-bcca817f2dad	{}	2026-11-02 08:17:21.479
0a587be9-6573-4a78-a0d3-c0d34ab9e8f1	11e4a072-93c9-47a7-9157-bcca817f2dad	SITE_CREATED	ConstructionSite	6a2da76c-6581-4465-a631-6021eaacb729	{"name": "Mandovi Estuary Project", "siteCode": "SITE-Y58G4P"}	2026-11-02 08:17:22.625
d162db93-d65a-4c00-bf0e-20fe90591b9e	11e4a072-93c9-47a7-9157-bcca817f2dad	SITE_UPDATED	ConstructionSite	6a2da76c-6581-4465-a631-6021eaacb729	{"changes": {"name": "Mandovi Estuary Project", "areaId": "57f1d151-0337-4f37-98a5-f61caed833ce", "address": "Betim Jetty Terminal, Bardez, North Goa - Updated", "contractorId": null}, "siteCode": "SITE-Y58G4P"}	2026-11-02 08:17:22.994
df0534e6-bed0-44c4-8f1f-d415c0eed19f	11e4a072-93c9-47a7-9157-bcca817f2dad	CONTRACTOR_ASSIGNED_TO_SITE	ConstructionSite	6a2da76c-6581-4465-a631-6021eaacb729	{"userId": "8d184988-8b6a-4a06-a19a-587e6a6ed01c", "siteCode": "SITE-Y58G4P", "contractorId": "fa90b952-c13f-4b50-aa9a-2abd2653178e"}	2026-11-02 08:17:23.748
f3974c99-d4ee-403e-acfe-8a1c26e1ca7c	11e4a072-93c9-47a7-9157-bcca817f2dad	USER_CREATED	User	8d184988-8b6a-4a06-a19a-587e6a6ed01c	{"role": "CONTRACTOR", "contractorId": "fa90b952-c13f-4b50-aa9a-2abd2653178e", "stakeholderCode": "C000001"}	2026-11-02 08:17:23.749
9fb04e5f-ff74-43f9-92a6-efb9bb85499d	11e4a072-93c9-47a7-9157-bcca817f2dad	USER_CREATED	User	bdc998dc-f5c4-4d7b-afb4-be7ef3cc0aeb	{"role": "HEALTH_WORKER", "stakeholderCode": "HW000001"}	2026-11-02 08:17:24.802
a83974ca-6869-434b-b5ee-56e0dfbad069	11e4a072-93c9-47a7-9157-bcca817f2dad	USER_CREATED	User	89efe680-bb36-44e8-bcdb-1ab97a199f0d	{"role": "CLINICIAN", "stakeholderCode": "CL000001"}	2026-11-02 08:17:25.176
2871bf0a-ff8c-433a-a3be-72cd7bb134e2	11e4a072-93c9-47a7-9157-bcca817f2dad	USER_CREATED	User	672dcec1-8ca1-49df-aa8d-110241482f23	{"role": "PATHOLOGIST", "stakeholderCode": "P000001"}	2026-11-02 08:17:25.545
d88d8711-af74-4c44-8ef2-6156bf1a81bc	11e4a072-93c9-47a7-9157-bcca817f2dad	USER_CREATED	User	acec7475-dcc0-4765-947f-727a858c6346	{"role": "RESEARCH_LAB", "stakeholderCode": "RL000001"}	2026-11-02 08:17:25.956
7490ed60-36c8-4d67-a509-05ee3054bd4a	11e4a072-93c9-47a7-9157-bcca817f2dad	ADMIN_PASSWORD_CHANGED	User	11e4a072-93c9-47a7-9157-bcca817f2dad	{}	2026-11-02 08:18:26.756
c7adabe1-de8b-4112-a0dc-6906cb9df318	11e4a072-93c9-47a7-9157-bcca817f2dad	SITE_CREATED	ConstructionSite	a308136b-1345-4008-81b1-be0ae09ce9fe	{"name": "Mandovi Estuary Project", "siteCode": "SITE-82WUJS"}	2026-11-02 08:18:27.959
8013caed-4e36-4a39-95b3-96bc766e959b	11e4a072-93c9-47a7-9157-bcca817f2dad	SITE_UPDATED	ConstructionSite	a308136b-1345-4008-81b1-be0ae09ce9fe	{"changes": {"name": "Mandovi Estuary Project", "areaId": "57f1d151-0337-4f37-98a5-f61caed833ce", "address": "Betim Jetty Terminal, Bardez, North Goa - Updated", "contractorId": null}, "siteCode": "SITE-82WUJS"}	2026-11-02 08:18:28.291
8109c4c7-0246-46c9-8217-346114d7546f	11e4a072-93c9-47a7-9157-bcca817f2dad	CONTRACTOR_ASSIGNED_TO_SITE	ConstructionSite	a308136b-1345-4008-81b1-be0ae09ce9fe	{"userId": "afcc0dc7-c062-4cdd-88dd-b736e3a3b641", "siteCode": "SITE-82WUJS", "contractorId": "ab4d2464-27d7-464e-9cd6-012d3e26fddd"}	2026-11-02 08:18:28.974
cd64fc72-89c6-4659-9cf5-7a7bde94bf82	11e4a072-93c9-47a7-9157-bcca817f2dad	USER_CREATED	User	afcc0dc7-c062-4cdd-88dd-b736e3a3b641	{"role": "CONTRACTOR", "contractorId": "ab4d2464-27d7-464e-9cd6-012d3e26fddd", "stakeholderCode": "C000001"}	2026-11-02 08:18:28.976
16ce2131-bbec-4a87-a0cb-6bb57846d090	11e4a072-93c9-47a7-9157-bcca817f2dad	USER_CREATED	User	eee0a193-1e9c-421e-8db9-658030f73aa4	{"role": "HEALTH_WORKER", "stakeholderCode": "HW000001"}	2026-11-02 08:18:30.019
42913a00-92f6-4b9c-95bf-b98e6647ef72	11e4a072-93c9-47a7-9157-bcca817f2dad	USER_CREATED	User	4c0c429e-64f3-4f13-a444-222373a8c26f	{"role": "CLINICIAN", "stakeholderCode": "CL000001"}	2026-11-02 08:18:30.383
fe276713-e9c5-4c3c-8e50-80fd085a71c5	11e4a072-93c9-47a7-9157-bcca817f2dad	USER_CREATED	User	855b21d5-a541-4fcf-8401-92e4a8c2eaea	{"role": "PATHOLOGIST", "stakeholderCode": "P000001"}	2026-11-02 08:18:30.775
1f29a8b9-e800-4127-9477-1d792db2ff8b	11e4a072-93c9-47a7-9157-bcca817f2dad	USER_CREATED	User	f5e6b8b8-a016-4e85-96e7-4e41c6ab08be	{"role": "RESEARCH_LAB", "stakeholderCode": "RL000001"}	2026-11-02 08:18:31.176
9620449e-78e9-4f6e-8ac7-4486f1d000c3	11e4a072-93c9-47a7-9157-bcca817f2dad	TRAVEL_REPORT_REVIEWED	TravelReport	8274ce68-7953-4ad7-931e-ec77c596aeb2	{"status": "REVIEWED"}	2026-11-02 08:18:32.966
ed13e8c0-eb71-4a21-8309-e07f425ad709	afcc0dc7-c062-4cdd-88dd-b736e3a3b641	STAKEHOLDER_PIN_CHANGED	User	afcc0dc7-c062-4cdd-88dd-b736e3a3b641	{}	2026-11-02 09:37:56.638
68e025fc-9f68-4b50-b7eb-f5f61f74a2e7	afcc0dc7-c062-4cdd-88dd-b736e3a3b641	TRAVEL_REPORT_SUBMITTED	TravelReport	3a227db5-a88d-4a35-985c-20364314dfad	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "travelRecordId": "802edf92-8d5b-446d-906d-cb3712b3c523"}	2026-11-02 09:49:05.917
7c0a509b-8b45-4466-bec6-e1ae09153b36	11e4a072-93c9-47a7-9157-bcca817f2dad	ADMIN_PASSWORD_CHANGED	User	11e4a072-93c9-47a7-9157-bcca817f2dad	{}	2026-11-02 11:38:24.588
d51ff42a-8d5e-4ae8-8020-8ed347c0b0aa	11e4a072-93c9-47a7-9157-bcca817f2dad	DEMO_DATA_RESET	System	demo-dataset	{"siteCode": "SITE-DEMO01", "workersCount": 10, "contractorCode": "C000002"}	2026-11-02 11:42:51.204
701e17ac-3d17-47fd-9412-6ba03bb9caf9	bfc03d3c-7418-48b8-a4e9-51513d2b2bde	STAKEHOLDER_PIN_CHANGED	User	bfc03d3c-7418-48b8-a4e9-51513d2b2bde	{}	2026-11-02 11:52:38.597
d2141d79-3b9f-411a-9803-05d36ceeff1a	bfc03d3c-7418-48b8-a4e9-51513d2b2bde	TRAVEL_REPORT_SUBMITTED	TravelReport	e43bf913-ab79-47da-815f-5f29779609bf	{"workerId": "f3fdfbab-d150-4245-81da-ff82e45cf1f7", "travelRecordId": "cb8ea80e-ebf4-466b-be9d-491b98bbd7c3"}	2026-11-02 11:56:12.646
6f578758-7e92-4274-9094-fa60e9ec017b	11e4a072-93c9-47a7-9157-bcca817f2dad	USER_CREATED	User	6b24f4d4-06c3-4546-8f67-9352cd959b9a	{"role": "CONTRACTOR", "contractorId": "af8f9ae5-abe2-43b7-9770-849ede85865f", "stakeholderCode": "C000003"}	2026-11-03 04:03:15.296
1bb00933-74d1-4b78-95d7-e0537a426554	11e4a072-93c9-47a7-9157-bcca817f2dad	SITE_CREATED	ConstructionSite	7731c797-9f4f-4ef6-a656-e7b867f24024	{"name": "tests", "siteCode": "SITE-GRABY2"}	2026-11-03 04:09:45.858
36a595da-ae31-4ff1-918e-21b489bfd257	11e4a072-93c9-47a7-9157-bcca817f2dad	CONTRACTOR_ASSIGNED_TO_SITE	ConstructionSite	7731c797-9f4f-4ef6-a656-e7b867f24024	{"userId": "eaa6ea89-eb70-444b-b7e4-a01e192dcb73", "siteCode": "SITE-GRABY2", "contractorId": "18fadebd-de28-4ed7-966b-55207a6f4606"}	2026-11-03 04:10:19.662
0a74a644-3f75-4742-9112-4d07b7c85ec3	11e4a072-93c9-47a7-9157-bcca817f2dad	USER_CREATED	User	eaa6ea89-eb70-444b-b7e4-a01e192dcb73	{"role": "CONTRACTOR", "contractorId": "18fadebd-de28-4ed7-966b-55207a6f4606", "stakeholderCode": "C000004"}	2026-11-03 04:10:19.664
beafb01c-7aa2-4216-a6d8-be57b5060cc0	\N	INITIAL_SITE_ASSIGNED	WorkerSiteAssignment	60991335-8e7c-480f-a8bc-072f7981b768	{"siteId": "7731c797-9f4f-4ef6-a656-e7b867f24024", "workerId": "3412eb86-5df0-4031-9f33-d24708f16559"}	2026-11-03 04:11:26.915
0e3248ff-cdef-4201-9c4f-3e9a3358947c	\N	SCREENING_COMPLETED	InitialScreening	b696e768-a538-47c6-8230-7cf7cc9689e2	{"version": "worker-screening-2026-10-31", "workerId": "3412eb86-5df0-4031-9f33-d24708f16559"}	2026-11-03 04:12:23.766
70aeadf6-5768-424a-8ddf-1e4f5829619d	eaa6ea89-eb70-444b-b7e4-a01e192dcb73	STAKEHOLDER_PIN_CHANGED	User	eaa6ea89-eb70-444b-b7e4-a01e192dcb73	{}	2026-11-03 04:12:55.469
dbc19e7f-9e3e-45e7-ad33-3eebe00d8eb5	11e4a072-93c9-47a7-9157-bcca817f2dad	USER_CREATED	User	3a37ccf3-3e66-450d-880b-786f3ed25818	{"role": "CONTRACTOR", "contractorId": "df86cf83-4518-436a-bb7c-380a9a6d1d8b", "stakeholderCode": "C000005"}	2026-11-03 04:39:22.291
c59c0916-16b0-4ddc-b3f0-1057df4b88c2	3a37ccf3-3e66-450d-880b-786f3ed25818	STAKEHOLDER_PIN_CHANGED	User	3a37ccf3-3e66-450d-880b-786f3ed25818	{}	2026-11-03 04:40:08.822
ee4c2226-7ba5-4d98-98ec-8cfb50f8d07d	11e4a072-93c9-47a7-9157-bcca817f2dad	SITE_CONTRACTOR_ADDED	ContractorSite	2f9adf35-f5e5-46ec-8287-997ec50b07d1	{"siteCode": "SITE-82WUJS", "contractorId": "8f87317a-a8b0-4518-932c-87d01c09e762"}	2026-11-03 09:01:19.058
e51ec0ee-6461-4f92-bbae-e278218ac2fd	848c1c34-aea9-432d-8d54-793009d87684	WORKER_PASS_GENERATED	WorkerPassToken	UGpGLLJT	{"workerId": "848c1c34-aea9-432d-8d54-793009d87684", "expiresAt": "2026-11-03T09:06:19.178Z", "tokenPrefix": "UGpGLLJT"}	2026-11-03 09:01:19.202
4a3630eb-5d36-48dc-9400-3b989775513c	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	WORKER_ASSIGNED_VIA_QR	WorkerSiteAssignment	8ed04825-f7ed-4d46-b694-75077957b34e	{"siteId": "a308136b-1345-4008-81b1-be0ae09ce9fe", "workerId": "848c1c34-aea9-432d-8d54-793009d87684", "contractorId": "8b0412cf-64b0-46a6-9ef4-b42edbf0005e"}	2026-11-03 09:01:19.318
91af32db-a5ec-4399-ba90-311f43ad8f95	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_GENERATED	WorkerPassToken	AjEmrxPl	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "expiresAt": "2026-11-03T09:06:19.376Z", "tokenPrefix": "AjEmrxPl"}	2026-11-03 09:01:19.389
bb5f3e3d-1b83-48ed-aeb6-c0112ed9007c	8f87317a-a8b0-4518-932c-87d01c09e762	WORKER_REQUEST_VIA_QR	SiteTransferRequest	c2bad784-e99c-4a72-9fa9-f9dd63014639	{"toSiteId": "a308136b-1345-4008-81b1-be0ae09ce9fe", "workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "fromSiteId": "a308136b-1345-4008-81b1-be0ae09ce9fe", "toContractorId": "8f87317a-a8b0-4518-932c-87d01c09e762", "fromContractorId": "8b0412cf-64b0-46a6-9ef4-b42edbf0005e"}	2026-11-03 09:01:19.429
95c08c2a-d1be-4ac6-bb5c-1b0b5ffc6688	8d4a1a32-de33-45ba-aa28-3998d7df6161	TRANSFER_APPROVED	SiteTransferRequest	c2bad784-e99c-4a72-9fa9-f9dd63014639	{"actor": "worker", "reason": null, "status": "PENDING_CURRENT_CONTRACTOR"}	2026-11-03 09:01:19.482
b962211e-c452-42a3-809b-2bb7f01479fd	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	TRANSFER_COMPLETED	SiteTransferRequest	c2bad784-e99c-4a72-9fa9-f9dd63014639	{"actor": "fromContractor", "reason": "Approved release to Vikram Dempo team", "status": "ACCEPTED"}	2026-11-03 09:01:19.506
9a347f0f-8feb-4f84-a7de-c480580c54ed	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_GENERATED	WorkerPassToken	JH2eQq2v	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "expiresAt": "2026-11-03T09:06:19.536Z", "tokenPrefix": "JH2eQq2v"}	2026-11-03 09:01:19.549
e658bda8-3daf-4a4e-abce-a41ecb4d791a	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_GENERATED	WorkerPassToken	0gXmJJEU	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "expiresAt": "2026-11-03T09:06:19.587Z", "tokenPrefix": "0gXmJJEU"}	2026-11-03 09:01:19.601
810f78b2-83b9-4fbe-9e85-7ca01127f50f	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_REVOKED	WorkerPassToken	8d4a1a32-de33-45ba-aa28-3998d7df6161	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161"}	2026-11-03 09:01:19.623
b3717e9f-4b38-4a97-b014-0328bb63482c	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_GENERATED	WorkerPassToken	FEv14pCL	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "expiresAt": "2026-11-03T09:06:19.649Z", "tokenPrefix": "FEv14pCL"}	2026-11-03 09:01:19.661
3f29304b-9124-421f-80ec-f48db1bb24e3	11e4a072-93c9-47a7-9157-bcca817f2dad	SITE_CONTRACTOR_REMOVED	ContractorSite	2f9adf35-f5e5-46ec-8287-997ec50b07d1	{"siteCode": "SITE-82WUJS", "contractorId": "8f87317a-a8b0-4518-932c-87d01c09e762", "reassignedWorkers": 1, "reassignToContractorId": "8b0412cf-64b0-46a6-9ef4-b42edbf0005e"}	2026-11-03 09:01:19.712
daf71803-6076-4b66-a636-167c7f7c3cb8	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_GENERATED	WorkerPassToken	cFonnouw	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "expiresAt": "2026-11-03T09:07:47.731Z", "tokenPrefix": "cFonnouw"}	2026-11-03 09:02:47.753
7f23fb2e-abc8-4015-b43e-e29fe3a3e9cb	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_GENERATED	WorkerPassToken	JmQx1XNg	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "expiresAt": "2026-11-03T09:12:00.535Z", "tokenPrefix": "JmQx1XNg"}	2026-11-03 09:07:00.558
9736175d-62ff-45e6-bb2c-9fe0470f79f3	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_GENERATED	WorkerPassToken	ZgWV8rIn	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "expiresAt": "2026-11-03T09:14:02.739Z", "tokenPrefix": "ZgWV8rIn"}	2026-11-03 09:09:02.83
7a9609f6-4fb4-45f4-a334-ef6791fd9ed6	9ea6a322-29e6-4645-821f-1a9195451db5	WORKER_PASS_GENERATED	WorkerPassToken	y8TPWBMo	{"workerId": "9ea6a322-29e6-4645-821f-1a9195451db5", "expiresAt": "2026-11-03T09:15:12.830Z", "tokenPrefix": "y8TPWBMo"}	2026-11-03 09:10:12.843
e4c97096-bbf1-49b0-8a1c-ca6902f0d159	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	WORKER_REQUEST_VIA_QR	SiteTransferRequest	f6c4db67-1ebd-44d8-b71d-63a8a6ba52a8	{"toSiteId": "a308136b-1345-4008-81b1-be0ae09ce9fe", "workerId": "9ea6a322-29e6-4645-821f-1a9195451db5", "fromSiteId": "0340a99e-f09f-4616-aa2d-b474f933e072", "toContractorId": "8b0412cf-64b0-46a6-9ef4-b42edbf0005e", "fromContractorId": "8f87317a-a8b0-4518-932c-87d01c09e762"}	2026-11-03 09:11:44.869
09a8fe8e-5c6f-4348-ba77-206459ea0361	11e4a072-93c9-47a7-9157-bcca817f2dad	SITE_CONTRACTOR_ADDED	ContractorSite	2f9adf35-f5e5-46ec-8287-997ec50b07d1	{"siteCode": "SITE-82WUJS", "contractorId": "8f87317a-a8b0-4518-932c-87d01c09e762"}	2026-11-03 09:22:24.375
32e3e490-2073-496f-bc37-5d1a9ec9bf09	848c1c34-aea9-432d-8d54-793009d87684	WORKER_PASS_GENERATED	WorkerPassToken	IwnDBu2o	{"workerId": "848c1c34-aea9-432d-8d54-793009d87684", "expiresAt": "2026-11-03T09:27:24.452Z", "tokenPrefix": "IwnDBu2o"}	2026-11-03 09:22:24.467
1b5f04ff-639e-4c38-8801-6aaa2c859ced	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	WORKER_ASSIGNED_VIA_QR	WorkerSiteAssignment	fc680d70-a617-4465-a447-5f70b949ce56	{"siteId": "a308136b-1345-4008-81b1-be0ae09ce9fe", "workerId": "848c1c34-aea9-432d-8d54-793009d87684", "contractorId": "8b0412cf-64b0-46a6-9ef4-b42edbf0005e"}	2026-11-03 09:22:24.526
8c1e5c7a-1c5e-4e93-8d99-8f78f0c95749	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_GENERATED	WorkerPassToken	SDmkew-a	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "expiresAt": "2026-11-03T09:27:24.605Z", "tokenPrefix": "SDmkew-a"}	2026-11-03 09:22:24.617
71aad65c-c086-440a-af76-717bb513ad7c	8f87317a-a8b0-4518-932c-87d01c09e762	WORKER_REQUEST_VIA_QR	SiteTransferRequest	1aa3cc97-05f0-46ab-b0c4-bcf84db259db	{"toSiteId": "a308136b-1345-4008-81b1-be0ae09ce9fe", "workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "fromSiteId": "a308136b-1345-4008-81b1-be0ae09ce9fe", "toContractorId": "8f87317a-a8b0-4518-932c-87d01c09e762", "fromContractorId": "8b0412cf-64b0-46a6-9ef4-b42edbf0005e"}	2026-11-03 09:22:24.651
0dca7aed-a97d-4a10-bd9e-259bc0a58bdd	8d4a1a32-de33-45ba-aa28-3998d7df6161	TRANSFER_APPROVED	SiteTransferRequest	1aa3cc97-05f0-46ab-b0c4-bcf84db259db	{"actor": "worker", "reason": null, "status": "PENDING_CURRENT_CONTRACTOR"}	2026-11-03 09:22:24.693
ace04ca0-e243-45b8-85e9-06b6bef175ee	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	TRANSFER_COMPLETED	SiteTransferRequest	1aa3cc97-05f0-46ab-b0c4-bcf84db259db	{"actor": "fromContractor", "reason": "Approved release to Vikram Dempo team", "status": "ACCEPTED"}	2026-11-03 09:22:24.716
2dd3bfdd-1c61-40f6-b997-8c895dfb0092	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_GENERATED	WorkerPassToken	pm5dhwYj	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "expiresAt": "2026-11-03T09:27:24.751Z", "tokenPrefix": "pm5dhwYj"}	2026-11-03 09:22:24.764
1f352d16-b82a-429f-9c43-207b796a96b8	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_GENERATED	WorkerPassToken	YY-_4m6x	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "expiresAt": "2026-11-03T09:27:24.799Z", "tokenPrefix": "YY-_4m6x"}	2026-11-03 09:22:24.811
06adf46c-cc56-42f2-8290-53b18167aef4	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_REVOKED	WorkerPassToken	8d4a1a32-de33-45ba-aa28-3998d7df6161	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161"}	2026-11-03 09:22:24.834
32fe2599-bda0-441c-b00c-4e03cf81beb9	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_GENERATED	WorkerPassToken	EsW_pTpM	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "expiresAt": "2026-11-03T09:27:24.859Z", "tokenPrefix": "EsW_pTpM"}	2026-11-03 09:22:24.871
c089aa2a-0811-46cb-a5fa-3663b6bce995	11e4a072-93c9-47a7-9157-bcca817f2dad	SITE_CONTRACTOR_REMOVED	ContractorSite	2f9adf35-f5e5-46ec-8287-997ec50b07d1	{"siteCode": "SITE-82WUJS", "contractorId": "8f87317a-a8b0-4518-932c-87d01c09e762", "reassignedWorkers": 1, "reassignToContractorId": "8b0412cf-64b0-46a6-9ef4-b42edbf0005e"}	2026-11-03 09:22:24.912
008b015b-d73a-4adb-b29f-4845eafcadc5	11e4a072-93c9-47a7-9157-bcca817f2dad	SITE_CONTRACTOR_ADDED	ContractorSite	2f9adf35-f5e5-46ec-8287-997ec50b07d1	{"siteCode": "SITE-82WUJS", "contractorId": "8f87317a-a8b0-4518-932c-87d01c09e762"}	2026-11-03 09:58:20.063
386a1b55-dedc-48a4-bd0d-adb16046089a	848c1c34-aea9-432d-8d54-793009d87684	WORKER_PASS_GENERATED	WorkerPassToken	zEnkncdP	{"workerId": "848c1c34-aea9-432d-8d54-793009d87684", "expiresAt": "2026-11-03T10:03:20.176Z", "tokenPrefix": "zEnkncdP"}	2026-11-03 09:58:20.184
b8f78bb0-718a-4e07-a281-93cfa3ec3ce6	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	WORKER_ASSIGNED_VIA_QR	WorkerSiteAssignment	3aa86fcf-69a5-4d61-ab14-b508859c40e1	{"siteId": "a308136b-1345-4008-81b1-be0ae09ce9fe", "workerId": "848c1c34-aea9-432d-8d54-793009d87684", "contractorId": "8b0412cf-64b0-46a6-9ef4-b42edbf0005e"}	2026-11-03 09:58:20.278
843d6909-82b8-4303-add6-0f5afe319138	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_GENERATED	WorkerPassToken	xsZPm7cC	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "expiresAt": "2026-11-03T10:03:20.361Z", "tokenPrefix": "xsZPm7cC"}	2026-11-03 09:58:20.368
1261b34a-bede-41da-bc16-c831f6cfe32e	8f87317a-a8b0-4518-932c-87d01c09e762	WORKER_REQUEST_VIA_QR	SiteTransferRequest	d1c99199-4a73-4156-8b45-94341f78be29	{"toSiteId": "a308136b-1345-4008-81b1-be0ae09ce9fe", "workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "fromSiteId": "a308136b-1345-4008-81b1-be0ae09ce9fe", "toContractorId": "8f87317a-a8b0-4518-932c-87d01c09e762", "fromContractorId": "8b0412cf-64b0-46a6-9ef4-b42edbf0005e"}	2026-11-03 09:58:20.431
8b11234d-15ca-4e88-ab6d-9e4c7fadc82d	8d4a1a32-de33-45ba-aa28-3998d7df6161	TRANSFER_APPROVED	SiteTransferRequest	d1c99199-4a73-4156-8b45-94341f78be29	{"actor": "worker", "reason": null, "status": "PENDING_CURRENT_CONTRACTOR"}	2026-11-03 09:58:20.477
55d9e13b-6e7d-4187-8fa6-71b791073246	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	TRANSFER_COMPLETED	SiteTransferRequest	d1c99199-4a73-4156-8b45-94341f78be29	{"actor": "fromContractor", "reason": "Approved release to Vikram Dempo team", "status": "ACCEPTED"}	2026-11-03 09:58:20.504
a9492fd1-f558-4d44-bfa7-a68658bc15f4	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_GENERATED	WorkerPassToken	EvbPeaar	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "expiresAt": "2026-11-03T10:03:20.526Z", "tokenPrefix": "EvbPeaar"}	2026-11-03 09:58:20.53
152abbc2-8e56-4ae4-96e2-d8369724413c	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	WORKER_REQUEST_VIA_QR	SiteTransferRequest	bbab3b74-46ea-47bd-86be-88764441775e	{"toSiteId": "a308136b-1345-4008-81b1-be0ae09ce9fe", "workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "fromSiteId": "a308136b-1345-4008-81b1-be0ae09ce9fe", "toContractorId": "8b0412cf-64b0-46a6-9ef4-b42edbf0005e", "fromContractorId": "8f87317a-a8b0-4518-932c-87d01c09e762"}	2026-11-03 09:58:20.573
96c18078-696d-4cc2-ba48-a3195e318921	8d4a1a32-de33-45ba-aa28-3998d7df6161	TRANSFER_REJECTED	SiteTransferRequest	bbab3b74-46ea-47bd-86be-88764441775e	{"actor": "worker", "reason": "Worker declines transfer", "status": "REJECTED"}	2026-11-03 09:58:20.602
48cfb57d-0a6f-49ba-9c3b-34e57bb82d4d	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_GENERATED	WorkerPassToken	Qwj-5fR5	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "expiresAt": "2026-11-03T10:03:20.625Z", "tokenPrefix": "Qwj-5fR5"}	2026-11-03 09:58:20.629
ffaa5b4f-240c-4cdf-be8a-5403c1ea1cd1	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	WORKER_REQUEST_VIA_QR	SiteTransferRequest	6937077c-22a8-4ebb-adeb-5205701e416b	{"toSiteId": "a308136b-1345-4008-81b1-be0ae09ce9fe", "workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "fromSiteId": "a308136b-1345-4008-81b1-be0ae09ce9fe", "toContractorId": "8b0412cf-64b0-46a6-9ef4-b42edbf0005e", "fromContractorId": "8f87317a-a8b0-4518-932c-87d01c09e762"}	2026-11-03 09:58:20.656
7c2ec821-f510-4926-8a71-56df5f89aaeb	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	TRANSFER_CANCELLED	SiteTransferRequest	6937077c-22a8-4ebb-adeb-5205701e416b	{"reason": "Position no longer needed"}	2026-11-03 09:58:20.684
73b843a9-0f5a-4974-af61-a553c4d61c72	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_GENERATED	WorkerPassToken	Lamph14W	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "expiresAt": "2026-11-03T10:03:20.714Z", "tokenPrefix": "Lamph14W"}	2026-11-03 09:58:20.717
87465780-faa2-41f3-89e8-d9aed768cab5	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_GENERATED	WorkerPassToken	1yanE-OC	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "expiresAt": "2026-11-03T10:03:20.750Z", "tokenPrefix": "1yanE-OC"}	2026-11-03 09:58:20.754
2bb54c0e-ccc4-4251-b70e-c93819ac23e5	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_REVOKED	WorkerPassToken	8d4a1a32-de33-45ba-aa28-3998d7df6161	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161"}	2026-11-03 09:58:20.779
4f5c7a4f-c503-42be-831d-c8bec19f111f	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_GENERATED	WorkerPassToken	5YLaxi7V	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "expiresAt": "2026-11-03T10:03:20.819Z", "tokenPrefix": "5YLaxi7V"}	2026-11-03 09:58:20.824
c768b189-9e02-451c-9fb9-7da59a3c2984	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_GENERATED	WorkerPassToken	B4mQjf7U	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "expiresAt": "2026-11-03T10:03:20.842Z", "tokenPrefix": "B4mQjf7U"}	2026-11-03 09:58:20.847
532c7f26-e20e-4fcd-bc09-05849ec02d93	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	WORKER_REQUEST_VIA_QR	SiteTransferRequest	70ec2811-9756-4a30-b3e0-88c93e64671a	{"toSiteId": "a308136b-1345-4008-81b1-be0ae09ce9fe", "workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "fromSiteId": "a308136b-1345-4008-81b1-be0ae09ce9fe", "toContractorId": "8b0412cf-64b0-46a6-9ef4-b42edbf0005e", "fromContractorId": "8f87317a-a8b0-4518-932c-87d01c09e762"}	2026-11-03 09:58:20.899
255f40d5-173e-4288-a949-32e220262bd3	11e4a072-93c9-47a7-9157-bcca817f2dad	SITE_CONTRACTOR_REMOVED	ContractorSite	2f9adf35-f5e5-46ec-8287-997ec50b07d1	{"siteCode": "SITE-82WUJS", "contractorId": "8f87317a-a8b0-4518-932c-87d01c09e762", "reassignedWorkers": 1, "reassignToContractorId": "8b0412cf-64b0-46a6-9ef4-b42edbf0005e"}	2026-11-03 09:58:20.952
6130b095-ef14-4525-b4dd-9d927a1568a7	11e4a072-93c9-47a7-9157-bcca817f2dad	SITE_CONTRACTOR_REMOVED	ContractorSite	2f9adf35-f5e5-46ec-8287-997ec50b07d1	{"siteCode": "SITE-82WUJS", "contractorId": "8f87317a-a8b0-4518-932c-87d01c09e762", "reassignedWorkers": 1, "reassignToContractorId": "8b0412cf-64b0-46a6-9ef4-b42edbf0005e"}	2026-11-03 09:58:48.384
7be72994-ecf9-4e62-b97e-976eb1466049	11e4a072-93c9-47a7-9157-bcca817f2dad	SITE_CONTRACTOR_ADDED	ContractorSite	2f9adf35-f5e5-46ec-8287-997ec50b07d1	{"siteCode": "SITE-82WUJS", "contractorId": "8f87317a-a8b0-4518-932c-87d01c09e762"}	2026-11-03 09:58:47.595
2710b407-3467-4ff9-9fe6-a7c4a3631638	848c1c34-aea9-432d-8d54-793009d87684	WORKER_PASS_GENERATED	WorkerPassToken	AeSKZGtT	{"workerId": "848c1c34-aea9-432d-8d54-793009d87684", "expiresAt": "2026-11-03T10:03:47.686Z", "tokenPrefix": "AeSKZGtT"}	2026-11-03 09:58:47.691
0db14aad-ca90-4361-ba32-cee0111d8b33	8d4a1a32-de33-45ba-aa28-3998d7df6161	TRANSFER_APPROVED	SiteTransferRequest	99ad12b4-301a-4d28-9cac-189720d6712a	{"actor": "worker", "reason": null, "status": "PENDING_CURRENT_CONTRACTOR"}	2026-11-03 09:58:47.913
d15a1c44-5bfb-473d-b501-b887805ed0a1	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	TRANSFER_COMPLETED	SiteTransferRequest	99ad12b4-301a-4d28-9cac-189720d6712a	{"actor": "fromContractor", "reason": "Approved release to Vikram Dempo team", "status": "ACCEPTED"}	2026-11-03 09:58:47.941
a73b7703-b701-441e-b2fc-be97d70dd1d4	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_GENERATED	WorkerPassToken	qJVBBip5	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "expiresAt": "2026-11-03T10:03:47.964Z", "tokenPrefix": "qJVBBip5"}	2026-11-03 09:58:47.968
65aae3f0-d463-4c3c-9198-bbc85723d310	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	WORKER_REQUEST_VIA_QR	SiteTransferRequest	089245f8-e2bf-4aa1-abdb-1d26a99248d0	{"toSiteId": "a308136b-1345-4008-81b1-be0ae09ce9fe", "workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "fromSiteId": "a308136b-1345-4008-81b1-be0ae09ce9fe", "toContractorId": "8b0412cf-64b0-46a6-9ef4-b42edbf0005e", "fromContractorId": "8f87317a-a8b0-4518-932c-87d01c09e762"}	2026-11-03 09:58:47.993
f57b67b6-5d8e-4089-8787-f6d01022795a	8d4a1a32-de33-45ba-aa28-3998d7df6161	TRANSFER_REJECTED	SiteTransferRequest	089245f8-e2bf-4aa1-abdb-1d26a99248d0	{"actor": "worker", "reason": "Worker declines transfer", "status": "REJECTED"}	2026-11-03 09:58:48.026
b3c7233c-3fc8-44fb-99df-63138e3388b1	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_GENERATED	WorkerPassToken	-oNfLei4	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "expiresAt": "2026-11-03T10:03:48.050Z", "tokenPrefix": "-oNfLei4"}	2026-11-03 09:58:48.053
7a9416ff-e71d-40ca-9ab1-3f03a22a7122	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	WORKER_REQUEST_VIA_QR	SiteTransferRequest	7f0a6de5-c4d1-43a6-b682-e3dde7f84fc8	{"toSiteId": "a308136b-1345-4008-81b1-be0ae09ce9fe", "workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "fromSiteId": "a308136b-1345-4008-81b1-be0ae09ce9fe", "toContractorId": "8b0412cf-64b0-46a6-9ef4-b42edbf0005e", "fromContractorId": "8f87317a-a8b0-4518-932c-87d01c09e762"}	2026-11-03 09:58:48.078
5bebbb24-8ec2-4803-adf0-c6767cb80f72	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	TRANSFER_CANCELLED	SiteTransferRequest	7f0a6de5-c4d1-43a6-b682-e3dde7f84fc8	{"reason": "Position no longer needed"}	2026-11-03 09:58:48.111
ba13bb3e-6997-49a9-a09b-3fef547bb680	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_GENERATED	WorkerPassToken	DV6_1-Q0	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "expiresAt": "2026-11-03T10:03:48.147Z", "tokenPrefix": "DV6_1-Q0"}	2026-11-03 09:58:48.153
091f8a3b-f440-4eb9-a284-7b8e5a69ab3a	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_GENERATED	WorkerPassToken	gMQnAJLS	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "expiresAt": "2026-11-03T10:03:48.200Z", "tokenPrefix": "gMQnAJLS"}	2026-11-03 09:58:48.207
7a56d5cf-088f-455e-8a24-030b81472eb6	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_REVOKED	WorkerPassToken	8d4a1a32-de33-45ba-aa28-3998d7df6161	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161"}	2026-11-03 09:58:48.234
f751ce12-17c6-46be-b84b-6132ff31a8e8	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_GENERATED	WorkerPassToken	hYuNqvZO	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "expiresAt": "2026-11-03T10:03:48.264Z", "tokenPrefix": "hYuNqvZO"}	2026-11-03 09:58:48.268
7705cb04-8cd5-4f11-b4ad-306f7e85e552	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_GENERATED	WorkerPassToken	voEkUtx3	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "expiresAt": "2026-11-03T10:03:48.286Z", "tokenPrefix": "voEkUtx3"}	2026-11-03 09:58:48.292
e5a3a294-0e59-497d-918c-b01b0f9bd2a9	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	WORKER_REQUEST_VIA_QR	SiteTransferRequest	373348cd-fc5f-444e-81ba-e8a620c237fc	{"toSiteId": "a308136b-1345-4008-81b1-be0ae09ce9fe", "workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "fromSiteId": "a308136b-1345-4008-81b1-be0ae09ce9fe", "toContractorId": "8b0412cf-64b0-46a6-9ef4-b42edbf0005e", "fromContractorId": "8f87317a-a8b0-4518-932c-87d01c09e762"}	2026-11-03 09:58:48.332
a04c2067-b092-4b30-85e7-7005fa0cc1a5	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	WORKER_ASSIGNED_VIA_QR	WorkerSiteAssignment	adfd39b7-f6cb-49f3-a8ee-ab928513f6ae	{"siteId": "a308136b-1345-4008-81b1-be0ae09ce9fe", "workerId": "848c1c34-aea9-432d-8d54-793009d87684", "contractorId": "8b0412cf-64b0-46a6-9ef4-b42edbf0005e"}	2026-11-03 09:58:47.746
bf167bd9-99d5-468a-84d3-a50b0796d621	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_GENERATED	WorkerPassToken	iavYIlBz	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "expiresAt": "2026-11-03T10:03:47.823Z", "tokenPrefix": "iavYIlBz"}	2026-11-03 09:58:47.827
d190047b-3b40-4c19-a4c9-28236f9f367b	8f87317a-a8b0-4518-932c-87d01c09e762	WORKER_REQUEST_VIA_QR	SiteTransferRequest	99ad12b4-301a-4d28-9cac-189720d6712a	{"toSiteId": "a308136b-1345-4008-81b1-be0ae09ce9fe", "workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "fromSiteId": "a308136b-1345-4008-81b1-be0ae09ce9fe", "toContractorId": "8f87317a-a8b0-4518-932c-87d01c09e762", "fromContractorId": "8b0412cf-64b0-46a6-9ef4-b42edbf0005e"}	2026-11-03 09:58:47.869
57c0e652-c55f-43bc-b8b1-b877e8e5bede	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_GENERATED	WorkerPassToken	cqqDaU_7	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "expiresAt": "2026-11-03T10:08:16.088Z", "tokenPrefix": "cqqDaU_7"}	2026-11-03 10:03:16.094
d07570a2-ba76-4a4d-97a9-60d79d284094	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_GENERATED	WorkerPassToken	u4zPLZaC	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "expiresAt": "2026-11-03T10:40:32.836Z", "tokenPrefix": "u4zPLZaC"}	2026-11-03 10:35:32.841
c09be01b-5b06-4e01-aef2-a1e04f3208d1	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_GENERATED	WorkerPassToken	WoKgYI0a	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "expiresAt": "2026-11-03T11:32:13.004Z", "tokenPrefix": "WoKgYI0a"}	2026-11-03 11:27:13.029
85e144b7-7608-4272-8834-f47bcc7c1adb	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_GENERATED	WorkerPassToken	jnX4rVmi	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "expiresAt": "2026-11-03T11:32:31.110Z", "tokenPrefix": "jnX4rVmi"}	2026-11-03 11:27:31.117
c7fee6f7-2dd3-42a2-8c79-9da3aa32f8b8	8d4a1a32-de33-45ba-aa28-3998d7df6161	TRANSFER_APPROVED	SiteTransferRequest	373348cd-fc5f-444e-81ba-e8a620c237fc	{"actor": "worker", "reason": null, "status": "PENDING_CURRENT_CONTRACTOR"}	2026-11-03 11:27:37.518
e3da5053-d076-4e52-85a9-e91a3501c07c	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_GENERATED	WorkerPassToken	VUIECtHL	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "expiresAt": "2026-11-03T11:34:26.619Z", "tokenPrefix": "VUIECtHL"}	2026-11-03 11:29:26.626
b90eb19b-319f-42a1-8dd9-6dff4bf3c966	07452e3a-7d30-4d0c-84a3-cee7ab101077	WORKER_REGISTERED	Worker	43ab44f2-f1a4-4f88-823d-8b35433665e8	{"workerCode": "M3-LYG9PL"}	2026-11-04 03:53:50.99
b466f6b8-1d0a-44e9-bfa7-f67a8b324efa	961eba75-e0e0-44b9-97d9-8f7ca1a567e9	WORKER_REGISTERED	Worker	b316b76f-dc93-4b85-a3fb-8ede67c72109	{"workerCode": "M3-YPBD7A"}	2026-11-04 03:55:37.833
31747d18-0e3d-476a-9b8f-d536dbfe2856	c2427344-0394-42e4-8d09-dafd5c97d073	WORKER_REGISTERED	Worker	c52d1677-66d8-4271-a6ca-22f257b7f0d3	{"workerCode": "M3-MM4SSZ"}	2026-11-04 03:57:27.205
f900eb5e-8b53-4c7b-a80c-70740bb5c424	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_GENERATED	WorkerPassToken	GPAWCY49	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "expiresAt": "2026-11-04T04:02:27.789Z", "tokenPrefix": "GPAWCY49"}	2026-11-04 03:57:27.802
46a9ba49-a5a1-48c8-93e8-7e50676aa3ab	152facab-c9d5-42b4-838a-293e44422a25	WORKER_REGISTERED	Worker	419be1f0-c848-4de6-a675-087959ef445b	{"workerCode": "M3-FCDVEG"}	2026-11-04 03:58:00.277
9be6e9b1-fe99-4143-8b42-280c7e1b4e7b	8d4a1a32-de33-45ba-aa28-3998d7df6161	WORKER_PASS_GENERATED	WorkerPassToken	uxN-2PK_	{"workerId": "8d4a1a32-de33-45ba-aa28-3998d7df6161", "expiresAt": "2026-11-04T04:03:00.838Z", "tokenPrefix": "uxN-2PK_"}	2026-11-04 03:58:00.844
\.


--
-- Data for Name: ConstructionSite; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."ConstructionSite" (id, "siteCode", name, "areaId", "contractorId", active, "createdAt", address, landmark, "contactPhone") FROM stdin;
89dcf8b9-beb9-4bbc-bf3b-8d182968bd9d	SITE-D7PCH2	Mandovi Estuary Project	57f1d151-0337-4f37-98a5-f61caed833ce	54b3fb7d-c281-436e-be4d-20635dcb649b	t	2026-11-02 08:09:49.775	Betim Jetty Terminal, Bardez, North Goa - Updated	\N	\N
6a2da76c-6581-4465-a631-6021eaacb729	SITE-Y58G4P	Mandovi Estuary Project	57f1d151-0337-4f37-98a5-f61caed833ce	fa90b952-c13f-4b50-aa9a-2abd2653178e	t	2026-11-02 08:17:22.611	Betim Jetty Terminal, Bardez, North Goa - Updated	\N	\N
445b4b1f-eb76-4075-a062-9dd0407c149e	SITE-CNDLM1	Candolim Tower Project	57f1d151-0337-4f37-98a5-f61caed833ce	11111111-1111-1111-1111-111111111111	t	2026-10-30 09:07:43.538	\N	\N	\N
18774408-09f3-47c5-ba44-a3c69af52d6d	SITE-PANJI1	Panaji Riverfront	ead003cf-5607-4067-bb08-d03e6414d34e	11111111-1111-1111-1111-111111111111	t	2026-10-30 09:07:43.553	\N	\N	\N
bdf12666-3c9e-450a-976e-24b8620bcdaf	SITE-MARGO1	Margao Metro Depot	c81a3001-d584-4ff0-a8dc-c680df3b7701	22222222-2222-2222-2222-222222222222	t	2026-10-30 09:07:43.564	\N	\N	\N
fa7397cc-94f2-4f93-91af-67e44e61220a	SITE-VASCO1	Vasco Port Expansion	d3bbc2c5-d758-4a66-b568-a6c29dd0074a	22222222-2222-2222-2222-222222222222	t	2026-10-30 09:07:43.577	\N	\N	\N
3bddf887-6712-4c1c-9b60-ed15c17ef0ad	SITE-CURCH1	Curchorem Bridge Works	f802d2ed-f433-4e61-b46c-079bd90bef70	22222222-2222-2222-2222-222222222222	t	2026-10-30 09:07:43.589	\N	\N	\N
0340a99e-f09f-4616-aa2d-b474f933e072	SITE-DEMO01	DEMO Zuari Greens Housing Project	f802d2ed-f433-4e61-b46c-079bd90bef70	8f87317a-a8b0-4518-932c-87d01c09e762	t	2026-11-02 11:42:50.656	Survey No. 84/2, Quepem-Curchorem Road	Opposite Old Government Primary School	9800000002
7731c797-9f4f-4ef6-a656-e7b867f24024	SITE-GRABY2	tests	4984a95b-edbb-4567-936a-f881521f1cc6	18fadebd-de28-4ed7-966b-55207a6f4606	t	2026-11-03 04:09:45.839	\N	\N	\N
c2222222-2222-2222-2222-222222222222	SITE-DEMO02	DEMO Mandovi Heights	57f1d151-0337-4f37-98a5-f61caed833ce	8f87317a-a8b0-4518-932c-87d01c09e762	t	2026-11-03 04:52:40.414	Plot 15, Aguada Road	Near Candolim Beach Road	9800000003
a308136b-1345-4008-81b1-be0ae09ce9fe	SITE-82WUJS	Mandovi Estuary Project	57f1d151-0337-4f37-98a5-f61caed833ce	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	t	2026-11-02 08:18:27.947	Betim Jetty Terminal, Bardez, North Goa - Updated	\N	\N
d127d9e7-37a7-4887-b201-190db400969a	SITE-MRMR01	Miramar Seaside Complex	d4824ce4-05e6-401a-9f24-4cd8d0a45a42	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	t	2026-11-02 09:34:40.567	Miramar Circle, Panaji, North Goa	\N	\N
\.


--
-- Data for Name: Contractor; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."Contractor" (id, name, "createdAt") FROM stdin;
8b0412cf-64b0-46a6-9ef4-b42edbf0005e	Apex Coastal Builders	2026-11-02 08:04:56.565
5f598791-41ad-45f3-8ede-10c0c7282037	Conflicting Builders	2026-11-02 08:04:56.995
59add45c-31ed-46bf-add0-84224ecc6a82	Apex Coastal Builders	2026-11-02 08:06:53.963
69b44e85-35e0-4cbb-a4ff-82c75c2d4f5a	Conflicting Builders	2026-11-02 08:06:54.409
1219e6bb-03d9-4b6a-8f77-20b1f86a8356	Apex Coastal Builders	2026-11-02 08:08:55.749
54b3fb7d-c281-436e-be4d-20635dcb649b	Apex Coastal Builders	2026-11-02 08:09:50.904
fa90b952-c13f-4b50-aa9a-2abd2653178e	Apex Coastal Builders	2026-11-02 08:17:23.74
ab4d2464-27d7-464e-9cd6-012d3e26fddd	Apex Coastal Builders	2026-11-02 08:18:28.965
11111111-1111-1111-1111-111111111111	North Goa Builders	2026-10-30 09:07:42.455
22222222-2222-2222-2222-222222222222	South Goa Infra	2026-10-30 09:07:43.337
8f87317a-a8b0-4518-932c-87d01c09e762	Vikram Dempo (Demo Contractor)	2026-11-02 11:42:50.642
af8f9ae5-abe2-43b7-9770-849ede85865f	Anand Shirodkar	2026-11-03 04:03:15.287
18fadebd-de28-4ed7-966b-55207a6f4606	test	2026-11-03 04:10:19.645
df86cf83-4518-436a-bb7c-380a9a6d1d8b	tarun	2026-11-03 04:39:22.288
\.


--
-- Data for Name: ContractorSite; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."ContractorSite" (id, "contractorId", "siteId", active, "assignedAt", "removedAt") FROM stdin;
b9826b70-7f2f-4a5d-9216-5f1dd9faf1d8	54b3fb7d-c281-436e-be4d-20635dcb649b	89dcf8b9-beb9-4bbc-bf3b-8d182968bd9d	t	2026-11-03 05:35:40.784	\N
0309fb58-4d1d-49c4-8374-517f466cc0b4	fa90b952-c13f-4b50-aa9a-2abd2653178e	6a2da76c-6581-4465-a631-6021eaacb729	t	2026-11-03 05:35:40.784	\N
a4570687-1ae8-409b-aa94-ff16eee29131	11111111-1111-1111-1111-111111111111	445b4b1f-eb76-4075-a062-9dd0407c149e	t	2026-11-03 05:35:40.784	\N
57916227-5375-4f22-a1c9-e8490cfcf176	11111111-1111-1111-1111-111111111111	18774408-09f3-47c5-ba44-a3c69af52d6d	t	2026-11-03 05:35:40.784	\N
e95bb958-1e44-4261-bc5e-2d56fba62dd2	22222222-2222-2222-2222-222222222222	bdf12666-3c9e-450a-976e-24b8620bcdaf	t	2026-11-03 05:35:40.784	\N
8276137c-4566-45d3-89e6-61ec2aeddadf	22222222-2222-2222-2222-222222222222	fa7397cc-94f2-4f93-91af-67e44e61220a	t	2026-11-03 05:35:40.784	\N
59daf93b-5e3a-4099-914e-33f36eb870c9	22222222-2222-2222-2222-222222222222	3bddf887-6712-4c1c-9b60-ed15c17ef0ad	t	2026-11-03 05:35:40.784	\N
68a5a791-73c6-476b-89fe-70f383bd32fa	8f87317a-a8b0-4518-932c-87d01c09e762	0340a99e-f09f-4616-aa2d-b474f933e072	t	2026-11-03 05:35:40.784	\N
35644d54-8729-4a08-8e85-d6b23bd39257	18fadebd-de28-4ed7-966b-55207a6f4606	7731c797-9f4f-4ef6-a656-e7b867f24024	t	2026-11-03 05:35:40.784	\N
ab8fae55-aae5-4ca1-9120-ac240ff6022c	8f87317a-a8b0-4518-932c-87d01c09e762	c2222222-2222-2222-2222-222222222222	t	2026-11-03 05:35:40.784	\N
db5da98b-972f-4856-b9fd-93a99eb9a34c	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	a308136b-1345-4008-81b1-be0ae09ce9fe	t	2026-11-03 05:35:40.784	\N
1975db81-7b73-4592-ae31-6fe0d73a2c31	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	d127d9e7-37a7-4887-b201-190db400969a	t	2026-11-03 05:35:40.784	\N
2f9adf35-f5e5-46ec-8287-997ec50b07d1	8f87317a-a8b0-4518-932c-87d01c09e762	a308136b-1345-4008-81b1-be0ae09ce9fe	f	2026-11-03 09:58:47.581	2026-11-03 09:58:48.378
\.


--
-- Data for Name: DiagnosticResult; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."DiagnosticResult" (id, "episodeId", "testType", result, species, "testDate", "createdById", "createdAt") FROM stdin;
68093403-43c1-43a3-8b69-c00915f6d4fc	f282dea4-d5b4-488e-9685-728f7ecf4369	RDT	POSITIVE	\N	2026-11-02 09:35:12.941	\N	2026-11-02 09:35:12.942
4796e072-f2a3-4186-93ca-fc19e91c5c17	a1abae39-117f-48d3-9bbc-68edd746e116	RDT	NEGATIVE	\N	2026-11-02 09:35:12.968	\N	2026-11-02 09:35:12.969
835675a8-f254-4076-a410-8434b4df37f4	4fa9bcc0-0d9f-415b-8ae7-94872fb85ba4	RDT	NEGATIVE	\N	2026-11-02 11:42:50.666	11e4a072-93c9-47a7-9157-bcca817f2dad	2026-11-02 11:42:50.667
1c95e30a-3fdc-4ffe-bbaf-e24b318d3862	8e2cc5ae-e1b3-4946-b267-3e8d971ad533	MICROSCOPY	NEGATIVE	\N	2026-11-02 11:42:51.15	11e4a072-93c9-47a7-9157-bcca817f2dad	2026-11-02 11:42:51.151
61185168-7b52-4baa-a004-cb5ce502c00b	d1756b6c-1f6e-4987-a657-7614a04a148e	RDT	NEGATIVE	\N	2026-11-02 11:42:51.157	11e4a072-93c9-47a7-9157-bcca817f2dad	2026-11-02 11:42:51.158
06f8fb1c-77d9-40cf-bf14-b0c90d611bb9	aefb1d5a-3ac5-4e68-bf99-84b39fb7e5b8	MICROSCOPY	NEGATIVE	\N	2026-11-02 11:42:51.165	11e4a072-93c9-47a7-9157-bcca817f2dad	2026-11-02 11:42:51.166
f2e7b33d-261b-4612-8692-fe51f5488262	a037eddc-796f-48b3-93d4-63e511130ae8	RDT	NEGATIVE	\N	2026-11-02 11:42:51.172	11e4a072-93c9-47a7-9157-bcca817f2dad	2026-11-02 11:42:51.172
c50263a5-0708-4439-9584-8f6e6cff5f39	fadec34d-debb-4742-aaf5-3872851a56f5	RDT	POSITIVE	P_VIVAX	2026-11-02 11:42:51.178	11e4a072-93c9-47a7-9157-bcca817f2dad	2026-11-02 11:42:51.179
d1480d0c-e098-4d05-bbc1-dd56ec970ed8	73349f8d-37df-42c4-b1f3-bb887b585be4	MICROSCOPY	POSITIVE	P_FALCIPARUM	2026-11-02 11:42:51.186	11e4a072-93c9-47a7-9157-bcca817f2dad	2026-11-02 11:42:51.186
df485f39-4256-404c-93a2-cdef0f1e6a71	c411029c-4422-4346-b725-4e9090e821d6	RDT	POSITIVE	P_VIVAX	2026-11-02 11:42:51.191	11e4a072-93c9-47a7-9157-bcca817f2dad	2026-11-02 11:42:51.192
e410cb2f-b2c1-4481-89d8-b0bf78958bcd	0ecc0e5d-6cc6-4444-b14e-eb27d95bd2fe	MICROSCOPY	POSITIVE	P_FALCIPARUM	2026-11-02 11:42:51.197	11e4a072-93c9-47a7-9157-bcca817f2dad	2026-11-02 11:42:51.197
55e4e712-a8a8-49e8-a561-84b988cf47f1	e65baf2b-70ff-47bd-a02f-d6035e40868e	RDT	POSITIVE	MIXED	2026-11-02 11:42:51.202	11e4a072-93c9-47a7-9157-bcca817f2dad	2026-11-02 11:42:51.203
\.


--
-- Data for Name: FollowUp; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."FollowUp" (id, "workerId", "episodeId", question, response, note, "respondedAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: IdempotencyKey; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."IdempotencyKey" (id, key, scope, "userId", "entityId", "createdAt") FROM stdin;
edd7b2b6-81a6-4f46-a0c2-f45abf511883	d0468916-3de9-4c06-b916-88879bf27056	symptom_report	939038bf-ee3a-4d23-8d6c-cd9b1fe224b1	3ca8ca53-890c-4c1a-9ede-92a6c20cd476	2026-10-30 09:44:25.233
8629bafd-984b-4881-8df3-8a1cf606bc60	510a3e1a-ae9f-4478-a5b7-a9b4dd46676b	symptom_report	939038bf-ee3a-4d23-8d6c-cd9b1fe224b1	170ee8c2-d3c3-4374-8869-3b9efb13e2e0	2026-10-30 10:31:11.681
60a4d145-cb51-477d-b8ad-44f47aeada88	f11867c0-0335-4b8a-a91c-7993395d4313	symptom_report	232afa3c-ff8c-42c4-b531-fb9eb86ee8e9	89b1de28-caa8-42d0-832e-f37dfcd682ce	2026-10-31 07:04:54.331
8fe7478b-9e0d-4b1d-ba02-a82070ecd288	0c74fbb2-cb41-4644-a86b-a352e7d552e6	symptom_report	e3737134-7776-41c5-91a7-709f4e0e7b60	a40bdc9f-d628-46ca-a0d5-39280cee1884	2026-10-31 07:40:40.758
5c4fdc50-e7ee-4285-b14a-13abde6e2cae	7527413c-3261-43dc-9f13-4413a28247eb	symptom_report	5691c8f1-f036-4986-a592-5a01dfe4e469	3140a21a-1bb2-4432-88de-ac2e4b628e65	2026-10-31 09:48:01.774
b4077041-29c2-4bef-9e47-01a92c2e0d23	5cfb9480-c3d1-4b97-8195-8204465a2c9c	symptom_report	5691c8f1-f036-4986-a592-5a01dfe4e469	c4ea6575-1e5b-4773-8c28-96300cea04b1	2026-10-31 09:50:07.142
\.


--
-- Data for Name: InitialScreening; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."InitialScreening" (id, "workerId", status, version, "consentGiven", answers, "completedAt", "createdAt", "updatedAt") FROM stdin;
7d2a6765-446d-41e6-a1b2-5ff2e8968fe9	2ec7835e-d53c-4b23-9ffb-c583a6e84fd7	COMPLETE	worker-screening-2026-09-01	t	{"gender": "female", "full_name": "Asha Demo", "fever_today": "no", "mobile_number": "9000000001"}	2026-10-30 09:07:45.607	2026-10-30 09:07:45.608	2026-10-30 09:07:45.608
2027997e-b4d3-4799-a4ac-ed747b538a0a	d214bc04-e5c3-4868-a17d-17448ec2ad1d	COMPLETE	worker-screening-2026-09-01	t	{"gender": "male", "age_years": 0, "full_name": "Ramesh Test", "fever_today": "no", "date_of_birth": "2026-10-15", "mobile_number": "9112233445", "diagnosed_malaria": "no", "planning_visit_outside": "no", "travelled_outside_3_months": "no"}	2026-10-30 11:09:46.923	2026-10-30 11:09:46.925	2026-10-30 11:09:46.925
b696e768-a538-47c6-8230-7cf7cc9689e2	3412eb86-5df0-4031-9f33-d24708f16559	COMPLETE	worker-screening-2026-09-01	t	{"gender": "male", "age_years": 0, "full_name": "Atreya", "repellent": "yes", "fever_today": "no", "gov_id_type": "other", "mosquito_net": "no", "date_of_birth": "2026-10-15", "mobile_number": "9876543210", "qualification": "classes_1_5", "duration_in_goa": "6m_1y", "diagnosed_malaria": "no", "preferred_language": "en", "last_stay_home_state": "7_days", "fever_malaria_before_goa": "no", "travelled_outside_3_months": "no"}	2026-11-03 04:12:23.752	2026-10-30 10:11:06.454	2026-11-03 04:12:23.753
a5ddc6fe-6045-4bf0-89ab-e36ddc870226	7e989751-6b32-41c5-b2b3-e3ddb348117e	COMPLETE	worker-screening-2026-09-01	t	{"gender": "male", "age_years": 0, "full_name": "Local Device Test", "fever_today": "no", "gov_id_type": "aadhaar", "date_of_birth": "2026-10-31", "mobile_number": "9800000099", "duration_in_goa": "lte_1_month", "diagnosed_malaria": "no", "preferred_language": "en", "associated_symptoms": ["none"], "planning_visit_outside": "no", "travelled_outside_3_months": "no"}	2026-10-31 07:15:21.013	2026-10-31 07:15:21.015	2026-10-31 07:15:21.015
91f1a48d-9de2-4543-a6cf-2df5055b5748	1ec4187f-7e06-4ca1-bb21-4626e25012f0	COMPLETE	worker-screening-2026-09-01	t	{"gender": "male", "age_years": 49, "full_name": "Sib", "repellent": "yes", "fever_today": "not_sure", "gov_id_type": "aadhaar", "mosquito_net": "no", "date_of_birth": "1977-10-17", "mobile_number": "9090909090", "fever_duration": "not_required", "completed_course": "not_sure", "able_to_go_testing": "no", "preferred_language": "bn", "fever_during_travel": "no", "planning_visit_outside": "yes", "fever_malaria_before_goa": "dont_know", "travelled_outside_3_months": "yes"}	2026-10-31 07:37:48.347	2026-10-31 07:37:48.348	2026-10-31 07:37:48.348
896a9798-0f37-41a4-b60d-6123588e3a7c	160f6d93-c491-49d9-85e5-dad04ef070fd	COMPLETE	worker-screening-2026-09-01	t	{"gender": "female", "age_years": 19, "full_name": "Dhudu", "fever_today": "no", "gov_id_type": "aadhaar", "date_of_birth": "2007-10-18", "mobile_number": "8582828285", "preferred_language": "hi"}	2026-10-31 08:54:29.439	2026-10-31 08:54:29.44	2026-10-31 08:54:29.44
3372387c-5aa1-447d-8b4d-bf745dcaddc8	8d4a1a32-de33-45ba-aa28-3998d7df6161	COMPLETE	1.0	t	{"age": 32, "gender": "MALE", "state_of_origin": "Bihar"}	2026-11-02 09:34:40.623	2026-11-02 09:34:40.625	2026-11-02 09:34:40.625
3baa1846-8c02-4a50-8942-20805f0e7c83	ee27b7b1-a626-4a08-923e-d1c76f7e7d61	COMPLETE	1.0	t	{"age": 28, "gender": "MALE", "state_of_origin": "Bihar"}	2026-11-02 09:34:40.662	2026-11-02 09:34:40.663	2026-11-02 09:34:40.663
66e47aa1-a72b-436b-94d3-5598380beeb4	da52b214-6959-4f48-b4ef-60604ae3a332	COMPLETE	1.0	t	{"age": 35, "gender": "MALE", "state_of_origin": "Bihar"}	2026-11-02 09:35:12.825	2026-11-02 09:35:12.826	2026-11-02 09:35:12.826
54157802-e18e-4403-9eef-474834e9afdb	7aef5256-8377-4ce8-ba82-5255973576fd	COMPLETE	1.0	t	{"age": 24, "gender": "MALE", "state_of_origin": "Bihar"}	2026-11-02 09:35:12.851	2026-11-02 09:35:12.852	2026-11-02 09:35:12.852
670650bb-d52e-48ea-b226-26b68df267b5	848c1c34-aea9-432d-8d54-793009d87684	COMPLETE	1.0	t	{"age": 30, "gender": "MALE", "state_of_origin": "Bihar"}	2026-11-02 09:35:13.03	2026-11-02 09:35:13.031	2026-11-02 09:35:13.031
12e7d270-e3c2-40cc-8d81-34e4aaf16f8f	9ea6a322-29e6-4645-821f-1a9195451db5	COMPLETE	2026.1	t	{"gender": "male", "full_name": "Ramesh Kumar", "fever_today": "no", "mobile_number": "9800000011"}	\N	2026-11-02 11:42:50.664	2026-11-02 11:42:50.664
682f1830-cd83-4ffe-a04f-c5d75c69cb64	e2c97c8b-646a-4447-94fd-49611fdebcef	COMPLETE	2026.1	t	{"gender": "male", "full_name": "Suresh Patil", "fever_today": "no", "mobile_number": "9800000012"}	\N	2026-11-02 11:42:51.148	2026-11-02 11:42:51.148
57dfb3b4-1eb4-4a90-abbf-b4b1177fd0bc	1267008e-abec-4f4d-9d82-acf8b57f220e	COMPLETE	2026.1	t	{"gender": "male", "full_name": "Manoj Sharma", "fever_today": "no", "mobile_number": "9800000013"}	\N	2026-11-02 11:42:51.155	2026-11-02 11:42:51.155
85d8ff29-52b4-42bb-9b61-040edb826e90	f899e85c-0c2c-441d-8d0e-1dea0b06bcb2	COMPLETE	2026.1	t	{"gender": "male", "full_name": "Rajesh Verma", "fever_today": "no", "mobile_number": "9800000014"}	\N	2026-11-02 11:42:51.163	2026-11-02 11:42:51.163
dabbd399-d757-473e-a8ac-fe215cdac8d5	b3e9ba23-e764-47d0-b5c5-238984485429	COMPLETE	2026.1	t	{"gender": "male", "full_name": "Amit Singh", "fever_today": "no", "mobile_number": "9800000015"}	\N	2026-11-02 11:42:51.17	2026-11-02 11:42:51.17
52111724-f3f8-40fd-8d6a-2c6b1d5f23ca	f3fdfbab-d150-4245-81da-ff82e45cf1f7	COMPLETE	2026.1	t	{"gender": "male", "full_name": "Vikas Yadav", "fever_today": "yes", "mobile_number": "9800000016"}	\N	2026-11-02 11:42:51.177	2026-11-02 11:42:51.177
de7fb29d-4bfe-467b-a4d4-336c3e53bd00	6ac4565c-29c3-45f9-8290-23b2ff86e1e6	COMPLETE	2026.1	t	{"gender": "male", "full_name": "Sunil Das", "fever_today": "yes", "mobile_number": "9800000017"}	\N	2026-11-02 11:42:51.185	2026-11-02 11:42:51.185
c8c30131-c64d-46af-8809-ed49a3afb1b1	5f46925c-d2b4-42f0-a1a8-151a766b3177	COMPLETE	2026.1	t	{"gender": "male", "full_name": "Anil Mondal", "fever_today": "yes", "mobile_number": "9800000018"}	\N	2026-11-02 11:42:51.19	2026-11-02 11:42:51.19
a3443ee0-cb4f-4172-b982-f01b06ff9dca	13d4c39a-b34e-4239-9456-5461b23137f3	COMPLETE	2026.1	t	{"gender": "male", "full_name": "Deepak Roy", "fever_today": "yes", "mobile_number": "9800000019"}	\N	2026-11-02 11:42:51.195	2026-11-02 11:42:51.195
b5245281-8484-4111-8a5e-78e7e4f0b4fd	663d830e-3fb2-4753-b13e-709d78af6f3a	COMPLETE	2026.1	t	{"gender": "male", "full_name": "Sanjay Gupta", "fever_today": "yes", "mobile_number": "9800000020"}	\N	2026-11-02 11:42:51.201	2026-11-02 11:42:51.201
\.


--
-- Data for Name: LocationNode; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."LocationNode" (id, level, name, "parentId") FROM stdin;
df6a3b59-71f1-496b-aa24-5811397e4662	STATE	Goa	\N
6b111cca-a27a-4e08-8dd5-f1d17b179b3f	DISTRICT	North Goa	df6a3b59-71f1-496b-aa24-5811397e4662
7299c6fd-4fac-491c-a115-0d39a1434e24	DISTRICT	South Goa	df6a3b59-71f1-496b-aa24-5811397e4662
de6cbc87-cf3f-452d-b96c-9a88b9ee8650	DISTRICT	Kushavati	df6a3b59-71f1-496b-aa24-5811397e4662
d4824ce4-05e6-401a-9f24-4cd8d0a45a42	TALUKA	Bardez	6b111cca-a27a-4e08-8dd5-f1d17b179b3f
38bec4eb-1256-49f6-9066-191edcb198ad	TALUKA	Tiswadi	6b111cca-a27a-4e08-8dd5-f1d17b179b3f
f83de0ff-2e89-408f-8fd8-284331f742ee	TALUKA	Salcete	7299c6fd-4fac-491c-a115-0d39a1434e24
314acb8e-8779-43c5-9cc5-5bf91a0c18bb	TALUKA	Mormugao	7299c6fd-4fac-491c-a115-0d39a1434e24
43c3dc1c-6ba5-40e9-adfa-35d2a29473e6	TALUKA	Quepem	de6cbc87-cf3f-452d-b96c-9a88b9ee8650
57f1d151-0337-4f37-98a5-f61caed833ce	AREA	Candolim	d4824ce4-05e6-401a-9f24-4cd8d0a45a42
ead003cf-5607-4067-bb08-d03e6414d34e	AREA	Panaji	38bec4eb-1256-49f6-9066-191edcb198ad
c81a3001-d584-4ff0-a8dc-c680df3b7701	AREA	Margao	f83de0ff-2e89-408f-8fd8-284331f742ee
d3bbc2c5-d758-4a66-b568-a6c29dd0074a	AREA	Vasco	314acb8e-8779-43c5-9cc5-5bf91a0c18bb
f802d2ed-f433-4e61-b46c-079bd90bef70	AREA	Curchorem	43c3dc1c-6ba5-40e9-adfa-35d2a29473e6
14e19023-4696-43c9-a3c1-6b7b392d9861	AREA	Old Goa	38bec4eb-1256-49f6-9066-191edcb198ad
ff4b5cfc-7cb0-4e28-a8a4-908c433b4a9e	AREA	Ribandar	38bec4eb-1256-49f6-9066-191edcb198ad
7df508d6-d45e-4735-abe4-365f20db03fd	AREA	Santa Cruz	38bec4eb-1256-49f6-9066-191edcb198ad
9eebf8e6-d57b-47ed-958c-fe4c7ac299e1	AREA	Taleigao	38bec4eb-1256-49f6-9066-191edcb198ad
dee9bbdf-3d06-47ea-a2d3-7e1b4956b479	AREA	Merces	38bec4eb-1256-49f6-9066-191edcb198ad
6156473e-74e5-4ee2-b208-91b99ede7e6e	AREA	Chimbel	38bec4eb-1256-49f6-9066-191edcb198ad
09171bea-7781-46be-bd15-99b0f689f7d0	AREA	Bambolim	38bec4eb-1256-49f6-9066-191edcb198ad
338f98fb-eb97-4b30-aac8-fdb2381dcd4e	AREA	Corlim	38bec4eb-1256-49f6-9066-191edcb198ad
8ac46d77-37e4-44dc-80dd-06c8b8061c37	AREA	Curca	38bec4eb-1256-49f6-9066-191edcb198ad
4d3154eb-0bd8-404e-935f-642b044d38e1	AREA	Neura	38bec4eb-1256-49f6-9066-191edcb198ad
6f607067-3f28-42f3-96ab-b02bae43fb51	AREA	Siridao	38bec4eb-1256-49f6-9066-191edcb198ad
e6262ee2-e6a8-413e-8bb7-eee0509ef7f6	AREA	Mandur	38bec4eb-1256-49f6-9066-191edcb198ad
655d629c-371d-4d86-ba68-7ab53f80dca3	AREA	Batim	38bec4eb-1256-49f6-9066-191edcb198ad
739a98c0-ded9-4c50-80e8-f83245218f9a	AREA	Carambolim	38bec4eb-1256-49f6-9066-191edcb198ad
35043d07-da9a-4038-a96f-c2b717a101e9	AREA	St. Estevam	38bec4eb-1256-49f6-9066-191edcb198ad
aa9c090e-d15d-4f07-b5ad-2fd094e36887	AREA	Cumbarjua	38bec4eb-1256-49f6-9066-191edcb198ad
99779d0e-3227-4db1-84d6-152d2406ce15	AREA	Chorao	38bec4eb-1256-49f6-9066-191edcb198ad
0e1234f4-a8dd-46b3-aff8-394c1e2bd631	AREA	Divar	38bec4eb-1256-49f6-9066-191edcb198ad
874dc9b3-2d4d-47e1-af5c-0cc90b81d413	AREA	Goltim-Navelim	38bec4eb-1256-49f6-9066-191edcb198ad
11720f2a-874b-484a-ad5a-c11f4d6315ad	AREA	Azossim	38bec4eb-1256-49f6-9066-191edcb198ad
39ada54c-5323-40fd-86d2-8e2e32837679	AREA	Ella	38bec4eb-1256-49f6-9066-191edcb198ad
4984a95b-edbb-4567-936a-f881521f1cc6	AREA	Mapusa	d4824ce4-05e6-401a-9f24-4cd8d0a45a42
fe2d17e4-c916-408f-8fa6-3606bcebf958	AREA	Calangute	d4824ce4-05e6-401a-9f24-4cd8d0a45a42
02cbccfb-6eae-42ca-b280-6e33984e53e1	AREA	Anjuna	d4824ce4-05e6-401a-9f24-4cd8d0a45a42
25698e23-78a5-49b8-b07d-661f7ccfd1cc	AREA	Arpora	d4824ce4-05e6-401a-9f24-4cd8d0a45a42
47cdde58-45a9-4e84-bd8b-f7a1ff99455a	AREA	Colvale	d4824ce4-05e6-401a-9f24-4cd8d0a45a42
b1b0b170-6291-4faa-adbd-753995162196	AREA	Guirim	d4824ce4-05e6-401a-9f24-4cd8d0a45a42
f53244e2-aef7-495c-9f7b-82d7dc4522ec	AREA	Moira	d4824ce4-05e6-401a-9f24-4cd8d0a45a42
ab0b6bc9-a249-4aae-ae8d-9f63d5bf0e9c	AREA	Nachinola	d4824ce4-05e6-401a-9f24-4cd8d0a45a42
a4948ec9-20fa-4c27-9a2d-c5c778d83ade	AREA	Nerul	d4824ce4-05e6-401a-9f24-4cd8d0a45a42
9f556dea-5d09-4222-a9f8-0ff328eeb7f9	AREA	Parra	d4824ce4-05e6-401a-9f24-4cd8d0a45a42
18655856-c2d9-4c18-a558-343fee8de61f	AREA	Pilerne	d4824ce4-05e6-401a-9f24-4cd8d0a45a42
ef0e8d2f-bf85-4a95-8432-c1185915ad73	AREA	Porvorim	d4824ce4-05e6-401a-9f24-4cd8d0a45a42
c83a1b5a-c440-4345-a3f3-385ef35d8ba7	AREA	Reis Magos	d4824ce4-05e6-401a-9f24-4cd8d0a45a42
e2b37bd6-678b-4bb7-a2de-345667da5712	AREA	Saligao	d4824ce4-05e6-401a-9f24-4cd8d0a45a42
fc1f336d-a463-403d-a640-b0bbc2fd5a9d	AREA	Siolim	d4824ce4-05e6-401a-9f24-4cd8d0a45a42
23c837ad-b5f1-4092-8112-77adca0cb80f	AREA	Socorro	d4824ce4-05e6-401a-9f24-4cd8d0a45a42
211437e8-2d1d-4dae-9ef4-0e1273e2c11b	AREA	Tivim	d4824ce4-05e6-401a-9f24-4cd8d0a45a42
ec5a34f0-8b2a-4b57-b3d0-bcad37d4880a	AREA	Vagator	d4824ce4-05e6-401a-9f24-4cd8d0a45a42
49f49ebd-996a-4392-94ad-b1510b74e557	AREA	Penha de Franca	d4824ce4-05e6-401a-9f24-4cd8d0a45a42
cc289b67-b0c1-4b57-8852-0967addfa6f1	AREA	Aldona	d4824ce4-05e6-401a-9f24-4cd8d0a45a42
57a7ef3d-a7a4-44bf-9842-02a9fd24e108	AREA	Assagao	d4824ce4-05e6-401a-9f24-4cd8d0a45a42
6aba50da-037b-453e-a7b0-1578587c0711	AREA	Bastora	d4824ce4-05e6-401a-9f24-4cd8d0a45a42
fdc4eee5-3374-4fe2-8417-156c8c34c03b	AREA	Salvador do Mundo	d4824ce4-05e6-401a-9f24-4cd8d0a45a42
34dfd1b9-563e-4d2a-9e4b-7f7293d6491d	AREA	Sangolda	d4824ce4-05e6-401a-9f24-4cd8d0a45a42
1bc4655c-3eb8-476b-b2f6-20411f4a93ff	AREA	Verla-Canca	d4824ce4-05e6-401a-9f24-4cd8d0a45a42
7f78b64f-487c-4a67-b1a5-f4a2fd024592	AREA	Nagoa	d4824ce4-05e6-401a-9f24-4cd8d0a45a42
3cd53950-ef24-4f6d-87db-a6cd98e1e80e	TALUKA	Pernem	6b111cca-a27a-4e08-8dd5-f1d17b179b3f
febe1d5d-6ef4-406a-947a-c537ac3c0aed	AREA	Pernem	3cd53950-ef24-4f6d-87db-a6cd98e1e80e
24922dbc-03df-450a-8e07-ad83c0498cd2	AREA	Arambol	3cd53950-ef24-4f6d-87db-a6cd98e1e80e
1ef2fe7e-22ac-40c9-9b3d-15c7655f6144	AREA	Mandrem	3cd53950-ef24-4f6d-87db-a6cd98e1e80e
f7ce3f2f-cb1b-4da2-bac1-e2ced828c2e6	AREA	Morjim	3cd53950-ef24-4f6d-87db-a6cd98e1e80e
e5000968-3d7e-487c-a4a3-6905115264e4	AREA	Tuem	3cd53950-ef24-4f6d-87db-a6cd98e1e80e
bc05239d-8df2-4c3d-b82f-e7c1e50f3237	AREA	Dhargalim	3cd53950-ef24-4f6d-87db-a6cd98e1e80e
f1968195-341a-4de8-a5b0-44a1b6f174d0	AREA	Querim	3cd53950-ef24-4f6d-87db-a6cd98e1e80e
041be8e5-11ec-44ec-b779-ddd322ec4e11	AREA	Agarwada	3cd53950-ef24-4f6d-87db-a6cd98e1e80e
1c8e02e8-5ebd-4b97-a7c4-6e0edf3eb2d4	AREA	Alorna	3cd53950-ef24-4f6d-87db-a6cd98e1e80e
5aadf28e-bbbe-464d-808b-d1a8779a3fd6	AREA	Casarvarnem	3cd53950-ef24-4f6d-87db-a6cd98e1e80e
c92913a6-cd5d-4098-9009-505520797296	AREA	Chandel	3cd53950-ef24-4f6d-87db-a6cd98e1e80e
3e6e8005-2171-4d2c-865a-4f173935f4ee	AREA	Corgao	3cd53950-ef24-4f6d-87db-a6cd98e1e80e
2b5cd2a8-1925-4da1-b1a8-1dba4bc52da6	AREA	Ibrampur	3cd53950-ef24-4f6d-87db-a6cd98e1e80e
c3bab7df-7ea8-434b-88a7-1db2c140a2f7	AREA	Mopa	3cd53950-ef24-4f6d-87db-a6cd98e1e80e
9286d219-bf40-4c0d-b95b-a8b3bacc4cc8	AREA	Ozorim	3cd53950-ef24-4f6d-87db-a6cd98e1e80e
c2e33068-6ef5-4237-9d53-22104e3253b8	AREA	Paliem	3cd53950-ef24-4f6d-87db-a6cd98e1e80e
e1b54a79-963a-47a7-ae16-b6d6e4c64ee6	AREA	Torxem	3cd53950-ef24-4f6d-87db-a6cd98e1e80e
8ce1431f-8f5a-410c-b1cc-aeb2d0be9de5	AREA	Virnora	3cd53950-ef24-4f6d-87db-a6cd98e1e80e
f037a360-4d2a-4b7b-aa2b-070e9a393994	AREA	Warchawada	3cd53950-ef24-4f6d-87db-a6cd98e1e80e
6717cebd-20b9-4c8c-8e15-536785d66810	AREA	Parxem	3cd53950-ef24-4f6d-87db-a6cd98e1e80e
9a991617-b524-4f53-856b-55f83189d157	TALUKA	Bicholim	6b111cca-a27a-4e08-8dd5-f1d17b179b3f
e72fa2d3-6d6d-4bb5-9af9-08c842b370fa	AREA	Bicholim	9a991617-b524-4f53-856b-55f83189d157
09fb9a00-48a0-4284-9042-92712a03b527	AREA	Sanqelim	9a991617-b524-4f53-856b-55f83189d157
783d1dfc-2a7f-4900-88e8-c9fbb0909a74	AREA	Mayem	9a991617-b524-4f53-856b-55f83189d157
bb294439-83a9-401e-9a5b-b147f03055eb	AREA	Mulgao	9a991617-b524-4f53-856b-55f83189d157
33074110-80f1-4431-b1ba-09719a1035cd	AREA	Pale	9a991617-b524-4f53-856b-55f83189d157
6a82ec75-3cbf-4025-9763-fb5847ce260d	AREA	Piligao	9a991617-b524-4f53-856b-55f83189d157
c402b8c4-8f40-4fe8-bd0a-745da8c89a0b	AREA	Sirigao	9a991617-b524-4f53-856b-55f83189d157
3539f669-e748-4c85-8a53-5be18874c5a6	AREA	Surla	9a991617-b524-4f53-856b-55f83189d157
e2df9afb-7be4-4bee-b028-703545e5e48a	AREA	Kudne	9a991617-b524-4f53-856b-55f83189d157
c94f8f85-26d0-48b6-9605-ab614e86937c	AREA	Advalpal	9a991617-b524-4f53-856b-55f83189d157
845cdb20-afeb-4ddf-a7b8-4f03a2b0f57d	AREA	Amona	9a991617-b524-4f53-856b-55f83189d157
e72f4b54-ccb5-48e8-b58c-628e6f12af11	AREA	Bordem	9a991617-b524-4f53-856b-55f83189d157
25e5c8b1-bf2b-4bfc-9841-ad94430f9b1f	AREA	Karapur	9a991617-b524-4f53-856b-55f83189d157
ae6abd47-35dc-4db2-ba10-1e39dd7b83ee	AREA	Navelim (Bicholim)	9a991617-b524-4f53-856b-55f83189d157
df02c346-b09b-41d0-86db-ae1829936e89	AREA	Salem	9a991617-b524-4f53-856b-55f83189d157
6a66ecc5-c27b-49cb-b11d-e74d66c4dd14	AREA	Velinga	9a991617-b524-4f53-856b-55f83189d157
d883093d-5b32-451e-bbde-09890161a6d5	AREA	Latambarcem	9a991617-b524-4f53-856b-55f83189d157
2cba1025-d0d3-4bf8-8f10-9c0ac682b62f	AREA	Mencurem	9a991617-b524-4f53-856b-55f83189d157
ef6dc753-8fd7-492f-a1e0-e59eef179731	TALUKA	Sattari	6b111cca-a27a-4e08-8dd5-f1d17b179b3f
709f9b45-b59e-406b-adff-3a792b305342	AREA	Valpoi	ef6dc753-8fd7-492f-a1e0-e59eef179731
db570485-564c-4304-999b-feec372028a0	AREA	Honda	ef6dc753-8fd7-492f-a1e0-e59eef179731
ff845ee4-17de-4c81-a7ed-7b0e72f79bb2	AREA	Pissurlem	ef6dc753-8fd7-492f-a1e0-e59eef179731
56c34da9-aa13-4dd5-b23c-9a9ffdf1bdc5	AREA	Keri	ef6dc753-8fd7-492f-a1e0-e59eef179731
d06fdd1b-2d88-45b8-9a27-9eec05812906	AREA	Morlem	ef6dc753-8fd7-492f-a1e0-e59eef179731
5dff51ff-a8d1-4acd-8ee9-84eb11c58a64	AREA	Nagargao	ef6dc753-8fd7-492f-a1e0-e59eef179731
dbf933e8-2b7c-4614-9fb5-1ec0a7ee0ae2	AREA	Thane	ef6dc753-8fd7-492f-a1e0-e59eef179731
4ed3adac-9ddb-4f8e-ad56-8cdcc149b150	AREA	Sanvordem (Sattari)	ef6dc753-8fd7-492f-a1e0-e59eef179731
9c744066-b79a-4a07-bfad-17f7e8fedddd	AREA	Birondem	ef6dc753-8fd7-492f-a1e0-e59eef179731
ddfb6dee-b4b6-415c-aeed-28529c081026	AREA	Mauxi	ef6dc753-8fd7-492f-a1e0-e59eef179731
7b70e06e-89cf-49b0-99d2-83397563d9ac	AREA	Poriem	ef6dc753-8fd7-492f-a1e0-e59eef179731
eaf9da1b-2ea8-432a-80fc-8f11ae85b60b	AREA	Ravan	ef6dc753-8fd7-492f-a1e0-e59eef179731
73cf7cb3-4457-41d2-9dbe-adcae11b3f59	AREA	Rivem	ef6dc753-8fd7-492f-a1e0-e59eef179731
8c66a182-16fc-4397-932a-85599eda23c7	AREA	Savarde	ef6dc753-8fd7-492f-a1e0-e59eef179731
e6479750-b70f-47ed-851c-1e3d5ca43a82	AREA	Dongurli	ef6dc753-8fd7-492f-a1e0-e59eef179731
357e47d9-747c-49a1-80db-526d9448b2b5	TALUKA	Ponda	6b111cca-a27a-4e08-8dd5-f1d17b179b3f
c20bbba5-cc78-4008-a9a9-7abe53ab3d8a	AREA	Ponda	357e47d9-747c-49a1-80db-526d9448b2b5
c03b201e-c885-4e85-ad1e-7c59d43a37b1	AREA	Bandora	357e47d9-747c-49a1-80db-526d9448b2b5
8b7caf13-2876-4065-ba18-694aa131388e	AREA	Borim	357e47d9-747c-49a1-80db-526d9448b2b5
f9ab29f6-970e-43be-b184-f1faf8d05969	AREA	Curti	357e47d9-747c-49a1-80db-526d9448b2b5
f71ee857-67cd-40b3-8301-7f2642793277	AREA	Kundaim	357e47d9-747c-49a1-80db-526d9448b2b5
aab4589b-6a05-49b1-b36d-735042d548a0	AREA	Marcaim	357e47d9-747c-49a1-80db-526d9448b2b5
42b27981-2550-4061-ba13-5c1d3c5d9b4f	AREA	Priol	357e47d9-747c-49a1-80db-526d9448b2b5
3dc00d75-e86e-4cd0-bacc-5be3d750f7c7	AREA	Shiroda	357e47d9-747c-49a1-80db-526d9448b2b5
b0111a89-a1b9-4a78-955a-d1d77e109fcb	AREA	Usgao	357e47d9-747c-49a1-80db-526d9448b2b5
258b21b1-0ced-477e-849f-7fbaff307f62	AREA	Veling	357e47d9-747c-49a1-80db-526d9448b2b5
146ff289-32ba-476d-b4ca-a98fd4b01a8c	AREA	Betora	357e47d9-747c-49a1-80db-526d9448b2b5
70a3c650-cd85-4a92-91b3-d3605a952861	AREA	Candepar	357e47d9-747c-49a1-80db-526d9448b2b5
a2ee9061-0e06-4b27-b039-5e3235069ec3	AREA	Durbhat	357e47d9-747c-49a1-80db-526d9448b2b5
8b9ee597-cd2e-4684-967d-87c913eaf2eb	AREA	Kavalem	357e47d9-747c-49a1-80db-526d9448b2b5
b95facfe-4904-47aa-8aeb-a5ba17e3809c	AREA	Querim (Ponda)	357e47d9-747c-49a1-80db-526d9448b2b5
07b01610-f119-4c68-b201-e99100de20dd	AREA	Talaulim	357e47d9-747c-49a1-80db-526d9448b2b5
fa552fac-8a14-40af-97a1-bf59784323da	AREA	Tivrem	357e47d9-747c-49a1-80db-526d9448b2b5
70b0ada3-567c-4a13-8e5a-6f63d9e676a7	AREA	Volvoi	357e47d9-747c-49a1-80db-526d9448b2b5
d50042ab-0d5f-4564-84be-d019d856fc58	AREA	Boma	357e47d9-747c-49a1-80db-526d9448b2b5
5bdfb740-6300-4b94-9583-141dd8dcd268	AREA	Panchawadi	357e47d9-747c-49a1-80db-526d9448b2b5
ac62b8ce-f65a-49b9-9b9b-d254174f4aed	AREA	Benaulim	f83de0ff-2e89-408f-8fd8-284331f742ee
fab4d408-b5db-4ea8-8378-de0f08d4c507	AREA	Colva	f83de0ff-2e89-408f-8fd8-284331f742ee
8aa2137d-635d-4814-a9a8-e35b1ff49594	AREA	Curtorim	f83de0ff-2e89-408f-8fd8-284331f742ee
81c8ce2c-6243-4497-b198-d69148dc5303	AREA	Fatorda	f83de0ff-2e89-408f-8fd8-284331f742ee
50ff9ae0-2f14-43f1-bed3-9ce2be57b892	AREA	Loutolim	f83de0ff-2e89-408f-8fd8-284331f742ee
8a26a4ea-e4a1-4a6f-a8c0-c435b1a36192	AREA	Majorda	f83de0ff-2e89-408f-8fd8-284331f742ee
f38d0bf7-9370-4967-98ec-6775dc10cfa8	AREA	Navelim	f83de0ff-2e89-408f-8fd8-284331f742ee
abdfcc86-5b5f-48ed-8640-d37ffe0b798e	AREA	Nuvem	f83de0ff-2e89-408f-8fd8-284331f742ee
6751731a-9595-46d9-a6ba-da056d6744e2	AREA	Raia	f83de0ff-2e89-408f-8fd8-284331f742ee
fc38a85f-c052-47dc-a0ac-c097cc64cd77	AREA	Seraulim	f83de0ff-2e89-408f-8fd8-284331f742ee
7e8f6295-b55e-444a-93bf-b77cb78d7884	AREA	Varca	f83de0ff-2e89-408f-8fd8-284331f742ee
0f1cf0ff-24bd-4f83-b107-cdf4295c0b33	AREA	Velim	f83de0ff-2e89-408f-8fd8-284331f742ee
a6de584e-1bd8-4db2-9cbe-0e65e4e0224e	AREA	Aquem	f83de0ff-2e89-408f-8fd8-284331f742ee
379ecb9f-a541-4830-8a57-0025749e827f	AREA	Betalbatim	f83de0ff-2e89-408f-8fd8-284331f742ee
4d2c00c2-5bd5-4866-a916-c1e030e7a008	AREA	Carmona	f83de0ff-2e89-408f-8fd8-284331f742ee
c4918ca3-16da-4375-b0b9-940eccf34116	AREA	Cavelossim	f83de0ff-2e89-408f-8fd8-284331f742ee
995ddeb8-6152-467f-9a51-8765ae3afdd1	AREA	Chinchinim	f83de0ff-2e89-408f-8fd8-284331f742ee
a89d7298-0af9-4b16-b592-b99bd4596d7d	AREA	Davorlim	f83de0ff-2e89-408f-8fd8-284331f742ee
d09a49f4-8718-45c9-96e0-b9bc34894d18	AREA	Guirdolim	f83de0ff-2e89-408f-8fd8-284331f742ee
f5781ef4-65ff-4c28-ab7a-b6bacf0886b1	AREA	Macasana	f83de0ff-2e89-408f-8fd8-284331f742ee
76e841fa-862e-4841-adb8-9bb4e459e6d9	AREA	Orlim	f83de0ff-2e89-408f-8fd8-284331f742ee
3c9939b7-bec2-4bae-84b8-5ec8834738dd	AREA	Paroda	f83de0ff-2e89-408f-8fd8-284331f742ee
b4c76b7b-d094-419d-885f-233712dda35a	AREA	Rachol	f83de0ff-2e89-408f-8fd8-284331f742ee
e0d07d5b-4ce0-466a-9ee2-290d96cd5543	AREA	Rumdamol	f83de0ff-2e89-408f-8fd8-284331f742ee
3cadd1b6-655d-4ef9-b5c0-df4512def24b	AREA	Sirlim	f83de0ff-2e89-408f-8fd8-284331f742ee
7e1bf3e3-fbf4-4b2f-8eb0-99ecd83e9a4b	AREA	Assolna	f83de0ff-2e89-408f-8fd8-284331f742ee
0ea7ed48-325f-49d9-838c-ff58e3a55a5a	AREA	Ambelim	f83de0ff-2e89-408f-8fd8-284331f742ee
fc25e09f-c366-4d65-8a05-fac7c5978057	AREA	Vasco da Gama	314acb8e-8779-43c5-9cc5-5bf91a0c18bb
aa68a175-a20b-4144-9938-ccba76368f6f	AREA	Mormugao	314acb8e-8779-43c5-9cc5-5bf91a0c18bb
67a4e78f-133f-4bd1-88fc-1e4025ae9ab5	AREA	Dabolim	314acb8e-8779-43c5-9cc5-5bf91a0c18bb
d404244d-bce7-4190-8259-82c2ebcf8dae	AREA	Chicalim	314acb8e-8779-43c5-9cc5-5bf91a0c18bb
6838885b-2746-4ec8-8321-4473de35bf73	AREA	Cortalim	314acb8e-8779-43c5-9cc5-5bf91a0c18bb
10853cc5-fd2b-43ed-852f-ed5cd16e431e	AREA	Sancoale	314acb8e-8779-43c5-9cc5-5bf91a0c18bb
2da5cf3a-7c1a-4345-a7e1-a17f8f735303	AREA	Bogmalo	314acb8e-8779-43c5-9cc5-5bf91a0c18bb
3001aec5-05db-4c59-a4d8-09fc32b4bc4d	AREA	Velsao	314acb8e-8779-43c5-9cc5-5bf91a0c18bb
8c3a7249-81a5-44ac-b7d0-9a20e9815148	AREA	Cansaulim	314acb8e-8779-43c5-9cc5-5bf91a0c18bb
422c7829-3b22-4650-8acc-9803c77425af	AREA	Arossim	314acb8e-8779-43c5-9cc5-5bf91a0c18bb
217ccd47-5c24-4d80-9ba4-c5379b51197b	AREA	Pale (Mormugao)	314acb8e-8779-43c5-9cc5-5bf91a0c18bb
3c81875c-1b06-4d3c-acad-1901f78c37bd	AREA	Quelossim	314acb8e-8779-43c5-9cc5-5bf91a0c18bb
c7d662e4-4d35-409c-b2d4-efd1ae426439	AREA	Issorcim	314acb8e-8779-43c5-9cc5-5bf91a0c18bb
5b16bd20-f4c3-4527-b68b-381c1e00905f	AREA	Quepem	43c3dc1c-6ba5-40e9-adfa-35d2a29473e6
e3759ffd-cd06-4df2-bf7b-8c9d088e2500	AREA	Sanvordem	43c3dc1c-6ba5-40e9-adfa-35d2a29473e6
b910876e-d655-4597-8482-83f1dfffa00f	AREA	Tilamol	43c3dc1c-6ba5-40e9-adfa-35d2a29473e6
e8b5ed46-1ee6-44e2-9300-a94e6af73037	AREA	Balli	43c3dc1c-6ba5-40e9-adfa-35d2a29473e6
134bd759-3f69-4192-a2ab-5876cf4ef6c3	AREA	Fatorpa	43c3dc1c-6ba5-40e9-adfa-35d2a29473e6
f4b13fae-1f3e-49aa-8f52-d4092dbb83f8	AREA	Ambaulim	43c3dc1c-6ba5-40e9-adfa-35d2a29473e6
99319651-bee0-42a2-8218-a268c52686f4	AREA	Assolda	43c3dc1c-6ba5-40e9-adfa-35d2a29473e6
498b76f9-cf07-4b68-9473-4d1c45ae5316	AREA	Avedem	43c3dc1c-6ba5-40e9-adfa-35d2a29473e6
53a40bf2-a008-44da-a362-0d0f10785fa0	AREA	Cacora	43c3dc1c-6ba5-40e9-adfa-35d2a29473e6
461afc56-5afa-466c-add3-3dd6aebb2071	AREA	Chaifi	43c3dc1c-6ba5-40e9-adfa-35d2a29473e6
c8047aa8-06d9-4716-9198-3cb4f2b0d9ca	AREA	Morpirla	43c3dc1c-6ba5-40e9-adfa-35d2a29473e6
7223aa16-81d6-4139-99ed-18cdb34cb6f6	AREA	Naqueri	43c3dc1c-6ba5-40e9-adfa-35d2a29473e6
10fe9e5c-7045-4b9c-9af0-5cb825ceb59b	AREA	Paldem	43c3dc1c-6ba5-40e9-adfa-35d2a29473e6
7483b524-3b35-4841-8c3d-54983c8606f2	AREA	Quedem	43c3dc1c-6ba5-40e9-adfa-35d2a29473e6
15c89a26-8f9d-40fd-a043-22f858c57bb2	AREA	Sirvoi	43c3dc1c-6ba5-40e9-adfa-35d2a29473e6
21871274-db02-454e-bcfe-8497703b9bf3	AREA	Xeldem	43c3dc1c-6ba5-40e9-adfa-35d2a29473e6
fabddbff-d14f-4cff-a281-e03b5e46ba43	AREA	Deao	43c3dc1c-6ba5-40e9-adfa-35d2a29473e6
0b966e34-bf9e-4c2c-a0ce-9f5f7d5f7d2c	TALUKA	Sanguem	de6cbc87-cf3f-452d-b96c-9a88b9ee8650
0be72b6c-5a78-4a74-aeb3-138049bab03b	AREA	Sanguem	0b966e34-bf9e-4c2c-a0ce-9f5f7d5f7d2c
d0fac428-5600-4c16-9b54-de1f52f8a48b	AREA	Rivona	0b966e34-bf9e-4c2c-a0ce-9f5f7d5f7d2c
e26d17ff-e38e-4a29-9ae8-47d2b6b7282e	AREA	Netravali	0b966e34-bf9e-4c2c-a0ce-9f5f7d5f7d2c
5370cbdd-7508-494b-80aa-0db5f336043a	AREA	Bhati	0b966e34-bf9e-4c2c-a0ce-9f5f7d5f7d2c
d4e56abb-1989-44ca-875f-b575065ed783	AREA	Curdi	0b966e34-bf9e-4c2c-a0ce-9f5f7d5f7d2c
bca5a60a-cc91-45f5-b1bf-e246d2b03ee2	AREA	Kalay	0b966e34-bf9e-4c2c-a0ce-9f5f7d5f7d2c
7c34d3d9-3d7d-4bae-82c9-6d8e9440f89e	AREA	Molem (Sanguem)	0b966e34-bf9e-4c2c-a0ce-9f5f7d5f7d2c
dc66a2fa-498f-43f1-b5f4-6ed3384c5632	AREA	Uguem	0b966e34-bf9e-4c2c-a0ce-9f5f7d5f7d2c
e59591fc-d7cc-461a-825c-bef68b56cd2d	AREA	Villian	0b966e34-bf9e-4c2c-a0ce-9f5f7d5f7d2c
901f2938-502b-4f70-a973-a1d8e825ae75	AREA	Colomba	0b966e34-bf9e-4c2c-a0ce-9f5f7d5f7d2c
9dada06b-7257-4f4b-8572-716ee7adb014	AREA	Patiem	0b966e34-bf9e-4c2c-a0ce-9f5f7d5f7d2c
e6d1c0bf-a99d-4905-a7f6-dbd977db1b8d	AREA	Tudou	0b966e34-bf9e-4c2c-a0ce-9f5f7d5f7d2c
ca8b60e0-b2f5-4b43-91fe-b503f2bee5df	AREA	Wadem	0b966e34-bf9e-4c2c-a0ce-9f5f7d5f7d2c
8874f6e6-eb71-403f-8f39-723c11ba7cb8	AREA	Vichundrem	0b966e34-bf9e-4c2c-a0ce-9f5f7d5f7d2c
7d868648-b150-4b41-8987-986ac657558c	TALUKA	Canacona	de6cbc87-cf3f-452d-b96c-9a88b9ee8650
0a8a350a-0412-473e-b063-e6681cff4368	AREA	Chaudi	7d868648-b150-4b41-8987-986ac657558c
ce6eeefb-a320-49ff-b5e5-e3ba080947a5	AREA	Agonda	7d868648-b150-4b41-8987-986ac657558c
fb5fcb89-9fa7-4b34-8a2b-806bca22e6d4	AREA	Palolem	7d868648-b150-4b41-8987-986ac657558c
3c93c941-e555-4101-83c0-928364f981c5	AREA	Poinguinim	7d868648-b150-4b41-8987-986ac657558c
06754a9b-7a5a-48c8-add3-b15e93b08181	AREA	Loliem	7d868648-b150-4b41-8987-986ac657558c
9c8a5d2c-3c80-47bd-818e-69db0c4932f2	AREA	Cotigao	7d868648-b150-4b41-8987-986ac657558c
3f69ad25-27a6-4e24-8641-2b8b42d5ea1c	AREA	Gaondongrem	7d868648-b150-4b41-8987-986ac657558c
ecca657d-e3c2-4542-b596-c3c8103b1b6d	AREA	Cola	7d868648-b150-4b41-8987-986ac657558c
ceffdf29-509c-44af-a464-616f6d8a08be	AREA	Shristhal	7d868648-b150-4b41-8987-986ac657558c
ec2536e8-22ab-47eb-bf96-156d9ecde62b	AREA	Nagorcim	7d868648-b150-4b41-8987-986ac657558c
9063f4d0-9a48-4b32-b921-ecb33c98ffb2	AREA	Ponsulem	7d868648-b150-4b41-8987-986ac657558c
9c9e3cab-25d1-4745-8dd1-c714c62cf865	AREA	Galgibaga	7d868648-b150-4b41-8987-986ac657558c
999aeef3-9b9f-4eb6-8831-858fb401ce55	AREA	Patnem	7d868648-b150-4b41-8987-986ac657558c
55b24f48-c1a3-4d57-aa11-31f5cac68838	TALUKA	Dharbandora	de6cbc87-cf3f-452d-b96c-9a88b9ee8650
3b39703c-a112-4a95-91e2-67433ca6199a	AREA	Dharbandora	55b24f48-c1a3-4d57-aa11-31f5cac68838
c2ed7c69-139f-4494-8172-aab81a61d313	AREA	Colem	55b24f48-c1a3-4d57-aa11-31f5cac68838
edf76f8c-e25f-4bd3-902f-acbb53dabd9a	AREA	Mollem	55b24f48-c1a3-4d57-aa11-31f5cac68838
c87e6d9d-5b5d-446d-93b8-55776ced17d2	AREA	Kirlapal	55b24f48-c1a3-4d57-aa11-31f5cac68838
9ac82fcb-0dbd-440e-8ff7-998c58b30de3	AREA	Dabal	55b24f48-c1a3-4d57-aa11-31f5cac68838
963604d2-e897-469e-8062-30e2077632f1	AREA	Sangod	55b24f48-c1a3-4d57-aa11-31f5cac68838
fe12590b-936a-4040-a460-678ef9893cb2	AREA	Sacorda	55b24f48-c1a3-4d57-aa11-31f5cac68838
331ff45b-1da4-4260-bd8b-5068657b8bfc	AREA	Sancordem	55b24f48-c1a3-4d57-aa11-31f5cac68838
3458c94b-000a-4e42-b3d9-e1b31a9a1e44	AREA	Cotombi	43c3dc1c-6ba5-40e9-adfa-35d2a29473e6
\.


--
-- Data for Name: MalariaEpisode; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."MalariaEpisode" (id, "workerId", status, "onsetDate", "createdAt") FROM stdin;
81a0d500-ddf2-4018-a842-7fa5dbb315d5	d214bc04-e5c3-4868-a17d-17448ec2ad1d	SUSPECTED	\N	2026-10-30 11:31:39.25
f282dea4-d5b4-488e-9685-728f7ecf4369	8d4a1a32-de33-45ba-aa28-3998d7df6161	CONFIRMED	\N	2026-11-02 09:35:12.926
a1abae39-117f-48d3-9bbc-68edd746e116	ee27b7b1-a626-4a08-923e-d1c76f7e7d61	RESOLVED	\N	2026-11-02 09:35:12.957
71d1f6a3-cfe9-4fb4-80d7-22bc5241a6c5	da52b214-6959-4f48-b4ef-60604ae3a332	SUSPECTED	\N	2026-11-02 09:35:12.985
4fa9bcc0-0d9f-415b-8ae7-94872fb85ba4	9ea6a322-29e6-4645-821f-1a9195451db5	RESOLVED	2026-11-02 11:42:50.664	2026-11-02 11:42:50.665
8e2cc5ae-e1b3-4946-b267-3e8d971ad533	e2c97c8b-646a-4447-94fd-49611fdebcef	RESOLVED	2026-11-02 11:42:51.148	2026-11-02 11:42:51.149
d1756b6c-1f6e-4987-a657-7614a04a148e	1267008e-abec-4f4d-9d82-acf8b57f220e	RESOLVED	2026-11-02 11:42:51.156	2026-11-02 11:42:51.157
aefb1d5a-3ac5-4e68-bf99-84b39fb7e5b8	f899e85c-0c2c-441d-8d0e-1dea0b06bcb2	RESOLVED	2026-11-02 11:42:51.164	2026-11-02 11:42:51.165
a037eddc-796f-48b3-93d4-63e511130ae8	b3e9ba23-e764-47d0-b5c5-238984485429	RESOLVED	2026-11-02 11:42:51.171	2026-11-02 11:42:51.171
fadec34d-debb-4742-aaf5-3872851a56f5	f3fdfbab-d150-4245-81da-ff82e45cf1f7	CONFIRMED	2026-11-02 11:42:51.177	2026-11-02 11:42:51.178
73349f8d-37df-42c4-b1f3-bb887b585be4	6ac4565c-29c3-45f9-8290-23b2ff86e1e6	CONFIRMED	2026-11-02 11:42:51.185	2026-11-02 11:42:51.186
c411029c-4422-4346-b725-4e9090e821d6	5f46925c-d2b4-42f0-a1a8-151a766b3177	CONFIRMED	2026-11-02 11:42:51.19	2026-11-02 11:42:51.191
0ecc0e5d-6cc6-4444-b14e-eb27d95bd2fe	13d4c39a-b34e-4239-9456-5461b23137f3	CONFIRMED	2026-11-02 11:42:51.196	2026-11-02 11:42:51.196
e65baf2b-70ff-47bd-a02f-d6035e40868e	663d830e-3fb2-4753-b13e-709d78af6f3a	CONFIRMED	2026-11-02 11:42:51.201	2026-11-02 11:42:51.202
\.


--
-- Data for Name: Notification; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."Notification" (id, "audienceRole", "audienceUserId", type, title, body, "entityType", "entityId", "dedupeKey", "readAt", "createdAt") FROM stdin;
50cdbfa7-cf4d-4604-8fa7-b91585ebcf6e	ADMIN	\N	TRAVEL_REPORT_SUBMITTED	Positive-case travel report submitted	Contractor North Goa Builders submitted a travel report for worker M3-TEST-POS-01 departing within 3 days.	TravelReport	8274ce68-7953-4ad7-931e-ec77c596aeb2	demo_travel_notif_1	\N	2026-11-02 07:58:39.643
6504c7a6-033e-4c36-9b63-fd2c0748f474	ADMIN	\N	SITE_JOIN_REQUEST	New worker site join request	Worker M3-TEST-NEG-03 requested to join Panaji Riverfront.	SiteJoinRequest	7f89bb71-5e1a-49cf-bbbf-dd90c196e50d	demo_join_notif_1	\N	2026-11-02 07:58:39.643
89f9fa9a-5be7-482d-9cc5-0afa3e0012dd	ADMIN	\N	ACCOUNT_CREATED	Account created	CONTRACTOR account C000001 created for Apex Coastal Builders. First login requires the temporary PIN to be changed.	User	b80e60d3-c092-4473-8290-1aa2a72c56cc	user_created:b80e60d3-c092-4473-8290-1aa2a72c56cc:role:ADMIN	\N	2026-11-02 08:04:56.588
31c56fbc-33dc-4873-819b-06e53241f960	ADMIN	\N	ACCOUNT_CREATED	Account created	CONTRACTOR account C000002 created for Conflicting Builders. First login requires the temporary PIN to be changed.	User	0165147c-ead6-441d-89c7-a55a6ace7538	user_created:0165147c-ead6-441d-89c7-a55a6ace7538:role:ADMIN	\N	2026-11-02 08:04:57.009
25b6c731-57f7-403c-9c6a-edf27dd47521	ADMIN	\N	ACCOUNT_CREATED	Account created	CONTRACTOR account C000001 created for Apex Coastal Builders. First login requires the temporary PIN to be changed.	User	4dcc3a36-bd3c-4c9c-9cfc-517e57602295	user_created:4dcc3a36-bd3c-4c9c-9cfc-517e57602295:role:ADMIN	\N	2026-11-02 08:06:53.982
7255c8cb-7830-424c-85bf-9635b9d64e1d	ADMIN	\N	ACCOUNT_CREATED	Account created	CONTRACTOR account C000002 created for Conflicting Builders. First login requires the temporary PIN to be changed.	User	cece933d-8149-4d44-94e1-6ca9dfc16a55	user_created:cece933d-8149-4d44-94e1-6ca9dfc16a55:role:ADMIN	\N	2026-11-02 08:06:54.429
ec64886d-a54b-4639-a874-b8dea6d5055a	ADMIN	\N	ACCOUNT_CREATED	Account created	CONTRACTOR account C000001 created for Apex Coastal Builders. First login requires the temporary PIN to be changed.	User	ddb0c3a2-a9d6-4025-9c29-8ddf5658d3c3	user_created:ddb0c3a2-a9d6-4025-9c29-8ddf5658d3c3:role:ADMIN	\N	2026-11-02 08:08:55.775
f161c1bd-db2c-4f05-b728-b87059332446	ADMIN	\N	ACCOUNT_CREATED	Account created	CONTRACTOR account C000001 created for Apex Coastal Builders. First login requires the temporary PIN to be changed.	User	1796e3b2-1fae-451a-a320-9bdff531353d	user_created:1796e3b2-1fae-451a-a320-9bdff531353d:role:ADMIN	\N	2026-11-02 08:09:50.929
00ba22c1-6930-4445-a81a-63e1f0824775	ADMIN	\N	ACCOUNT_CREATED	Account created	CONTRACTOR account C000001 created for Apex Coastal Builders. First login requires the temporary PIN to be changed.	User	8d184988-8b6a-4a06-a19a-587e6a6ed01c	user_created:8d184988-8b6a-4a06-a19a-587e6a6ed01c:role:ADMIN	\N	2026-11-02 08:17:23.779
cbc486e8-eebd-4b76-8cad-f1811b4cc807	ADMIN	\N	ACCOUNT_CREATED	Account created	HEALTH_WORKER account HW000001 created for Dr. Sunita Rao. First login requires the temporary PIN to be changed.	User	bdc998dc-f5c4-4d7b-afb4-be7ef3cc0aeb	user_created:bdc998dc-f5c4-4d7b-afb4-be7ef3cc0aeb:role:ADMIN	\N	2026-11-02 08:17:24.812
a6825ec2-51de-4642-b48a-bf8edf7eeb72	ADMIN	\N	ACCOUNT_CREATED	Account created	CLINICIAN account CL000001 created for Dr. Vikram Naik. First login requires the temporary PIN to be changed.	User	89efe680-bb36-44e8-bcdb-1ab97a199f0d	user_created:89efe680-bb36-44e8-bcdb-1ab97a199f0d:role:ADMIN	\N	2026-11-02 08:17:25.186
2ca00ad1-bba2-45b6-8d7f-d606c6115c03	ADMIN	\N	ACCOUNT_CREATED	Account created	PATHOLOGIST account P000001 created for Dr. Ananya Sen. First login requires the temporary PIN to be changed.	User	672dcec1-8ca1-49df-aa8d-110241482f23	user_created:672dcec1-8ca1-49df-aa8d-110241482f23:role:ADMIN	\N	2026-11-02 08:17:25.557
60322f04-f970-4763-8d85-327167e58d62	ADMIN	\N	ACCOUNT_CREATED	Account created	RESEARCH_LAB account RL000001 created for Goa Vector Research Lab. First login requires the temporary PIN to be changed.	User	acec7475-dcc0-4765-947f-727a858c6346	user_created:acec7475-dcc0-4765-947f-727a858c6346:role:ADMIN	\N	2026-11-02 08:17:25.966
b2906813-ecdb-4e88-9abb-6bbeedec0279	ADMIN	\N	ACCOUNT_CREATED	Account created	CONTRACTOR account C000001 created for Apex Coastal Builders. First login requires the temporary PIN to be changed.	User	afcc0dc7-c062-4cdd-88dd-b736e3a3b641	user_created:afcc0dc7-c062-4cdd-88dd-b736e3a3b641:role:ADMIN	\N	2026-11-02 08:18:28.987
59f9fd57-a922-417a-b271-c0b42cef1475	ADMIN	\N	ACCOUNT_CREATED	Account created	HEALTH_WORKER account HW000001 created for Dr. Sunita Rao. First login requires the temporary PIN to be changed.	User	eee0a193-1e9c-421e-8db9-658030f73aa4	user_created:eee0a193-1e9c-421e-8db9-658030f73aa4:role:ADMIN	\N	2026-11-02 08:18:30.029
8ede4184-c954-4196-a849-56ea74fa9447	ADMIN	\N	ACCOUNT_CREATED	Account created	CLINICIAN account CL000001 created for Dr. Vikram Naik. First login requires the temporary PIN to be changed.	User	4c0c429e-64f3-4f13-a444-222373a8c26f	user_created:4c0c429e-64f3-4f13-a444-222373a8c26f:role:ADMIN	\N	2026-11-02 08:18:30.393
f4ac6e42-3c5f-4fdc-a514-f94f77fb539c	ADMIN	\N	ACCOUNT_CREATED	Account created	PATHOLOGIST account P000001 created for Dr. Ananya Sen. First login requires the temporary PIN to be changed.	User	855b21d5-a541-4fcf-8401-92e4a8c2eaea	user_created:855b21d5-a541-4fcf-8401-92e4a8c2eaea:role:ADMIN	\N	2026-11-02 08:18:30.784
4ab2146e-c053-42e6-a891-b0cbbed2f50c	ADMIN	\N	ACCOUNT_CREATED	Account created	RESEARCH_LAB account RL000001 created for Goa Vector Research Lab. First login requires the temporary PIN to be changed.	User	f5e6b8b8-a016-4e85-96e7-4e41c6ab08be	user_created:f5e6b8b8-a016-4e85-96e7-4e41c6ab08be:role:ADMIN	2026-11-02 08:18:33.377	2026-11-02 08:18:31.185
f6b7a2f8-d3ba-4088-8d14-815913237100	ADMIN	\N	TRAVEL_REPORT_SUBMITTED	Positive-case travel report submitted	A Contractor submitted a travel report for worker M3-POS-01 departing 2026-11-06.	TravelReport	3a227db5-a88d-4a35-985c-20364314dfad	travel_report_submitted:3a227db5-a88d-4a35-985c-20364314dfad:role:ADMIN	\N	2026-11-02 09:49:05.919
50975ce9-0de4-491b-98fb-f40fab2b5316	CLINICIAN	\N	TRAVEL_REPORT_SUBMITTED	Positive-case travel report submitted	A Contractor submitted a travel report for worker M3-POS-01 departing 2026-11-06.	TravelReport	3a227db5-a88d-4a35-985c-20364314dfad	travel_report_submitted:3a227db5-a88d-4a35-985c-20364314dfad:role:CLINICIAN	\N	2026-11-02 09:49:05.919
6aa988db-ec7c-4665-a171-c7bb4019d1c4	CONTRACTOR	afcc0dc7-c062-4cdd-88dd-b736e3a3b641	JOIN_REQUEST	New Site Join Request	Worker Vikram Singh requested to join Mandovi Estuary Project.	JOIN_REQUEST	848c1c34-aea9-432d-8d54-793009d87684	DEMO_JOIN_REQ:848c1c34-aea9-432d-8d54-793009d87684	2026-11-02 11:53:36.049	2026-11-02 09:35:13.091
79dff3f3-b8d4-41e6-b596-d012aac02cb8	CONTRACTOR	afcc0dc7-c062-4cdd-88dd-b736e3a3b641	TRAVEL_ALERT	High-Risk Travel Alert: Positive Worker	Worker Raju Sharma tested positive for Malaria and has scheduled travel to Bihar departing in 4 days.	TRAVEL_RECORD	802edf92-8d5b-446d-906d-cb3712b3c523	DEMO_TRAVEL_ALERT:802edf92-8d5b-446d-906d-cb3712b3c523	2026-11-02 11:53:36.879	2026-11-02 09:35:13.081
3533a912-48bc-44ef-b264-56918ef6ba81	RESEARCH_LAB	\N	TRAVEL_REPORT_SUBMITTED	Positive-case travel report submitted	A Contractor submitted a travel report for worker M3-POS-01 departing 2026-11-06.	TravelReport	3a227db5-a88d-4a35-985c-20364314dfad	travel_report_submitted:3a227db5-a88d-4a35-985c-20364314dfad:role:RESEARCH_LAB	\N	2026-11-02 09:49:05.919
3f8e55a9-baf3-4a8b-9b79-aa3ad2318ad2	CONTRACTOR	afcc0dc7-c062-4cdd-88dd-b736e3a3b641	TRANSFER_REQUEST	Site Transfer Pending Approval	Transfer request for Amit Kumar to Miramar Seaside Complex requires your review.	TRANSFER	1f97a26d-b88e-4987-850e-9c7ef20f0818	DEMO_TRANSFER:1f97a26d-b88e-4987-850e-9c7ef20f0818	2026-11-02 11:53:34.829	2026-11-02 09:35:13.105
a4ef6422-91b7-498e-9b5e-5374d5108e97	ADMIN	\N	TRAVEL_REPORT_SUBMITTED	Positive-case travel report submitted	A Contractor submitted a travel report for worker M3-D06 departing 2026-11-05.	TravelReport	e43bf913-ab79-47da-815f-5f29779609bf	travel_report_submitted:e43bf913-ab79-47da-815f-5f29779609bf:role:ADMIN	\N	2026-11-02 11:56:12.648
435df9ec-19a1-47fb-9309-44ddf50b4b7a	CLINICIAN	\N	TRAVEL_REPORT_SUBMITTED	Positive-case travel report submitted	A Contractor submitted a travel report for worker M3-D06 departing 2026-11-05.	TravelReport	e43bf913-ab79-47da-815f-5f29779609bf	travel_report_submitted:e43bf913-ab79-47da-815f-5f29779609bf:role:CLINICIAN	\N	2026-11-02 11:56:12.648
4fb7248b-2063-44d4-bdcd-37a046c87c3a	RESEARCH_LAB	\N	TRAVEL_REPORT_SUBMITTED	Positive-case travel report submitted	A Contractor submitted a travel report for worker M3-D06 departing 2026-11-05.	TravelReport	e43bf913-ab79-47da-815f-5f29779609bf	travel_report_submitted:e43bf913-ab79-47da-815f-5f29779609bf:role:RESEARCH_LAB	\N	2026-11-02 11:56:12.648
48fcf9ff-f6ea-4bbc-b6be-eca7da6c7bf8	ADMIN	\N	ACCOUNT_CREATED	Account created	CONTRACTOR account C000004 created for test. First login requires the temporary PIN to be changed.	User	eaa6ea89-eb70-444b-b7e4-a01e192dcb73	user_created:eaa6ea89-eb70-444b-b7e4-a01e192dcb73:role:ADMIN	2026-11-03 04:13:31.395	2026-11-03 04:10:19.674
936c3569-cc7d-479d-a7dc-aafa80cb022a	ADMIN	\N	ACCOUNT_CREATED	Account created	CONTRACTOR account C000003 created for Anand Shirodkar. First login requires the temporary PIN to be changed.	User	6b24f4d4-06c3-4546-8f67-9352cd959b9a	user_created:6b24f4d4-06c3-4546-8f67-9352cd959b9a:role:ADMIN	2026-11-03 04:13:32.485	2026-11-03 04:03:15.309
ebbab488-d8f5-4823-8c66-2748470a6404	ADMIN	\N	ACCOUNT_CREATED	Account created	CONTRACTOR account C000005 created for tarun. First login requires the temporary PIN to be changed.	User	3a37ccf3-3e66-450d-880b-786f3ed25818	user_created:3a37ccf3-3e66-450d-880b-786f3ed25818:role:ADMIN	\N	2026-11-03 04:39:22.302
a43eb90f-a468-4c26-b3de-6d18d3785c77	ADMIN	\N	SITE_CONTRACTOR_ASSIGNED	Contractor added to site	Contractor Vikram Dempo (Demo Contractor) was added to construction site Mandovi Estuary Project.	ConstructionSite	SITE-82WUJS	site_contractor_add:SITE-82WUJS:8f87317a-a8b0-4518-932c-87d01c09e762:role:ADMIN	\N	2026-11-03 09:01:19.07
f742ab63-ee16-4320-a9b5-c7b4507c4ae4	WORKER	\N	SITE_ASSIGNMENT	Workforce Assignment Confirmed	You have been directly assigned to the workforce at Mandovi Estuary Project.	WorkerSiteAssignment	8ed04825-f7ed-4d46-b694-75077957b34e	qr_direct_assign:8ed04825-f7ed-4d46-b694-75077957b34e:role:WORKER	\N	2026-11-03 09:01:19.321
610a44d3-3295-4fd3-a8be-63e20863fb1c	\N	848c1c34-aea9-432d-8d54-793009d87684	SITE_ASSIGNMENT	Workforce Assignment Confirmed	You have been directly assigned to the workforce at Mandovi Estuary Project.	WorkerSiteAssignment	8ed04825-f7ed-4d46-b694-75077957b34e	qr_direct_assign:8ed04825-f7ed-4d46-b694-75077957b34e:user:848c1c34-aea9-432d-8d54-793009d87684	\N	2026-11-03 09:01:19.321
25c55816-8256-472a-92f9-c75edf642dd3	ADMIN	\N	SITE_ASSIGNMENT	Worker Assigned via QR	Worker M3-JOIN-01 was directly assigned to site Mandovi Estuary Project.	WorkerSiteAssignment	8ed04825-f7ed-4d46-b694-75077957b34e	admin_qr_direct_assign:8ed04825-f7ed-4d46-b694-75077957b34e:role:ADMIN	\N	2026-11-03 09:01:19.328
c032389f-5718-4b2a-b2a1-a847fa273c7b	WORKER	\N	TRANSFER_REQUEST	Workforce Assignment Request	A contractor has requested to add you to their workforce at Mandovi Estuary Project. Tap to accept or reject.	SiteTransferRequest	c2bad784-e99c-4a72-9fa9-f9dd63014639	qr_assign_req:c2bad784-e99c-4a72-9fa9-f9dd63014639:role:WORKER	\N	2026-11-03 09:01:19.43
b787fb0f-74cb-44f7-89c5-8ff4e8ef0521	\N	8d4a1a32-de33-45ba-aa28-3998d7df6161	TRANSFER_REQUEST	Workforce Assignment Request	A contractor has requested to add you to their workforce at Mandovi Estuary Project. Tap to accept or reject.	SiteTransferRequest	c2bad784-e99c-4a72-9fa9-f9dd63014639	qr_assign_req:c2bad784-e99c-4a72-9fa9-f9dd63014639:user:8d4a1a32-de33-45ba-aa28-3998d7df6161	\N	2026-11-03 09:01:19.43
ee9c0c9b-0867-4d1e-a1ff-9f0a9cdfb31e	ADMIN	\N	TRANSFER_REQUEST	Workforce Assignment Request Submitted	Contractor requested worker M3-POS-01 for site Mandovi Estuary Project.	SiteTransferRequest	c2bad784-e99c-4a72-9fa9-f9dd63014639	admin_qr_assign_req:c2bad784-e99c-4a72-9fa9-f9dd63014639:role:ADMIN	\N	2026-11-03 09:01:19.431
9e61cf27-b436-4ddf-a09e-18b4e1f10a19	ADMIN	\N	TRANSFER_DECISION	Transfer approval stage	Transfer c2bad784-e99c-4a72-9fa9-f9dd63014639 for worker 8d4a1a32-de33-45ba-aa28-3998d7df6161 moved to PENDING_CURRENT_CONTRACTOR after a decision by the worker.	SiteTransferRequest	c2bad784-e99c-4a72-9fa9-f9dd63014639	transfer_decision:c2bad784-e99c-4a72-9fa9-f9dd63014639:worker:PENDING_CURRENT_CONTRACTOR:role:ADMIN	\N	2026-11-03 09:01:19.483
b8a321c1-bc97-43a9-a547-5ec1ffab14a0	ADMIN	\N	TRANSFER_DECISION	Transfer completed	Transfer c2bad784-e99c-4a72-9fa9-f9dd63014639 for worker 8d4a1a32-de33-45ba-aa28-3998d7df6161 moved to ACCEPTED after a decision by the fromContractor.	SiteTransferRequest	c2bad784-e99c-4a72-9fa9-f9dd63014639	transfer_decision:c2bad784-e99c-4a72-9fa9-f9dd63014639:fromContractor:ACCEPTED:role:ADMIN	\N	2026-11-03 09:01:19.506
7fd0cb88-bfc0-415f-abd8-490f81597f12	WORKER	\N	TRANSFER_REQUEST	Workforce Assignment Request	A contractor has requested to add you to their workforce at Mandovi Estuary Project. Tap to accept or reject.	SiteTransferRequest	f6c4db67-1ebd-44d8-b71d-63a8a6ba52a8	qr_assign_req:f6c4db67-1ebd-44d8-b71d-63a8a6ba52a8:role:WORKER	\N	2026-11-03 09:11:44.871
f9bfc16e-98d4-48e6-8741-e74bf48aafff	\N	9ea6a322-29e6-4645-821f-1a9195451db5	TRANSFER_REQUEST	Workforce Assignment Request	A contractor has requested to add you to their workforce at Mandovi Estuary Project. Tap to accept or reject.	SiteTransferRequest	f6c4db67-1ebd-44d8-b71d-63a8a6ba52a8	qr_assign_req:f6c4db67-1ebd-44d8-b71d-63a8a6ba52a8:user:9ea6a322-29e6-4645-821f-1a9195451db5	\N	2026-11-03 09:11:44.871
2cbb3bb1-cde4-4ce8-a1aa-d62c6e65084a	ADMIN	\N	TRANSFER_REQUEST	Workforce Assignment Request Submitted	Contractor requested worker M3-D01 for site Mandovi Estuary Project.	SiteTransferRequest	f6c4db67-1ebd-44d8-b71d-63a8a6ba52a8	admin_qr_assign_req:f6c4db67-1ebd-44d8-b71d-63a8a6ba52a8:role:ADMIN	\N	2026-11-03 09:11:44.875
93e5e31d-448e-4281-a988-f9388f38e9f5	WORKER	\N	SITE_ASSIGNMENT	Workforce Assignment Confirmed	You have been directly assigned to the workforce at Mandovi Estuary Project.	WorkerSiteAssignment	fc680d70-a617-4465-a447-5f70b949ce56	qr_direct_assign:fc680d70-a617-4465-a447-5f70b949ce56:role:WORKER	\N	2026-11-03 09:22:24.529
19386a37-0c2f-4bcf-8c38-6c15ca5b2060	\N	848c1c34-aea9-432d-8d54-793009d87684	SITE_ASSIGNMENT	Workforce Assignment Confirmed	You have been directly assigned to the workforce at Mandovi Estuary Project.	WorkerSiteAssignment	fc680d70-a617-4465-a447-5f70b949ce56	qr_direct_assign:fc680d70-a617-4465-a447-5f70b949ce56:user:848c1c34-aea9-432d-8d54-793009d87684	\N	2026-11-03 09:22:24.529
7945bd1a-7aff-4d43-9eed-c97c5fe24e85	ADMIN	\N	SITE_ASSIGNMENT	Worker Assigned via QR	Worker M3-JOIN-01 was directly assigned to site Mandovi Estuary Project.	WorkerSiteAssignment	fc680d70-a617-4465-a447-5f70b949ce56	admin_qr_direct_assign:fc680d70-a617-4465-a447-5f70b949ce56:role:ADMIN	\N	2026-11-03 09:22:24.536
545f9359-e6bc-42ed-b435-9ef95bd61066	WORKER	\N	TRANSFER_REQUEST	Workforce Assignment Request	A contractor has requested to add you to their workforce at Mandovi Estuary Project. Tap to accept or reject.	SiteTransferRequest	1aa3cc97-05f0-46ab-b0c4-bcf84db259db	qr_assign_req:1aa3cc97-05f0-46ab-b0c4-bcf84db259db:role:WORKER	\N	2026-11-03 09:22:24.653
a7d6f5f8-a564-4b7c-b9bc-ec937ca094ee	\N	8d4a1a32-de33-45ba-aa28-3998d7df6161	TRANSFER_REQUEST	Workforce Assignment Request	A contractor has requested to add you to their workforce at Mandovi Estuary Project. Tap to accept or reject.	SiteTransferRequest	1aa3cc97-05f0-46ab-b0c4-bcf84db259db	qr_assign_req:1aa3cc97-05f0-46ab-b0c4-bcf84db259db:user:8d4a1a32-de33-45ba-aa28-3998d7df6161	\N	2026-11-03 09:22:24.653
951dcd97-ad7e-4859-afc6-9cb861773f3c	ADMIN	\N	TRANSFER_REQUEST	Workforce Assignment Request Submitted	Contractor requested worker M3-POS-01 for site Mandovi Estuary Project.	SiteTransferRequest	1aa3cc97-05f0-46ab-b0c4-bcf84db259db	admin_qr_assign_req:1aa3cc97-05f0-46ab-b0c4-bcf84db259db:role:ADMIN	\N	2026-11-03 09:22:24.655
254d9a87-4569-45fe-8f4b-58242f26e8f3	ADMIN	\N	TRANSFER_DECISION	Transfer approval stage	Transfer 1aa3cc97-05f0-46ab-b0c4-bcf84db259db for worker 8d4a1a32-de33-45ba-aa28-3998d7df6161 moved to PENDING_CURRENT_CONTRACTOR after a decision by the worker.	SiteTransferRequest	1aa3cc97-05f0-46ab-b0c4-bcf84db259db	transfer_decision:1aa3cc97-05f0-46ab-b0c4-bcf84db259db:worker:PENDING_CURRENT_CONTRACTOR:role:ADMIN	\N	2026-11-03 09:22:24.694
56937755-5d2b-432e-a52c-c0fe89879975	ADMIN	\N	TRANSFER_DECISION	Transfer completed	Transfer 1aa3cc97-05f0-46ab-b0c4-bcf84db259db for worker 8d4a1a32-de33-45ba-aa28-3998d7df6161 moved to ACCEPTED after a decision by the fromContractor.	SiteTransferRequest	1aa3cc97-05f0-46ab-b0c4-bcf84db259db	transfer_decision:1aa3cc97-05f0-46ab-b0c4-bcf84db259db:fromContractor:ACCEPTED:role:ADMIN	\N	2026-11-03 09:22:24.717
9a91f4b4-034a-47b2-a5f6-cee60c50c95c	WORKER	\N	SITE_ASSIGNMENT	Workforce Assignment Confirmed	You have been directly assigned to the workforce at Mandovi Estuary Project.	WorkerSiteAssignment	3aa86fcf-69a5-4d61-ab14-b508859c40e1	qr_direct_assign:3aa86fcf-69a5-4d61-ab14-b508859c40e1:role:WORKER	\N	2026-11-03 09:58:20.281
9579974c-0243-41ae-bd8a-ffcd408dc44a	\N	848c1c34-aea9-432d-8d54-793009d87684	SITE_ASSIGNMENT	Workforce Assignment Confirmed	You have been directly assigned to the workforce at Mandovi Estuary Project.	WorkerSiteAssignment	3aa86fcf-69a5-4d61-ab14-b508859c40e1	qr_direct_assign:3aa86fcf-69a5-4d61-ab14-b508859c40e1:user:848c1c34-aea9-432d-8d54-793009d87684	\N	2026-11-03 09:58:20.281
417c31d0-e2f2-46b5-a5b4-1a6c2856e140	ADMIN	\N	SITE_ASSIGNMENT	Worker Assigned via QR	Worker M3-JOIN-01 was directly assigned to site Mandovi Estuary Project.	WorkerSiteAssignment	3aa86fcf-69a5-4d61-ab14-b508859c40e1	admin_qr_direct_assign:3aa86fcf-69a5-4d61-ab14-b508859c40e1:role:ADMIN	\N	2026-11-03 09:58:20.286
72378365-d040-4d27-af6f-42723568c94a	WORKER	\N	TRANSFER_REQUEST	Workforce Assignment Request	A contractor has requested to add you to their workforce at Mandovi Estuary Project. Tap to accept or reject.	SiteTransferRequest	d1c99199-4a73-4156-8b45-94341f78be29	qr_assign_req:d1c99199-4a73-4156-8b45-94341f78be29:role:WORKER	\N	2026-11-03 09:58:20.432
c03200ca-3a43-4b73-8f0e-9cb0fc158076	\N	8d4a1a32-de33-45ba-aa28-3998d7df6161	TRANSFER_REQUEST	Workforce Assignment Request	A contractor has requested to add you to their workforce at Mandovi Estuary Project. Tap to accept or reject.	SiteTransferRequest	d1c99199-4a73-4156-8b45-94341f78be29	qr_assign_req:d1c99199-4a73-4156-8b45-94341f78be29:user:8d4a1a32-de33-45ba-aa28-3998d7df6161	\N	2026-11-03 09:58:20.432
b9b7af60-ac89-41be-a6b6-5135060a49c3	ADMIN	\N	TRANSFER_REQUEST	Workforce Assignment Request Submitted	Contractor requested worker M3-POS-01 for site Mandovi Estuary Project.	SiteTransferRequest	d1c99199-4a73-4156-8b45-94341f78be29	admin_qr_assign_req:d1c99199-4a73-4156-8b45-94341f78be29:role:ADMIN	\N	2026-11-03 09:58:20.434
160969b2-a002-4076-bad3-29ef811d2bd9	ADMIN	\N	TRANSFER_DECISION	Transfer approval stage	Transfer d1c99199-4a73-4156-8b45-94341f78be29 for worker 8d4a1a32-de33-45ba-aa28-3998d7df6161 moved to PENDING_CURRENT_CONTRACTOR after a decision by the worker.	SiteTransferRequest	d1c99199-4a73-4156-8b45-94341f78be29	transfer_decision:d1c99199-4a73-4156-8b45-94341f78be29:worker:PENDING_CURRENT_CONTRACTOR:role:ADMIN	\N	2026-11-03 09:58:20.478
1982809a-6294-43e0-9c5a-d25194c91421	ADMIN	\N	TRANSFER_DECISION	Transfer completed	Transfer d1c99199-4a73-4156-8b45-94341f78be29 for worker 8d4a1a32-de33-45ba-aa28-3998d7df6161 moved to ACCEPTED after a decision by the fromContractor.	SiteTransferRequest	d1c99199-4a73-4156-8b45-94341f78be29	transfer_decision:d1c99199-4a73-4156-8b45-94341f78be29:fromContractor:ACCEPTED:role:ADMIN	\N	2026-11-03 09:58:20.505
a6b7777d-ec1c-4313-96d9-c13eb2b731d0	WORKER	\N	TRANSFER_REQUEST	Workforce Assignment Request	A contractor has requested to add you to their workforce at Mandovi Estuary Project. Tap to accept or reject.	SiteTransferRequest	bbab3b74-46ea-47bd-86be-88764441775e	qr_assign_req:bbab3b74-46ea-47bd-86be-88764441775e:role:WORKER	\N	2026-11-03 09:58:20.575
a50d2c08-4f44-47f8-9b89-fd8d450f9cd5	\N	8d4a1a32-de33-45ba-aa28-3998d7df6161	TRANSFER_REQUEST	Workforce Assignment Request	A contractor has requested to add you to their workforce at Mandovi Estuary Project. Tap to accept or reject.	SiteTransferRequest	bbab3b74-46ea-47bd-86be-88764441775e	qr_assign_req:bbab3b74-46ea-47bd-86be-88764441775e:user:8d4a1a32-de33-45ba-aa28-3998d7df6161	\N	2026-11-03 09:58:20.575
e24d64d5-2cee-4214-af5e-9d7ad38e7b5c	ADMIN	\N	TRANSFER_REQUEST	Workforce Assignment Request Submitted	Contractor requested worker M3-POS-01 for site Mandovi Estuary Project.	SiteTransferRequest	bbab3b74-46ea-47bd-86be-88764441775e	admin_qr_assign_req:bbab3b74-46ea-47bd-86be-88764441775e:role:ADMIN	\N	2026-11-03 09:58:20.579
2a6185c3-a44f-4ca9-942f-690b320a09ec	ADMIN	\N	TRANSFER_DECISION	Transfer declined	Transfer bbab3b74-46ea-47bd-86be-88764441775e for worker 8d4a1a32-de33-45ba-aa28-3998d7df6161 moved to REJECTED after a decision by the worker.	SiteTransferRequest	bbab3b74-46ea-47bd-86be-88764441775e	transfer_decision:bbab3b74-46ea-47bd-86be-88764441775e:worker:REJECTED:role:ADMIN	\N	2026-11-03 09:58:20.603
f067922c-33a1-449c-8269-14c45f07bafb	WORKER	\N	TRANSFER_REQUEST	Workforce Assignment Request	A contractor has requested to add you to their workforce at Mandovi Estuary Project. Tap to accept or reject.	SiteTransferRequest	6937077c-22a8-4ebb-adeb-5205701e416b	qr_assign_req:6937077c-22a8-4ebb-adeb-5205701e416b:role:WORKER	\N	2026-11-03 09:58:20.657
2faae41c-b758-4077-8ac7-c72d40fe7489	\N	8d4a1a32-de33-45ba-aa28-3998d7df6161	TRANSFER_REQUEST	Workforce Assignment Request	A contractor has requested to add you to their workforce at Mandovi Estuary Project. Tap to accept or reject.	SiteTransferRequest	6937077c-22a8-4ebb-adeb-5205701e416b	qr_assign_req:6937077c-22a8-4ebb-adeb-5205701e416b:user:8d4a1a32-de33-45ba-aa28-3998d7df6161	\N	2026-11-03 09:58:20.657
9d45bf6c-2cec-4dfa-a100-ffe687c79bb4	ADMIN	\N	TRANSFER_REQUEST	Workforce Assignment Request Submitted	Contractor requested worker M3-POS-01 for site Mandovi Estuary Project.	SiteTransferRequest	6937077c-22a8-4ebb-adeb-5205701e416b	admin_qr_assign_req:6937077c-22a8-4ebb-adeb-5205701e416b:role:ADMIN	\N	2026-11-03 09:58:20.658
4e8adf6a-d63e-401f-9a06-8d4a258f5e12	WORKER	\N	TRANSFER_REQUEST	Workforce Assignment Request	A contractor has requested to add you to their workforce at Mandovi Estuary Project. Tap to accept or reject.	SiteTransferRequest	70ec2811-9756-4a30-b3e0-88c93e64671a	qr_assign_req:70ec2811-9756-4a30-b3e0-88c93e64671a:role:WORKER	\N	2026-11-03 09:58:20.9
68164d0a-6e0e-4583-aea5-b0ab004e874c	\N	8d4a1a32-de33-45ba-aa28-3998d7df6161	TRANSFER_REQUEST	Workforce Assignment Request	A contractor has requested to add you to their workforce at Mandovi Estuary Project. Tap to accept or reject.	SiteTransferRequest	70ec2811-9756-4a30-b3e0-88c93e64671a	qr_assign_req:70ec2811-9756-4a30-b3e0-88c93e64671a:user:8d4a1a32-de33-45ba-aa28-3998d7df6161	\N	2026-11-03 09:58:20.9
72307777-869b-4c37-8d93-3d37f1712561	ADMIN	\N	TRANSFER_REQUEST	Workforce Assignment Request Submitted	Contractor requested worker M3-POS-01 for site Mandovi Estuary Project.	SiteTransferRequest	70ec2811-9756-4a30-b3e0-88c93e64671a	admin_qr_assign_req:70ec2811-9756-4a30-b3e0-88c93e64671a:role:ADMIN	\N	2026-11-03 09:58:20.902
3dd393b9-b152-447d-9c84-e9ba7c5b628c	ADMIN	\N	TRANSFER_DECISION	Transfer approval stage	Transfer 99ad12b4-301a-4d28-9cac-189720d6712a for worker 8d4a1a32-de33-45ba-aa28-3998d7df6161 moved to PENDING_CURRENT_CONTRACTOR after a decision by the worker.	SiteTransferRequest	99ad12b4-301a-4d28-9cac-189720d6712a	transfer_decision:99ad12b4-301a-4d28-9cac-189720d6712a:worker:PENDING_CURRENT_CONTRACTOR:role:ADMIN	\N	2026-11-03 09:58:47.914
cee0da60-72c3-4e9c-ac99-f6700b4691b3	ADMIN	\N	TRANSFER_DECISION	Transfer completed	Transfer 99ad12b4-301a-4d28-9cac-189720d6712a for worker 8d4a1a32-de33-45ba-aa28-3998d7df6161 moved to ACCEPTED after a decision by the fromContractor.	SiteTransferRequest	99ad12b4-301a-4d28-9cac-189720d6712a	transfer_decision:99ad12b4-301a-4d28-9cac-189720d6712a:fromContractor:ACCEPTED:role:ADMIN	\N	2026-11-03 09:58:47.943
66f4f596-9155-4bf8-92c0-9c4ed3f16580	WORKER	\N	TRANSFER_REQUEST	Workforce Assignment Request	A contractor has requested to add you to their workforce at Mandovi Estuary Project. Tap to accept or reject.	SiteTransferRequest	089245f8-e2bf-4aa1-abdb-1d26a99248d0	qr_assign_req:089245f8-e2bf-4aa1-abdb-1d26a99248d0:role:WORKER	\N	2026-11-03 09:58:47.995
636070e7-76c4-4007-aaa2-ecf5bb1ece89	\N	8d4a1a32-de33-45ba-aa28-3998d7df6161	TRANSFER_REQUEST	Workforce Assignment Request	A contractor has requested to add you to their workforce at Mandovi Estuary Project. Tap to accept or reject.	SiteTransferRequest	089245f8-e2bf-4aa1-abdb-1d26a99248d0	qr_assign_req:089245f8-e2bf-4aa1-abdb-1d26a99248d0:user:8d4a1a32-de33-45ba-aa28-3998d7df6161	\N	2026-11-03 09:58:47.995
bc87295c-8b48-44a3-abcf-8733d870c4b8	ADMIN	\N	TRANSFER_REQUEST	Workforce Assignment Request Submitted	Contractor requested worker M3-POS-01 for site Mandovi Estuary Project.	SiteTransferRequest	089245f8-e2bf-4aa1-abdb-1d26a99248d0	admin_qr_assign_req:089245f8-e2bf-4aa1-abdb-1d26a99248d0:role:ADMIN	\N	2026-11-03 09:58:47.997
376ffebc-f848-46a4-be07-4fe955d430d9	ADMIN	\N	TRANSFER_DECISION	Transfer declined	Transfer 089245f8-e2bf-4aa1-abdb-1d26a99248d0 for worker 8d4a1a32-de33-45ba-aa28-3998d7df6161 moved to REJECTED after a decision by the worker.	SiteTransferRequest	089245f8-e2bf-4aa1-abdb-1d26a99248d0	transfer_decision:089245f8-e2bf-4aa1-abdb-1d26a99248d0:worker:REJECTED:role:ADMIN	\N	2026-11-03 09:58:48.029
52ee6a1a-6343-4b0f-ace5-d0dc8eb2dcf0	WORKER	\N	TRANSFER_REQUEST	Workforce Assignment Request	A contractor has requested to add you to their workforce at Mandovi Estuary Project. Tap to accept or reject.	SiteTransferRequest	7f0a6de5-c4d1-43a6-b682-e3dde7f84fc8	qr_assign_req:7f0a6de5-c4d1-43a6-b682-e3dde7f84fc8:role:WORKER	\N	2026-11-03 09:58:48.079
1dbb0e64-796f-4291-a49e-ac514d9fad48	\N	8d4a1a32-de33-45ba-aa28-3998d7df6161	TRANSFER_REQUEST	Workforce Assignment Request	A contractor has requested to add you to their workforce at Mandovi Estuary Project. Tap to accept or reject.	SiteTransferRequest	7f0a6de5-c4d1-43a6-b682-e3dde7f84fc8	qr_assign_req:7f0a6de5-c4d1-43a6-b682-e3dde7f84fc8:user:8d4a1a32-de33-45ba-aa28-3998d7df6161	\N	2026-11-03 09:58:48.079
96197c93-82f3-4f0c-ab59-8bcf613b5c4e	ADMIN	\N	TRANSFER_REQUEST	Workforce Assignment Request Submitted	Contractor requested worker M3-POS-01 for site Mandovi Estuary Project.	SiteTransferRequest	7f0a6de5-c4d1-43a6-b682-e3dde7f84fc8	admin_qr_assign_req:7f0a6de5-c4d1-43a6-b682-e3dde7f84fc8:role:ADMIN	\N	2026-11-03 09:58:48.082
411e9ca0-43fc-4868-a506-a32f3ced0a6c	WORKER	\N	TRANSFER_REQUEST	Workforce Assignment Request	A contractor has requested to add you to their workforce at Mandovi Estuary Project. Tap to accept or reject.	SiteTransferRequest	373348cd-fc5f-444e-81ba-e8a620c237fc	qr_assign_req:373348cd-fc5f-444e-81ba-e8a620c237fc:role:WORKER	\N	2026-11-03 09:58:48.338
8e75c947-956e-429f-972f-915bc2d20ee9	\N	8d4a1a32-de33-45ba-aa28-3998d7df6161	TRANSFER_REQUEST	Workforce Assignment Request	A contractor has requested to add you to their workforce at Mandovi Estuary Project. Tap to accept or reject.	SiteTransferRequest	373348cd-fc5f-444e-81ba-e8a620c237fc	qr_assign_req:373348cd-fc5f-444e-81ba-e8a620c237fc:user:8d4a1a32-de33-45ba-aa28-3998d7df6161	\N	2026-11-03 09:58:48.338
d22e7332-cd88-47e2-9651-e250c624758c	ADMIN	\N	TRANSFER_REQUEST	Workforce Assignment Request Submitted	Contractor requested worker M3-POS-01 for site Mandovi Estuary Project.	SiteTransferRequest	373348cd-fc5f-444e-81ba-e8a620c237fc	admin_qr_assign_req:373348cd-fc5f-444e-81ba-e8a620c237fc:role:ADMIN	\N	2026-11-03 09:58:48.341
e394d11c-846b-49ed-b1d6-d2dd8bb8a1a5	WORKER	\N	SITE_ASSIGNMENT	Workforce Assignment Confirmed	You have been directly assigned to the workforce at Mandovi Estuary Project.	WorkerSiteAssignment	adfd39b7-f6cb-49f3-a8ee-ab928513f6ae	qr_direct_assign:adfd39b7-f6cb-49f3-a8ee-ab928513f6ae:role:WORKER	\N	2026-11-03 09:58:47.748
35145379-0e06-4259-8388-11d743e4bc8a	\N	848c1c34-aea9-432d-8d54-793009d87684	SITE_ASSIGNMENT	Workforce Assignment Confirmed	You have been directly assigned to the workforce at Mandovi Estuary Project.	WorkerSiteAssignment	adfd39b7-f6cb-49f3-a8ee-ab928513f6ae	qr_direct_assign:adfd39b7-f6cb-49f3-a8ee-ab928513f6ae:user:848c1c34-aea9-432d-8d54-793009d87684	\N	2026-11-03 09:58:47.748
b8f15199-b3b7-4257-92d0-f6d4a3a14611	ADMIN	\N	SITE_ASSIGNMENT	Worker Assigned via QR	Worker M3-JOIN-01 was directly assigned to site Mandovi Estuary Project.	WorkerSiteAssignment	adfd39b7-f6cb-49f3-a8ee-ab928513f6ae	admin_qr_direct_assign:adfd39b7-f6cb-49f3-a8ee-ab928513f6ae:role:ADMIN	\N	2026-11-03 09:58:47.75
41d7acc9-0066-43a0-80cf-8af40f6fe5e6	WORKER	\N	TRANSFER_REQUEST	Workforce Assignment Request	A contractor has requested to add you to their workforce at Mandovi Estuary Project. Tap to accept or reject.	SiteTransferRequest	99ad12b4-301a-4d28-9cac-189720d6712a	qr_assign_req:99ad12b4-301a-4d28-9cac-189720d6712a:role:WORKER	\N	2026-11-03 09:58:47.87
8bc44a49-5eaa-4df1-92a0-b0c1963bf05f	\N	8d4a1a32-de33-45ba-aa28-3998d7df6161	TRANSFER_REQUEST	Workforce Assignment Request	A contractor has requested to add you to their workforce at Mandovi Estuary Project. Tap to accept or reject.	SiteTransferRequest	99ad12b4-301a-4d28-9cac-189720d6712a	qr_assign_req:99ad12b4-301a-4d28-9cac-189720d6712a:user:8d4a1a32-de33-45ba-aa28-3998d7df6161	\N	2026-11-03 09:58:47.87
b9fe2612-383c-493f-b5da-d834e24973d0	ADMIN	\N	TRANSFER_REQUEST	Workforce Assignment Request Submitted	Contractor requested worker M3-POS-01 for site Mandovi Estuary Project.	SiteTransferRequest	99ad12b4-301a-4d28-9cac-189720d6712a	admin_qr_assign_req:99ad12b4-301a-4d28-9cac-189720d6712a:role:ADMIN	\N	2026-11-03 09:58:47.872
d4206f64-60bd-4ddf-b4f0-4c0618639bd0	ADMIN	\N	TRANSFER_DECISION	Transfer approval stage	Transfer 373348cd-fc5f-444e-81ba-e8a620c237fc for worker 8d4a1a32-de33-45ba-aa28-3998d7df6161 moved to PENDING_CURRENT_CONTRACTOR after a decision by the worker.	SiteTransferRequest	373348cd-fc5f-444e-81ba-e8a620c237fc	transfer_decision:373348cd-fc5f-444e-81ba-e8a620c237fc:worker:PENDING_CURRENT_CONTRACTOR:role:ADMIN	\N	2026-11-03 11:27:37.519
\.


--
-- Data for Name: Prescription; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."Prescription" (id, "episodeId", "workerId", details, "issuedAt", "issuedById", "createdAt") FROM stdin;
\.


--
-- Data for Name: SiteJoinRequest; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."SiteJoinRequest" (id, "workerId", "siteId", status, "decidedById", "decidedAt", "createdAt", "updatedAt") FROM stdin;
85c2517b-f403-4531-a89c-0b4372c1af51	848c1c34-aea9-432d-8d54-793009d87684	a308136b-1345-4008-81b1-be0ae09ce9fe	PENDING	\N	\N	2026-11-02 09:35:13.048	2026-11-02 09:35:13.048
\.


--
-- Data for Name: SiteTransferRequest; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."SiteTransferRequest" (id, "workerId", "fromSiteId", "toSiteId", "initiatorType", "initiatorId", status, "workerDecision", "workerDecisionAt", "fromContractorDecision", "fromContractorDecisionAt", "toContractorDecision", "toContractorDecisionAt", "cancelledById", "cancelledAt", "effectiveAt", note, "createdAt", "updatedAt", "fromContractorId", "toContractorId") FROM stdin;
d2e8a49e-4a94-41f2-adc6-091f148894b4	2ec7835e-d53c-4b23-9ffb-c583a6e84fd7	445b4b1f-eb76-4075-a062-9dd0407c149e	18774408-09f3-47c5-ba44-a3c69af52d6d	WORKER	939038bf-ee3a-4d23-8d6c-cd9b1fe224b1	PENDING_CURRENT_CONTRACTOR	APPROVED	2026-10-30 10:30:49.775	PENDING	\N	PENDING	\N	\N	\N	\N	\N	2026-10-30 10:30:49.776	2026-10-30 10:30:49.776	\N	\N
f7d7c787-b589-409e-80a8-dc6b2478de00	1ec4187f-7e06-4ca1-bb21-4626e25012f0	445b4b1f-eb76-4075-a062-9dd0407c149e	18774408-09f3-47c5-ba44-a3c69af52d6d	WORKER	e3737134-7776-41c5-91a7-709f4e0e7b60	PENDING_CURRENT_CONTRACTOR	APPROVED	2026-10-31 07:39:05.978	PENDING	\N	PENDING	\N	\N	\N	\N	\N	2026-10-31 07:39:05.98	2026-10-31 07:39:05.98	\N	\N
1f97a26d-b88e-4987-850e-9c7ef20f0818	ee27b7b1-a626-4a08-923e-d1c76f7e7d61	a308136b-1345-4008-81b1-be0ae09ce9fe	d127d9e7-37a7-4887-b201-190db400969a	CONTRACTOR	afcc0dc7-c062-4cdd-88dd-b736e3a3b641	PENDING_CURRENT_CONTRACTOR	APPROVED	\N	PENDING	\N	PENDING	\N	\N	\N	\N	Relocation to Miramar site for scaffolding	2026-11-02 09:35:13.066	2026-11-02 09:35:13.066	\N	\N
f6c4db67-1ebd-44d8-b71d-63a8a6ba52a8	9ea6a322-29e6-4645-821f-1a9195451db5	0340a99e-f09f-4616-aa2d-b474f933e072	a308136b-1345-4008-81b1-be0ae09ce9fe	CONTRACTOR	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	PENDING_WORKER_RESPONSE	PENDING	\N	PENDING	\N	APPROVED	2026-11-03 09:11:44.853	\N	\N	\N	\N	2026-11-03 09:11:44.864	2026-11-03 09:11:44.864	8f87317a-a8b0-4518-932c-87d01c09e762	8b0412cf-64b0-46a6-9ef4-b42edbf0005e
99ad12b4-301a-4d28-9cac-189720d6712a	8d4a1a32-de33-45ba-aa28-3998d7df6161	a308136b-1345-4008-81b1-be0ae09ce9fe	a308136b-1345-4008-81b1-be0ae09ce9fe	CONTRACTOR	8f87317a-a8b0-4518-932c-87d01c09e762	ACCEPTED	APPROVED	2026-11-03 09:58:47.91	APPROVED	2026-11-03 09:58:47.933	APPROVED	2026-11-03 09:58:47.862	\N	\N	2026-11-03 09:58:47.933	Transfer to Vikram Dempo team	2026-11-03 09:58:47.867	2026-11-03 09:58:47.938	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	8f87317a-a8b0-4518-932c-87d01c09e762
089245f8-e2bf-4aa1-abdb-1d26a99248d0	8d4a1a32-de33-45ba-aa28-3998d7df6161	a308136b-1345-4008-81b1-be0ae09ce9fe	a308136b-1345-4008-81b1-be0ae09ce9fe	CONTRACTOR	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	REJECTED	REJECTED	2026-11-03 09:58:48.021	PENDING	\N	APPROVED	2026-11-03 09:58:47.985	\N	\N	\N	\N	2026-11-03 09:58:47.989	2026-11-03 09:58:48.022	8f87317a-a8b0-4518-932c-87d01c09e762	8b0412cf-64b0-46a6-9ef4-b42edbf0005e
7f0a6de5-c4d1-43a6-b682-e3dde7f84fc8	8d4a1a32-de33-45ba-aa28-3998d7df6161	a308136b-1345-4008-81b1-be0ae09ce9fe	a308136b-1345-4008-81b1-be0ae09ce9fe	CONTRACTOR	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	CANCELLED	PENDING	\N	PENDING	\N	APPROVED	2026-11-03 09:58:48.072	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	2026-11-03 09:58:48.1	\N	\N	2026-11-03 09:58:48.076	2026-11-03 09:58:48.1	8f87317a-a8b0-4518-932c-87d01c09e762	8b0412cf-64b0-46a6-9ef4-b42edbf0005e
373348cd-fc5f-444e-81ba-e8a620c237fc	8d4a1a32-de33-45ba-aa28-3998d7df6161	a308136b-1345-4008-81b1-be0ae09ce9fe	a308136b-1345-4008-81b1-be0ae09ce9fe	CONTRACTOR	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	PENDING_CURRENT_CONTRACTOR	APPROVED	2026-11-03 11:27:37.512	PENDING	\N	APPROVED	2026-11-03 09:58:48.325	\N	\N	\N	\N	2026-11-03 09:58:48.328	2026-11-03 11:27:37.514	8f87317a-a8b0-4518-932c-87d01c09e762	8b0412cf-64b0-46a6-9ef4-b42edbf0005e
\.


--
-- Data for Name: SymptomReport; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."SymptomReport" (id, "workerId", "episodeId", symptoms, note, "createdAt", "voiceData") FROM stdin;
3ca8ca53-890c-4c1a-9ede-92a6c20cd476	2ec7835e-d53c-4b23-9ffb-c583a6e84fd7	\N	["headache"]	\N	2026-10-30 09:44:25.22	\N
170ee8c2-d3c3-4374-8869-3b9efb13e2e0	2ec7835e-d53c-4b23-9ffb-c583a6e84fd7	\N	["chills"]	\N	2026-10-30 10:31:11.67	\N
a40bdc9f-d628-46ca-a0d5-39280cee1884	1ec4187f-7e06-4ca1-bb21-4626e25012f0	\N	["body_ache"]	\N	2026-10-31 07:40:40.747	\N
3140a21a-1bb2-4432-88de-ac2e4b628e65	160f6d93-c491-49d9-85e5-dad04ef070fd	\N	[]	\N	2026-10-31 09:48:01.762	file:///data/user/0/org.m3.surveillance/cache/Audio/recording-f01ce351-d5f7-465d-991e-007057494670.m4a
c4ea6575-1e5b-4773-8c28-96300cea04b1	160f6d93-c491-49d9-85e5-dad04ef070fd	\N	["headache"]	\N	2026-10-31 09:50:07.131	file:///data/user/0/org.m3.surveillance/cache/Audio/recording-30ec52a5-7a0a-469d-b825-924773c986ad.m4a
\.


--
-- Data for Name: TravelRecord; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."TravelRecord" (id, "workerId", "planningTravel", "departureDate", "returnDate", destination, state, "hadFeverOrMalaria", "treatmentGiven", "completedCourse", "treatmentPlace", status, "createdAt", "updatedAt") FROM stdin;
dd83605a-8b1b-434f-af86-bb0bd6f3db20	160f6d93-c491-49d9-85e5-dad04ef070fd	t	2028-12-31 00:00:00	2028-12-31 00:00:00	Patna	Bihar^	t	f	f	\N	SUBMITTED	2026-10-31 09:46:03.657	2026-10-31 09:46:03.657
802edf92-8d5b-446d-906d-cb3712b3c523	8d4a1a32-de33-45ba-aa28-3998d7df6161	f	2026-11-06 09:35:12.997	2026-11-20 09:35:12.997	Patna Junction	Bihar	f	f	f	\N	PLANNED	2026-11-02 09:35:13.001	2026-11-02 09:35:13.001
cb8ea80e-ebf4-466b-be9d-491b98bbd7c3	f3fdfbab-d150-4245-81da-ff82e45cf1f7	t	2026-11-05 11:42:51.18	2026-11-20 11:42:51.18	Patna	Bihar	f	f	f	\N	PLANNED	2026-11-02 11:42:51.181	2026-11-02 11:42:51.181
\.


--
-- Data for Name: TravelReport; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."TravelReport" (id, "travelRecordId", "workerId", "departureDate", "destinationState", reason, status, "reviewNote", "reviewedById", "reviewedAt", "submittedByContractorId", "createdAt", "updatedAt") FROM stdin;
3a227db5-a88d-4a35-985c-20364314dfad	802edf92-8d5b-446d-906d-cb3712b3c523	8d4a1a32-de33-45ba-aa28-3998d7df6161	2026-11-06 09:35:12.997	Bihar	Worker confirmed positive for malaria and traveling home. Full medication course provided.	OPEN	\N	\N	\N	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	2026-11-02 09:49:05.913	2026-11-02 09:49:05.913
e43bf913-ab79-47da-815f-5f29779609bf	cb8ea80e-ebf4-466b-be9d-491b98bbd7c3	f3fdfbab-d150-4245-81da-ff82e45cf1f7	2026-11-05 11:42:51.18	Bihar	Worker completed antimalarial regimen. Informed health supervisor.	OPEN	\N	\N	\N	8f87317a-a8b0-4518-932c-87d01c09e762	2026-11-02 11:56:12.643	2026-11-02 11:56:12.643
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."User" (id, role, "displayName", username, "passwordHash", phone, "pinHash", "workerId", "contractorId", "createdAt", "updatedAt", "stakeholderCode", "mustChangeCredential", active) FROM stdin;
9d10296a-b6c2-44da-af1f-d84be00beb38	WORKER	Atreya	\N	\N	7744020601	$2a$10$o9IflLy/7cwXEuM4Ct0xy.KVbGMfMWpSTy.4ShRYgHWO/1zkv5VtW	3412eb86-5df0-4031-9f33-d24708f16559	\N	2026-10-30 09:49:17.18	2026-10-30 09:49:17.18	\N	f	t
939038bf-ee3a-4d23-8d6c-cd9b1fe224b1	WORKER	Asha Demo	\N	\N	9000000001	$2a$10$dfkuqFp86Bpt7zccnReIy.LAGA7Drn77p1UhgkLCukMRULmwGHH3q	2ec7835e-d53c-4b23-9ffb-c583a6e84fd7	\N	2026-10-30 09:07:45.144	2026-10-30 09:07:45.144	\N	f	t
4d153c78-a255-4628-bf3f-f9655dceee72	RESEARCH_LAB	Demo Research Lab	researchlab	$2a$10$nJqOKoZqcqm6Uu6xMsc5uePPu3DdDm6P08RIeJWwPa6s84oUH/3zW	\N	\N	\N	\N	2026-10-30 09:07:44.836	2026-11-02 11:37:58.862	\N	f	t
b910dc48-fd32-4929-b816-f57bd19d23e9	WORKER	Ramesh Kumar	\N	\N	9800000011	$2a$10$GX0ZWiJy5cnScgouPvZlkeuya2OZ7yT0Dw6dJHEEgJa/OE7pwOZP6	9ea6a322-29e6-4645-821f-1a9195451db5	\N	2026-11-02 11:42:50.659	2026-11-02 11:42:50.659	\N	f	t
2f86c02f-4e5c-4f13-8ea1-c6d6f1b8a5b0	WORKER	Local Device Test	\N	\N	9800000099	$2a$10$ZPsFB8qXis42JuNKQvMJzOG8civOQfCn4s0z.wgT4sag8WEjYe0Fe	7e989751-6b32-41c5-b2b3-e3ddb348117e	\N	2026-10-31 07:05:40.77	2026-10-31 07:05:40.77	\N	f	t
e3737134-7776-41c5-91a7-709f4e0e7b60	WORKER	Sib	\N	\N	9090909090	$2a$10$8xtdSNLBOdHDoL9gQSTo..ckr7iCxb10VZiKy9Gbm0BvwT4SkHPRC	1ec4187f-7e06-4ca1-bb21-4626e25012f0	\N	2026-10-31 07:26:38.923	2026-10-31 07:26:38.923	\N	f	t
5691c8f1-f036-4986-a592-5a01dfe4e469	WORKER	Dhudu	\N	\N	3131313313	$2a$10$NuKKPkXbiA7TxKAkfki8QOg6D631b4s9ZHOsVJ.JG6J.43R2UldoS	160f6d93-c491-49d9-85e5-dad04ef070fd	\N	2026-10-31 08:37:09.608	2026-10-31 08:37:09.608	\N	f	t
505b830d-c5bf-4b3f-ac46-82ab0257bde4	WORKER	Suresh Patil	\N	\N	9800000012	$2a$10$GX0ZWiJy5cnScgouPvZlkeuya2OZ7yT0Dw6dJHEEgJa/OE7pwOZP6	e2c97c8b-646a-4447-94fd-49611fdebcef	\N	2026-11-02 11:42:51.144	2026-11-02 11:42:51.144	\N	f	t
6e7e8943-ebbb-49bf-b013-d67c22abf579	WORKER	Ramesh Test	\N	\N	9112233445	$2a$10$qLifxOHeN8OW4GyvMhWse.PwvPe4l4VLmUrDAZLh47TbZSrH/vzJ6	d214bc04-e5c3-4868-a17d-17448ec2ad1d	\N	2026-10-30 10:55:59.139	2026-10-30 10:55:59.139	\N	f	t
2de6c223-eb76-4bcd-80df-59421bb7f64b	CONTRACTOR	North Goa Builders	contractor.north	$2a$10$hvtQsI3QsDtmJNZC9o9.BewHJ82uUq.A3g5IRbFOnx/teVrA4UZoa	\N	\N	\N	11111111-1111-1111-1111-111111111111	2026-10-30 09:07:42.591	2026-11-02 11:37:55.923	\N	f	t
52f7be3a-e9b8-4224-9cdf-c0de83852a31	CONTRACTOR	South Goa Infra	contractor.south	$2a$10$uLF/Osl08ZETG/Dqdx5KfOEhVafCzsZp4byA8DWKrh.h2SskVpxH2	\N	\N	\N	22222222-2222-2222-2222-222222222222	2026-10-30 09:07:43.472	2026-11-02 11:37:56.586	\N	f	t
5cff2c9e-974b-4e43-b78a-36834cf51af8	HEALTH_WORKER	Demo Health Worker	healthworker	$2a$10$AkBoEQz/tnCokSPVabVayONu9AQdQZVdrLTOEGlTPNrRUX1WrN9YS	\N	\N	\N	\N	2026-10-30 09:07:43.704	2026-11-02 11:37:57.42	\N	f	t
4c0c429e-64f3-4f13-a444-222373a8c26f	CLINICIAN	Dr. Vikram Naik	\N	$2a$10$MsXetv5KPAIa0N/uP3Hxk.izbtrej8Oci9vI0jt2/D7RN8.FbNqEu	9822112235	\N	\N	\N	2026-11-02 08:18:30.381	2026-11-02 08:18:30.381	CL000001	t	t
b19a8ebb-5560-4965-978d-7bc36c7aeda3	CLINICIAN	Demo Clinician	clinician	$2a$10$bp2WjBnfGDj8RCn1WXZ7n.8Vq6CQkd0kjhmhZbRfz8yeFcx2JwfJe	\N	\N	\N	\N	2026-10-30 09:07:43.829	2026-11-02 11:37:58.068	\N	f	t
eee0a193-1e9c-421e-8db9-658030f73aa4	HEALTH_WORKER	Dr. Sunita Rao	\N	$2a$10$c0N0ZHqizD3BXe5aoG/7feaJCYBVIrvmiBvG/mUT4EpBauztT0qGe	9822112234	\N	\N	\N	2026-11-02 08:18:30.017	2026-11-02 08:18:30.017	HW000001	t	t
f5e6b8b8-a016-4e85-96e7-4e41c6ab08be	RESEARCH_LAB	Goa Vector Research Lab	\N	$2a$10$KiNNNkL03WcoGvbA06akUOa3gNxX00ebu9cw6L1ykCcEo20XIeYuG	9822112237	\N	\N	\N	2026-11-02 08:18:31.175	2026-11-02 08:18:31.175	RL000001	t	t
ddc27600-128b-4893-b86e-f66254e9f256	WORKER	Amit Kumar (Negative)	\N	\N	9822112232	$2a$10$18mk9s/ciguToaDzMh6U6.pGTurnajjLwtbnYRw/eBUlnwQr4Uhc2	ee27b7b1-a626-4a08-923e-d1c76f7e7d61	\N	2026-11-02 09:34:40.652	2026-11-02 09:34:40.652	\N	f	t
cc1b55af-7aaf-4025-8b34-1f89f4efa41c	PATHOLOGIST	Demo Pathologist	pathologist	$2a$10$uZcjQhrVq6PxjlCM3KcghuJ/JhrRQYl//TonIDU7oDZZz02BWqK7W	\N	\N	\N	\N	2026-10-30 09:07:44.681	2026-11-02 11:37:58.745	\N	f	t
afcc0dc7-c062-4cdd-88dd-b736e3a3b641	CONTRACTOR	Apex Coastal Builders	\N	$2a$10$JN6lJTROYHWKm59qBxoi5.c.igrkg07jlNT7JzaelmTeJtFGjxWgK	9822112233	\N	\N	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	2026-11-02 08:18:28.967	2026-11-02 09:37:56.635	C000001	f	t
3ed0db04-90b4-4e6a-9006-8c113a751110	WORKER	Manoj Sharma	\N	\N	9800000013	$2a$10$GX0ZWiJy5cnScgouPvZlkeuya2OZ7yT0Dw6dJHEEgJa/OE7pwOZP6	1267008e-abec-4f4d-9d82-acf8b57f220e	\N	2026-11-02 11:42:51.152	2026-11-02 11:42:51.152	\N	f	t
5fec75d7-6786-47d0-a3b5-e28fa81c0bd0	WORKER	Rajesh Verma	\N	\N	9800000014	$2a$10$GX0ZWiJy5cnScgouPvZlkeuya2OZ7yT0Dw6dJHEEgJa/OE7pwOZP6	f899e85c-0c2c-441d-8d0e-1dea0b06bcb2	\N	2026-11-02 11:42:51.16	2026-11-02 11:42:51.16	\N	f	t
038b9bce-72df-47bd-a8d4-547ddfb758a6	WORKER	Amit Singh	\N	\N	9800000015	$2a$10$GX0ZWiJy5cnScgouPvZlkeuya2OZ7yT0Dw6dJHEEgJa/OE7pwOZP6	b3e9ba23-e764-47d0-b5c5-238984485429	\N	2026-11-02 11:42:51.167	2026-11-02 11:42:51.167	\N	f	t
bfc03d3c-7418-48b8-a4e9-51513d2b2bde	CONTRACTOR	Vikram Dempo	\N	$2a$10$GQXm4ib71VeY/aonzyFfBeydHJUvjsqGHG0YB29tTA9hhqqph1n0.	9800000001	\N	\N	8f87317a-a8b0-4518-932c-87d01c09e762	2026-11-02 11:42:50.65	2026-11-03 08:56:31.511	C000002	f	t
0ad1ff4d-2f61-437c-8a52-e8ff4b091bea	WORKER	Raju Sharma (Positive)	\N	\N	9822112231	$2a$10$bbXhBBfdXQpyr74H5WeXEeHV20FE3I49Ak1y5hSg7tZnTVjvHTss.	8d4a1a32-de33-45ba-aa28-3998d7df6161	\N	2026-11-02 09:34:40.612	2026-11-03 08:57:58.73	\N	f	t
11e4a072-93c9-47a7-9157-bcca817f2dad	ADMIN	Demo Admin	admin	$2a$10$.y9F4MP.pqZr6nftOE/up.FX7DEXpqlaydXtjNcd5s6q2rUx4MwvS	\N	\N	\N	\N	2026-10-30 09:07:45.01	2026-11-03 08:58:33.245	\N	f	t
855b21d5-a541-4fcf-8401-92e4a8c2eaea	PATHOLOGIST	Dr. Ananya Sen	\N	$2a$10$2Oio4XUVSi8KiddzivbTZu1cptPYqiIgp/SK1bzEIjpDWVld6L96y	9822112236	$2a$10$.Xc2PtXf1POO/hoO7B2jUuKeDS2SXckPXaw/FSWbQy8.IirfxVXmi	848c1c34-aea9-432d-8d54-793009d87684	\N	2026-11-02 08:18:30.774	2026-11-04 03:54:51.972	P000001	t	t
4f00a6fa-b84d-42a4-8476-6bc5a04dc3b0	WORKER	Vikas Yadav	\N	\N	9800000016	$2a$10$GX0ZWiJy5cnScgouPvZlkeuya2OZ7yT0Dw6dJHEEgJa/OE7pwOZP6	f3fdfbab-d150-4245-81da-ff82e45cf1f7	\N	2026-11-02 11:42:51.173	2026-11-02 11:42:51.173	\N	f	t
67e99acf-1b45-40d8-8382-b0d2516c23b9	WORKER	Sunil Das	\N	\N	9800000017	$2a$10$GX0ZWiJy5cnScgouPvZlkeuya2OZ7yT0Dw6dJHEEgJa/OE7pwOZP6	6ac4565c-29c3-45f9-8290-23b2ff86e1e6	\N	2026-11-02 11:42:51.182	2026-11-02 11:42:51.182	\N	f	t
4b893276-61b1-4aa6-b9ae-2543bca79299	WORKER	Anil Mondal	\N	\N	9800000018	$2a$10$GX0ZWiJy5cnScgouPvZlkeuya2OZ7yT0Dw6dJHEEgJa/OE7pwOZP6	5f46925c-d2b4-42f0-a1a8-151a766b3177	\N	2026-11-02 11:42:51.187	2026-11-02 11:42:51.187	\N	f	t
819f91a5-c654-4019-8f3d-3fff48a3d8e7	WORKER	Deepak Roy	\N	\N	9800000019	$2a$10$GX0ZWiJy5cnScgouPvZlkeuya2OZ7yT0Dw6dJHEEgJa/OE7pwOZP6	13d4c39a-b34e-4239-9456-5461b23137f3	\N	2026-11-02 11:42:51.193	2026-11-02 11:42:51.193	\N	f	t
7bf12722-b7d9-497f-b7bb-389670c2a13c	WORKER	Sanjay Gupta	\N	\N	9800000020	$2a$10$GX0ZWiJy5cnScgouPvZlkeuya2OZ7yT0Dw6dJHEEgJa/OE7pwOZP6	663d830e-3fb2-4753-b13e-709d78af6f3a	\N	2026-11-02 11:42:51.198	2026-11-02 11:42:51.198	\N	f	t
6b24f4d4-06c3-4546-8f67-9352cd959b9a	CONTRACTOR	Anand Shirodkar	\N	$2a$10$ekuOgnUdCYExSBQ6kOj1ru/Cdiz9rc2kI98QrMTxkJxl0475Tm4hu	9822400542	\N	\N	af8f9ae5-abe2-43b7-9770-849ede85865f	2026-11-03 04:03:15.29	2026-11-03 04:03:15.29	C000003	t	t
eaa6ea89-eb70-444b-b7e4-a01e192dcb73	CONTRACTOR	test	\N	$2a$10$mt/9m.Y3FCP2xsTg5w.qtuoXc3XLGFlxg4/YjgxDtMzeWQ3Bk.Z/K	9822453198	\N	\N	18fadebd-de28-4ed7-966b-55207a6f4606	2026-11-03 04:10:19.647	2026-11-03 04:12:55.465	C000004	f	t
3a37ccf3-3e66-450d-880b-786f3ed25818	CONTRACTOR	tarun	\N	$2a$10$y2mtQA76Ep0gIb69fM6NTuhaqT5H4Qm8oWmrJJ3VSSumEZf3x4R1G	1123665498	\N	\N	df86cf83-4518-436a-bb7c-380a9a6d1d8b	2026-11-03 04:39:22.289	2026-11-03 04:40:08.819	C000005	f	t
07452e3a-7d30-4d0c-84a3-cee7ab101077	WORKER	New Mobile Worker	\N	\N	9757642282	$2a$10$8K0AOr34kih88jSGfk4KoONov9bgyF1JPaEB82snUHfA8M9XIHKDO	43ab44f2-f1a4-4f88-823d-8b35433665e8	\N	2026-11-04 03:53:50.971	2026-11-04 03:53:50.971	\N	f	t
961eba75-e0e0-44b9-97d9-8f7ca1a567e9	WORKER	New Mobile Worker	\N	\N	9795879165	$2a$10$htJbOi39Hgvw1b/isZcMu.j.sQqn0fvMwhwE507uTBmF.eQvCDBo.	b316b76f-dc93-4b85-a3fb-8ede67c72109	\N	2026-11-04 03:55:37.816	2026-11-04 03:55:37.816	\N	f	t
c2427344-0394-42e4-8d09-dafd5c97d073	WORKER	New Mobile Worker	\N	\N	9746181917	$2a$10$WCZmvxyHyXdW870S17mPzuTs7jrw0LOd40wrQMCrv6f9GtdJDfxnC	c52d1677-66d8-4271-a6ca-22f257b7f0d3	\N	2026-11-04 03:57:27.188	2026-11-04 03:57:27.188	\N	f	t
152facab-c9d5-42b4-838a-293e44422a25	WORKER	New Mobile Worker	\N	\N	9763363327	$2a$10$Dm0ZrlRcv/YDW9JTU7sRzuyQrfQbBmfcSM69w88QvtQZsUAPT2E2S	419be1f0-c848-4de6-a675-087959ef445b	\N	2026-11-04 03:58:00.261	2026-11-04 03:58:00.261	\N	f	t
\.


--
-- Data for Name: Worker; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."Worker" (id, "workerCode", name, phone, "preferredLanguage", "createdAt", "updatedAt") FROM stdin;
d214bc04-e5c3-4868-a17d-17448ec2ad1d	M3-TH8NMU	Ramesh Test	9112233445	en	2026-10-30 10:55:59.139	2026-10-30 10:55:59.139
7e989751-6b32-41c5-b2b3-e3ddb348117e	M3-8YZTWY	Local Device Test	9800000099	en	2026-10-31 07:05:40.77	2026-10-31 07:05:40.77
1ec4187f-7e06-4ca1-bb21-4626e25012f0	M3-EAEGYD	Sib	9090909090	en	2026-10-31 07:26:38.923	2026-10-31 07:26:38.923
160f6d93-c491-49d9-85e5-dad04ef070fd	M3-59K8W4	Dhudu	3131313313	en	2026-10-31 08:37:09.608	2026-10-31 08:37:09.608
b316b76f-dc93-4b85-a3fb-8ede67c72109	M3-YPBD7A	New Mobile Worker	9795879165	en	2026-11-04 03:55:37.816	2026-11-04 03:55:37.816
c52d1677-66d8-4271-a6ca-22f257b7f0d3	M3-MM4SSZ	New Mobile Worker	9746181917	en	2026-11-04 03:57:27.188	2026-11-04 03:57:27.188
419be1f0-c848-4de6-a675-087959ef445b	M3-FCDVEG	New Mobile Worker	9763363327	en	2026-11-04 03:58:00.261	2026-11-04 03:58:00.261
2ec7835e-d53c-4b23-9ffb-c583a6e84fd7	M3-DEMO01	Asha Demo	9000000001	hi	2026-10-30 09:07:45.144	2026-11-02 04:49:50.885
ee27b7b1-a626-4a08-923e-d1c76f7e7d61	M3-NEG-01	Amit Kumar (Negative)	9822112232	en	2026-11-02 09:34:40.641	2026-11-02 09:35:12.8
da52b214-6959-4f48-b4ef-60604ae3a332	M3-AWT-01	Sunil Yadav (Awaiting)	9822112234	en	2026-11-02 09:34:40.674	2026-11-02 09:35:12.814
7aef5256-8377-4ce8-ba82-5255973576fd	M3-REG-01	Deepak Verma (No Result)	9822112235	en	2026-11-02 09:35:12.839	2026-11-02 09:35:12.839
848c1c34-aea9-432d-8d54-793009d87684	M3-JOIN-01	Vikram Singh (Join Req)	9822112236	en	2026-11-02 09:35:13.016	2026-11-02 09:35:13.016
9ea6a322-29e6-4645-821f-1a9195451db5	M3-D01	Ramesh Kumar	9800000011	en	2026-11-02 11:42:50.659	2026-11-02 11:42:50.659
e2c97c8b-646a-4447-94fd-49611fdebcef	M3-D02	Suresh Patil	9800000012	en	2026-11-02 11:42:51.144	2026-11-02 11:42:51.144
1267008e-abec-4f4d-9d82-acf8b57f220e	M3-D03	Manoj Sharma	9800000013	en	2026-11-02 11:42:51.152	2026-11-02 11:42:51.152
f899e85c-0c2c-441d-8d0e-1dea0b06bcb2	M3-D04	Rajesh Verma	9800000014	en	2026-11-02 11:42:51.16	2026-11-02 11:42:51.16
f3fdfbab-d150-4245-81da-ff82e45cf1f7	M3-D06	Vikas Yadav	9800000016	en	2026-11-02 11:42:51.173	2026-11-02 11:42:51.173
6ac4565c-29c3-45f9-8290-23b2ff86e1e6	M3-D07	Sunil Das	9800000017	en	2026-11-02 11:42:51.182	2026-11-02 11:42:51.182
5f46925c-d2b4-42f0-a1a8-151a766b3177	M3-D08	Anil Mondal	9800000018	en	2026-11-02 11:42:51.187	2026-11-02 11:42:51.187
13d4c39a-b34e-4239-9456-5461b23137f3	M3-D09	Deepak Roy	9800000019	en	2026-11-02 11:42:51.193	2026-11-02 11:42:51.193
663d830e-3fb2-4753-b13e-709d78af6f3a	M3-D10	Sanjay Gupta	9800000020	en	2026-11-02 11:42:51.198	2026-11-02 11:42:51.198
3412eb86-5df0-4031-9f33-d24708f16559	M3-U2ARGS	Atreya	7744020601	en	2026-10-30 09:49:17.18	2026-11-03 04:11:13.085
b3e9ba23-e764-47d0-b5c5-238984485429	M3-D05	Amit Singh	9800000015	en	2026-11-02 11:42:51.167	2026-11-03 04:56:02.879
8d4a1a32-de33-45ba-aa28-3998d7df6161	M3-POS-01	Raju Sharma (Positive)	9822112231	en	2026-11-02 09:34:40.6	2026-11-03 10:02:53.921
43ab44f2-f1a4-4f88-823d-8b35433665e8	M3-LYG9PL	New Mobile Worker	9757642282	en	2026-11-04 03:53:50.971	2026-11-04 03:53:50.971
\.


--
-- Data for Name: WorkerPassToken; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."WorkerPassToken" (id, "tokenHash", "tokenPrefix", "workerId", "expiresAt", "usedAt", "usedById", "revokedAt", "createdAt") FROM stdin;
f8e3aed7-185e-4e14-8009-4eb1a11fe929	e6d6f67c2e5d225636a1a080bda6a941fb65a4235256c8717c623064b10c9c8a	UGpGLLJT	848c1c34-aea9-432d-8d54-793009d87684	2026-11-03 09:06:19.178	2026-11-03 09:01:19.306	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	\N	2026-11-03 09:01:19.185
37a170cb-cff3-41e3-aac1-a3326728dbf7	c8d46d94a8aa0daf41d57eba7d8ffed0c0faf38158305f412786e666f0c3383f	AjEmrxPl	8d4a1a32-de33-45ba-aa28-3998d7df6161	2026-11-03 09:06:19.376	2026-11-03 09:01:19.418	8f87317a-a8b0-4518-932c-87d01c09e762	\N	2026-11-03 09:01:19.379
2ecca2ae-43b5-4532-b00d-6847476841a1	5ff7ceff0285a8b25b53475e830e84346a5d977e5b1abc574d8583b5788aa552	xsZPm7cC	8d4a1a32-de33-45ba-aa28-3998d7df6161	2026-11-03 10:03:20.361	2026-11-03 09:58:20.422	8f87317a-a8b0-4518-932c-87d01c09e762	\N	2026-11-03 09:58:20.365
d726ff27-0ced-46a0-b2ee-5aea88b21203	9e680e38484d60f78e45a73cd66ee2aada224fe61041fa834b716ca8e5e501ac	EvbPeaar	8d4a1a32-de33-45ba-aa28-3998d7df6161	2026-11-03 10:03:20.526	2026-11-03 09:58:20.562	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	\N	2026-11-03 09:58:20.528
4c2c2529-043f-4b4f-bd37-e9819f768871	82510fbc9549bb82ae4072983fbbc5ebf72ddd7c26ffcae153606f1ce0d02829	y8TPWBMo	9ea6a322-29e6-4645-821f-1a9195451db5	2026-11-03 09:15:12.83	2026-11-03 09:11:44.853	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	\N	2026-11-03 09:10:12.833
0f372ff4-e503-4800-a4ab-5d74e81f5f3f	f7ceaca69bdb89d64873d33299a7a675f3d8d914e0a9d619b46b749f3c581349	IwnDBu2o	848c1c34-aea9-432d-8d54-793009d87684	2026-11-03 09:27:24.452	2026-11-03 09:22:24.518	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	\N	2026-11-03 09:22:24.456
3211dac7-9917-42e6-bb6d-51dfc949c305	508a2c798500bab13dc1f5eb1edbe6c72bae42c4aad141e20d44491db2ba6ffd	SDmkew-a	8d4a1a32-de33-45ba-aa28-3998d7df6161	2026-11-03 09:27:24.605	2026-11-03 09:22:24.645	8f87317a-a8b0-4518-932c-87d01c09e762	\N	2026-11-03 09:22:24.607
d582f67c-0be6-492f-9f44-7c4809c33047	e1f9b59a0c555f563f02a9c983440716cb44f57d79f231016545ff5e2499d107	zEnkncdP	848c1c34-aea9-432d-8d54-793009d87684	2026-11-03 10:03:20.176	2026-11-03 09:58:20.269	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	\N	2026-11-03 09:58:20.181
83751193-6a5a-4885-8814-6984eab72880	1c705d17e782783591794aa8b4a8c8b6268c4586de345d81f04984408a49ab21	Qwj-5fR5	8d4a1a32-de33-45ba-aa28-3998d7df6161	2026-11-03 10:03:20.625	2026-11-03 09:58:20.649	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	\N	2026-11-03 09:58:20.627
98f6e701-757b-4b78-a534-f169efedbb87	84a0252f373be450d71f9f81877b5c2be348233d5c375545d06f95e3ed34ec69	gMQnAJLS	8d4a1a32-de33-45ba-aa28-3998d7df6161	2026-11-03 10:03:48.2	\N	\N	2026-11-03 09:58:48.222	2026-11-03 09:58:48.204
beb0b617-5d5e-41d1-abd6-9f99b5e7d693	26965b85b23d74bcd9d34e80030ed652f126b73d6d76203cd8d3f10fe4980074	B4mQjf7U	8d4a1a32-de33-45ba-aa28-3998d7df6161	2026-11-03 10:03:20.842	2026-11-03 09:58:20.888	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	\N	2026-11-03 09:58:20.845
bff50e71-b584-4e1a-ad6c-65ce1d872e46	fc382aa3f247c2977c973f24cff961224c631afbb7946a0e286fa9bce348fa45	AeSKZGtT	848c1c34-aea9-432d-8d54-793009d87684	2026-11-03 10:03:47.686	2026-11-03 09:58:47.74	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	\N	2026-11-03 09:58:47.689
2432f8b5-c0f8-45e9-b1a7-15c323140c2a	bef2ad3f84f03ca6ae6eb885d2b0d8fa016b8b66d74e5b276932052614bce194	iavYIlBz	8d4a1a32-de33-45ba-aa28-3998d7df6161	2026-11-03 10:03:47.823	2026-11-03 09:58:47.862	8f87317a-a8b0-4518-932c-87d01c09e762	\N	2026-11-03 09:58:47.825
7e0c2adf-8737-47dc-bb47-2bfbb73252a9	61b140df069cdb2123e517f4c4419dda34320f5c636fa94277965655aa6d5653	qJVBBip5	8d4a1a32-de33-45ba-aa28-3998d7df6161	2026-11-03 10:03:47.964	2026-11-03 09:58:47.985	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	\N	2026-11-03 09:58:47.966
b35ac86b-0c21-4e1e-8092-76982a8c816a	038f21045be1d0cae3a02bb1c5d7f27428b4eb9c7ec5c75e73c9aafbd1c0772a	-oNfLei4	8d4a1a32-de33-45ba-aa28-3998d7df6161	2026-11-03 10:03:48.05	2026-11-03 09:58:48.072	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	\N	2026-11-03 09:58:48.052
6435c1af-e271-46f4-9dab-0e262a0604a8	5bb3f2330e2190e423a05a22a5bbcc6b13ec155f5dc8d83d5adcdd084c86dabd	5YLaxi7V	8d4a1a32-de33-45ba-aa28-3998d7df6161	2026-11-03 09:58:38.171	\N	\N	2026-11-03 09:58:20.842	2026-11-03 09:58:20.822
0ca8c6bf-050b-4827-af35-4b7a3837a992	8a5f755aa9f84ea16bfc87c98c54803a7c203655bbdcc2434e5017cd14bfa944	JH2eQq2v	8d4a1a32-de33-45ba-aa28-3998d7df6161	2026-11-03 09:58:38.171	\N	\N	\N	2026-11-03 09:01:19.539
be2a8c8f-ac24-4ac2-a4d9-8962b4fb84b9	c9c219c264dfe4767961be3924fbaf2cd4cbb91060a67ca002f285eb6935de79	0gXmJJEU	8d4a1a32-de33-45ba-aa28-3998d7df6161	2026-11-03 09:58:38.171	\N	\N	2026-11-03 09:01:19.613	2026-11-03 09:01:19.59
5425a9e1-d756-4db8-8962-1cea769263ca	aa3b1cf9562c07ffd5ec77cc13b0daf35efce398d4255092748d6d19760921f6	FEv14pCL	8d4a1a32-de33-45ba-aa28-3998d7df6161	2026-11-03 09:58:38.171	\N	\N	2026-11-03 09:02:47.731	2026-11-03 09:01:19.651
13cf8628-915a-4fc8-a4b6-bd201c40e127	fe70a92b41a3ebd201ce5db41ce71e50087e5a795ea826f46bbac4b3a6511512	cFonnouw	8d4a1a32-de33-45ba-aa28-3998d7df6161	2026-11-03 09:58:38.171	\N	\N	2026-11-03 09:07:00.535	2026-11-03 09:02:47.743
22b0e1d2-57b6-41b6-80d5-f35044ad3c8c	803d434d876cc65789477a5e4d37d25bc90d134b242d3193304bcbabbe9d3b51	JmQx1XNg	8d4a1a32-de33-45ba-aa28-3998d7df6161	2026-11-03 09:58:38.171	\N	\N	2026-11-03 09:09:02.739	2026-11-03 09:07:00.547
dacc2006-a2f9-4f5e-958a-f0634290fc51	3979b69e16cf3ee7ba840a4cd80c298c8a078551f3b6b19f1886289048f07968	ZgWV8rIn	8d4a1a32-de33-45ba-aa28-3998d7df6161	2026-11-03 09:58:38.171	\N	\N	\N	2026-11-03 09:09:02.82
cc07aaef-b4e6-4292-886e-5e192cb97448	692b01d5da0ca91cc439548547fe57a043b81257fd03cae5e46d2974e2d1c651	pm5dhwYj	8d4a1a32-de33-45ba-aa28-3998d7df6161	2026-11-03 09:58:38.171	\N	\N	\N	2026-11-03 09:22:24.754
b251addc-c0f8-4184-9015-36dc06a54a39	b41f91b5615ae29fc33ff0c56732d70db2593ed52361a3895dd191bea3f7418f	hYuNqvZO	8d4a1a32-de33-45ba-aa28-3998d7df6161	2026-11-03 10:03:48.264	\N	\N	2026-11-03 09:58:48.286	2026-11-03 09:58:48.266
2b1797e8-286a-41bd-8850-e9a8573df6e0	b04edea77ff4b64a981b6fcf359d17626c1621a52d9b30dcf68e70383b189e55	voEkUtx3	8d4a1a32-de33-45ba-aa28-3998d7df6161	2026-11-03 10:03:48.286	2026-11-03 09:58:48.325	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	\N	2026-11-03 09:58:48.289
31d4c2bb-61ee-462f-b475-0cbeaac6f30f	e001a29f808f4acf1bae9097bbcd15e10d205bd7b0a8e247ca141e704217f0b6	YY-_4m6x	8d4a1a32-de33-45ba-aa28-3998d7df6161	2026-11-03 09:58:38.171	\N	\N	2026-11-03 09:22:24.824	2026-11-03 09:22:24.801
23c578b1-6152-4fdc-924d-31a075cf5438	30720762a02bc262a38b40e2f9e786780c323568d0b4cd8fa0971dd3c10a6a88	EsW_pTpM	8d4a1a32-de33-45ba-aa28-3998d7df6161	2026-11-03 09:58:38.171	\N	\N	\N	2026-11-03 09:22:24.861
56161a58-a690-4757-aba3-f49db660fa3c	3781efcf7192680d7fdafce6344e0dcd0073416e18b0be2a6dfaec6d476fc1b7	Lamph14W	8d4a1a32-de33-45ba-aa28-3998d7df6161	2026-11-03 09:58:38.171	\N	\N	\N	2026-11-03 09:58:20.716
21f25dc8-0eda-4386-b252-83fc0388136c	c8ca7e229ad5e7cdb91b4bf0d950d4b3df29edce9be471c45b2ec06ef4026a35	1yanE-OC	8d4a1a32-de33-45ba-aa28-3998d7df6161	2026-11-03 09:58:38.171	\N	\N	2026-11-03 09:58:20.768	2026-11-03 09:58:20.753
ad27830f-1811-42ac-b701-27de07db26ee	66b3b29f81e19ebaf4b70d61bb90ff6acdf61a94d207ec8be5f44b6b5fe5ca24	DV6_1-Q0	8d4a1a32-de33-45ba-aa28-3998d7df6161	2026-11-03 09:58:38.171	\N	\N	\N	2026-11-03 09:58:48.151
68a4cf4b-9cc3-42d5-9eae-898bcb274e49	83511bab2568d0a3a2ec97fe8a85d13ea14fad466d53a88f098e5cf0ec78a4a3	cqqDaU_7	8d4a1a32-de33-45ba-aa28-3998d7df6161	2026-11-03 10:08:16.088	\N	\N	\N	2026-11-03 10:03:16.092
10e66b22-cda7-40ea-84fb-a41614e5b436	047b5d0e617c2e7d25e53b4bcf9efaa1b4243a6808fdac5d23bd6fe10882a592	u4zPLZaC	8d4a1a32-de33-45ba-aa28-3998d7df6161	2026-11-03 10:40:32.836	\N	\N	\N	2026-11-03 10:35:32.839
6ace1823-eb62-432d-af9c-9ee3d591f4e2	c6efa54cf1be40b54d89b8712753f7533bbe700049835586a87986e904c352c6	WoKgYI0a	8d4a1a32-de33-45ba-aa28-3998d7df6161	2026-11-03 11:32:13.004	\N	\N	2026-11-03 11:27:31.11	2026-11-03 11:27:13.026
c32376ee-605f-4d01-b90a-0935c5b7524e	c116ca30163a17105e7e423f31c064bd9f7a7f60fc17ea985a642f32e8eeaf7a	jnX4rVmi	8d4a1a32-de33-45ba-aa28-3998d7df6161	2026-11-03 11:32:31.11	\N	\N	2026-11-03 11:29:26.619	2026-11-03 11:27:31.115
293adc4a-7332-498c-b3bf-2fab9d46115e	86580641a86d8a713b9686ddaaaba7c787fb5fe603e879d0262c8eeb55562f37	VUIECtHL	8d4a1a32-de33-45ba-aa28-3998d7df6161	2026-11-03 11:34:26.619	\N	\N	\N	2026-11-03 11:29:26.624
19463052-ab3b-4f14-b386-593b34362cf4	c863b0619c4985eba9b80f641319804c54a46d447e5acd8e2b994914a065933c	GPAWCY49	8d4a1a32-de33-45ba-aa28-3998d7df6161	2026-11-04 04:02:27.789	\N	\N	2026-11-04 03:58:00.838	2026-11-04 03:57:27.798
9eba549c-bcc7-4e77-b3a8-a12101a52fdb	ae79c97931bf58c5cc029c851b8b6aea276f430e37c452b300dc50ea2fa6938d	uxN-2PK_	8d4a1a32-de33-45ba-aa28-3998d7df6161	2026-11-04 04:03:00.838	\N	\N	\N	2026-11-04 03:58:00.842
\.


--
-- Data for Name: WorkerSiteAssignment; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."WorkerSiteAssignment" (id, "workerId", "siteId", active, "startedAt", "endedAt", "transferId", "createdAt", "contractorId", status) FROM stdin;
b98ad670-5c87-4711-9f58-9d07ac83794c	1ec4187f-7e06-4ca1-bb21-4626e25012f0	445b4b1f-eb76-4075-a062-9dd0407c149e	t	2026-10-31 07:38:28.265	\N	\N	2026-10-31 07:38:28.265	11111111-1111-1111-1111-111111111111	ACTIVE
79689ea4-820f-435b-89f3-140301c3f671	7e989751-6b32-41c5-b2b3-e3ddb348117e	445b4b1f-eb76-4075-a062-9dd0407c149e	t	2026-10-31 07:18:16.147	\N	\N	2026-10-31 07:18:16.147	11111111-1111-1111-1111-111111111111	ACTIVE
12879ab1-8386-4de7-8679-1d19d2b29683	2ec7835e-d53c-4b23-9ffb-c583a6e84fd7	445b4b1f-eb76-4075-a062-9dd0407c149e	t	2026-10-30 09:07:45.594	\N	\N	2026-10-30 09:07:45.594	11111111-1111-1111-1111-111111111111	ACTIVE
9bbbbd61-089e-4ebc-9bbe-49d0f9ea94ea	160f6d93-c491-49d9-85e5-dad04ef070fd	18774408-09f3-47c5-ba44-a3c69af52d6d	t	2026-10-31 09:41:21.429	\N	\N	2026-10-31 09:41:21.429	11111111-1111-1111-1111-111111111111	ACTIVE
bb8e9403-eb08-4b5e-828e-9905b52efed9	663d830e-3fb2-4753-b13e-709d78af6f3a	0340a99e-f09f-4616-aa2d-b474f933e072	t	2026-11-02 11:42:51.2	\N	\N	2026-11-02 11:42:51.2	8f87317a-a8b0-4518-932c-87d01c09e762	ACTIVE
a9266fac-04b5-417c-9d68-eb45c5a44b61	13d4c39a-b34e-4239-9456-5461b23137f3	0340a99e-f09f-4616-aa2d-b474f933e072	t	2026-11-02 11:42:51.194	\N	\N	2026-11-02 11:42:51.194	8f87317a-a8b0-4518-932c-87d01c09e762	ACTIVE
671d61fb-9551-43c6-9719-fd80234ebe04	5f46925c-d2b4-42f0-a1a8-151a766b3177	0340a99e-f09f-4616-aa2d-b474f933e072	t	2026-11-02 11:42:51.189	\N	\N	2026-11-02 11:42:51.189	8f87317a-a8b0-4518-932c-87d01c09e762	ACTIVE
ff96b221-b0eb-48c1-a584-9b76b8a81598	6ac4565c-29c3-45f9-8290-23b2ff86e1e6	0340a99e-f09f-4616-aa2d-b474f933e072	t	2026-11-02 11:42:51.184	\N	\N	2026-11-02 11:42:51.184	8f87317a-a8b0-4518-932c-87d01c09e762	ACTIVE
37c67f15-463a-4cae-8550-a175124221f7	f3fdfbab-d150-4245-81da-ff82e45cf1f7	0340a99e-f09f-4616-aa2d-b474f933e072	t	2026-11-02 11:42:51.176	\N	\N	2026-11-02 11:42:51.176	8f87317a-a8b0-4518-932c-87d01c09e762	ACTIVE
91ecb9bc-4318-408f-8fea-f0dca1aaddd5	b3e9ba23-e764-47d0-b5c5-238984485429	0340a99e-f09f-4616-aa2d-b474f933e072	t	2026-11-02 11:42:51.169	\N	\N	2026-11-02 11:42:51.169	8f87317a-a8b0-4518-932c-87d01c09e762	ACTIVE
79dfaf16-be97-4616-8b36-165f5d9f7ff6	f899e85c-0c2c-441d-8d0e-1dea0b06bcb2	0340a99e-f09f-4616-aa2d-b474f933e072	t	2026-11-02 11:42:51.162	\N	\N	2026-11-02 11:42:51.162	8f87317a-a8b0-4518-932c-87d01c09e762	ACTIVE
bd52d416-1b76-477e-974d-8e48c053be95	1267008e-abec-4f4d-9d82-acf8b57f220e	0340a99e-f09f-4616-aa2d-b474f933e072	t	2026-11-02 11:42:51.154	\N	\N	2026-11-02 11:42:51.154	8f87317a-a8b0-4518-932c-87d01c09e762	ACTIVE
a9fd92f7-452d-460b-87c7-5e5d2090043f	e2c97c8b-646a-4447-94fd-49611fdebcef	0340a99e-f09f-4616-aa2d-b474f933e072	t	2026-11-02 11:42:51.147	\N	\N	2026-11-02 11:42:51.147	8f87317a-a8b0-4518-932c-87d01c09e762	ACTIVE
f2f67141-3a81-4a7d-a53a-c51395c5251c	9ea6a322-29e6-4645-821f-1a9195451db5	0340a99e-f09f-4616-aa2d-b474f933e072	t	2026-11-02 11:42:50.662	\N	\N	2026-11-02 11:42:50.662	8f87317a-a8b0-4518-932c-87d01c09e762	ACTIVE
60991335-8e7c-480f-a8bc-072f7981b768	3412eb86-5df0-4031-9f33-d24708f16559	7731c797-9f4f-4ef6-a656-e7b867f24024	t	2026-11-03 04:11:26.895	\N	\N	2026-11-03 04:11:26.895	18fadebd-de28-4ed7-966b-55207a6f4606	ACTIVE
aed3980f-b95f-4a27-9d12-c2b2e44188df	7aef5256-8377-4ce8-ba82-5255973576fd	a308136b-1345-4008-81b1-be0ae09ce9fe	t	2026-11-02 09:35:12.91	\N	\N	2026-11-02 09:35:12.91	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	ACTIVE
4912923c-1470-431f-bb2f-25e6b7141283	da52b214-6959-4f48-b4ef-60604ae3a332	a308136b-1345-4008-81b1-be0ae09ce9fe	t	2026-11-02 09:35:12.899	\N	\N	2026-11-02 09:35:12.899	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	ACTIVE
d23aa46c-c2a2-4172-b264-dc9354159145	ee27b7b1-a626-4a08-923e-d1c76f7e7d61	a308136b-1345-4008-81b1-be0ae09ce9fe	t	2026-11-02 09:35:12.886	\N	\N	2026-11-02 09:35:12.886	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	ACTIVE
3aa86fcf-69a5-4d61-ab14-b508859c40e1	848c1c34-aea9-432d-8d54-793009d87684	a308136b-1345-4008-81b1-be0ae09ce9fe	f	2026-11-03 09:58:20.269	2026-11-03 09:58:47.623	\N	2026-11-03 09:58:20.275	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	ENDED
8ed04825-f7ed-4d46-b694-75077957b34e	848c1c34-aea9-432d-8d54-793009d87684	a308136b-1345-4008-81b1-be0ae09ce9fe	f	2026-11-03 09:01:19.306	2026-11-03 09:22:24.4	\N	2026-11-03 09:01:19.312	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	ENDED
fc680d70-a617-4465-a447-5f70b949ce56	848c1c34-aea9-432d-8d54-793009d87684	a308136b-1345-4008-81b1-be0ae09ce9fe	f	2026-11-03 09:22:24.518	2026-11-03 09:58:20.107	\N	2026-11-03 09:22:24.523	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	ENDED
adfd39b7-f6cb-49f3-a8ee-ab928513f6ae	848c1c34-aea9-432d-8d54-793009d87684	a308136b-1345-4008-81b1-be0ae09ce9fe	t	2026-11-03 09:58:47.74	\N	\N	2026-11-03 09:58:47.745	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	ACTIVE
83a1f90a-fef8-472e-bb73-25243aaa633f	8d4a1a32-de33-45ba-aa28-3998d7df6161	a308136b-1345-4008-81b1-be0ae09ce9fe	f	2026-11-03 09:58:47.786	2026-11-03 09:58:47.933	\N	2026-11-03 09:58:47.787	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	TRANSFERRED
1e44c784-e40a-4bf2-b9d6-18b1c9293295	8d4a1a32-de33-45ba-aa28-3998d7df6161	a308136b-1345-4008-81b1-be0ae09ce9fe	f	2026-11-03 09:58:47.933	2026-11-03 09:58:48.378	99ad12b4-301a-4d28-9cac-189720d6712a	2026-11-03 09:58:47.936	8f87317a-a8b0-4518-932c-87d01c09e762	ENDED
a5bc8a09-a5b5-4eda-a876-0aa4e9826c9f	8d4a1a32-de33-45ba-aa28-3998d7df6161	a308136b-1345-4008-81b1-be0ae09ce9fe	t	2026-11-03 09:58:48.378	\N	\N	2026-11-03 09:58:48.381	8b0412cf-64b0-46a6-9ef4-b42edbf0005e	ACTIVE
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
4571868e-d79e-49f3-ae20-4b10b26b99f4	8bbdb56ed72e44e0f98db8f18a5c81a73821e1b3178086c416c4419c87ad56a5	2026-10-30 09:07:40.363249+00	20261030074038_init	\N	\N	2026-10-30 09:07:39.566951+00	1
f0a4ac8e-ca8e-4ddc-960e-d53325002440	d1adb6007f96e5e3d516815c2ba85751c5e50c89de940727a83cd5f30f90924b	2026-10-30 09:07:40.419978+00	20261030075000_partial_unique_indexes	\N	\N	2026-10-30 09:07:40.372357+00	1
551b0f6f-7e62-4163-83c3-c4e0251b9e50	7fdab0284da94ac7b0a2fd3b3665f0913f5e8c5cf744cc4bd3dabada8b1a3d4a	2026-10-31 09:20:14.178075+00	20261031092014_add_travel_records_and_voice	\N	\N	2026-10-31 09:20:14.085888+00	1
644eb8d4-9f86-49ac-b7fb-c5552cb4f2cb	39e8d4944e63e57350c4cfaeb838f7d39d874bbb53220cd0a98c88404923edde	2026-11-02 05:42:32.068896+00	20261102090000_admin_module	\N	\N	2026-11-02 05:42:31.813634+00	1
fa9faa89-cc1c-4799-82b6-00dfba8c19a7	0cad3cb75037b599a99a65778070d37af193dbe406a76481d15bbc475358932a	\N	20261102120000_site_landmark_and_contact	A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 20261102120000_site_landmark_and_contact\n\nDatabase error code: 42701\n\nDatabase error:\nERROR: column "landmark" of relation "ConstructionSite" already exists\n\nDbError { severity: "ERROR", parsed_severity: Some(Error), code: SqlState(E42701), message: "column \\"landmark\\" of relation \\"ConstructionSite\\" already exists", detail: None, hint: None, position: None, where_: None, schema: None, table: None, column: None, datatype: None, constraint: None, file: Some("tablecmds.c"), line: Some(7356), routine: Some("check_for_column_name_collision") }\n\n   0: sql_schema_connector::apply_migration::apply_script\n           with migration_name="20261102120000_site_landmark_and_contact"\n             at schema-engine/connectors/sql-schema-connector/src/apply_migration.rs:106\n   1: schema_core::commands::apply_migrations::Applying migration\n           with migration_name="20261102120000_site_landmark_and_contact"\n             at schema-engine/core/src/commands/apply_migrations.rs:91\n   2: schema_core::state::ApplyMigrations\n             at schema-engine/core/src/state.rs:226	2026-11-02 11:37:12.544659+00	2026-11-02 11:36:53.473458+00	0
8c7d9d99-f8f3-44a6-8d2b-6c2bae8d2b4b	0cad3cb75037b599a99a65778070d37af193dbe406a76481d15bbc475358932a	2026-11-02 11:37:12.711041+00	20261102120000_site_landmark_and_contact		\N	2026-11-02 11:37:12.711041+00	0
17a99ac6-a6d8-40b9-a842-ad842da5dd38	b0a69af4e3a06c02374f7d987df0301d8b1e7c63949166e1cc6d1535eaf51c37	2026-11-03 05:35:41.04354+00	20261103060000_workforce_management_and_qr_pass	\N	\N	2026-11-03 05:35:40.763272+00	1
\.


--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


--
-- Name: ConstructionSite ConstructionSite_pkey; Type: CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."ConstructionSite"
    ADD CONSTRAINT "ConstructionSite_pkey" PRIMARY KEY (id);


--
-- Name: ContractorSite ContractorSite_pkey; Type: CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."ContractorSite"
    ADD CONSTRAINT "ContractorSite_pkey" PRIMARY KEY (id);


--
-- Name: Contractor Contractor_pkey; Type: CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."Contractor"
    ADD CONSTRAINT "Contractor_pkey" PRIMARY KEY (id);


--
-- Name: DiagnosticResult DiagnosticResult_pkey; Type: CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."DiagnosticResult"
    ADD CONSTRAINT "DiagnosticResult_pkey" PRIMARY KEY (id);


--
-- Name: FollowUp FollowUp_pkey; Type: CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."FollowUp"
    ADD CONSTRAINT "FollowUp_pkey" PRIMARY KEY (id);


--
-- Name: IdempotencyKey IdempotencyKey_pkey; Type: CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."IdempotencyKey"
    ADD CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY (id);


--
-- Name: InitialScreening InitialScreening_pkey; Type: CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."InitialScreening"
    ADD CONSTRAINT "InitialScreening_pkey" PRIMARY KEY (id);


--
-- Name: LocationNode LocationNode_pkey; Type: CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."LocationNode"
    ADD CONSTRAINT "LocationNode_pkey" PRIMARY KEY (id);


--
-- Name: MalariaEpisode MalariaEpisode_pkey; Type: CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."MalariaEpisode"
    ADD CONSTRAINT "MalariaEpisode_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: Prescription Prescription_pkey; Type: CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."Prescription"
    ADD CONSTRAINT "Prescription_pkey" PRIMARY KEY (id);


--
-- Name: SiteJoinRequest SiteJoinRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."SiteJoinRequest"
    ADD CONSTRAINT "SiteJoinRequest_pkey" PRIMARY KEY (id);


--
-- Name: SiteTransferRequest SiteTransferRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."SiteTransferRequest"
    ADD CONSTRAINT "SiteTransferRequest_pkey" PRIMARY KEY (id);


--
-- Name: SymptomReport SymptomReport_pkey; Type: CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."SymptomReport"
    ADD CONSTRAINT "SymptomReport_pkey" PRIMARY KEY (id);


--
-- Name: TravelRecord TravelRecord_pkey; Type: CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."TravelRecord"
    ADD CONSTRAINT "TravelRecord_pkey" PRIMARY KEY (id);


--
-- Name: TravelReport TravelReport_pkey; Type: CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."TravelReport"
    ADD CONSTRAINT "TravelReport_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: WorkerPassToken WorkerPassToken_pkey; Type: CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."WorkerPassToken"
    ADD CONSTRAINT "WorkerPassToken_pkey" PRIMARY KEY (id);


--
-- Name: WorkerSiteAssignment WorkerSiteAssignment_pkey; Type: CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."WorkerSiteAssignment"
    ADD CONSTRAINT "WorkerSiteAssignment_pkey" PRIMARY KEY (id);


--
-- Name: Worker Worker_pkey; Type: CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."Worker"
    ADD CONSTRAINT "Worker_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: AuditLog_entityType_entityId_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "AuditLog_entityType_entityId_idx" ON public."AuditLog" USING btree ("entityType", "entityId");


--
-- Name: ConstructionSite_areaId_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "ConstructionSite_areaId_idx" ON public."ConstructionSite" USING btree ("areaId");


--
-- Name: ConstructionSite_contractorId_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "ConstructionSite_contractorId_idx" ON public."ConstructionSite" USING btree ("contractorId");


--
-- Name: ConstructionSite_siteCode_key; Type: INDEX; Schema: public; Owner: m3
--

CREATE UNIQUE INDEX "ConstructionSite_siteCode_key" ON public."ConstructionSite" USING btree ("siteCode");


--
-- Name: ContractorSite_active_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "ContractorSite_active_idx" ON public."ContractorSite" USING btree (active);


--
-- Name: ContractorSite_contractorId_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "ContractorSite_contractorId_idx" ON public."ContractorSite" USING btree ("contractorId");


--
-- Name: ContractorSite_contractorId_siteId_key; Type: INDEX; Schema: public; Owner: m3
--

CREATE UNIQUE INDEX "ContractorSite_contractorId_siteId_key" ON public."ContractorSite" USING btree ("contractorId", "siteId");


--
-- Name: ContractorSite_siteId_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "ContractorSite_siteId_idx" ON public."ContractorSite" USING btree ("siteId");


--
-- Name: DiagnosticResult_episodeId_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "DiagnosticResult_episodeId_idx" ON public."DiagnosticResult" USING btree ("episodeId");


--
-- Name: FollowUp_workerId_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "FollowUp_workerId_idx" ON public."FollowUp" USING btree ("workerId");


--
-- Name: IdempotencyKey_scope_key_key; Type: INDEX; Schema: public; Owner: m3
--

CREATE UNIQUE INDEX "IdempotencyKey_scope_key_key" ON public."IdempotencyKey" USING btree (scope, key);


--
-- Name: InitialScreening_workerId_key; Type: INDEX; Schema: public; Owner: m3
--

CREATE UNIQUE INDEX "InitialScreening_workerId_key" ON public."InitialScreening" USING btree ("workerId");


--
-- Name: LocationNode_level_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "LocationNode_level_idx" ON public."LocationNode" USING btree (level);


--
-- Name: LocationNode_parentId_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "LocationNode_parentId_idx" ON public."LocationNode" USING btree ("parentId");


--
-- Name: MalariaEpisode_workerId_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "MalariaEpisode_workerId_idx" ON public."MalariaEpisode" USING btree ("workerId");


--
-- Name: Notification_audienceRole_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "Notification_audienceRole_idx" ON public."Notification" USING btree ("audienceRole");


--
-- Name: Notification_audienceUserId_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "Notification_audienceUserId_idx" ON public."Notification" USING btree ("audienceUserId");


--
-- Name: Notification_createdAt_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "Notification_createdAt_idx" ON public."Notification" USING btree ("createdAt");


--
-- Name: Notification_dedupeKey_key; Type: INDEX; Schema: public; Owner: m3
--

CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON public."Notification" USING btree ("dedupeKey");


--
-- Name: Prescription_episodeId_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "Prescription_episodeId_idx" ON public."Prescription" USING btree ("episodeId");


--
-- Name: Prescription_workerId_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "Prescription_workerId_idx" ON public."Prescription" USING btree ("workerId");


--
-- Name: SiteJoinRequest_siteId_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "SiteJoinRequest_siteId_idx" ON public."SiteJoinRequest" USING btree ("siteId");


--
-- Name: SiteJoinRequest_status_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "SiteJoinRequest_status_idx" ON public."SiteJoinRequest" USING btree (status);


--
-- Name: SiteJoinRequest_workerId_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "SiteJoinRequest_workerId_idx" ON public."SiteJoinRequest" USING btree ("workerId");


--
-- Name: SiteTransferRequest_fromContractorId_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "SiteTransferRequest_fromContractorId_idx" ON public."SiteTransferRequest" USING btree ("fromContractorId");


--
-- Name: SiteTransferRequest_status_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "SiteTransferRequest_status_idx" ON public."SiteTransferRequest" USING btree (status);


--
-- Name: SiteTransferRequest_toContractorId_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "SiteTransferRequest_toContractorId_idx" ON public."SiteTransferRequest" USING btree ("toContractorId");


--
-- Name: SiteTransferRequest_workerId_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "SiteTransferRequest_workerId_idx" ON public."SiteTransferRequest" USING btree ("workerId");


--
-- Name: SymptomReport_workerId_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "SymptomReport_workerId_idx" ON public."SymptomReport" USING btree ("workerId");


--
-- Name: TravelRecord_workerId_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "TravelRecord_workerId_idx" ON public."TravelRecord" USING btree ("workerId");


--
-- Name: TravelReport_status_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "TravelReport_status_idx" ON public."TravelReport" USING btree (status);


--
-- Name: TravelReport_travelRecordId_key; Type: INDEX; Schema: public; Owner: m3
--

CREATE UNIQUE INDEX "TravelReport_travelRecordId_key" ON public."TravelReport" USING btree ("travelRecordId");


--
-- Name: TravelReport_workerId_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "TravelReport_workerId_idx" ON public."TravelReport" USING btree ("workerId");


--
-- Name: User_contractorId_key; Type: INDEX; Schema: public; Owner: m3
--

CREATE UNIQUE INDEX "User_contractorId_key" ON public."User" USING btree ("contractorId");


--
-- Name: User_phone_key; Type: INDEX; Schema: public; Owner: m3
--

CREATE UNIQUE INDEX "User_phone_key" ON public."User" USING btree (phone);


--
-- Name: User_role_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "User_role_idx" ON public."User" USING btree (role);


--
-- Name: User_stakeholderCode_key; Type: INDEX; Schema: public; Owner: m3
--

CREATE UNIQUE INDEX "User_stakeholderCode_key" ON public."User" USING btree ("stakeholderCode");


--
-- Name: User_username_key; Type: INDEX; Schema: public; Owner: m3
--

CREATE UNIQUE INDEX "User_username_key" ON public."User" USING btree (username);


--
-- Name: User_workerId_key; Type: INDEX; Schema: public; Owner: m3
--

CREATE UNIQUE INDEX "User_workerId_key" ON public."User" USING btree ("workerId");


--
-- Name: WorkerPassToken_expiresAt_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "WorkerPassToken_expiresAt_idx" ON public."WorkerPassToken" USING btree ("expiresAt");


--
-- Name: WorkerPassToken_tokenHash_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "WorkerPassToken_tokenHash_idx" ON public."WorkerPassToken" USING btree ("tokenHash");


--
-- Name: WorkerPassToken_tokenHash_key; Type: INDEX; Schema: public; Owner: m3
--

CREATE UNIQUE INDEX "WorkerPassToken_tokenHash_key" ON public."WorkerPassToken" USING btree ("tokenHash");


--
-- Name: WorkerPassToken_workerId_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "WorkerPassToken_workerId_idx" ON public."WorkerPassToken" USING btree ("workerId");


--
-- Name: WorkerSiteAssignment_contractorId_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "WorkerSiteAssignment_contractorId_idx" ON public."WorkerSiteAssignment" USING btree ("contractorId");


--
-- Name: WorkerSiteAssignment_siteId_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "WorkerSiteAssignment_siteId_idx" ON public."WorkerSiteAssignment" USING btree ("siteId");


--
-- Name: WorkerSiteAssignment_workerId_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "WorkerSiteAssignment_workerId_idx" ON public."WorkerSiteAssignment" USING btree ("workerId");


--
-- Name: Worker_phone_idx; Type: INDEX; Schema: public; Owner: m3
--

CREATE INDEX "Worker_phone_idx" ON public."Worker" USING btree (phone);


--
-- Name: Worker_phone_key; Type: INDEX; Schema: public; Owner: m3
--

CREATE UNIQUE INDEX "Worker_phone_key" ON public."Worker" USING btree (phone);


--
-- Name: Worker_workerCode_key; Type: INDEX; Schema: public; Owner: m3
--

CREATE UNIQUE INDEX "Worker_workerCode_key" ON public."Worker" USING btree ("workerCode");


--
-- Name: one_pending_join_request_per_worker; Type: INDEX; Schema: public; Owner: m3
--

CREATE UNIQUE INDEX one_pending_join_request_per_worker ON public."SiteJoinRequest" USING btree ("workerId") WHERE (status = 'PENDING'::public."JoinRequestStatus");


--
-- Name: uq_active_assignment_per_worker; Type: INDEX; Schema: public; Owner: m3
--

CREATE UNIQUE INDEX uq_active_assignment_per_worker ON public."WorkerSiteAssignment" USING btree ("workerId") WHERE (active = true);


--
-- Name: uq_open_transfer_per_worker; Type: INDEX; Schema: public; Owner: m3
--

CREATE UNIQUE INDEX uq_open_transfer_per_worker ON public."SiteTransferRequest" USING btree ("workerId") WHERE (status = ANY (ARRAY['PENDING_WORKER_RESPONSE'::public."TransferStatus", 'PENDING_CURRENT_CONTRACTOR'::public."TransferStatus", 'PENDING_DESTINATION_CONTRACTOR'::public."TransferStatus"]));


--
-- Name: ConstructionSite ConstructionSite_areaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."ConstructionSite"
    ADD CONSTRAINT "ConstructionSite_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES public."LocationNode"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ConstructionSite ConstructionSite_contractorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."ConstructionSite"
    ADD CONSTRAINT "ConstructionSite_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES public."Contractor"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ContractorSite ContractorSite_contractorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."ContractorSite"
    ADD CONSTRAINT "ContractorSite_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES public."Contractor"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ContractorSite ContractorSite_siteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."ContractorSite"
    ADD CONSTRAINT "ContractorSite_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES public."ConstructionSite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DiagnosticResult DiagnosticResult_episodeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."DiagnosticResult"
    ADD CONSTRAINT "DiagnosticResult_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES public."MalariaEpisode"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FollowUp FollowUp_workerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."FollowUp"
    ADD CONSTRAINT "FollowUp_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES public."Worker"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: InitialScreening InitialScreening_workerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."InitialScreening"
    ADD CONSTRAINT "InitialScreening_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES public."Worker"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LocationNode LocationNode_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."LocationNode"
    ADD CONSTRAINT "LocationNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public."LocationNode"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MalariaEpisode MalariaEpisode_workerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."MalariaEpisode"
    ADD CONSTRAINT "MalariaEpisode_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES public."Worker"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Prescription Prescription_episodeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."Prescription"
    ADD CONSTRAINT "Prescription_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES public."MalariaEpisode"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Prescription Prescription_workerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."Prescription"
    ADD CONSTRAINT "Prescription_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES public."Worker"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SiteJoinRequest SiteJoinRequest_siteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."SiteJoinRequest"
    ADD CONSTRAINT "SiteJoinRequest_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES public."ConstructionSite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SiteJoinRequest SiteJoinRequest_workerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."SiteJoinRequest"
    ADD CONSTRAINT "SiteJoinRequest_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES public."Worker"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SiteTransferRequest SiteTransferRequest_fromContractorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."SiteTransferRequest"
    ADD CONSTRAINT "SiteTransferRequest_fromContractorId_fkey" FOREIGN KEY ("fromContractorId") REFERENCES public."Contractor"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SiteTransferRequest SiteTransferRequest_fromSiteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."SiteTransferRequest"
    ADD CONSTRAINT "SiteTransferRequest_fromSiteId_fkey" FOREIGN KEY ("fromSiteId") REFERENCES public."ConstructionSite"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SiteTransferRequest SiteTransferRequest_toContractorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."SiteTransferRequest"
    ADD CONSTRAINT "SiteTransferRequest_toContractorId_fkey" FOREIGN KEY ("toContractorId") REFERENCES public."Contractor"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SiteTransferRequest SiteTransferRequest_toSiteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."SiteTransferRequest"
    ADD CONSTRAINT "SiteTransferRequest_toSiteId_fkey" FOREIGN KEY ("toSiteId") REFERENCES public."ConstructionSite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SiteTransferRequest SiteTransferRequest_workerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."SiteTransferRequest"
    ADD CONSTRAINT "SiteTransferRequest_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES public."Worker"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SymptomReport SymptomReport_workerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."SymptomReport"
    ADD CONSTRAINT "SymptomReport_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES public."Worker"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TravelRecord TravelRecord_workerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."TravelRecord"
    ADD CONSTRAINT "TravelRecord_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES public."Worker"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TravelReport TravelReport_travelRecordId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."TravelReport"
    ADD CONSTRAINT "TravelReport_travelRecordId_fkey" FOREIGN KEY ("travelRecordId") REFERENCES public."TravelRecord"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TravelReport TravelReport_workerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."TravelReport"
    ADD CONSTRAINT "TravelReport_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES public."Worker"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: User User_contractorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES public."Contractor"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: User User_workerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES public."Worker"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WorkerPassToken WorkerPassToken_workerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."WorkerPassToken"
    ADD CONSTRAINT "WorkerPassToken_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES public."Worker"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WorkerSiteAssignment WorkerSiteAssignment_contractorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."WorkerSiteAssignment"
    ADD CONSTRAINT "WorkerSiteAssignment_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES public."Contractor"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WorkerSiteAssignment WorkerSiteAssignment_siteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."WorkerSiteAssignment"
    ADD CONSTRAINT "WorkerSiteAssignment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES public."ConstructionSite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WorkerSiteAssignment WorkerSiteAssignment_workerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3
--

ALTER TABLE ONLY public."WorkerSiteAssignment"
    ADD CONSTRAINT "WorkerSiteAssignment_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES public."Worker"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict wrbrNwYn1xNCn39p4IzeMDwAEMYfiymC9XAqb57HmPHn1KJe2jUK4EgZZcVAzLK

