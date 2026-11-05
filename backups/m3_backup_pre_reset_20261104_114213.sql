--
-- PostgreSQL database dump
--

\restrict HCWI5La2LYY4W9Sfy6TqCnamofleurEFKqpKlqnZuWKBUqzR1TGUF3mMwP9NIFG

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
10712cec-dac8-4b7b-bbc5-2bc85a953459	cc33567b-bc8a-49ec-885f-7f3d414fcc8d	STAKEHOLDER_PIN_CHANGED	User	cc33567b-bc8a-49ec-885f-7f3d414fcc8d	{}	2026-11-04 04:56:04.914
ab3d5910-9be5-48d5-a5b6-e989f5e771ad	409e76f6-4805-464f-ac17-e95a2adcf6bd	STAKEHOLDER_PIN_CHANGED	User	409e76f6-4805-464f-ac17-e95a2adcf6bd	{}	2026-11-04 04:56:05.257
7fe20f51-80e1-46ed-ac79-1973b9e332b7	419a1807-f147-43d0-a931-9998e1fe1e67	WORKER_PASS_GENERATED	WorkerPassToken	DvEL7TLa	{"workerId": "419a1807-f147-43d0-a931-9998e1fe1e67", "expiresAt": "2026-11-04T05:02:29.184Z", "tokenPrefix": "DvEL7TLa"}	2026-11-04 04:57:29.192
53c38aaf-437f-499f-8580-0628c563e65b	b86be46e-b77e-4b9b-8f8e-525c0ecc7e64	SYMPTOM_REPORTED	SymptomReport	386ae7a9-b345-4e85-b225-1d6f209c798e	{"workerId": "419a1807-f147-43d0-a931-9998e1fe1e67"}	2026-11-04 04:58:48.865
022b278b-d964-44b2-8911-45cc36fa7747	\N	INITIAL_SITE_ASSIGNED	WorkerSiteAssignment	e8b41637-2981-4e9c-b52c-0da66504d448	{"siteId": "51e7817c-986e-41e6-acc4-6de663df7e32", "workerId": "d2dc6e23-2c77-47e8-ab79-51b6238f4d61"}	2026-11-04 05:48:43.977
29419355-bf6e-43be-af18-2dce5e1bb044	419a1807-f147-43d0-a931-9998e1fe1e67	WORKER_PASS_GENERATED	WorkerPassToken	GoexSPWL	{"workerId": "419a1807-f147-43d0-a931-9998e1fe1e67", "expiresAt": "2026-11-04T05:01:40.764Z", "tokenPrefix": "GoexSPWL"}	2026-11-04 04:56:40.774
c258356b-8b8d-4490-8dde-53d43568e49d	07417fc5-e757-4e4c-8e96-8ed98c98364f	WORKER_PASS_GENERATED	WorkerPassToken	MlQITcSH	{"workerId": "07417fc5-e757-4e4c-8e96-8ed98c98364f", "expiresAt": "2026-11-04T05:03:04.320Z", "tokenPrefix": "MlQITcSH"}	2026-11-04 04:58:04.324
9397b197-82a1-4406-bba2-a0824e819684	7d8e1e8d-22ee-4ae0-a739-16832dd79309	WORKER_PASS_GENERATED	WorkerPassToken	nLFfG2oF	{"workerId": "7d8e1e8d-22ee-4ae0-a739-16832dd79309", "expiresAt": "2026-11-04T05:03:04.642Z", "tokenPrefix": "nLFfG2oF"}	2026-11-04 04:58:04.645
b2fa7fa3-1fd5-488e-ae92-0671c92c6e5b	11e4a072-93c9-47a7-9157-bcca817f2dad	DEMO_DATA_RESET	System	demo-dataset	{"siteCode": "SITE-DEMO01", "workersCount": 10, "contractorCode": "C000003"}	2026-11-04 06:04:15.46
340e5b56-fba6-4e9b-adcc-33c403d24788	07417fc5-e757-4e4c-8e96-8ed98c98364f	WORKER_PASS_GENERATED	WorkerPassToken	wqKUfsI3	{"workerId": "07417fc5-e757-4e4c-8e96-8ed98c98364f", "expiresAt": "2026-11-04T05:02:29.360Z", "tokenPrefix": "wqKUfsI3"}	2026-11-04 04:57:29.367
4ea63f86-ffc9-408c-9c72-45be25aacedf	48c5a333-ab6e-4402-b6d2-b8da4294a65e	WORKER_REGISTERED	Worker	493f87c4-a23d-4ad7-8e89-6dd82953e484	{"workerCode": "M3-FVENR3"}	2026-11-04 06:06:59.814
7edec30c-c7af-4a41-8587-b438a7319d6f	5027f974-5be2-42b1-8159-d63ec85e2317	WORKER_PASS_GENERATED	WorkerPassToken	ypA1SvBY	{"workerId": "5027f974-5be2-42b1-8159-d63ec85e2317", "expiresAt": "2026-11-04T05:02:29.528Z", "tokenPrefix": "ypA1SvBY"}	2026-11-04 04:57:29.534
fa9e09e3-6d1a-4cef-b0e1-9d86624993a6	419a1807-f147-43d0-a931-9998e1fe1e67	WORKER_PASS_GENERATED	WorkerPassToken	18lw1KsF	{"workerId": "419a1807-f147-43d0-a931-9998e1fe1e67", "expiresAt": "2026-11-04T05:03:04.154Z", "tokenPrefix": "18lw1KsF"}	2026-11-04 04:58:04.157
3a247e34-367e-4441-abd3-f054f55b9b35	\N	INITIAL_SITE_ASSIGNED	WorkerSiteAssignment	5226762f-599b-46dc-a804-0967798fb69f	{"siteId": "bb05cf97-9dff-44fe-bdf6-b157e51f4382", "workerId": "493f87c4-a23d-4ad7-8e89-6dd82953e484"}	2026-11-04 06:10:14.615
287bcf3d-46e1-4e2a-80c6-7e8f7319bf54	11e4a072-93c9-47a7-9157-bcca817f2dad	ADMIN_PASSWORD_CHANGED	User	11e4a072-93c9-47a7-9157-bcca817f2dad	{}	2026-11-02 07:59:55.267
17199fbe-8942-4bfc-877b-2b15a4e17bd8	11e4a072-93c9-47a7-9157-bcca817f2dad	ADMIN_PASSWORD_CHANGED	User	11e4a072-93c9-47a7-9157-bcca817f2dad	{}	2026-11-02 08:03:03.466
34d61978-9f54-4219-95d3-dde62747364c	11e4a072-93c9-47a7-9157-bcca817f2dad	ADMIN_PASSWORD_CHANGED	User	11e4a072-93c9-47a7-9157-bcca817f2dad	{}	2026-11-02 08:04:54.325
e8cfcc5c-3c93-43ce-8d8c-6894f5d88dbe	11e4a072-93c9-47a7-9157-bcca817f2dad	ADMIN_PASSWORD_CHANGED	User	11e4a072-93c9-47a7-9157-bcca817f2dad	{}	2026-11-02 08:06:51.806
60f3d684-4b33-49fe-a6a9-fcf15b087496	7d8e1e8d-22ee-4ae0-a739-16832dd79309	WORKER_PASS_GENERATED	WorkerPassToken	0qj9w_qa	{"workerId": "7d8e1e8d-22ee-4ae0-a739-16832dd79309", "expiresAt": "2026-11-04T05:02:29.707Z", "tokenPrefix": "0qj9w_qa"}	2026-11-04 04:57:29.713
7c109e0d-d7f2-4a94-b8a2-1719016c8e90	11e4a072-93c9-47a7-9157-bcca817f2dad	ADMIN_PASSWORD_CHANGED	User	11e4a072-93c9-47a7-9157-bcca817f2dad	{}	2026-11-02 08:08:53.453
6c9f505b-bb67-4ea4-8bc6-dd097339a70a	5027f974-5be2-42b1-8159-d63ec85e2317	WORKER_PASS_GENERATED	WorkerPassToken	DSHKj1Wz	{"workerId": "5027f974-5be2-42b1-8159-d63ec85e2317", "expiresAt": "2026-11-04T05:03:04.483Z", "tokenPrefix": "DSHKj1Wz"}	2026-11-04 04:58:04.488
eef95a80-afd5-49cf-93e0-5da6ba1aad08	11e4a072-93c9-47a7-9157-bcca817f2dad	ADMIN_PASSWORD_CHANGED	User	11e4a072-93c9-47a7-9157-bcca817f2dad	{}	2026-11-02 08:09:48.588
93859c5c-6077-448d-86f3-6b42fc81bec8	ef825dfd-398e-49cd-97fe-53e7e6031e08	WORKER_REGISTERED	Worker	d2dc6e23-2c77-47e8-ab79-51b6238f4d61	{"workerCode": "M3-3NPBUW"}	2026-11-04 05:44:26.004
b71d3642-9417-4e41-9df1-d50b3ebf0657	11e4a072-93c9-47a7-9157-bcca817f2dad	ADMIN_PASSWORD_CHANGED	User	11e4a072-93c9-47a7-9157-bcca817f2dad	{}	2026-11-02 08:16:18.72
2534b888-2cae-48d8-a2ca-38b8807dc585	11e4a072-93c9-47a7-9157-bcca817f2dad	ADMIN_PASSWORD_CHANGED	User	11e4a072-93c9-47a7-9157-bcca817f2dad	{}	2026-11-02 08:17:21.479
7490ed60-36c8-4d67-a509-05ee3054bd4a	11e4a072-93c9-47a7-9157-bcca817f2dad	ADMIN_PASSWORD_CHANGED	User	11e4a072-93c9-47a7-9157-bcca817f2dad	{}	2026-11-02 08:18:26.756
7c0a509b-8b45-4466-bec6-e1ae09153b36	11e4a072-93c9-47a7-9157-bcca817f2dad	ADMIN_PASSWORD_CHANGED	User	11e4a072-93c9-47a7-9157-bcca817f2dad	{}	2026-11-02 11:38:24.588
d51ff42a-8d5e-4ae8-8020-8ed347c0b0aa	11e4a072-93c9-47a7-9157-bcca817f2dad	DEMO_DATA_RESET	System	demo-dataset	{"siteCode": "SITE-DEMO01", "workersCount": 10, "contractorCode": "C000002"}	2026-11-02 11:42:51.204
\.


--
-- Data for Name: ConstructionSite; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."ConstructionSite" (id, "siteCode", name, "areaId", "contractorId", active, "createdAt", address, landmark, "contactPhone") FROM stdin;
51e7817c-986e-41e6-acc4-6de663df7e32	SITE-TEST01	M3 Test Construction Site	57f1d151-0337-4f37-98a5-f61caed833ce	6524c1fa-5451-412a-9bc2-0b422ef9364a	t	2026-11-04 04:50:07.559	Plot 101, Near Health Centre, Candolim Coastal Road, North Goa	Candolim Health Centre	9000000100
bb05cf97-9dff-44fe-bdf6-b157e51f4382	SITE-DEMO01	DEMO Zuari Greens Housing Project	f802d2ed-f433-4e61-b46c-079bd90bef70	35060c7b-c5bc-4f69-8673-1a07c4665d83	t	2026-11-04 06:04:15.376	Survey No. 84/2, Quepem-Curchorem Road	Opposite Old Government Primary School	9800000002
\.


--
-- Data for Name: Contractor; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."Contractor" (id, name, "createdAt") FROM stdin;
6524c1fa-5451-412a-9bc2-0b422ef9364a	Test Contractor One	2026-11-04 04:50:07.509
8d8578a8-5d22-4763-bff4-06a9de8bca3d	Test Contractor Two	2026-11-04 04:50:07.538
35060c7b-c5bc-4f69-8673-1a07c4665d83	Vikram Dempo (Demo Contractor)	2026-11-04 06:04:15.358
\.


--
-- Data for Name: ContractorSite; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."ContractorSite" (id, "contractorId", "siteId", active, "assignedAt", "removedAt") FROM stdin;
2ff63061-2f2d-4c4f-9fff-e25dc3ea2971	6524c1fa-5451-412a-9bc2-0b422ef9364a	51e7817c-986e-41e6-acc4-6de663df7e32	t	2026-11-04 04:50:07.571	\N
9ba3fdc5-1d4c-456a-ac72-7b986281f6e2	8d8578a8-5d22-4763-bff4-06a9de8bca3d	51e7817c-986e-41e6-acc4-6de663df7e32	t	2026-11-04 04:50:07.583	\N
\.


--
-- Data for Name: DiagnosticResult; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."DiagnosticResult" (id, "episodeId", "testType", result, species, "testDate", "createdById", "createdAt") FROM stdin;
5f9ebaa9-a0fd-4496-b4e5-00ee02ddfe77	832adf79-61b8-4f0b-b6b2-f5a4484fb09e	RDT	POSITIVE	\N	2026-11-04 04:50:07.663	05dbd0f1-14c1-48b7-8227-2f0ecdc841af	2026-11-04 04:50:07.664
009d4059-5d53-48f9-8e5e-cfaf5e83ae47	a8a4e2dd-ca54-45a8-b6b7-45060fb91757	RDT	POSITIVE	\N	2026-11-04 04:50:07.726	05dbd0f1-14c1-48b7-8227-2f0ecdc841af	2026-11-04 04:50:07.727
8b1ffa02-053a-4e92-96dc-b7f5ed8b1304	a0ded25e-ede1-48c6-9a9e-296244be0401	RDT	NEGATIVE	\N	2026-11-04 04:50:07.787	05dbd0f1-14c1-48b7-8227-2f0ecdc841af	2026-11-04 04:50:07.788
33f7a78f-8bdc-4491-b604-6928136f7c58	d63a2fe3-d8bb-4704-a9d1-c46cd5582270	RDT	NEGATIVE	\N	2026-11-04 04:50:07.846	05dbd0f1-14c1-48b7-8227-2f0ecdc841af	2026-11-04 04:50:07.847
8d1be92d-ae2f-414e-bde7-1f21019102bb	974ad00a-e9ba-44c1-b1c2-9107de30184a	RDT	NEGATIVE	\N	2026-11-04 06:04:15.384	11e4a072-93c9-47a7-9157-bcca817f2dad	2026-11-04 06:04:15.384
e575e7a0-ef6e-4996-98eb-6e82a1a040e1	2a29f68a-8677-49af-9d93-12f10be0c8be	MICROSCOPY	NEGATIVE	\N	2026-11-04 06:04:15.393	11e4a072-93c9-47a7-9157-bcca817f2dad	2026-11-04 06:04:15.393
9557752e-8939-4a10-b2b4-fd5bdb674c06	d1e3cab2-87e7-4cb8-af07-81523fae056b	RDT	NEGATIVE	\N	2026-11-04 06:04:15.398	11e4a072-93c9-47a7-9157-bcca817f2dad	2026-11-04 06:04:15.399
953426a7-de82-49bc-98a5-1859f744bd4b	ae4496ec-3f1b-4a07-8d84-d4eed2735ce5	MICROSCOPY	NEGATIVE	\N	2026-11-04 06:04:15.406	11e4a072-93c9-47a7-9157-bcca817f2dad	2026-11-04 06:04:15.407
936e13d3-41f1-44d3-82fd-8b11d1c2b058	812f5026-db8d-4245-aecd-38152461287b	RDT	NEGATIVE	\N	2026-11-04 06:04:15.415	11e4a072-93c9-47a7-9157-bcca817f2dad	2026-11-04 06:04:15.416
4a0ea080-ce2f-4aab-812c-785d0247cf92	f50e2a85-5340-4cd9-b6c0-7774c1768e9d	RDT	POSITIVE	P_VIVAX	2026-11-04 06:04:15.424	11e4a072-93c9-47a7-9157-bcca817f2dad	2026-11-04 06:04:15.424
133acdca-49a7-44bc-bd7d-e227cf9d5939	184e6ccc-9dd1-4055-8abc-a5bc4dcd997f	MICROSCOPY	POSITIVE	P_FALCIPARUM	2026-11-04 06:04:15.436	11e4a072-93c9-47a7-9157-bcca817f2dad	2026-11-04 06:04:15.437
649c2625-8ef3-404c-8ba6-2e1b886424c7	df5a78a8-e3ee-44b9-997d-14e5cc80791b	RDT	POSITIVE	P_VIVAX	2026-11-04 06:04:15.444	11e4a072-93c9-47a7-9157-bcca817f2dad	2026-11-04 06:04:15.444
162493eb-65bd-4c94-a7fd-efd3a8e5a150	47afffbb-b46d-4e67-af17-799851338998	MICROSCOPY	POSITIVE	P_FALCIPARUM	2026-11-04 06:04:15.45	11e4a072-93c9-47a7-9157-bcca817f2dad	2026-11-04 06:04:15.451
af244abc-cf95-4674-aa69-de603e00e48d	9a788322-8b34-475d-8d75-1aec52db72be	RDT	POSITIVE	MIXED	2026-11-04 06:04:15.458	11e4a072-93c9-47a7-9157-bcca817f2dad	2026-11-04 06:04:15.459
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
\.


--
-- Data for Name: InitialScreening; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."InitialScreening" (id, "workerId", status, version, "consentGiven", answers, "completedAt", "createdAt", "updatedAt") FROM stdin;
7eb7bdfd-38b0-448a-8c72-41f26b0a616e	7d8e1e8d-22ee-4ae0-a739-16832dd79309	COMPLETE	1.0	t	{"age": 32, "gender": "male", "full_name": "Test Worker Negative Two", "fever_today": "no", "mobile_number": "9000000204", "synthetic_test_record": true}	2026-11-04 04:50:07.817	2026-11-04 04:50:07.818	2026-11-04 04:50:07.818
4482e9ad-047a-49ba-ae15-f0ab92c543aa	419a1807-f147-43d0-a931-9998e1fe1e67	COMPLETE	1.0	t	{"age": 32, "gender": "male", "full_name": "Test Worker Positive One", "fever_today": "yes", "mobile_number": "9000000201", "synthetic_test_record": true}	2026-11-04 04:50:07.624	2026-11-04 04:50:07.626	2026-11-04 04:50:07.626
42bb6d81-8f7a-4765-ba5a-57efe5f261c8	07417fc5-e757-4e4c-8e96-8ed98c98364f	COMPLETE	1.0	t	{"age": 32, "gender": "male", "full_name": "Test Worker Positive Two", "fever_today": "yes", "mobile_number": "9000000202", "synthetic_test_record": true}	2026-11-04 04:50:07.695	2026-11-04 04:50:07.696	2026-11-04 04:50:07.696
d370d958-fb00-4718-af6e-59de24f4ed20	5027f974-5be2-42b1-8159-d63ec85e2317	COMPLETE	1.0	t	{"age": 32, "gender": "male", "full_name": "Test Worker Negative One", "fever_today": "no", "mobile_number": "9000000203", "synthetic_test_record": true}	2026-11-04 04:50:07.757	2026-11-04 04:50:07.758	2026-11-04 04:50:07.758
dfdc6f72-395f-4e96-8615-2f59d46dddf3	d2dc6e23-2c77-47e8-ab79-51b6238f4d61	DRAFT	worker-screening-2026-10-31	f	{"gender": "male", "age_years": 34, "full_name": "Aman Gupta", "gov_id_type": "aadhaar", "date_of_birth": "1991-11-18", "gov_id_number": "123456789478", "preferred_language": "pa", "present_address_type": "site_premises", "permanent_address_state": "Goa", "present_address_site_id": "SITE-TEST01", "permanent_address_pincode": "403502", "present_address_site_name": "M3 Test Construction Site · Candolim", "permanent_address_district": "North Goa / South Goa"}	\N	2026-11-04 06:00:20.655	2026-11-04 06:00:20.655
ff988599-bf4d-4248-bc69-b00cc6218bce	32ef9f7d-e09b-43c0-a0e2-7ba54b3bc91a	COMPLETE	2026.1	t	{"gender": "male", "full_name": "Ramesh Kumar", "fever_today": "no", "mobile_number": "9800000011"}	\N	2026-11-04 06:04:15.382	2026-11-04 06:04:15.382
3b719b6a-bdd0-4977-84b5-2e8a37e46e90	7751a765-5dfd-4e42-990e-b45fd363e2de	COMPLETE	2026.1	t	{"gender": "male", "full_name": "Suresh Patil", "fever_today": "no", "mobile_number": "9800000012"}	\N	2026-11-04 06:04:15.392	2026-11-04 06:04:15.392
06607583-2c70-4e0c-b81c-92859061a6c5	940f15e1-d64d-4912-a0e1-9f1b29afeb2b	COMPLETE	2026.1	t	{"gender": "male", "full_name": "Manoj Sharma", "fever_today": "no", "mobile_number": "9800000013"}	\N	2026-11-04 06:04:15.397	2026-11-04 06:04:15.397
15a0aaa7-0d9e-4227-8896-03786618de70	22b97352-da79-4fa8-9178-000ec0b191be	COMPLETE	2026.1	t	{"gender": "male", "full_name": "Rajesh Verma", "fever_today": "no", "mobile_number": "9800000014"}	\N	2026-11-04 06:04:15.404	2026-11-04 06:04:15.404
d41d1818-16b2-416d-87f6-1afb178b8e2b	344d099c-db21-4075-b4a7-ab7348f6220a	COMPLETE	2026.1	t	{"gender": "male", "full_name": "Amit Singh", "fever_today": "no", "mobile_number": "9800000015"}	\N	2026-11-04 06:04:15.413	2026-11-04 06:04:15.413
d149a574-e0b2-42fa-8562-17a7ca182906	bd04c3f7-a718-489f-9f9f-642e522e44e9	COMPLETE	2026.1	t	{"gender": "male", "full_name": "Vikas Yadav", "fever_today": "yes", "mobile_number": "9800000016"}	\N	2026-11-04 06:04:15.421	2026-11-04 06:04:15.421
ed73356a-2bb1-4f89-8fee-f1e8695d4ccc	db581bc8-5463-4616-a2be-d14405ca7c50	COMPLETE	2026.1	t	{"gender": "male", "full_name": "Sunil Das", "fever_today": "yes", "mobile_number": "9800000017"}	\N	2026-11-04 06:04:15.434	2026-11-04 06:04:15.434
b8066a4c-003e-4dfa-9514-2d0a7278f525	a980c72e-99d0-49b3-bd39-6b876aa67e99	COMPLETE	2026.1	t	{"gender": "male", "full_name": "Anil Mondal", "fever_today": "yes", "mobile_number": "9800000018"}	\N	2026-11-04 06:04:15.442	2026-11-04 06:04:15.442
2696ee03-3ed7-48fc-b329-f3a0b5d540ea	7f3373d9-6fbd-4388-8eb5-cd884ab79e2d	COMPLETE	2026.1	t	{"gender": "male", "full_name": "Deepak Roy", "fever_today": "yes", "mobile_number": "9800000019"}	\N	2026-11-04 06:04:15.449	2026-11-04 06:04:15.449
d24438d8-0a0c-4db7-ad5a-3f24a15e1eda	b5068d76-fc69-4a64-a9e3-6c2858fab261	COMPLETE	2026.1	t	{"gender": "male", "full_name": "Sanjay Gupta", "fever_today": "yes", "mobile_number": "9800000020"}	\N	2026-11-04 06:04:15.457	2026-11-04 06:04:15.457
775cc4ab-7ef2-47b5-9f64-348d23a43566	493f87c4-a23d-4ad7-8e89-6dd82953e484	DRAFT	worker-screening-2026-10-31	f	{"gender": "male", "age_years": 0, "full_name": "Test", "date_of_birth": "2026-11-02", "gov_id_number": "112344564512", "preferred_language": "en", "permanent_address_state": "Goa", "present_address_site_id": "SITE-DEMO01", "permanent_address_pincode": "403501", "present_address_site_name": "DEMO Zuari Greens Housing Project · Curchorem", "permanent_address_district": "North Goa / South Goa"}	\N	2026-11-04 06:11:37.427	2026-11-04 06:11:37.427
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
832adf79-61b8-4f0b-b6b2-f5a4484fb09e	419a1807-f147-43d0-a931-9998e1fe1e67	CONFIRMED	2026-11-04 04:50:07.651	2026-11-04 04:50:07.652
a8a4e2dd-ca54-45a8-b6b7-45060fb91757	07417fc5-e757-4e4c-8e96-8ed98c98364f	CONFIRMED	2026-11-04 04:50:07.716	2026-11-04 04:50:07.717
a0ded25e-ede1-48c6-9a9e-296244be0401	5027f974-5be2-42b1-8159-d63ec85e2317	RESOLVED	2026-11-04 04:50:07.777	2026-11-04 04:50:07.778
d63a2fe3-d8bb-4704-a9d1-c46cd5582270	7d8e1e8d-22ee-4ae0-a739-16832dd79309	RESOLVED	2026-11-04 04:50:07.836	2026-11-04 04:50:07.837
974ad00a-e9ba-44c1-b1c2-9107de30184a	32ef9f7d-e09b-43c0-a0e2-7ba54b3bc91a	RESOLVED	2026-11-04 06:04:15.383	2026-11-04 06:04:15.383
2a29f68a-8677-49af-9d93-12f10be0c8be	7751a765-5dfd-4e42-990e-b45fd363e2de	RESOLVED	2026-11-04 06:04:15.392	2026-11-04 06:04:15.392
d1e3cab2-87e7-4cb8-af07-81523fae056b	940f15e1-d64d-4912-a0e1-9f1b29afeb2b	RESOLVED	2026-11-04 06:04:15.398	2026-11-04 06:04:15.398
ae4496ec-3f1b-4a07-8d84-d4eed2735ce5	22b97352-da79-4fa8-9178-000ec0b191be	RESOLVED	2026-11-04 06:04:15.405	2026-11-04 06:04:15.406
812f5026-db8d-4245-aecd-38152461287b	344d099c-db21-4075-b4a7-ab7348f6220a	RESOLVED	2026-11-04 06:04:15.414	2026-11-04 06:04:15.414
f50e2a85-5340-4cd9-b6c0-7774c1768e9d	bd04c3f7-a718-489f-9f9f-642e522e44e9	CONFIRMED	2026-11-04 06:04:15.422	2026-11-04 06:04:15.423
184e6ccc-9dd1-4055-8abc-a5bc4dcd997f	db581bc8-5463-4616-a2be-d14405ca7c50	CONFIRMED	2026-11-04 06:04:15.435	2026-11-04 06:04:15.436
df5a78a8-e3ee-44b9-997d-14e5cc80791b	a980c72e-99d0-49b3-bd39-6b876aa67e99	CONFIRMED	2026-11-04 06:04:15.443	2026-11-04 06:04:15.443
47afffbb-b46d-4e67-af17-799851338998	7f3373d9-6fbd-4388-8eb5-cd884ab79e2d	CONFIRMED	2026-11-04 06:04:15.449	2026-11-04 06:04:15.45
9a788322-8b34-475d-8d75-1aec52db72be	b5068d76-fc69-4a64-a9e3-6c2858fab261	CONFIRMED	2026-11-04 06:04:15.457	2026-11-04 06:04:15.458
\.


--
-- Data for Name: Notification; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."Notification" (id, "audienceRole", "audienceUserId", type, title, body, "entityType", "entityId", "dedupeKey", "readAt", "createdAt") FROM stdin;
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
\.


--
-- Data for Name: SiteTransferRequest; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."SiteTransferRequest" (id, "workerId", "fromSiteId", "toSiteId", "initiatorType", "initiatorId", status, "workerDecision", "workerDecisionAt", "fromContractorDecision", "fromContractorDecisionAt", "toContractorDecision", "toContractorDecisionAt", "cancelledById", "cancelledAt", "effectiveAt", note, "createdAt", "updatedAt", "fromContractorId", "toContractorId") FROM stdin;
\.


--
-- Data for Name: SymptomReport; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."SymptomReport" (id, "workerId", "episodeId", symptoms, note, "createdAt", "voiceData") FROM stdin;
\.


--
-- Data for Name: TravelRecord; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."TravelRecord" (id, "workerId", "planningTravel", "departureDate", "returnDate", destination, state, "hadFeverOrMalaria", "treatmentGiven", "completedCourse", "treatmentPlace", status, "createdAt", "updatedAt") FROM stdin;
e2b28558-1254-4c30-a685-6c2f647c6484	bd04c3f7-a718-489f-9f9f-642e522e44e9	t	2026-11-07 06:04:15.426	2026-11-22 06:04:15.426	Patna	Bihar	f	f	f	\N	PLANNED	2026-11-04 06:04:15.427	2026-11-04 06:04:15.427
\.


--
-- Data for Name: TravelReport; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."TravelReport" (id, "travelRecordId", "workerId", "departureDate", "destinationState", reason, status, "reviewNote", "reviewedById", "reviewedAt", "submittedByContractorId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."User" (id, role, "displayName", username, "passwordHash", phone, "pinHash", "workerId", "contractorId", "createdAt", "updatedAt", "stakeholderCode", "mustChangeCredential", active) FROM stdin;
ef825dfd-398e-49cd-97fe-53e7e6031e08	WORKER	Aman Gupta	\N	\N	9938187963	$2a$10$zfMvgeGSeDofSv3Ebx.gbePQyJuUTl7RxDdWgEIrWu/SYMTmrm8nu	d2dc6e23-2c77-47e8-ab79-51b6238f4d61	\N	2026-11-04 05:44:25.983	2026-11-04 05:44:25.983	\N	f	t
48c5a333-ab6e-4402-b6d2-b8da4294a65e	WORKER	Test	\N	\N	7744020601	$2a$10$ZEGqQQa0B.1nVM2Ke7dYJukW5lmwWzSMF1HSd0VJKbOCTUaX5p.ZW	493f87c4-a23d-4ad7-8e89-6dd82953e484	\N	2026-11-04 06:06:59.79	2026-11-04 06:06:59.79	\N	f	t
ee576b80-e24f-4952-ad5d-7166b10b0d4a	WORKER	Test Worker Negative Two	\N	\N	9000000204	$2a$10$uI2a3Y26LWuk/GDMUQUHtuYQUL0Yay9IUTFAdb9.E7s8c3pZyJ1fy	7d8e1e8d-22ee-4ae0-a739-16832dd79309	\N	2026-11-04 04:50:07.808	2026-11-04 04:50:07.808	\N	f	t
11e4a072-93c9-47a7-9157-bcca817f2dad	ADMIN	Demo Admin	admin	$2a$10$.y9F4MP.pqZr6nftOE/up.FX7DEXpqlaydXtjNcd5s6q2rUx4MwvS	\N	\N	\N	\N	2026-10-30 09:07:45.01	2026-11-03 08:58:33.245	\N	f	t
cc33567b-bc8a-49ec-885f-7f3d414fcc8d	CONTRACTOR	Test Contractor One	\N	$2a$10$krNaldyhfcUv1RM11zEy8u5a2y1vRgFHCiEd5wVVWYNNfG2sle28W	9000000101	\N	\N	6524c1fa-5451-412a-9bc2-0b422ef9364a	2026-11-04 04:50:07.527	2026-11-04 04:56:04.911	C000001	f	t
409e76f6-4805-464f-ac17-e95a2adcf6bd	CONTRACTOR	Test Contractor Two	\N	$2a$10$IPt7L/AQFo8Pnvmf8gwrTOQ4KZKavtAjZ52aLdNK1ko5LsqKzn8AC	9000000102	\N	\N	8d8578a8-5d22-4763-bff4-06a9de8bca3d	2026-11-04 04:50:07.548	2026-11-04 04:56:05.255	C000002	f	t
1f8bf6eb-384d-4536-bea7-ffadf27b4350	CONTRACTOR	Vikram Dempo	\N	$2a$10$OYAO4IfW.Jzpd35CH72xI.tcmL7jF8ncYQ6I/AFHqzjuUgjckdstK	9800000001	\N	\N	35060c7b-c5bc-4f69-8673-1a07c4665d83	2026-11-04 06:04:15.371	2026-11-04 06:04:15.371	C000003	t	t
1852403d-05c7-47b0-8c53-11ada373016e	WORKER	Ramesh Kumar	\N	\N	9800000011	$2a$10$OYAO4IfW.Jzpd35CH72xI.tcmL7jF8ncYQ6I/AFHqzjuUgjckdstK	32ef9f7d-e09b-43c0-a0e2-7ba54b3bc91a	\N	2026-11-04 06:04:15.378	2026-11-04 06:04:15.378	\N	f	t
057cb5d3-de85-4117-9706-075fe3e23200	WORKER	Suresh Patil	\N	\N	9800000012	$2a$10$OYAO4IfW.Jzpd35CH72xI.tcmL7jF8ncYQ6I/AFHqzjuUgjckdstK	7751a765-5dfd-4e42-990e-b45fd363e2de	\N	2026-11-04 06:04:15.389	2026-11-04 06:04:15.389	\N	f	t
8805350a-331d-4a47-8505-f0eb3f313bdd	WORKER	Manoj Sharma	\N	\N	9800000013	$2a$10$OYAO4IfW.Jzpd35CH72xI.tcmL7jF8ncYQ6I/AFHqzjuUgjckdstK	940f15e1-d64d-4912-a0e1-9f1b29afeb2b	\N	2026-11-04 06:04:15.394	2026-11-04 06:04:15.394	\N	f	t
da0e1312-383b-46ee-b905-2c9f71bbbee0	WORKER	Rajesh Verma	\N	\N	9800000014	$2a$10$OYAO4IfW.Jzpd35CH72xI.tcmL7jF8ncYQ6I/AFHqzjuUgjckdstK	22b97352-da79-4fa8-9178-000ec0b191be	\N	2026-11-04 06:04:15.4	2026-11-04 06:04:15.4	\N	f	t
aac701af-01b7-4418-919e-a8910906ce5c	WORKER	Amit Singh	\N	\N	9800000015	$2a$10$OYAO4IfW.Jzpd35CH72xI.tcmL7jF8ncYQ6I/AFHqzjuUgjckdstK	344d099c-db21-4075-b4a7-ab7348f6220a	\N	2026-11-04 06:04:15.409	2026-11-04 06:04:15.409	\N	f	t
5938f978-a748-42e0-bf96-dce6f4e14f5c	WORKER	Vikas Yadav	\N	\N	9800000016	$2a$10$OYAO4IfW.Jzpd35CH72xI.tcmL7jF8ncYQ6I/AFHqzjuUgjckdstK	bd04c3f7-a718-489f-9f9f-642e522e44e9	\N	2026-11-04 06:04:15.417	2026-11-04 06:04:15.417	\N	f	t
16aafe62-141b-44e1-ad6d-b0af734b5895	WORKER	Sunil Das	\N	\N	9800000017	$2a$10$OYAO4IfW.Jzpd35CH72xI.tcmL7jF8ncYQ6I/AFHqzjuUgjckdstK	db581bc8-5463-4616-a2be-d14405ca7c50	\N	2026-11-04 06:04:15.43	2026-11-04 06:04:15.43	\N	f	t
aac4638a-deb5-4a62-b550-3b9ee71aaf8f	WORKER	Anil Mondal	\N	\N	9800000018	$2a$10$OYAO4IfW.Jzpd35CH72xI.tcmL7jF8ncYQ6I/AFHqzjuUgjckdstK	a980c72e-99d0-49b3-bd39-6b876aa67e99	\N	2026-11-04 06:04:15.438	2026-11-04 06:04:15.438	\N	f	t
c29c7645-f38f-4fb0-8167-18697ee1efe4	WORKER	Deepak Roy	\N	\N	9800000019	$2a$10$OYAO4IfW.Jzpd35CH72xI.tcmL7jF8ncYQ6I/AFHqzjuUgjckdstK	7f3373d9-6fbd-4388-8eb5-cd884ab79e2d	\N	2026-11-04 06:04:15.446	2026-11-04 06:04:15.446	\N	f	t
1863c4cc-8b01-47cd-9fc9-697a7125b005	WORKER	Sanjay Gupta	\N	\N	9800000020	$2a$10$OYAO4IfW.Jzpd35CH72xI.tcmL7jF8ncYQ6I/AFHqzjuUgjckdstK	b5068d76-fc69-4a64-a9e3-6c2858fab261	\N	2026-11-04 06:04:15.453	2026-11-04 06:04:15.453	\N	f	t
05dbd0f1-14c1-48b7-8227-2f0ecdc841af	CLINICIAN	Dr. Test Clinician	\N	$2a$10$uI2a3Y26LWuk/GDMUQUHtuYQUL0Yay9IUTFAdb9.E7s8c3pZyJ1fy	9000000301	\N	\N	\N	2026-11-04 04:50:07.593	2026-11-04 04:50:07.593	CL000001	t	t
b86be46e-b77e-4b9b-8f8e-525c0ecc7e64	WORKER	Test Worker Positive One	\N	\N	9000000201	$2a$10$uI2a3Y26LWuk/GDMUQUHtuYQUL0Yay9IUTFAdb9.E7s8c3pZyJ1fy	419a1807-f147-43d0-a931-9998e1fe1e67	\N	2026-11-04 04:50:07.614	2026-11-04 04:50:07.614	\N	f	t
227a2c22-7261-4134-83f2-b13e5bae3bfc	WORKER	Test Worker Positive Two	\N	\N	9000000202	$2a$10$uI2a3Y26LWuk/GDMUQUHtuYQUL0Yay9IUTFAdb9.E7s8c3pZyJ1fy	07417fc5-e757-4e4c-8e96-8ed98c98364f	\N	2026-11-04 04:50:07.686	2026-11-04 04:50:07.686	\N	f	t
2d797ca3-72f8-4e8a-94f2-5f5e0ce954c3	WORKER	Test Worker Negative One	\N	\N	9000000203	$2a$10$uI2a3Y26LWuk/GDMUQUHtuYQUL0Yay9IUTFAdb9.E7s8c3pZyJ1fy	5027f974-5be2-42b1-8159-d63ec85e2317	\N	2026-11-04 04:50:07.747	2026-11-04 04:50:07.747	\N	f	t
\.


--
-- Data for Name: Worker; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."Worker" (id, "workerCode", name, phone, "preferredLanguage", "createdAt", "updatedAt") FROM stdin;
419a1807-f147-43d0-a931-9998e1fe1e67	M3-TEST01	Test Worker Positive One	9000000201	en	2026-11-04 04:50:07.603	2026-11-04 04:50:07.603
07417fc5-e757-4e4c-8e96-8ed98c98364f	M3-TEST02	Test Worker Positive Two	9000000202	en	2026-11-04 04:50:07.676	2026-11-04 04:50:07.676
5027f974-5be2-42b1-8159-d63ec85e2317	M3-TEST03	Test Worker Negative One	9000000203	en	2026-11-04 04:50:07.738	2026-11-04 04:50:07.738
7d8e1e8d-22ee-4ae0-a739-16832dd79309	M3-TEST04	Test Worker Negative Two	9000000204	en	2026-11-04 04:50:07.798	2026-11-04 04:50:07.798
d2dc6e23-2c77-47e8-ab79-51b6238f4d61	M3-3NPBUW	Aman Gupta	9938187963	en	2026-11-04 05:44:25.983	2026-11-04 05:44:26.071
32ef9f7d-e09b-43c0-a0e2-7ba54b3bc91a	M3-D01	Ramesh Kumar	9800000011	en	2026-11-04 06:04:15.378	2026-11-04 06:04:15.378
7751a765-5dfd-4e42-990e-b45fd363e2de	M3-D02	Suresh Patil	9800000012	en	2026-11-04 06:04:15.389	2026-11-04 06:04:15.389
940f15e1-d64d-4912-a0e1-9f1b29afeb2b	M3-D03	Manoj Sharma	9800000013	en	2026-11-04 06:04:15.394	2026-11-04 06:04:15.394
22b97352-da79-4fa8-9178-000ec0b191be	M3-D04	Rajesh Verma	9800000014	en	2026-11-04 06:04:15.4	2026-11-04 06:04:15.4
344d099c-db21-4075-b4a7-ab7348f6220a	M3-D05	Amit Singh	9800000015	en	2026-11-04 06:04:15.409	2026-11-04 06:04:15.409
bd04c3f7-a718-489f-9f9f-642e522e44e9	M3-D06	Vikas Yadav	9800000016	en	2026-11-04 06:04:15.417	2026-11-04 06:04:15.417
db581bc8-5463-4616-a2be-d14405ca7c50	M3-D07	Sunil Das	9800000017	en	2026-11-04 06:04:15.43	2026-11-04 06:04:15.43
a980c72e-99d0-49b3-bd39-6b876aa67e99	M3-D08	Anil Mondal	9800000018	en	2026-11-04 06:04:15.438	2026-11-04 06:04:15.438
7f3373d9-6fbd-4388-8eb5-cd884ab79e2d	M3-D09	Deepak Roy	9800000019	en	2026-11-04 06:04:15.446	2026-11-04 06:04:15.446
b5068d76-fc69-4a64-a9e3-6c2858fab261	M3-D10	Sanjay Gupta	9800000020	en	2026-11-04 06:04:15.453	2026-11-04 06:04:15.453
493f87c4-a23d-4ad7-8e89-6dd82953e484	M3-FVENR3	Test	7744020601	pa	2026-11-04 06:06:59.79	2026-11-04 06:07:00.044
\.


--
-- Data for Name: WorkerPassToken; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."WorkerPassToken" (id, "tokenHash", "tokenPrefix", "workerId", "expiresAt", "usedAt", "usedById", "revokedAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: WorkerSiteAssignment; Type: TABLE DATA; Schema: public; Owner: m3
--

COPY public."WorkerSiteAssignment" (id, "workerId", "siteId", active, "startedAt", "endedAt", "transferId", "createdAt", "contractorId", status) FROM stdin;
6fd3e6f8-d6e1-407c-a0b1-be25bc52cfe2	419a1807-f147-43d0-a931-9998e1fe1e67	51e7817c-986e-41e6-acc4-6de663df7e32	t	2026-11-04 04:50:07.639	\N	\N	2026-11-04 04:50:07.64	\N	ACTIVE
be46013e-8a20-4ea1-b827-c488aaa9856c	07417fc5-e757-4e4c-8e96-8ed98c98364f	51e7817c-986e-41e6-acc4-6de663df7e32	t	2026-11-04 04:50:07.706	\N	\N	2026-11-04 04:50:07.707	\N	ACTIVE
34328af8-43ec-48a5-9533-124ea2f4c786	5027f974-5be2-42b1-8159-d63ec85e2317	51e7817c-986e-41e6-acc4-6de663df7e32	t	2026-11-04 04:50:07.768	\N	\N	2026-11-04 04:50:07.769	\N	ACTIVE
253f27a1-b5e8-4bd2-9445-ff65a03a0766	7d8e1e8d-22ee-4ae0-a739-16832dd79309	51e7817c-986e-41e6-acc4-6de663df7e32	t	2026-11-04 04:50:07.826	\N	\N	2026-11-04 04:50:07.827	\N	ACTIVE
fbe64801-22ef-41a6-98ed-9aac8c9389ac	32ef9f7d-e09b-43c0-a0e2-7ba54b3bc91a	bb05cf97-9dff-44fe-bdf6-b157e51f4382	t	2026-11-04 06:04:15.38	\N	\N	2026-11-04 06:04:15.38	\N	ACTIVE
57810a30-4d5d-4b02-86ec-f437ce96630c	7751a765-5dfd-4e42-990e-b45fd363e2de	bb05cf97-9dff-44fe-bdf6-b157e51f4382	t	2026-11-04 06:04:15.39	\N	\N	2026-11-04 06:04:15.39	\N	ACTIVE
29ddf108-c0f1-49b3-b420-2603a955e76c	940f15e1-d64d-4912-a0e1-9f1b29afeb2b	bb05cf97-9dff-44fe-bdf6-b157e51f4382	t	2026-11-04 06:04:15.396	\N	\N	2026-11-04 06:04:15.396	\N	ACTIVE
efaa1b03-248d-4d97-b8bd-c03f1d34b50f	22b97352-da79-4fa8-9178-000ec0b191be	bb05cf97-9dff-44fe-bdf6-b157e51f4382	t	2026-11-04 06:04:15.403	\N	\N	2026-11-04 06:04:15.403	\N	ACTIVE
e56c2345-13b2-4312-8c81-2288eaaf3699	344d099c-db21-4075-b4a7-ab7348f6220a	bb05cf97-9dff-44fe-bdf6-b157e51f4382	t	2026-11-04 06:04:15.411	\N	\N	2026-11-04 06:04:15.411	\N	ACTIVE
143d5f47-f156-422b-9ff4-5fe8674d242b	bd04c3f7-a718-489f-9f9f-642e522e44e9	bb05cf97-9dff-44fe-bdf6-b157e51f4382	t	2026-11-04 06:04:15.42	\N	\N	2026-11-04 06:04:15.42	\N	ACTIVE
150442e3-e9be-4ca3-b5b4-e2ff4fdbdbaa	db581bc8-5463-4616-a2be-d14405ca7c50	bb05cf97-9dff-44fe-bdf6-b157e51f4382	t	2026-11-04 06:04:15.433	\N	\N	2026-11-04 06:04:15.433	\N	ACTIVE
96743a49-9a3a-47ef-9839-1fd0178abf79	a980c72e-99d0-49b3-bd39-6b876aa67e99	bb05cf97-9dff-44fe-bdf6-b157e51f4382	t	2026-11-04 06:04:15.441	\N	\N	2026-11-04 06:04:15.441	\N	ACTIVE
25fc674c-2083-476b-96ce-9bcd5a537b0d	7f3373d9-6fbd-4388-8eb5-cd884ab79e2d	bb05cf97-9dff-44fe-bdf6-b157e51f4382	t	2026-11-04 06:04:15.448	\N	\N	2026-11-04 06:04:15.448	\N	ACTIVE
ff89b62d-462e-4f4e-bcd1-6589c4033ff0	b5068d76-fc69-4a64-a9e3-6c2858fab261	bb05cf97-9dff-44fe-bdf6-b157e51f4382	t	2026-11-04 06:04:15.455	\N	\N	2026-11-04 06:04:15.455	\N	ACTIVE
e8b41637-2981-4e9c-b52c-0da66504d448	d2dc6e23-2c77-47e8-ab79-51b6238f4d61	51e7817c-986e-41e6-acc4-6de663df7e32	t	2026-11-04 05:48:43.965	\N	\N	2026-11-04 05:48:43.965	6524c1fa-5451-412a-9bc2-0b422ef9364a	ACTIVE
5226762f-599b-46dc-a804-0967798fb69f	493f87c4-a23d-4ad7-8e89-6dd82953e484	bb05cf97-9dff-44fe-bdf6-b157e51f4382	t	2026-11-04 06:10:14.602	\N	\N	2026-11-04 06:10:14.602	35060c7b-c5bc-4f69-8673-1a07c4665d83	ACTIVE
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

\unrestrict HCWI5La2LYY4W9Sfy6TqCnamofleurEFKqpKlqnZuWKBUqzR1TGUF3mMwP9NIFG

