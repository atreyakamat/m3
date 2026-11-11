--
-- PostgreSQL database dump
--

\restrict YPW5YzqHiwZls1IDHsmtJFXVWSwuD67JCDwi7BJThMZ1OumtYX9qEgmhLXWW8cR

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
-- Name: AssignmentStatus; Type: TYPE; Schema: public; Owner: m3_staging
--

CREATE TYPE public."AssignmentStatus" AS ENUM (
    'ACTIVE',
    'ENDED',
    'TRANSFERRED'
);


ALTER TYPE public."AssignmentStatus" OWNER TO m3_staging;

--
-- Name: ConsentStatus; Type: TYPE; Schema: public; Owner: m3_staging
--

CREATE TYPE public."ConsentStatus" AS ENUM (
    'ACCEPTED',
    'DECLINED'
);


ALTER TYPE public."ConsentStatus" OWNER TO m3_staging;

--
-- Name: CorrectionStatus; Type: TYPE; Schema: public; Owner: m3_staging
--

CREATE TYPE public."CorrectionStatus" AS ENUM (
    'SUBMITTED',
    'UNDER_REVIEW',
    'APPROVED',
    'REJECTED',
    'COMPLETED'
);


ALTER TYPE public."CorrectionStatus" OWNER TO m3_staging;

--
-- Name: Decision; Type: TYPE; Schema: public; Owner: m3_staging
--

CREATE TYPE public."Decision" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


ALTER TYPE public."Decision" OWNER TO m3_staging;

--
-- Name: DepartureConfirmationStatus; Type: TYPE; Schema: public; Owner: m3_staging
--

CREATE TYPE public."DepartureConfirmationStatus" AS ENUM (
    'PENDING_CONFIRMATION',
    'CONFIRMED',
    'REJECTED',
    'CANCELLED'
);


ALTER TYPE public."DepartureConfirmationStatus" OWNER TO m3_staging;

--
-- Name: DiagnosticResultValue; Type: TYPE; Schema: public; Owner: m3_staging
--

CREATE TYPE public."DiagnosticResultValue" AS ENUM (
    'POSITIVE',
    'NEGATIVE',
    'INCONCLUSIVE'
);


ALTER TYPE public."DiagnosticResultValue" OWNER TO m3_staging;

--
-- Name: EpisodeStatus; Type: TYPE; Schema: public; Owner: m3_staging
--

CREATE TYPE public."EpisodeStatus" AS ENUM (
    'SUSPECTED',
    'CONFIRMED',
    'RESOLVED'
);


ALTER TYPE public."EpisodeStatus" OWNER TO m3_staging;

--
-- Name: EscalationAlertStatus; Type: TYPE; Schema: public; Owner: m3_staging
--

CREATE TYPE public."EscalationAlertStatus" AS ENUM (
    'SENT',
    'ACKNOWLEDGED',
    'ACTIONED'
);


ALTER TYPE public."EscalationAlertStatus" OWNER TO m3_staging;

--
-- Name: FacilityType; Type: TYPE; Schema: public; Owner: m3_staging
--

CREATE TYPE public."FacilityType" AS ENUM (
    'PHC',
    'UHC'
);


ALTER TYPE public."FacilityType" OWNER TO m3_staging;

--
-- Name: HouseholdRelationship; Type: TYPE; Schema: public; Owner: m3_staging
--

CREATE TYPE public."HouseholdRelationship" AS ENUM (
    'SPOUSE',
    'CHILD',
    'PARENT',
    'SIBLING',
    'OTHER_FAMILY',
    'ROOMMATE',
    'OTHER'
);


ALTER TYPE public."HouseholdRelationship" OWNER TO m3_staging;

--
-- Name: JoinRequestStatus; Type: TYPE; Schema: public; Owner: m3_staging
--

CREATE TYPE public."JoinRequestStatus" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'DECLINED',
    'CANCELLED'
);


ALTER TYPE public."JoinRequestStatus" OWNER TO m3_staging;

--
-- Name: Language; Type: TYPE; Schema: public; Owner: m3_staging
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


ALTER TYPE public."Language" OWNER TO m3_staging;

--
-- Name: LocationLevel; Type: TYPE; Schema: public; Owner: m3_staging
--

CREATE TYPE public."LocationLevel" AS ENUM (
    'STATE',
    'DISTRICT',
    'TALUKA',
    'AREA'
);


ALTER TYPE public."LocationLevel" OWNER TO m3_staging;

--
-- Name: PlasmodiumSpecies; Type: TYPE; Schema: public; Owner: m3_staging
--

CREATE TYPE public."PlasmodiumSpecies" AS ENUM (
    'P_FALCIPARUM',
    'P_VIVAX',
    'MIXED',
    'OTHER',
    'UNKNOWN'
);


ALTER TYPE public."PlasmodiumSpecies" OWNER TO m3_staging;

--
-- Name: Role; Type: TYPE; Schema: public; Owner: m3_staging
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


ALTER TYPE public."Role" OWNER TO m3_staging;

--
-- Name: ScreeningStatus; Type: TYPE; Schema: public; Owner: m3_staging
--

CREATE TYPE public."ScreeningStatus" AS ENUM (
    'DRAFT',
    'COMPLETE'
);


ALTER TYPE public."ScreeningStatus" OWNER TO m3_staging;

--
-- Name: TestType; Type: TYPE; Schema: public; Owner: m3_staging
--

CREATE TYPE public."TestType" AS ENUM (
    'RDT',
    'MICROSCOPY'
);


ALTER TYPE public."TestType" OWNER TO m3_staging;

--
-- Name: TransferInitiator; Type: TYPE; Schema: public; Owner: m3_staging
--

CREATE TYPE public."TransferInitiator" AS ENUM (
    'WORKER',
    'CONTRACTOR'
);


ALTER TYPE public."TransferInitiator" OWNER TO m3_staging;

--
-- Name: TransferStatus; Type: TYPE; Schema: public; Owner: m3_staging
--

CREATE TYPE public."TransferStatus" AS ENUM (
    'PENDING_WORKER_RESPONSE',
    'PENDING_CURRENT_CONTRACTOR',
    'PENDING_DESTINATION_CONTRACTOR',
    'ACCEPTED',
    'REJECTED',
    'CANCELLED'
);


ALTER TYPE public."TransferStatus" OWNER TO m3_staging;

--
-- Name: TranslationStatus; Type: TYPE; Schema: public; Owner: m3_staging
--

CREATE TYPE public."TranslationStatus" AS ENUM (
    'PENDING',
    'TRANSLATED',
    'FAILED',
    'REVIEWED'
);


ALTER TYPE public."TranslationStatus" OWNER TO m3_staging;

--
-- Name: TravelDirection; Type: TYPE; Schema: public; Owner: m3_staging
--

CREATE TYPE public."TravelDirection" AS ENUM (
    'LEAVING_GOA',
    'ENTERING_GOA'
);


ALTER TYPE public."TravelDirection" OWNER TO m3_staging;

--
-- Name: TravelReportStatus; Type: TYPE; Schema: public; Owner: m3_staging
--

CREATE TYPE public."TravelReportStatus" AS ENUM (
    'OPEN',
    'REVIEWED',
    'RESOLVED'
);


ALTER TYPE public."TravelReportStatus" OWNER TO m3_staging;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AppInstallConsent; Type: TABLE; Schema: public; Owner: m3_staging
--

CREATE TABLE public."AppInstallConsent" (
    id text NOT NULL,
    "workerId" text,
    version text NOT NULL,
    language public."Language" NOT NULL,
    status public."ConsentStatus" NOT NULL,
    "deviceInfo" text,
    "appVersion" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."AppInstallConsent" OWNER TO m3_staging;

--
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: m3_staging
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


ALTER TABLE public."AuditLog" OWNER TO m3_staging;

--
-- Name: ConstructionSite; Type: TABLE; Schema: public; Owner: m3_staging
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


ALTER TABLE public."ConstructionSite" OWNER TO m3_staging;

--
-- Name: Contractor; Type: TABLE; Schema: public; Owner: m3_staging
--

CREATE TABLE public."Contractor" (
    id text NOT NULL,
    name text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Contractor" OWNER TO m3_staging;

--
-- Name: ContractorSite; Type: TABLE; Schema: public; Owner: m3_staging
--

CREATE TABLE public."ContractorSite" (
    id text NOT NULL,
    "contractorId" text NOT NULL,
    "siteId" text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "assignedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "removedAt" timestamp(3) without time zone
);


ALTER TABLE public."ContractorSite" OWNER TO m3_staging;

--
-- Name: DataSubmissionConsent; Type: TABLE; Schema: public; Owner: m3_staging
--

CREATE TABLE public."DataSubmissionConsent" (
    id text NOT NULL,
    "workerId" text NOT NULL,
    version text NOT NULL,
    language public."Language" NOT NULL,
    status public."ConsentStatus" NOT NULL,
    "formId" text NOT NULL,
    "deviceInfo" text,
    "appVersion" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."DataSubmissionConsent" OWNER TO m3_staging;

--
-- Name: DiagnosticResult; Type: TABLE; Schema: public; Owner: m3_staging
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


ALTER TABLE public."DiagnosticResult" OWNER TO m3_staging;

--
-- Name: EscalationRecipient; Type: TABLE; Schema: public; Owner: m3_staging
--

CREATE TABLE public."EscalationRecipient" (
    id text NOT NULL,
    "alertId" text NOT NULL,
    "clinicianId" text NOT NULL,
    "deliveredAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "acknowledgedAt" timestamp(3) without time zone,
    "actionTaken" text,
    "actionTakenAt" timestamp(3) without time zone,
    status public."EscalationAlertStatus" DEFAULT 'SENT'::public."EscalationAlertStatus" NOT NULL
);


ALTER TABLE public."EscalationRecipient" OWNER TO m3_staging;

--
-- Name: Facility; Type: TABLE; Schema: public; Owner: m3_staging
--

CREATE TABLE public."Facility" (
    id text NOT NULL,
    "facilityCode" text NOT NULL,
    name text NOT NULL,
    type public."FacilityType" NOT NULL,
    state text DEFAULT 'Goa'::text NOT NULL,
    district text NOT NULL,
    taluka text NOT NULL,
    address text,
    latitude double precision,
    longitude double precision,
    "contactPhone" text,
    "contactEmail" text,
    active boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Facility" OWNER TO m3_staging;

--
-- Name: FacilityEscalationAlert; Type: TABLE; Schema: public; Owner: m3_staging
--

CREATE TABLE public."FacilityEscalationAlert" (
    id text NOT NULL,
    "diagnosticResultId" text NOT NULL,
    "facilityId" text NOT NULL,
    "adminId" text NOT NULL,
    reason text NOT NULL,
    status public."EscalationAlertStatus" DEFAULT 'SENT'::public."EscalationAlertStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."FacilityEscalationAlert" OWNER TO m3_staging;

--
-- Name: FacilityStaffAssignment; Type: TABLE; Schema: public; Owner: m3_staging
--

CREATE TABLE public."FacilityStaffAssignment" (
    id text NOT NULL,
    "facilityId" text NOT NULL,
    "userId" text NOT NULL,
    role public."Role" NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "startDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "endDate" timestamp(3) without time zone,
    "assignedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."FacilityStaffAssignment" OWNER TO m3_staging;

--
-- Name: FollowUp; Type: TABLE; Schema: public; Owner: m3_staging
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


ALTER TABLE public."FollowUp" OWNER TO m3_staging;

--
-- Name: HouseholdAssessment; Type: TABLE; Schema: public; Owner: m3_staging
--

CREATE TABLE public."HouseholdAssessment" (
    id text NOT NULL,
    "memberId" text NOT NULL,
    "clinicianId" text NOT NULL,
    "assessedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "memberPresent" boolean DEFAULT true NOT NULL,
    "workerPresent" boolean DEFAULT false NOT NULL,
    symptoms jsonb DEFAULT '[]'::jsonb NOT NULL,
    "clinicalHistory" text,
    "examinationFindings" text,
    "testRequested" boolean DEFAULT false NOT NULL,
    "testType" public."TestType",
    "testResult" public."DiagnosticResultValue",
    diagnosis text,
    treatment text,
    "referralInfo" text,
    "followUpRequired" boolean DEFAULT false NOT NULL,
    "nextFollowUpDate" timestamp(3) without time zone,
    "clinicalNotes" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."HouseholdAssessment" OWNER TO m3_staging;

--
-- Name: HouseholdMember; Type: TABLE; Schema: public; Owner: m3_staging
--

CREATE TABLE public."HouseholdMember" (
    id text NOT NULL,
    "memberCode" text NOT NULL,
    "workerId" text NOT NULL,
    "fullName" text,
    relationship public."HouseholdRelationship" NOT NULL,
    "ageOrDob" text,
    gender text,
    "preferredLanguage" public."Language" DEFAULT 'en'::public."Language" NOT NULL,
    "phoneAvailable" boolean DEFAULT false NOT NULL,
    phone text,
    "livesInSameRoom" boolean DEFAULT true NOT NULL,
    "isDependent" boolean DEFAULT false NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "createdById" text,
    "lastUpdatedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."HouseholdMember" OWNER TO m3_staging;

--
-- Name: IdempotencyKey; Type: TABLE; Schema: public; Owner: m3_staging
--

CREATE TABLE public."IdempotencyKey" (
    id text NOT NULL,
    key text NOT NULL,
    scope text NOT NULL,
    "userId" text,
    "entityId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."IdempotencyKey" OWNER TO m3_staging;

--
-- Name: InitialScreening; Type: TABLE; Schema: public; Owner: m3_staging
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
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "facilityId" text,
    "screenedById" text
);


ALTER TABLE public."InitialScreening" OWNER TO m3_staging;

--
-- Name: LocationNode; Type: TABLE; Schema: public; Owner: m3_staging
--

CREATE TABLE public."LocationNode" (
    id text NOT NULL,
    level public."LocationLevel" NOT NULL,
    name text NOT NULL,
    "parentId" text
);


ALTER TABLE public."LocationNode" OWNER TO m3_staging;

--
-- Name: MalariaEpisode; Type: TABLE; Schema: public; Owner: m3_staging
--

CREATE TABLE public."MalariaEpisode" (
    id text NOT NULL,
    "workerId" text NOT NULL,
    status public."EpisodeStatus" DEFAULT 'SUSPECTED'::public."EpisodeStatus" NOT NULL,
    "onsetDate" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."MalariaEpisode" OWNER TO m3_staging;

--
-- Name: Notification; Type: TABLE; Schema: public; Owner: m3_staging
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
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "acknowledgedAt" timestamp(3) without time zone,
    "actionTaken" text,
    "actionTakenAt" timestamp(3) without time zone,
    "actionTakenById" text,
    "audienceFacilityId" text
);


ALTER TABLE public."Notification" OWNER TO m3_staging;

--
-- Name: Prescription; Type: TABLE; Schema: public; Owner: m3_staging
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


ALTER TABLE public."Prescription" OWNER TO m3_staging;

--
-- Name: ProfileCorrectionRequest; Type: TABLE; Schema: public; Owner: m3_staging
--

CREATE TABLE public."ProfileCorrectionRequest" (
    id text NOT NULL,
    "workerId" text NOT NULL,
    "fieldName" text NOT NULL,
    "currentValue" text NOT NULL,
    "proposedValue" text NOT NULL,
    reason text NOT NULL,
    status public."CorrectionStatus" DEFAULT 'SUBMITTED'::public."CorrectionStatus" NOT NULL,
    "reviewedById" text,
    "reviewedAt" timestamp(3) without time zone,
    "adminNote" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ProfileCorrectionRequest" OWNER TO m3_staging;

--
-- Name: SiteJoinRequest; Type: TABLE; Schema: public; Owner: m3_staging
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


ALTER TABLE public."SiteJoinRequest" OWNER TO m3_staging;

--
-- Name: SiteTransferRequest; Type: TABLE; Schema: public; Owner: m3_staging
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


ALTER TABLE public."SiteTransferRequest" OWNER TO m3_staging;

--
-- Name: SymptomReport; Type: TABLE; Schema: public; Owner: m3_staging
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


ALTER TABLE public."SymptomReport" OWNER TO m3_staging;

--
-- Name: TranslationRecord; Type: TABLE; Schema: public; Owner: m3_staging
--

CREATE TABLE public."TranslationRecord" (
    id text NOT NULL,
    "entityType" text NOT NULL,
    "entityId" text NOT NULL,
    "fieldName" text NOT NULL,
    "originalText" text NOT NULL,
    "originalLanguage" public."Language" NOT NULL,
    "translatedText" text,
    status public."TranslationStatus" DEFAULT 'PENDING'::public."TranslationStatus" NOT NULL,
    service text DEFAULT 'backend-internal'::text NOT NULL,
    "reviewerId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."TranslationRecord" OWNER TO m3_staging;

--
-- Name: TravelRecord; Type: TABLE; Schema: public; Owner: m3_staging
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
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "arrivalConfirmedAt" timestamp(3) without time zone,
    "arrivalFacilityId" text,
    "arrivalFever" boolean,
    "arrivalHealthWorkerId" text,
    "arrivalReferred" boolean,
    "arrivalTestedOrTreated" boolean,
    "departureAdminAt" timestamp(3) without time zone,
    "departureAdminId" text,
    "departureCancelReason" text,
    "departureStatus" public."DepartureConfirmationStatus",
    direction public."TravelDirection",
    district text,
    "originDistrict" text,
    "originState" text,
    "originTown" text,
    purpose text,
    town text
);


ALTER TABLE public."TravelRecord" OWNER TO m3_staging;

--
-- Name: TravelReport; Type: TABLE; Schema: public; Owner: m3_staging
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


ALTER TABLE public."TravelReport" OWNER TO m3_staging;

--
-- Name: User; Type: TABLE; Schema: public; Owner: m3_staging
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


ALTER TABLE public."User" OWNER TO m3_staging;

--
-- Name: Worker; Type: TABLE; Schema: public; Owner: m3_staging
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


ALTER TABLE public."Worker" OWNER TO m3_staging;

--
-- Name: WorkerPassToken; Type: TABLE; Schema: public; Owner: m3_staging
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


ALTER TABLE public."WorkerPassToken" OWNER TO m3_staging;

--
-- Name: WorkerSiteAssignment; Type: TABLE; Schema: public; Owner: m3_staging
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


ALTER TABLE public."WorkerSiteAssignment" OWNER TO m3_staging;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: m3_staging
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


ALTER TABLE public._prisma_migrations OWNER TO m3_staging;

--
-- Data for Name: AppInstallConsent; Type: TABLE DATA; Schema: public; Owner: m3_staging
--

COPY public."AppInstallConsent" (id, "workerId", version, language, status, "deviceInfo", "appVersion", "createdAt") FROM stdin;
\.


--
-- Data for Name: AuditLog; Type: TABLE DATA; Schema: public; Owner: m3_staging
--

COPY public."AuditLog" (id, "actorId", action, "entityType", "entityId", metadata, "createdAt") FROM stdin;
\.


--
-- Data for Name: ConstructionSite; Type: TABLE DATA; Schema: public; Owner: m3_staging
--

COPY public."ConstructionSite" (id, "siteCode", name, "areaId", "contractorId", active, "createdAt", address, landmark, "contactPhone") FROM stdin;
9eb5fea3-5306-4ce4-bf2e-6dddf349fafd	SITE-SIM01	M3 Simulation Construction Site - Panaji Coastal	6e0fe17e-a499-45d3-b5cb-a2bd518c4fcc	\N	t	2026-11-11 08:34:05.34	Plot 42, Mandovi Bay Promenade, Panaji, North Goa 403001	Near Mandovi River Viewpoint	9800000001
\.


--
-- Data for Name: Contractor; Type: TABLE DATA; Schema: public; Owner: m3_staging
--

COPY public."Contractor" (id, name, "createdAt") FROM stdin;
a6c0372f-ab5e-4446-9627-74bc15533a90	Simulation Contractor Alpha	2026-11-11 08:34:05.362
d85967f4-1fd7-4fee-ae46-3536c6176271	Simulation Contractor Beta	2026-11-11 08:34:05.415
\.


--
-- Data for Name: ContractorSite; Type: TABLE DATA; Schema: public; Owner: m3_staging
--

COPY public."ContractorSite" (id, "contractorId", "siteId", active, "assignedAt", "removedAt") FROM stdin;
cc4cbe81-d7d1-445e-8e0d-b621752f7c50	a6c0372f-ab5e-4446-9627-74bc15533a90	9eb5fea3-5306-4ce4-bf2e-6dddf349fafd	t	2026-11-11 08:34:05.395	\N
74bfb8f0-abb9-4e75-b912-4898b1f69006	d85967f4-1fd7-4fee-ae46-3536c6176271	9eb5fea3-5306-4ce4-bf2e-6dddf349fafd	t	2026-11-11 08:34:05.437	\N
\.


--
-- Data for Name: DataSubmissionConsent; Type: TABLE DATA; Schema: public; Owner: m3_staging
--

COPY public."DataSubmissionConsent" (id, "workerId", version, language, status, "formId", "deviceInfo", "appVersion", "createdAt") FROM stdin;
\.


--
-- Data for Name: DiagnosticResult; Type: TABLE DATA; Schema: public; Owner: m3_staging
--

COPY public."DiagnosticResult" (id, "episodeId", "testType", result, species, "testDate", "createdById", "createdAt") FROM stdin;
64bf6985-a59a-4424-937a-88434b859a1e	9e65c071-88b9-4d47-a044-af2b8ef979da	RDT	POSITIVE	P_VIVAX	2026-11-11 08:35:45.568	\N	2026-11-11 08:35:45.569
4daa9dda-4e92-4ead-b98e-cfcdbf7cf213	34f51263-24be-4951-8c76-28905f460f07	RDT	NEGATIVE	\N	2026-11-11 08:35:45.686	\N	2026-11-11 08:35:45.687
\.


--
-- Data for Name: EscalationRecipient; Type: TABLE DATA; Schema: public; Owner: m3_staging
--

COPY public."EscalationRecipient" (id, "alertId", "clinicianId", "deliveredAt", "acknowledgedAt", "actionTaken", "actionTakenAt", status) FROM stdin;
\.


--
-- Data for Name: Facility; Type: TABLE DATA; Schema: public; Owner: m3_staging
--

COPY public."Facility" (id, "facilityCode", name, type, state, district, taluka, address, latitude, longitude, "contactPhone", "contactEmail", active, "createdAt", "updatedAt") FROM stdin;
35f882ac-68ac-4862-bd51-ec09f6485923	PHC-001	Candolim Primary Health Centre	PHC	Goa	North Goa	Bardez	Near Candolim Panchayat, Main Road, Candolim, Goa 403515	15.5185	73.7682	0832-2489021	phc.candolim@health.goa.gov.in	t	2026-11-11 08:34:05.22	2026-11-11 08:34:05.22
fd2c1da4-9036-4d2b-99a4-bab28e87dbd6	UHC-001	Panaji Urban Health Centre	UHC	Goa	North Goa	Tiswadi	Near Church Square, Panaji, Goa	\N	\N	0832-2225432	\N	t	2026-11-11 08:36:38.826	2026-11-11 08:36:38.826
\.


--
-- Data for Name: FacilityEscalationAlert; Type: TABLE DATA; Schema: public; Owner: m3_staging
--

COPY public."FacilityEscalationAlert" (id, "diagnosticResultId", "facilityId", "adminId", reason, status, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: FacilityStaffAssignment; Type: TABLE DATA; Schema: public; Owner: m3_staging
--

COPY public."FacilityStaffAssignment" (id, "facilityId", "userId", role, active, "startDate", "endDate", "assignedById", "createdAt", "updatedAt") FROM stdin;
2ff14c63-30ee-476b-8fa3-1c6261006f00	35f882ac-68ac-4862-bd51-ec09f6485923	761826f2-f597-4a1a-96fc-33b95f879547	HEALTH_WORKER	t	2026-11-11 08:34:05.461	\N	\N	2026-11-11 08:34:05.461	2026-11-11 08:34:05.461
\.


--
-- Data for Name: FollowUp; Type: TABLE DATA; Schema: public; Owner: m3_staging
--

COPY public."FollowUp" (id, "workerId", "episodeId", question, response, note, "respondedAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: HouseholdAssessment; Type: TABLE DATA; Schema: public; Owner: m3_staging
--

COPY public."HouseholdAssessment" (id, "memberId", "clinicianId", "assessedAt", "memberPresent", "workerPresent", symptoms, "clinicalHistory", "examinationFindings", "testRequested", "testType", "testResult", diagnosis, treatment, "referralInfo", "followUpRequired", "nextFollowUpDate", "clinicalNotes", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: HouseholdMember; Type: TABLE DATA; Schema: public; Owner: m3_staging
--

COPY public."HouseholdMember" (id, "memberCode", "workerId", "fullName", relationship, "ageOrDob", gender, "preferredLanguage", "phoneAvailable", phone, "livesInSameRoom", "isDependent", active, "createdById", "lastUpdatedById", "createdAt", "updatedAt") FROM stdin;
01b9e0e8-d8b5-4909-bf14-b86d4aae2290	M3-HH-SIM01-01	27b9a883-4718-46c1-b30c-45b189ed3d90	Sita Kumar	SPOUSE	29	female	en	f	\N	t	t	t	\N	\N	2026-11-11 08:35:45.596	2026-11-11 08:35:45.596
b851a7ef-d67c-420b-9f5d-2ab2eb0a3749	M3-HH-SIM01-02	27b9a883-4718-46c1-b30c-45b189ed3d90	Aarav Kumar	CHILD	6	male	en	f	\N	t	t	t	\N	\N	2026-11-11 08:35:45.608	2026-11-11 08:35:45.608
8e07cc56-a520-46dc-b70b-45bdf560b1c8	M3-HH-SIM02-01	429ea7b6-e6ab-428f-8046-26b0cd701744	Geeta Patel	SPOUSE	26	female	en	f	\N	t	t	t	\N	\N	2026-11-11 08:35:45.699	2026-11-11 08:35:45.699
\.


--
-- Data for Name: IdempotencyKey; Type: TABLE DATA; Schema: public; Owner: m3_staging
--

COPY public."IdempotencyKey" (id, key, scope, "userId", "entityId", "createdAt") FROM stdin;
\.


--
-- Data for Name: InitialScreening; Type: TABLE DATA; Schema: public; Owner: m3_staging
--

COPY public."InitialScreening" (id, "workerId", status, version, "consentGiven", answers, "completedAt", "createdAt", "updatedAt", "facilityId", "screenedById") FROM stdin;
a720f934-665d-4dc7-9d95-66a1136d9b4f	27b9a883-4718-46c1-b30c-45b189ed3d90	COMPLETE	worker-screening-2026-10-31	t	{"gender": "male", "age_years": 32, "full_name": "Ramesh Kumar", "fever_today": "yes", "mobile_number": "9800000301", "diagnosed_malaria": "yes", "present_address_site_id": "SITE-SIM01", "present_address_district": "North Goa"}	2026-11-11 08:35:45.517	2026-11-11 08:35:45.518	2026-11-11 08:35:45.518	35f882ac-68ac-4862-bd51-ec09f6485923	761826f2-f597-4a1a-96fc-33b95f879547
7e604018-ec67-45ad-a539-713c8cd2b038	429ea7b6-e6ab-428f-8046-26b0cd701744	COMPLETE	worker-screening-2026-10-31	t	{"gender": "male", "age_years": 28, "full_name": "Suresh Patel", "fever_today": "no", "mobile_number": "9800000302", "diagnosed_malaria": "no"}	2026-11-11 08:35:45.663	2026-11-11 08:35:45.664	2026-11-11 08:35:45.664	35f882ac-68ac-4862-bd51-ec09f6485923	761826f2-f597-4a1a-96fc-33b95f879547
0f0015e3-3a01-4784-a0cd-e9b2e63b0958	1f82d95a-c309-4627-ae99-5989040b5d2a	COMPLETE	worker-screening-2026-10-31	t	{"gender": "male", "age_years": 25, "full_name": "Vijay Singh", "fever_today": "yes", "mobile_number": "9800000303"}	2026-11-11 08:35:45.744	2026-11-11 08:35:45.744	2026-11-11 08:35:45.744	35f882ac-68ac-4862-bd51-ec09f6485923	761826f2-f597-4a1a-96fc-33b95f879547
\.


--
-- Data for Name: LocationNode; Type: TABLE DATA; Schema: public; Owner: m3_staging
--

COPY public."LocationNode" (id, level, name, "parentId") FROM stdin;
8b6740ca-eaa4-4f75-b2c9-6fe68959f837	STATE	Goa	\N
f6145a6f-16d8-4086-bd0a-1e020d1ecbaf	DISTRICT	North Goa	8b6740ca-eaa4-4f75-b2c9-6fe68959f837
20211db3-3804-481a-83aa-bb7994dc6aef	TALUKA	Tiswadi	f6145a6f-16d8-4086-bd0a-1e020d1ecbaf
6e0fe17e-a499-45d3-b5cb-a2bd518c4fcc	AREA	Panaji	20211db3-3804-481a-83aa-bb7994dc6aef
7902052c-5f6b-4b8f-9dbc-6d4eb488f1ce	AREA	Old Goa	20211db3-3804-481a-83aa-bb7994dc6aef
daace813-346d-4eaf-a310-79811388b876	AREA	Ribandar	20211db3-3804-481a-83aa-bb7994dc6aef
49ef1dd7-aee3-443e-ad2c-90861a0606c4	AREA	Santa Cruz	20211db3-3804-481a-83aa-bb7994dc6aef
1ba00d49-859b-449d-8208-b4ff338e1136	AREA	Taleigao	20211db3-3804-481a-83aa-bb7994dc6aef
1b9dc0b2-50b8-4dcb-937a-afb09a8949ff	AREA	Merces	20211db3-3804-481a-83aa-bb7994dc6aef
c3a0ee8b-6ea4-43d8-bd5b-fcf6951597d7	AREA	Chimbel	20211db3-3804-481a-83aa-bb7994dc6aef
6cb288f7-ee3a-4afe-b755-c6dbfab80993	AREA	Bambolim	20211db3-3804-481a-83aa-bb7994dc6aef
615d8933-27ed-451b-a38c-7ed162e9019e	AREA	Corlim	20211db3-3804-481a-83aa-bb7994dc6aef
2d54fae4-3b4c-4bb9-a9c0-a4aa5298f106	AREA	Curca	20211db3-3804-481a-83aa-bb7994dc6aef
25964323-7e17-4218-9599-ba74774a2a10	AREA	Neura	20211db3-3804-481a-83aa-bb7994dc6aef
7c80775c-45f8-4cef-a599-267241c42d25	AREA	Siridao	20211db3-3804-481a-83aa-bb7994dc6aef
313089ab-56b5-4698-a626-b3aa3f27d63d	AREA	Mandur	20211db3-3804-481a-83aa-bb7994dc6aef
41b59c76-2400-4dad-ac2b-f16ee99befaf	AREA	Batim	20211db3-3804-481a-83aa-bb7994dc6aef
4a467ea9-ed6c-4a1b-b089-65314e6bc7d2	AREA	Carambolim	20211db3-3804-481a-83aa-bb7994dc6aef
5a5e375c-cf68-4de9-82ea-86e4e2585e36	AREA	St. Estevam	20211db3-3804-481a-83aa-bb7994dc6aef
4035664c-4d5a-4686-b69a-7d6cf59308e4	AREA	Cumbarjua	20211db3-3804-481a-83aa-bb7994dc6aef
c7406e9d-9b6a-4025-b97f-428cfb3bf996	AREA	Chorao	20211db3-3804-481a-83aa-bb7994dc6aef
645c6735-f57e-4d1c-a362-9455b8bc87f4	AREA	Divar	20211db3-3804-481a-83aa-bb7994dc6aef
e351498a-6d69-4c71-b0f8-53df2fa5f8b7	AREA	Goltim-Navelim	20211db3-3804-481a-83aa-bb7994dc6aef
b7a3e756-3398-4bfa-8c46-2f63e0eec52e	AREA	Azossim	20211db3-3804-481a-83aa-bb7994dc6aef
b059ac8c-3945-4a1e-8d91-e48302aa2d76	AREA	Ella	20211db3-3804-481a-83aa-bb7994dc6aef
14ce274b-906c-4f6a-8b80-972e7f2af88a	TALUKA	Bardez	f6145a6f-16d8-4086-bd0a-1e020d1ecbaf
cfc255d0-eddc-4b85-aca7-6c387e9cb258	AREA	Candolim	14ce274b-906c-4f6a-8b80-972e7f2af88a
e3808838-2aab-4560-afb2-65ad3d37dca6	AREA	Mapusa	14ce274b-906c-4f6a-8b80-972e7f2af88a
97e0ca23-b188-49e8-b20e-3d8298830157	AREA	Calangute	14ce274b-906c-4f6a-8b80-972e7f2af88a
54280357-5c35-4cfd-b1f3-87f2be992ba2	AREA	Anjuna	14ce274b-906c-4f6a-8b80-972e7f2af88a
fed209d2-bb0e-41bb-b73a-e9c288cfba83	AREA	Arpora	14ce274b-906c-4f6a-8b80-972e7f2af88a
f8d5f53e-78bf-48d0-ab3f-9dc0de870a57	AREA	Colvale	14ce274b-906c-4f6a-8b80-972e7f2af88a
5ba28f22-c083-41d9-8121-044d0ea38834	AREA	Guirim	14ce274b-906c-4f6a-8b80-972e7f2af88a
09a479f3-65aa-465b-a5e8-da3cf1e46dc8	AREA	Moira	14ce274b-906c-4f6a-8b80-972e7f2af88a
48869a3d-dd9e-4676-9e56-986d7eba35f6	AREA	Nachinola	14ce274b-906c-4f6a-8b80-972e7f2af88a
6f6b3db0-5ba1-4385-81eb-d2c5ecccca3e	AREA	Nerul	14ce274b-906c-4f6a-8b80-972e7f2af88a
85209753-c5df-4254-a6dd-c2cb8015b1a1	AREA	Parra	14ce274b-906c-4f6a-8b80-972e7f2af88a
49460ee6-e19a-4f37-99f9-634a4dabc8b5	AREA	Pilerne	14ce274b-906c-4f6a-8b80-972e7f2af88a
7a1de186-47c2-4580-8b5a-91b58c2adfde	AREA	Porvorim	14ce274b-906c-4f6a-8b80-972e7f2af88a
4dece24c-e69b-4af1-93fb-88a1df042c17	AREA	Reis Magos	14ce274b-906c-4f6a-8b80-972e7f2af88a
f73a06e3-9cf9-4e68-8171-1115c2c022ad	AREA	Saligao	14ce274b-906c-4f6a-8b80-972e7f2af88a
38eed646-c960-4e75-a7cc-44c4b5885a8b	AREA	Siolim	14ce274b-906c-4f6a-8b80-972e7f2af88a
eca24a98-c7cb-484b-819a-b651c9c95ab3	AREA	Socorro	14ce274b-906c-4f6a-8b80-972e7f2af88a
93e2790d-5776-4df9-a31d-1653611b5631	AREA	Tivim	14ce274b-906c-4f6a-8b80-972e7f2af88a
dac31522-b034-4fda-94bf-b7be72e8489d	AREA	Vagator	14ce274b-906c-4f6a-8b80-972e7f2af88a
b6a21053-445a-4645-a053-65a7afe7dd20	AREA	Penha de Franca	14ce274b-906c-4f6a-8b80-972e7f2af88a
730fc666-0ea8-43e2-9908-c4f0cd1f3737	AREA	Aldona	14ce274b-906c-4f6a-8b80-972e7f2af88a
15ffa312-1ce8-47ab-938c-213ade52071e	AREA	Assagao	14ce274b-906c-4f6a-8b80-972e7f2af88a
cbea2017-b109-4767-aa72-c1803ae01b26	AREA	Bastora	14ce274b-906c-4f6a-8b80-972e7f2af88a
58ce14d2-1ba7-4362-ae22-694813f6add4	AREA	Salvador do Mundo	14ce274b-906c-4f6a-8b80-972e7f2af88a
28b9f125-c3b5-4235-9d0d-aad7b8d9dd71	AREA	Sangolda	14ce274b-906c-4f6a-8b80-972e7f2af88a
7d8eaf25-ce2f-4c23-884e-5dee1a1fb85d	AREA	Verla-Canca	14ce274b-906c-4f6a-8b80-972e7f2af88a
44f3a417-98d6-4496-81c9-d1d6b3317580	AREA	Nagoa	14ce274b-906c-4f6a-8b80-972e7f2af88a
604bd8f8-d28b-4f4c-ab74-20c1b4f3f905	TALUKA	Pernem	f6145a6f-16d8-4086-bd0a-1e020d1ecbaf
83fc41d4-adf7-41fb-b492-af36ca9d23d1	AREA	Pernem	604bd8f8-d28b-4f4c-ab74-20c1b4f3f905
1a72f859-ee41-4e19-a979-cbf91109df74	AREA	Arambol	604bd8f8-d28b-4f4c-ab74-20c1b4f3f905
776d360f-b694-432b-869e-aeaea39ae77c	AREA	Mandrem	604bd8f8-d28b-4f4c-ab74-20c1b4f3f905
786a0f53-0473-41bc-8ac5-a8a1245b08b8	AREA	Morjim	604bd8f8-d28b-4f4c-ab74-20c1b4f3f905
69be05cc-e3a3-4df7-9bb7-abfc007258ff	AREA	Tuem	604bd8f8-d28b-4f4c-ab74-20c1b4f3f905
3f7fce0f-54f8-4a17-8c56-9d10d3506b37	AREA	Dhargalim	604bd8f8-d28b-4f4c-ab74-20c1b4f3f905
9c5d172d-27b5-4b83-a471-b0d2120ff918	AREA	Querim	604bd8f8-d28b-4f4c-ab74-20c1b4f3f905
d47e4621-4b06-4330-b155-4358e1e0d22f	AREA	Agarwada	604bd8f8-d28b-4f4c-ab74-20c1b4f3f905
321d275f-70a4-4ece-b570-928dedf2fe7a	AREA	Alorna	604bd8f8-d28b-4f4c-ab74-20c1b4f3f905
8b197eb6-e0f2-4b1c-b35c-3fcc19a4b898	AREA	Casarvarnem	604bd8f8-d28b-4f4c-ab74-20c1b4f3f905
790f9e94-9767-4ada-8e38-557349baab1a	AREA	Chandel	604bd8f8-d28b-4f4c-ab74-20c1b4f3f905
7451f57f-7f85-45db-a4c4-51e1a6957b4d	AREA	Corgao	604bd8f8-d28b-4f4c-ab74-20c1b4f3f905
6ccd80c7-a167-46eb-bf97-6475f2f975bd	AREA	Ibrampur	604bd8f8-d28b-4f4c-ab74-20c1b4f3f905
19bec53f-580b-4cc8-b2ae-9135ec8c0178	AREA	Mopa	604bd8f8-d28b-4f4c-ab74-20c1b4f3f905
9d2bccc8-3b41-424a-9f38-9abe312a1704	AREA	Ozorim	604bd8f8-d28b-4f4c-ab74-20c1b4f3f905
f2b110e5-0ece-4ace-b3d2-6bbde11d170e	AREA	Paliem	604bd8f8-d28b-4f4c-ab74-20c1b4f3f905
4d4ca6ee-ba94-4e59-94d3-bb198846b751	AREA	Torxem	604bd8f8-d28b-4f4c-ab74-20c1b4f3f905
b7473218-8fa3-47d0-90ed-7e8682f3cc4b	AREA	Virnora	604bd8f8-d28b-4f4c-ab74-20c1b4f3f905
76fb4a83-709e-46bd-9ef7-83b86462b69c	AREA	Warchawada	604bd8f8-d28b-4f4c-ab74-20c1b4f3f905
ae2dc5da-446f-4c41-8745-8fa3debca35c	AREA	Parxem	604bd8f8-d28b-4f4c-ab74-20c1b4f3f905
3c1e234a-5dc5-4053-a9a4-8a4fdeafee41	TALUKA	Bicholim	f6145a6f-16d8-4086-bd0a-1e020d1ecbaf
8c06adaf-a12d-4fed-a8f5-b3b0ef2eda5a	AREA	Bicholim	3c1e234a-5dc5-4053-a9a4-8a4fdeafee41
a2970c56-7cd1-4bde-b3c0-ab7468016bbc	AREA	Sanqelim	3c1e234a-5dc5-4053-a9a4-8a4fdeafee41
55f81abd-7c9b-480b-b3af-8302b7b0c34b	AREA	Mayem	3c1e234a-5dc5-4053-a9a4-8a4fdeafee41
5d82db88-193c-4223-80f7-8f0b72fba06f	AREA	Mulgao	3c1e234a-5dc5-4053-a9a4-8a4fdeafee41
73ec6443-52cf-472e-9966-64f4f9228403	AREA	Pale	3c1e234a-5dc5-4053-a9a4-8a4fdeafee41
93133b67-a712-4d37-891e-68027785186f	AREA	Piligao	3c1e234a-5dc5-4053-a9a4-8a4fdeafee41
75a219e0-c366-4c54-a5b9-e5e1bbac7ce5	AREA	Sirigao	3c1e234a-5dc5-4053-a9a4-8a4fdeafee41
6b5a0347-7826-4936-ae10-ad3e56d62351	AREA	Surla	3c1e234a-5dc5-4053-a9a4-8a4fdeafee41
a679c494-198b-4feb-9639-727d11a4e859	AREA	Kudne	3c1e234a-5dc5-4053-a9a4-8a4fdeafee41
25cb83fd-b1cf-40de-8e4f-9595fd70ae83	AREA	Advalpal	3c1e234a-5dc5-4053-a9a4-8a4fdeafee41
e2ee21a0-d47f-4468-8087-f88663cbf3cd	AREA	Amona	3c1e234a-5dc5-4053-a9a4-8a4fdeafee41
ddcf48e0-1a48-4a2e-8642-f0a6aa63e0e2	AREA	Bordem	3c1e234a-5dc5-4053-a9a4-8a4fdeafee41
ee619898-d644-4845-9076-72d10831d8d3	AREA	Karapur	3c1e234a-5dc5-4053-a9a4-8a4fdeafee41
027cf72a-d2c2-408c-9a40-54c0b3097e70	AREA	Navelim (Bicholim)	3c1e234a-5dc5-4053-a9a4-8a4fdeafee41
39d400a8-b766-4454-99ac-9ec3129ddca6	AREA	Salem	3c1e234a-5dc5-4053-a9a4-8a4fdeafee41
3b7f0d7e-3de2-4fc1-bed0-e903220c95f2	AREA	Velinga	3c1e234a-5dc5-4053-a9a4-8a4fdeafee41
d581b4f3-164d-4378-b59f-4efc57b4a855	AREA	Latambarcem	3c1e234a-5dc5-4053-a9a4-8a4fdeafee41
9bc7d354-ba71-4ea6-a5ec-31d7489b12a1	AREA	Mencurem	3c1e234a-5dc5-4053-a9a4-8a4fdeafee41
1fbe237a-5f14-4e27-b03a-31c4b8936730	TALUKA	Sattari	f6145a6f-16d8-4086-bd0a-1e020d1ecbaf
0d0d86b4-c37e-4186-8705-eabb9bbd6e6b	AREA	Valpoi	1fbe237a-5f14-4e27-b03a-31c4b8936730
50c93c6b-7e6e-45af-9065-740841e52bce	AREA	Honda	1fbe237a-5f14-4e27-b03a-31c4b8936730
f110986e-a691-4d91-9fad-4c4778f02e97	AREA	Pissurlem	1fbe237a-5f14-4e27-b03a-31c4b8936730
d1f9acaa-5255-4d13-869f-f7e29e94d201	AREA	Keri	1fbe237a-5f14-4e27-b03a-31c4b8936730
dff9ef86-655c-4242-9bff-3eaa21e2df5e	AREA	Morlem	1fbe237a-5f14-4e27-b03a-31c4b8936730
03b02800-fa38-4b3b-a1e9-c8c2d753f161	AREA	Nagargao	1fbe237a-5f14-4e27-b03a-31c4b8936730
5798f81b-9cb8-4554-83a4-fce6a9ab5701	AREA	Thane	1fbe237a-5f14-4e27-b03a-31c4b8936730
07b86606-0a0a-4ed0-a08c-feab9e67dfb2	AREA	Sanvordem (Sattari)	1fbe237a-5f14-4e27-b03a-31c4b8936730
d5d17c99-ef75-4992-a352-942c94fffd71	AREA	Birondem	1fbe237a-5f14-4e27-b03a-31c4b8936730
a5f1f1bb-ddf2-4e15-b2fd-103f25652182	AREA	Mauxi	1fbe237a-5f14-4e27-b03a-31c4b8936730
bbae5037-4300-4298-944e-69f3131a796f	AREA	Poriem	1fbe237a-5f14-4e27-b03a-31c4b8936730
f6f2900f-fa49-4e77-b1b3-5eb42949bfb8	AREA	Ravan	1fbe237a-5f14-4e27-b03a-31c4b8936730
abf4f345-5dde-4bb8-807d-d6cd20fb308c	AREA	Rivem	1fbe237a-5f14-4e27-b03a-31c4b8936730
5527b0cb-aa89-4e8f-b715-7b92c842b2a5	AREA	Savarde	1fbe237a-5f14-4e27-b03a-31c4b8936730
1a61c424-84f2-4512-9adb-28860383d4cf	AREA	Dongurli	1fbe237a-5f14-4e27-b03a-31c4b8936730
823fe704-f082-4aba-a7a0-700a7b1ae262	TALUKA	Ponda	f6145a6f-16d8-4086-bd0a-1e020d1ecbaf
76d17e8d-fea3-4a53-9533-c3313f35247f	AREA	Ponda	823fe704-f082-4aba-a7a0-700a7b1ae262
a546eef7-2f9d-4f0c-9c9b-1a38be994831	AREA	Bandora	823fe704-f082-4aba-a7a0-700a7b1ae262
da6fba50-0a74-445e-a5ae-63bfeff929e6	AREA	Borim	823fe704-f082-4aba-a7a0-700a7b1ae262
96fa3ee5-c463-4a0c-a9fa-0105c650aef9	AREA	Curti	823fe704-f082-4aba-a7a0-700a7b1ae262
a69eafc2-9cd7-4202-87bd-8a27d6ae17f9	AREA	Kundaim	823fe704-f082-4aba-a7a0-700a7b1ae262
bb21520b-aaec-4f7c-bb5f-b52be6da8d17	AREA	Marcaim	823fe704-f082-4aba-a7a0-700a7b1ae262
46d11090-6462-4c94-8035-f6baa4a7a4c5	AREA	Priol	823fe704-f082-4aba-a7a0-700a7b1ae262
27f5a1fa-66e5-4d26-ae0c-a22061f9d4e1	AREA	Shiroda	823fe704-f082-4aba-a7a0-700a7b1ae262
647e7eea-5ccd-4555-875e-d5e2c46ea413	AREA	Usgao	823fe704-f082-4aba-a7a0-700a7b1ae262
478151b0-7e7c-40be-afa4-ae36dfec4c47	AREA	Veling	823fe704-f082-4aba-a7a0-700a7b1ae262
af81d2d1-31b3-404b-810e-c016270c6bb3	AREA	Betora	823fe704-f082-4aba-a7a0-700a7b1ae262
83797b76-429e-4db6-99e4-629e1fd029ac	AREA	Candepar	823fe704-f082-4aba-a7a0-700a7b1ae262
19902cbc-c248-4770-aba0-b28bf27b8d2f	AREA	Durbhat	823fe704-f082-4aba-a7a0-700a7b1ae262
d44bdc75-1d58-4222-86ea-7df57d7f143b	AREA	Kavalem	823fe704-f082-4aba-a7a0-700a7b1ae262
7b693e97-0bc2-4223-9eba-7dbfadadd4ac	AREA	Querim (Ponda)	823fe704-f082-4aba-a7a0-700a7b1ae262
1f3bb918-aa4d-4941-b512-8e8f25338389	AREA	Talaulim	823fe704-f082-4aba-a7a0-700a7b1ae262
3a6aa5c0-afec-4718-baec-b08bc1a01ee8	AREA	Tivrem	823fe704-f082-4aba-a7a0-700a7b1ae262
4b5912bf-c1d8-4d7e-94b5-b658c0c900ea	AREA	Volvoi	823fe704-f082-4aba-a7a0-700a7b1ae262
0ec44cb0-1316-4a21-a19f-b8affd09b6be	AREA	Boma	823fe704-f082-4aba-a7a0-700a7b1ae262
ef72e052-e0a2-4fb5-8599-635f7c700749	AREA	Panchawadi	823fe704-f082-4aba-a7a0-700a7b1ae262
bc6a6e61-e5b0-4a61-a2bd-7e93db5f9498	DISTRICT	South Goa	8b6740ca-eaa4-4f75-b2c9-6fe68959f837
f31c9a66-6f8c-4de1-8133-bc1fc7837cfe	TALUKA	Salcete	bc6a6e61-e5b0-4a61-a2bd-7e93db5f9498
8f0f8a13-41cd-44f8-ab4a-39928636e122	AREA	Margao	f31c9a66-6f8c-4de1-8133-bc1fc7837cfe
6333d453-1bc8-4df1-bb3a-1311e681ebab	AREA	Benaulim	f31c9a66-6f8c-4de1-8133-bc1fc7837cfe
1fc5be5c-648d-4cbf-9c3d-73614e73c2b4	AREA	Colva	f31c9a66-6f8c-4de1-8133-bc1fc7837cfe
1ddbcb4a-1185-4954-9f3b-b777f1640abd	AREA	Curtorim	f31c9a66-6f8c-4de1-8133-bc1fc7837cfe
a85d05f3-e957-41f7-8950-04bf34b572a0	AREA	Fatorda	f31c9a66-6f8c-4de1-8133-bc1fc7837cfe
d619e04a-50dd-4e25-b503-a3b87b7cbe30	AREA	Loutolim	f31c9a66-6f8c-4de1-8133-bc1fc7837cfe
76ee1f4a-4d0d-40f8-a71b-4ea66275db02	AREA	Majorda	f31c9a66-6f8c-4de1-8133-bc1fc7837cfe
22a4723e-6f3e-4eae-ad90-4af5222d114f	AREA	Navelim	f31c9a66-6f8c-4de1-8133-bc1fc7837cfe
af833bd6-53b8-44d1-96a4-9369c73ca61c	AREA	Nuvem	f31c9a66-6f8c-4de1-8133-bc1fc7837cfe
4f553f17-d488-458b-9e7c-4113b03db009	AREA	Raia	f31c9a66-6f8c-4de1-8133-bc1fc7837cfe
35454999-3562-4b6d-bbdc-51b24adf76ce	AREA	Seraulim	f31c9a66-6f8c-4de1-8133-bc1fc7837cfe
f089f8fa-6070-4764-a118-dd4dea5a0387	AREA	Varca	f31c9a66-6f8c-4de1-8133-bc1fc7837cfe
c6e1b607-fc62-4a1f-84eb-94e2781bf564	AREA	Velim	f31c9a66-6f8c-4de1-8133-bc1fc7837cfe
127df27a-d754-4e73-a25a-a40463e32248	AREA	Aquem	f31c9a66-6f8c-4de1-8133-bc1fc7837cfe
7af3ff0f-a4a7-4a14-896d-0bca4466a2bd	AREA	Betalbatim	f31c9a66-6f8c-4de1-8133-bc1fc7837cfe
18fc7e05-4b28-4719-a252-a6f6c706d5e1	AREA	Carmona	f31c9a66-6f8c-4de1-8133-bc1fc7837cfe
74e5ced4-83fb-4e3a-820e-23c12cd4c8c3	AREA	Cavelossim	f31c9a66-6f8c-4de1-8133-bc1fc7837cfe
1c5221fa-ddd6-47fd-a2ef-c383bb14d05b	AREA	Chinchinim	f31c9a66-6f8c-4de1-8133-bc1fc7837cfe
1a7765ee-bb0b-490c-b1b0-c042bb8f6465	AREA	Davorlim	f31c9a66-6f8c-4de1-8133-bc1fc7837cfe
6b89778e-00df-4e45-97bf-e6b0a8b469b1	AREA	Guirdolim	f31c9a66-6f8c-4de1-8133-bc1fc7837cfe
5996216a-b72a-463e-868d-70466c154b88	AREA	Macasana	f31c9a66-6f8c-4de1-8133-bc1fc7837cfe
d785bf4c-033e-45f4-9c62-706b272b5ba3	AREA	Orlim	f31c9a66-6f8c-4de1-8133-bc1fc7837cfe
fcc13c45-4ad1-467a-b1a1-d49b91ddd23f	AREA	Paroda	f31c9a66-6f8c-4de1-8133-bc1fc7837cfe
a442810a-b2ad-4122-8aa6-52403bf06216	AREA	Rachol	f31c9a66-6f8c-4de1-8133-bc1fc7837cfe
90953f26-88f2-4fb8-8bca-2a66ccc2bf21	AREA	Rumdamol	f31c9a66-6f8c-4de1-8133-bc1fc7837cfe
bfb05f95-ae8e-4d55-9e00-cb6226f316a6	AREA	Sirlim	f31c9a66-6f8c-4de1-8133-bc1fc7837cfe
080f7ae1-1d9e-4bbb-b54e-0e5e4c544392	AREA	Assolna	f31c9a66-6f8c-4de1-8133-bc1fc7837cfe
63cb3b4d-ab49-4d31-ba48-80cc8ee85b78	AREA	Ambelim	f31c9a66-6f8c-4de1-8133-bc1fc7837cfe
61ad5f0d-9d5a-4baf-8a20-a23376e7a61c	TALUKA	Mormugao	bc6a6e61-e5b0-4a61-a2bd-7e93db5f9498
e2c0f60e-8678-413b-8da3-3dcbced0e11b	AREA	Vasco	61ad5f0d-9d5a-4baf-8a20-a23376e7a61c
3004af2b-bd99-4e8e-a05f-2a55b51d56e2	AREA	Vasco da Gama	61ad5f0d-9d5a-4baf-8a20-a23376e7a61c
ad6799cb-214d-4630-bfec-ef8699cbe29a	AREA	Mormugao	61ad5f0d-9d5a-4baf-8a20-a23376e7a61c
d948f745-f138-48aa-9e2f-49753e83400a	AREA	Dabolim	61ad5f0d-9d5a-4baf-8a20-a23376e7a61c
88d95612-ea4d-443b-ad30-8fd4232ad45c	AREA	Chicalim	61ad5f0d-9d5a-4baf-8a20-a23376e7a61c
56710f5a-3909-46b6-ba10-050c08e52095	AREA	Cortalim	61ad5f0d-9d5a-4baf-8a20-a23376e7a61c
a43be1fe-72a3-4e44-8e1b-efa6d11a500e	AREA	Sancoale	61ad5f0d-9d5a-4baf-8a20-a23376e7a61c
533f8036-cb7a-4ad6-b317-d8e67767cf19	AREA	Bogmalo	61ad5f0d-9d5a-4baf-8a20-a23376e7a61c
f85b5402-44e8-4f51-a76d-a4a058d6b685	AREA	Velsao	61ad5f0d-9d5a-4baf-8a20-a23376e7a61c
a4b45a17-9e97-4c97-9564-a2672a5125b9	AREA	Cansaulim	61ad5f0d-9d5a-4baf-8a20-a23376e7a61c
e844f20a-3f00-4f8b-8433-58bfff24b1b1	AREA	Arossim	61ad5f0d-9d5a-4baf-8a20-a23376e7a61c
17bbeb48-0392-4970-8a5d-16b98f13b626	AREA	Pale (Mormugao)	61ad5f0d-9d5a-4baf-8a20-a23376e7a61c
2938f3ac-8630-4209-905c-3221bae6494f	AREA	Quelossim	61ad5f0d-9d5a-4baf-8a20-a23376e7a61c
2d66fac3-9b37-49db-b475-9e4fe5962460	AREA	Issorcim	61ad5f0d-9d5a-4baf-8a20-a23376e7a61c
43e09518-44fe-454d-8c0c-e256d08b488c	DISTRICT	Kushavati	8b6740ca-eaa4-4f75-b2c9-6fe68959f837
c013ca3e-825d-4f4d-82da-5115d7c85aeb	TALUKA	Quepem	43e09518-44fe-454d-8c0c-e256d08b488c
96170b17-cc4f-466b-9c17-1ee2631704ac	AREA	Curchorem	c013ca3e-825d-4f4d-82da-5115d7c85aeb
f514d63b-f142-43b5-a048-3ef283bf5f1c	AREA	Quepem	c013ca3e-825d-4f4d-82da-5115d7c85aeb
b6cc6bf8-fc09-4022-aded-849878254069	AREA	Sanvordem	c013ca3e-825d-4f4d-82da-5115d7c85aeb
56318eed-aa94-4bf1-a7b4-0c6a60bdcdff	AREA	Tilamol	c013ca3e-825d-4f4d-82da-5115d7c85aeb
7c997c6d-3400-4642-8abb-e6dbeeada01d	AREA	Balli	c013ca3e-825d-4f4d-82da-5115d7c85aeb
dd56ca4d-bc53-46f4-9a2a-358a0e48967b	AREA	Fatorpa	c013ca3e-825d-4f4d-82da-5115d7c85aeb
f42ccba1-fc41-4466-9243-88949f3e88c5	AREA	Ambaulim	c013ca3e-825d-4f4d-82da-5115d7c85aeb
cb97dba1-8cc5-4eb6-96f7-bdcf09d3f8eb	AREA	Assolda	c013ca3e-825d-4f4d-82da-5115d7c85aeb
1465111c-de5f-4b81-bf4e-c907af4d5b29	AREA	Avedem	c013ca3e-825d-4f4d-82da-5115d7c85aeb
413e0e2c-d0bb-463d-a75a-51dfd68bab27	AREA	Cacora	c013ca3e-825d-4f4d-82da-5115d7c85aeb
92c32168-848e-4096-8ed5-cfab40092080	AREA	Chaifi	c013ca3e-825d-4f4d-82da-5115d7c85aeb
b2533507-c86d-47e7-a95d-a8fd4c6344d0	AREA	Cotombi	c013ca3e-825d-4f4d-82da-5115d7c85aeb
e917fe7c-b9fd-449a-9cfd-2f4282bc9a98	AREA	Morpirla	c013ca3e-825d-4f4d-82da-5115d7c85aeb
9c453638-6b2d-49f7-978c-6d207259da64	AREA	Naqueri	c013ca3e-825d-4f4d-82da-5115d7c85aeb
375e8cc7-b2b6-4840-a13e-9107eecdc139	AREA	Paldem	c013ca3e-825d-4f4d-82da-5115d7c85aeb
28ff00d7-3588-4942-8726-6448077ae547	AREA	Quedem	c013ca3e-825d-4f4d-82da-5115d7c85aeb
8a0bb702-c24a-4f51-ad64-49a0da2ca6f0	AREA	Sirvoi	c013ca3e-825d-4f4d-82da-5115d7c85aeb
4378d105-da0a-4458-8263-6bce1c794394	AREA	Xeldem	c013ca3e-825d-4f4d-82da-5115d7c85aeb
313e8820-b943-4f46-87f4-e34a265e08a8	AREA	Deao	c013ca3e-825d-4f4d-82da-5115d7c85aeb
dcd08572-fea1-4843-8114-34252122457e	TALUKA	Sanguem	43e09518-44fe-454d-8c0c-e256d08b488c
1300eee2-654f-4c41-a6c5-38b381a507bc	AREA	Sanguem	dcd08572-fea1-4843-8114-34252122457e
54178814-21d9-475d-9327-75707b8f6b03	AREA	Rivona	dcd08572-fea1-4843-8114-34252122457e
8f9963ce-a0ba-45ec-b496-09a421ac045f	AREA	Netravali	dcd08572-fea1-4843-8114-34252122457e
ef48b9b9-7c16-44ad-9883-90e02619649b	AREA	Bhati	dcd08572-fea1-4843-8114-34252122457e
151aa24e-33e8-4f50-b20f-5400e6e257c3	AREA	Curdi	dcd08572-fea1-4843-8114-34252122457e
35543db7-a93c-4e18-9621-f2ad022e68b6	AREA	Kalay	dcd08572-fea1-4843-8114-34252122457e
840273f0-f154-4ba0-87a0-bcc599acf7b7	AREA	Molem (Sanguem)	dcd08572-fea1-4843-8114-34252122457e
1da8f8c7-5d25-408f-b47d-4128a1fac578	AREA	Uguem	dcd08572-fea1-4843-8114-34252122457e
e60e703a-80f8-4f30-8b6d-720710680242	AREA	Villian	dcd08572-fea1-4843-8114-34252122457e
f38ea243-8251-417d-9b71-fdfc0a56ad0a	AREA	Colomba	dcd08572-fea1-4843-8114-34252122457e
54953fff-379d-4e40-89f8-a1e81f331c69	AREA	Patiem	dcd08572-fea1-4843-8114-34252122457e
bb8cb02b-7579-4744-bd76-53af6702ebbf	AREA	Tudou	dcd08572-fea1-4843-8114-34252122457e
c7ececf8-0316-4077-817a-52e450219d4c	AREA	Wadem	dcd08572-fea1-4843-8114-34252122457e
7a9c512b-b0c0-47d8-89c2-8ecadc894661	AREA	Vichundrem	dcd08572-fea1-4843-8114-34252122457e
1ce52fbb-7838-4383-82f2-317ba7e8a136	TALUKA	Canacona	43e09518-44fe-454d-8c0c-e256d08b488c
70a8e269-5803-48f5-8fde-23dc199aa45b	AREA	Chaudi	1ce52fbb-7838-4383-82f2-317ba7e8a136
a24f1b85-375d-4be5-91e5-4d51a4675007	AREA	Agonda	1ce52fbb-7838-4383-82f2-317ba7e8a136
0a66d42c-a000-49e1-8ac6-e93de5f20673	AREA	Palolem	1ce52fbb-7838-4383-82f2-317ba7e8a136
ef2cdd46-ae8c-4db3-b697-53cc3332c5dd	AREA	Poinguinim	1ce52fbb-7838-4383-82f2-317ba7e8a136
cb97af18-2737-4d6d-811b-434657a0b483	AREA	Loliem	1ce52fbb-7838-4383-82f2-317ba7e8a136
7ad2c6d7-79a8-4e45-8c8d-674ee201b1be	AREA	Cotigao	1ce52fbb-7838-4383-82f2-317ba7e8a136
0808af9a-920d-48e9-bae5-97886c121358	AREA	Gaondongrem	1ce52fbb-7838-4383-82f2-317ba7e8a136
9b744509-f983-4ebd-99e7-4065b0dd1732	AREA	Cola	1ce52fbb-7838-4383-82f2-317ba7e8a136
a29f96b4-9de1-484d-9a19-380aa35e4c1d	AREA	Shristhal	1ce52fbb-7838-4383-82f2-317ba7e8a136
e43c6967-a1e6-4801-a739-5c979c4f01c8	AREA	Nagorcim	1ce52fbb-7838-4383-82f2-317ba7e8a136
0c2f5946-926f-48ce-8887-3d9bb22617e8	AREA	Ponsulem	1ce52fbb-7838-4383-82f2-317ba7e8a136
0c3173b4-83b8-4c02-98f3-0d3d7443470b	AREA	Galgibaga	1ce52fbb-7838-4383-82f2-317ba7e8a136
385e1088-d927-44bd-a43e-14754554f2c7	AREA	Patnem	1ce52fbb-7838-4383-82f2-317ba7e8a136
21665909-1859-422e-8175-7b6ae04ca31d	TALUKA	Dharbandora	43e09518-44fe-454d-8c0c-e256d08b488c
f1cfdd83-cb3b-416c-80ab-c143a69d4973	AREA	Dharbandora	21665909-1859-422e-8175-7b6ae04ca31d
35dccc48-d513-493c-bc76-ec2cffa8bbca	AREA	Colem	21665909-1859-422e-8175-7b6ae04ca31d
ba7a7fb7-83e9-41c9-8992-a30393da8b04	AREA	Mollem	21665909-1859-422e-8175-7b6ae04ca31d
cd1574c4-32cc-4c74-876a-b70aa063bd66	AREA	Kirlapal	21665909-1859-422e-8175-7b6ae04ca31d
c5bbcae7-9b99-41db-9be6-de18034a1a94	AREA	Dabal	21665909-1859-422e-8175-7b6ae04ca31d
aa6e529e-e9e5-4855-abb0-1c640e77ca03	AREA	Sangod	21665909-1859-422e-8175-7b6ae04ca31d
72c56c85-0b56-41fc-8028-19eca0cc65fa	AREA	Sacorda	21665909-1859-422e-8175-7b6ae04ca31d
216671c1-a61f-4849-9e49-8415b42dcb11	AREA	Sancordem	21665909-1859-422e-8175-7b6ae04ca31d
\.


--
-- Data for Name: MalariaEpisode; Type: TABLE DATA; Schema: public; Owner: m3_staging
--

COPY public."MalariaEpisode" (id, "workerId", status, "onsetDate", "createdAt") FROM stdin;
9e65c071-88b9-4d47-a044-af2b8ef979da	27b9a883-4718-46c1-b30c-45b189ed3d90	CONFIRMED	2026-11-08 08:35:45.557	2026-11-11 08:35:45.558
34f51263-24be-4951-8c76-28905f460f07	429ea7b6-e6ab-428f-8046-26b0cd701744	RESOLVED	2026-11-06 08:35:45.675	2026-11-11 08:35:45.676
c1c1baa4-05a0-444a-93a4-bfef4949e88a	1f82d95a-c309-4627-ae99-5989040b5d2a	SUSPECTED	2026-11-11 08:35:45.756	2026-11-11 08:35:45.757
\.


--
-- Data for Name: Notification; Type: TABLE DATA; Schema: public; Owner: m3_staging
--

COPY public."Notification" (id, "audienceRole", "audienceUserId", type, title, body, "entityType", "entityId", "dedupeKey", "readAt", "createdAt", "acknowledgedAt", "actionTaken", "actionTakenAt", "actionTakenById", "audienceFacilityId") FROM stdin;
\.


--
-- Data for Name: Prescription; Type: TABLE DATA; Schema: public; Owner: m3_staging
--

COPY public."Prescription" (id, "episodeId", "workerId", details, "issuedAt", "issuedById", "createdAt") FROM stdin;
\.


--
-- Data for Name: ProfileCorrectionRequest; Type: TABLE DATA; Schema: public; Owner: m3_staging
--

COPY public."ProfileCorrectionRequest" (id, "workerId", "fieldName", "currentValue", "proposedValue", reason, status, "reviewedById", "reviewedAt", "adminNote", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: SiteJoinRequest; Type: TABLE DATA; Schema: public; Owner: m3_staging
--

COPY public."SiteJoinRequest" (id, "workerId", "siteId", status, "decidedById", "decidedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: SiteTransferRequest; Type: TABLE DATA; Schema: public; Owner: m3_staging
--

COPY public."SiteTransferRequest" (id, "workerId", "fromSiteId", "toSiteId", "initiatorType", "initiatorId", status, "workerDecision", "workerDecisionAt", "fromContractorDecision", "fromContractorDecisionAt", "toContractorDecision", "toContractorDecisionAt", "cancelledById", "cancelledAt", "effectiveAt", note, "createdAt", "updatedAt", "fromContractorId", "toContractorId") FROM stdin;
\.


--
-- Data for Name: SymptomReport; Type: TABLE DATA; Schema: public; Owner: m3_staging
--

COPY public."SymptomReport" (id, "workerId", "episodeId", symptoms, note, "createdAt", "voiceData") FROM stdin;
\.


--
-- Data for Name: TranslationRecord; Type: TABLE DATA; Schema: public; Owner: m3_staging
--

COPY public."TranslationRecord" (id, "entityType", "entityId", "fieldName", "originalText", "originalLanguage", "translatedText", status, service, "reviewerId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: TravelRecord; Type: TABLE DATA; Schema: public; Owner: m3_staging
--

COPY public."TravelRecord" (id, "workerId", "planningTravel", "departureDate", "returnDate", destination, state, "hadFeverOrMalaria", "treatmentGiven", "completedCourse", "treatmentPlace", status, "createdAt", "updatedAt", "arrivalConfirmedAt", "arrivalFacilityId", "arrivalFever", "arrivalHealthWorkerId", "arrivalReferred", "arrivalTestedOrTreated", "departureAdminAt", "departureAdminId", "departureCancelReason", "departureStatus", direction, district, "originDistrict", "originState", "originTown", purpose, town) FROM stdin;
6733bc8b-6e5e-4df7-8e99-f575e24ff119	585546bf-d392-4d80-9a7d-89f72c4bf336	t	2026-11-14 08:35:45.806	2026-12-01 08:35:45.806	Patna, Bihar	Bihar	f	f	f	\N	SUBMITTED	2026-11-11 08:35:45.807	2026-11-11 08:35:45.807	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	LEAVING_GOA	Patna	\N	\N	\N	Family Festival	\N
\.


--
-- Data for Name: TravelReport; Type: TABLE DATA; Schema: public; Owner: m3_staging
--

COPY public."TravelReport" (id, "travelRecordId", "workerId", "departureDate", "destinationState", reason, status, "reviewNote", "reviewedById", "reviewedAt", "submittedByContractorId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: m3_staging
--

COPY public."User" (id, role, "displayName", username, "passwordHash", phone, "pinHash", "workerId", "contractorId", "createdAt", "updatedAt", "stakeholderCode", "mustChangeCredential", active) FROM stdin;
dfb7b428-7f43-40c0-8d9a-7df9a391c488	CONTRACTOR	Simulation Contractor Alpha	\N	$2a$10$li.5AfmEqYAtrmbOwO5QSeZjgg2v43nxV525/vJj7AJTKqrHY/lLq	9800000101	\N	\N	a6c0372f-ab5e-4446-9627-74bc15533a90	2026-11-11 08:34:05.379	2026-11-11 08:34:05.379	C-SIM01	t	t
ea5cf241-31f3-4a25-b95e-17bd8470921e	CONTRACTOR	Simulation Contractor Beta	\N	$2a$10$li.5AfmEqYAtrmbOwO5QSeZjgg2v43nxV525/vJj7AJTKqrHY/lLq	9800000102	\N	\N	d85967f4-1fd7-4fee-ae46-3536c6176271	2026-11-11 08:34:05.425	2026-11-11 08:34:05.425	C-SIM02	t	t
761826f2-f597-4a1a-96fc-33b95f879547	HEALTH_WORKER	Simulation Health Worker	hw_sim01	$2a$10$li.5AfmEqYAtrmbOwO5QSeZjgg2v43nxV525/vJj7AJTKqrHY/lLq	9800000201	\N	\N	\N	2026-11-11 08:34:05.448	2026-11-11 08:34:05.448	HW-SIM01	t	t
de9e5259-c11e-4853-b684-72bf409bfceb	WORKER	Ramesh Kumar	\N	\N	9800000301	$2a$10$li.5AfmEqYAtrmbOwO5QSeZjgg2v43nxV525/vJj7AJTKqrHY/lLq	27b9a883-4718-46c1-b30c-45b189ed3d90	\N	2026-11-11 08:34:05.494	2026-11-11 08:34:05.494	\N	f	t
2347d7af-7ef4-47ba-8d85-afd2a1317fe8	WORKER	Suresh Patel	\N	\N	9800000302	$2a$10$ixRl8/XqCkHm7qz1ZFNHw.TZD2uu//AJVLEDpZjlZ6IXdmE4JHzSO	429ea7b6-e6ab-428f-8046-26b0cd701744	\N	2026-11-11 08:35:45.641	2026-11-11 08:35:45.641	\N	f	t
43e6e0e1-bac0-4ec2-9190-63241d4b62aa	WORKER	Vijay Singh	\N	\N	9800000303	$2a$10$ixRl8/XqCkHm7qz1ZFNHw.TZD2uu//AJVLEDpZjlZ6IXdmE4JHzSO	1f82d95a-c309-4627-ae99-5989040b5d2a	\N	2026-11-11 08:35:45.723	2026-11-11 08:35:45.723	\N	f	t
0aeae4df-e2e3-4f78-bd0c-c2e6b734ec83	WORKER	Manoj Das	\N	\N	9800000304	$2a$10$ixRl8/XqCkHm7qz1ZFNHw.TZD2uu//AJVLEDpZjlZ6IXdmE4JHzSO	585546bf-d392-4d80-9a7d-89f72c4bf336	\N	2026-11-11 08:35:45.779	2026-11-11 08:35:45.779	\N	f	t
1df6e315-fb99-49db-81e1-1adb32dea85e	ADMIN	Staging Administrator	staging_admin	$2a$10$oPJudQpQotgdvTG5/mgdkuq3yHZp/F20gWoffO7abB3I7LLQ6nMae	\N	\N	\N	\N	2026-11-11 08:37:46.872	2026-11-11 08:37:46.872	\N	f	t
1d553b33-d3d8-4e1d-99d5-c9019bd4bfbf	ADMIN	System Administrator	admin	$2a$10$oPJudQpQotgdvTG5/mgdkuq3yHZp/F20gWoffO7abB3I7LLQ6nMae	\N	\N	\N	\N	2026-11-11 08:37:46.872	2026-11-11 08:37:46.872	\N	f	t
\.


--
-- Data for Name: Worker; Type: TABLE DATA; Schema: public; Owner: m3_staging
--

COPY public."Worker" (id, "workerCode", name, phone, "preferredLanguage", "createdAt", "updatedAt") FROM stdin;
27b9a883-4718-46c1-b30c-45b189ed3d90	M3-SIM01	Ramesh Kumar	9800000301	hi	2026-11-11 08:34:05.48	2026-11-11 08:34:05.48
429ea7b6-e6ab-428f-8046-26b0cd701744	M3-SIM02	Suresh Patel	9800000302	gu	2026-11-11 08:35:45.626	2026-11-11 08:35:45.626
1f82d95a-c309-4627-ae99-5989040b5d2a	M3-SIM03	Vijay Singh	9800000303	hi	2026-11-11 08:35:45.711	2026-11-11 08:35:45.711
585546bf-d392-4d80-9a7d-89f72c4bf336	M3-SIM04	Manoj Das	9800000304	bn	2026-11-11 08:35:45.768	2026-11-11 08:35:45.768
\.


--
-- Data for Name: WorkerPassToken; Type: TABLE DATA; Schema: public; Owner: m3_staging
--

COPY public."WorkerPassToken" (id, "tokenHash", "tokenPrefix", "workerId", "expiresAt", "usedAt", "usedById", "revokedAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: WorkerSiteAssignment; Type: TABLE DATA; Schema: public; Owner: m3_staging
--

COPY public."WorkerSiteAssignment" (id, "workerId", "siteId", active, "startedAt", "endedAt", "transferId", "createdAt", "contractorId", status) FROM stdin;
fc8e2ded-20f6-4d02-a68d-1a285e6a4e4b	27b9a883-4718-46c1-b30c-45b189ed3d90	9eb5fea3-5306-4ce4-bf2e-6dddf349fafd	t	2026-11-11 08:35:45.496	\N	\N	2026-11-11 08:35:45.496	a6c0372f-ab5e-4446-9627-74bc15533a90	ACTIVE
5adb47b4-1d96-4eaa-909c-f05f8fe8b11e	429ea7b6-e6ab-428f-8046-26b0cd701744	9eb5fea3-5306-4ce4-bf2e-6dddf349fafd	t	2026-11-11 08:35:45.653	\N	\N	2026-11-11 08:35:45.653	a6c0372f-ab5e-4446-9627-74bc15533a90	ACTIVE
2e472f60-0e62-4697-848a-3d4d9c9286cd	1f82d95a-c309-4627-ae99-5989040b5d2a	9eb5fea3-5306-4ce4-bf2e-6dddf349fafd	t	2026-11-11 08:35:45.734	\N	\N	2026-11-11 08:35:45.734	d85967f4-1fd7-4fee-ae46-3536c6176271	ACTIVE
b77c45d0-ee7d-4e26-aa11-2d1b7595c123	585546bf-d392-4d80-9a7d-89f72c4bf336	9eb5fea3-5306-4ce4-bf2e-6dddf349fafd	t	2026-11-11 08:35:45.79	\N	\N	2026-11-11 08:35:45.79	d85967f4-1fd7-4fee-ae46-3536c6176271	ACTIVE
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: m3_staging
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
bb8b5337-376a-47c8-b3ff-2fb4a8cb137c	8bbdb56ed72e44e0f98db8f18a5c81a73821e1b3178086c416c4419c87ad56a5	2026-11-11 08:33:22.346128+00	20261030074038_init	\N	\N	2026-11-11 08:33:21.57812+00	1
621412ce-87ba-454e-8122-697a2b33d04f	d1adb6007f96e5e3d516815c2ba85751c5e50c89de940727a83cd5f30f90924b	2026-11-11 08:33:22.407054+00	20261030075000_partial_unique_indexes	\N	\N	2026-11-11 08:33:22.355073+00	1
74613015-9673-4370-a100-74caf170a366	7fdab0284da94ac7b0a2fd3b3665f0913f5e8c5cf744cc4bd3dabada8b1a3d4a	2026-11-11 08:33:22.495215+00	20261031092014_add_travel_records_and_voice	\N	\N	2026-11-11 08:33:22.417398+00	1
dbb97731-deea-4813-8bba-e688f68fc424	39e8d4944e63e57350c4cfaeb838f7d39d874bbb53220cd0a98c88404923edde	2026-11-11 08:33:22.75047+00	20261102090000_admin_module	\N	\N	2026-11-11 08:33:22.50544+00	1
76c97222-dfc6-4b87-ac95-d958ff82f08d	0cad3cb75037b599a99a65778070d37af193dbe406a76481d15bbc475358932a	2026-11-11 08:33:22.793949+00	20261102120000_site_landmark_and_contact	\N	\N	2026-11-11 08:33:22.760372+00	1
6608cb25-08fc-473a-9c68-08451d41bf60	b0a69af4e3a06c02374f7d987df0301d8b1e7c63949166e1cc6d1535eaf51c37	2026-11-11 08:33:23.013772+00	20261103060000_workforce_management_and_qr_pass	\N	\N	2026-11-11 08:33:22.804437+00	1
0b6e5126-512f-4b0d-b0f6-ee595a9732fb	d79e9e40c28418e6b1e515c9149f7dfb955ca738b17b8f132c6faebe708f112c	2026-11-11 08:33:23.816707+00	20261105100000_facilities_and_worker_updates	\N	\N	2026-11-11 08:33:23.040132+00	1
93838161-8798-426d-a12c-ca9dbf0b42fb	1eb07f41c0fdab76d175d476c266a677e335425db4b883b3520959a8710e0615	2026-11-11 08:35:27.067959+00	20261106000000_add_all_languages	\N	\N	2026-11-11 08:35:27.031699+00	1
\.


--
-- Name: AppInstallConsent AppInstallConsent_pkey; Type: CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."AppInstallConsent"
    ADD CONSTRAINT "AppInstallConsent_pkey" PRIMARY KEY (id);


--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


--
-- Name: ConstructionSite ConstructionSite_pkey; Type: CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."ConstructionSite"
    ADD CONSTRAINT "ConstructionSite_pkey" PRIMARY KEY (id);


--
-- Name: ContractorSite ContractorSite_pkey; Type: CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."ContractorSite"
    ADD CONSTRAINT "ContractorSite_pkey" PRIMARY KEY (id);


--
-- Name: Contractor Contractor_pkey; Type: CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."Contractor"
    ADD CONSTRAINT "Contractor_pkey" PRIMARY KEY (id);


--
-- Name: DataSubmissionConsent DataSubmissionConsent_pkey; Type: CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."DataSubmissionConsent"
    ADD CONSTRAINT "DataSubmissionConsent_pkey" PRIMARY KEY (id);


--
-- Name: DiagnosticResult DiagnosticResult_pkey; Type: CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."DiagnosticResult"
    ADD CONSTRAINT "DiagnosticResult_pkey" PRIMARY KEY (id);


--
-- Name: EscalationRecipient EscalationRecipient_pkey; Type: CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."EscalationRecipient"
    ADD CONSTRAINT "EscalationRecipient_pkey" PRIMARY KEY (id);


--
-- Name: FacilityEscalationAlert FacilityEscalationAlert_pkey; Type: CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."FacilityEscalationAlert"
    ADD CONSTRAINT "FacilityEscalationAlert_pkey" PRIMARY KEY (id);


--
-- Name: FacilityStaffAssignment FacilityStaffAssignment_pkey; Type: CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."FacilityStaffAssignment"
    ADD CONSTRAINT "FacilityStaffAssignment_pkey" PRIMARY KEY (id);


--
-- Name: Facility Facility_pkey; Type: CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."Facility"
    ADD CONSTRAINT "Facility_pkey" PRIMARY KEY (id);


--
-- Name: FollowUp FollowUp_pkey; Type: CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."FollowUp"
    ADD CONSTRAINT "FollowUp_pkey" PRIMARY KEY (id);


--
-- Name: HouseholdAssessment HouseholdAssessment_pkey; Type: CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."HouseholdAssessment"
    ADD CONSTRAINT "HouseholdAssessment_pkey" PRIMARY KEY (id);


--
-- Name: HouseholdMember HouseholdMember_pkey; Type: CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."HouseholdMember"
    ADD CONSTRAINT "HouseholdMember_pkey" PRIMARY KEY (id);


--
-- Name: IdempotencyKey IdempotencyKey_pkey; Type: CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."IdempotencyKey"
    ADD CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY (id);


--
-- Name: InitialScreening InitialScreening_pkey; Type: CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."InitialScreening"
    ADD CONSTRAINT "InitialScreening_pkey" PRIMARY KEY (id);


--
-- Name: LocationNode LocationNode_pkey; Type: CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."LocationNode"
    ADD CONSTRAINT "LocationNode_pkey" PRIMARY KEY (id);


--
-- Name: MalariaEpisode MalariaEpisode_pkey; Type: CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."MalariaEpisode"
    ADD CONSTRAINT "MalariaEpisode_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: Prescription Prescription_pkey; Type: CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."Prescription"
    ADD CONSTRAINT "Prescription_pkey" PRIMARY KEY (id);


--
-- Name: ProfileCorrectionRequest ProfileCorrectionRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."ProfileCorrectionRequest"
    ADD CONSTRAINT "ProfileCorrectionRequest_pkey" PRIMARY KEY (id);


--
-- Name: SiteJoinRequest SiteJoinRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."SiteJoinRequest"
    ADD CONSTRAINT "SiteJoinRequest_pkey" PRIMARY KEY (id);


--
-- Name: SiteTransferRequest SiteTransferRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."SiteTransferRequest"
    ADD CONSTRAINT "SiteTransferRequest_pkey" PRIMARY KEY (id);


--
-- Name: SymptomReport SymptomReport_pkey; Type: CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."SymptomReport"
    ADD CONSTRAINT "SymptomReport_pkey" PRIMARY KEY (id);


--
-- Name: TranslationRecord TranslationRecord_pkey; Type: CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."TranslationRecord"
    ADD CONSTRAINT "TranslationRecord_pkey" PRIMARY KEY (id);


--
-- Name: TravelRecord TravelRecord_pkey; Type: CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."TravelRecord"
    ADD CONSTRAINT "TravelRecord_pkey" PRIMARY KEY (id);


--
-- Name: TravelReport TravelReport_pkey; Type: CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."TravelReport"
    ADD CONSTRAINT "TravelReport_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: WorkerPassToken WorkerPassToken_pkey; Type: CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."WorkerPassToken"
    ADD CONSTRAINT "WorkerPassToken_pkey" PRIMARY KEY (id);


--
-- Name: WorkerSiteAssignment WorkerSiteAssignment_pkey; Type: CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."WorkerSiteAssignment"
    ADD CONSTRAINT "WorkerSiteAssignment_pkey" PRIMARY KEY (id);


--
-- Name: Worker Worker_pkey; Type: CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."Worker"
    ADD CONSTRAINT "Worker_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: AppInstallConsent_status_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "AppInstallConsent_status_idx" ON public."AppInstallConsent" USING btree (status);


--
-- Name: AppInstallConsent_workerId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "AppInstallConsent_workerId_idx" ON public."AppInstallConsent" USING btree ("workerId");


--
-- Name: AuditLog_entityType_entityId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "AuditLog_entityType_entityId_idx" ON public."AuditLog" USING btree ("entityType", "entityId");


--
-- Name: ConstructionSite_areaId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "ConstructionSite_areaId_idx" ON public."ConstructionSite" USING btree ("areaId");


--
-- Name: ConstructionSite_contractorId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "ConstructionSite_contractorId_idx" ON public."ConstructionSite" USING btree ("contractorId");


--
-- Name: ConstructionSite_siteCode_key; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE UNIQUE INDEX "ConstructionSite_siteCode_key" ON public."ConstructionSite" USING btree ("siteCode");


--
-- Name: ContractorSite_active_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "ContractorSite_active_idx" ON public."ContractorSite" USING btree (active);


--
-- Name: ContractorSite_contractorId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "ContractorSite_contractorId_idx" ON public."ContractorSite" USING btree ("contractorId");


--
-- Name: ContractorSite_contractorId_siteId_key; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE UNIQUE INDEX "ContractorSite_contractorId_siteId_key" ON public."ContractorSite" USING btree ("contractorId", "siteId");


--
-- Name: ContractorSite_siteId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "ContractorSite_siteId_idx" ON public."ContractorSite" USING btree ("siteId");


--
-- Name: DataSubmissionConsent_formId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "DataSubmissionConsent_formId_idx" ON public."DataSubmissionConsent" USING btree ("formId");


--
-- Name: DataSubmissionConsent_status_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "DataSubmissionConsent_status_idx" ON public."DataSubmissionConsent" USING btree (status);


--
-- Name: DataSubmissionConsent_workerId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "DataSubmissionConsent_workerId_idx" ON public."DataSubmissionConsent" USING btree ("workerId");


--
-- Name: DiagnosticResult_episodeId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "DiagnosticResult_episodeId_idx" ON public."DiagnosticResult" USING btree ("episodeId");


--
-- Name: EscalationRecipient_alertId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "EscalationRecipient_alertId_idx" ON public."EscalationRecipient" USING btree ("alertId");


--
-- Name: EscalationRecipient_clinicianId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "EscalationRecipient_clinicianId_idx" ON public."EscalationRecipient" USING btree ("clinicianId");


--
-- Name: EscalationRecipient_status_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "EscalationRecipient_status_idx" ON public."EscalationRecipient" USING btree (status);


--
-- Name: FacilityEscalationAlert_adminId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "FacilityEscalationAlert_adminId_idx" ON public."FacilityEscalationAlert" USING btree ("adminId");


--
-- Name: FacilityEscalationAlert_diagnosticResultId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "FacilityEscalationAlert_diagnosticResultId_idx" ON public."FacilityEscalationAlert" USING btree ("diagnosticResultId");


--
-- Name: FacilityEscalationAlert_facilityId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "FacilityEscalationAlert_facilityId_idx" ON public."FacilityEscalationAlert" USING btree ("facilityId");


--
-- Name: FacilityEscalationAlert_status_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "FacilityEscalationAlert_status_idx" ON public."FacilityEscalationAlert" USING btree (status);


--
-- Name: FacilityStaffAssignment_facilityId_active_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "FacilityStaffAssignment_facilityId_active_idx" ON public."FacilityStaffAssignment" USING btree ("facilityId", active);


--
-- Name: FacilityStaffAssignment_role_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "FacilityStaffAssignment_role_idx" ON public."FacilityStaffAssignment" USING btree (role);


--
-- Name: FacilityStaffAssignment_userId_active_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "FacilityStaffAssignment_userId_active_idx" ON public."FacilityStaffAssignment" USING btree ("userId", active);


--
-- Name: Facility_active_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "Facility_active_idx" ON public."Facility" USING btree (active);


--
-- Name: Facility_district_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "Facility_district_idx" ON public."Facility" USING btree (district);


--
-- Name: Facility_facilityCode_key; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE UNIQUE INDEX "Facility_facilityCode_key" ON public."Facility" USING btree ("facilityCode");


--
-- Name: Facility_taluka_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "Facility_taluka_idx" ON public."Facility" USING btree (taluka);


--
-- Name: Facility_type_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "Facility_type_idx" ON public."Facility" USING btree (type);


--
-- Name: FollowUp_workerId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "FollowUp_workerId_idx" ON public."FollowUp" USING btree ("workerId");


--
-- Name: HouseholdAssessment_assessedAt_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "HouseholdAssessment_assessedAt_idx" ON public."HouseholdAssessment" USING btree ("assessedAt");


--
-- Name: HouseholdAssessment_clinicianId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "HouseholdAssessment_clinicianId_idx" ON public."HouseholdAssessment" USING btree ("clinicianId");


--
-- Name: HouseholdAssessment_memberId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "HouseholdAssessment_memberId_idx" ON public."HouseholdAssessment" USING btree ("memberId");


--
-- Name: HouseholdMember_active_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "HouseholdMember_active_idx" ON public."HouseholdMember" USING btree (active);


--
-- Name: HouseholdMember_isDependent_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "HouseholdMember_isDependent_idx" ON public."HouseholdMember" USING btree ("isDependent");


--
-- Name: HouseholdMember_memberCode_key; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE UNIQUE INDEX "HouseholdMember_memberCode_key" ON public."HouseholdMember" USING btree ("memberCode");


--
-- Name: HouseholdMember_workerId_fullName_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "HouseholdMember_workerId_fullName_idx" ON public."HouseholdMember" USING btree ("workerId", "fullName");


--
-- Name: HouseholdMember_workerId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "HouseholdMember_workerId_idx" ON public."HouseholdMember" USING btree ("workerId");


--
-- Name: IdempotencyKey_scope_key_key; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE UNIQUE INDEX "IdempotencyKey_scope_key_key" ON public."IdempotencyKey" USING btree (scope, key);


--
-- Name: InitialScreening_facilityId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "InitialScreening_facilityId_idx" ON public."InitialScreening" USING btree ("facilityId");


--
-- Name: InitialScreening_screenedById_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "InitialScreening_screenedById_idx" ON public."InitialScreening" USING btree ("screenedById");


--
-- Name: InitialScreening_workerId_key; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE UNIQUE INDEX "InitialScreening_workerId_key" ON public."InitialScreening" USING btree ("workerId");


--
-- Name: LocationNode_level_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "LocationNode_level_idx" ON public."LocationNode" USING btree (level);


--
-- Name: LocationNode_parentId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "LocationNode_parentId_idx" ON public."LocationNode" USING btree ("parentId");


--
-- Name: MalariaEpisode_workerId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "MalariaEpisode_workerId_idx" ON public."MalariaEpisode" USING btree ("workerId");


--
-- Name: Notification_audienceFacilityId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "Notification_audienceFacilityId_idx" ON public."Notification" USING btree ("audienceFacilityId");


--
-- Name: Notification_audienceRole_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "Notification_audienceRole_idx" ON public."Notification" USING btree ("audienceRole");


--
-- Name: Notification_audienceUserId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "Notification_audienceUserId_idx" ON public."Notification" USING btree ("audienceUserId");


--
-- Name: Notification_createdAt_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "Notification_createdAt_idx" ON public."Notification" USING btree ("createdAt");


--
-- Name: Notification_dedupeKey_key; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON public."Notification" USING btree ("dedupeKey");


--
-- Name: Prescription_episodeId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "Prescription_episodeId_idx" ON public."Prescription" USING btree ("episodeId");


--
-- Name: Prescription_workerId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "Prescription_workerId_idx" ON public."Prescription" USING btree ("workerId");


--
-- Name: ProfileCorrectionRequest_reviewedById_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "ProfileCorrectionRequest_reviewedById_idx" ON public."ProfileCorrectionRequest" USING btree ("reviewedById");


--
-- Name: ProfileCorrectionRequest_status_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "ProfileCorrectionRequest_status_idx" ON public."ProfileCorrectionRequest" USING btree (status);


--
-- Name: ProfileCorrectionRequest_workerId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "ProfileCorrectionRequest_workerId_idx" ON public."ProfileCorrectionRequest" USING btree ("workerId");


--
-- Name: SiteJoinRequest_siteId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "SiteJoinRequest_siteId_idx" ON public."SiteJoinRequest" USING btree ("siteId");


--
-- Name: SiteJoinRequest_status_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "SiteJoinRequest_status_idx" ON public."SiteJoinRequest" USING btree (status);


--
-- Name: SiteJoinRequest_workerId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "SiteJoinRequest_workerId_idx" ON public."SiteJoinRequest" USING btree ("workerId");


--
-- Name: SiteTransferRequest_fromContractorId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "SiteTransferRequest_fromContractorId_idx" ON public."SiteTransferRequest" USING btree ("fromContractorId");


--
-- Name: SiteTransferRequest_status_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "SiteTransferRequest_status_idx" ON public."SiteTransferRequest" USING btree (status);


--
-- Name: SiteTransferRequest_toContractorId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "SiteTransferRequest_toContractorId_idx" ON public."SiteTransferRequest" USING btree ("toContractorId");


--
-- Name: SiteTransferRequest_workerId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "SiteTransferRequest_workerId_idx" ON public."SiteTransferRequest" USING btree ("workerId");


--
-- Name: SymptomReport_workerId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "SymptomReport_workerId_idx" ON public."SymptomReport" USING btree ("workerId");


--
-- Name: TranslationRecord_entityType_entityId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "TranslationRecord_entityType_entityId_idx" ON public."TranslationRecord" USING btree ("entityType", "entityId");


--
-- Name: TranslationRecord_status_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "TranslationRecord_status_idx" ON public."TranslationRecord" USING btree (status);


--
-- Name: TravelRecord_arrivalFacilityId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "TravelRecord_arrivalFacilityId_idx" ON public."TravelRecord" USING btree ("arrivalFacilityId");


--
-- Name: TravelRecord_departureStatus_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "TravelRecord_departureStatus_idx" ON public."TravelRecord" USING btree ("departureStatus");


--
-- Name: TravelRecord_direction_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "TravelRecord_direction_idx" ON public."TravelRecord" USING btree (direction);


--
-- Name: TravelRecord_workerId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "TravelRecord_workerId_idx" ON public."TravelRecord" USING btree ("workerId");


--
-- Name: TravelReport_status_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "TravelReport_status_idx" ON public."TravelReport" USING btree (status);


--
-- Name: TravelReport_travelRecordId_key; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE UNIQUE INDEX "TravelReport_travelRecordId_key" ON public."TravelReport" USING btree ("travelRecordId");


--
-- Name: TravelReport_workerId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "TravelReport_workerId_idx" ON public."TravelReport" USING btree ("workerId");


--
-- Name: User_contractorId_key; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE UNIQUE INDEX "User_contractorId_key" ON public."User" USING btree ("contractorId");


--
-- Name: User_phone_key; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE UNIQUE INDEX "User_phone_key" ON public."User" USING btree (phone);


--
-- Name: User_role_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "User_role_idx" ON public."User" USING btree (role);


--
-- Name: User_stakeholderCode_key; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE UNIQUE INDEX "User_stakeholderCode_key" ON public."User" USING btree ("stakeholderCode");


--
-- Name: User_username_key; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE UNIQUE INDEX "User_username_key" ON public."User" USING btree (username);


--
-- Name: User_workerId_key; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE UNIQUE INDEX "User_workerId_key" ON public."User" USING btree ("workerId");


--
-- Name: WorkerPassToken_expiresAt_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "WorkerPassToken_expiresAt_idx" ON public."WorkerPassToken" USING btree ("expiresAt");


--
-- Name: WorkerPassToken_tokenHash_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "WorkerPassToken_tokenHash_idx" ON public."WorkerPassToken" USING btree ("tokenHash");


--
-- Name: WorkerPassToken_tokenHash_key; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE UNIQUE INDEX "WorkerPassToken_tokenHash_key" ON public."WorkerPassToken" USING btree ("tokenHash");


--
-- Name: WorkerPassToken_workerId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "WorkerPassToken_workerId_idx" ON public."WorkerPassToken" USING btree ("workerId");


--
-- Name: WorkerSiteAssignment_contractorId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "WorkerSiteAssignment_contractorId_idx" ON public."WorkerSiteAssignment" USING btree ("contractorId");


--
-- Name: WorkerSiteAssignment_siteId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "WorkerSiteAssignment_siteId_idx" ON public."WorkerSiteAssignment" USING btree ("siteId");


--
-- Name: WorkerSiteAssignment_workerId_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "WorkerSiteAssignment_workerId_idx" ON public."WorkerSiteAssignment" USING btree ("workerId");


--
-- Name: Worker_phone_idx; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE INDEX "Worker_phone_idx" ON public."Worker" USING btree (phone);


--
-- Name: Worker_phone_key; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE UNIQUE INDEX "Worker_phone_key" ON public."Worker" USING btree (phone);


--
-- Name: Worker_workerCode_key; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE UNIQUE INDEX "Worker_workerCode_key" ON public."Worker" USING btree ("workerCode");


--
-- Name: one_pending_join_request_per_worker; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE UNIQUE INDEX one_pending_join_request_per_worker ON public."SiteJoinRequest" USING btree ("workerId") WHERE (status = 'PENDING'::public."JoinRequestStatus");


--
-- Name: uq_active_assignment_per_worker; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE UNIQUE INDEX uq_active_assignment_per_worker ON public."WorkerSiteAssignment" USING btree ("workerId") WHERE (active = true);


--
-- Name: uq_open_transfer_per_worker; Type: INDEX; Schema: public; Owner: m3_staging
--

CREATE UNIQUE INDEX uq_open_transfer_per_worker ON public."SiteTransferRequest" USING btree ("workerId") WHERE (status = ANY (ARRAY['PENDING_WORKER_RESPONSE'::public."TransferStatus", 'PENDING_CURRENT_CONTRACTOR'::public."TransferStatus", 'PENDING_DESTINATION_CONTRACTOR'::public."TransferStatus"]));


--
-- Name: AppInstallConsent AppInstallConsent_workerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."AppInstallConsent"
    ADD CONSTRAINT "AppInstallConsent_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES public."Worker"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ConstructionSite ConstructionSite_areaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."ConstructionSite"
    ADD CONSTRAINT "ConstructionSite_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES public."LocationNode"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ConstructionSite ConstructionSite_contractorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."ConstructionSite"
    ADD CONSTRAINT "ConstructionSite_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES public."Contractor"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ContractorSite ContractorSite_contractorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."ContractorSite"
    ADD CONSTRAINT "ContractorSite_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES public."Contractor"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ContractorSite ContractorSite_siteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."ContractorSite"
    ADD CONSTRAINT "ContractorSite_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES public."ConstructionSite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DataSubmissionConsent DataSubmissionConsent_workerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."DataSubmissionConsent"
    ADD CONSTRAINT "DataSubmissionConsent_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES public."Worker"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DiagnosticResult DiagnosticResult_episodeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."DiagnosticResult"
    ADD CONSTRAINT "DiagnosticResult_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES public."MalariaEpisode"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EscalationRecipient EscalationRecipient_alertId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."EscalationRecipient"
    ADD CONSTRAINT "EscalationRecipient_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES public."FacilityEscalationAlert"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EscalationRecipient EscalationRecipient_clinicianId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."EscalationRecipient"
    ADD CONSTRAINT "EscalationRecipient_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FacilityEscalationAlert FacilityEscalationAlert_adminId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."FacilityEscalationAlert"
    ADD CONSTRAINT "FacilityEscalationAlert_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FacilityEscalationAlert FacilityEscalationAlert_diagnosticResultId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."FacilityEscalationAlert"
    ADD CONSTRAINT "FacilityEscalationAlert_diagnosticResultId_fkey" FOREIGN KEY ("diagnosticResultId") REFERENCES public."DiagnosticResult"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FacilityEscalationAlert FacilityEscalationAlert_facilityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."FacilityEscalationAlert"
    ADD CONSTRAINT "FacilityEscalationAlert_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES public."Facility"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FacilityStaffAssignment FacilityStaffAssignment_facilityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."FacilityStaffAssignment"
    ADD CONSTRAINT "FacilityStaffAssignment_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES public."Facility"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FacilityStaffAssignment FacilityStaffAssignment_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."FacilityStaffAssignment"
    ADD CONSTRAINT "FacilityStaffAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FollowUp FollowUp_workerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."FollowUp"
    ADD CONSTRAINT "FollowUp_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES public."Worker"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: HouseholdAssessment HouseholdAssessment_clinicianId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."HouseholdAssessment"
    ADD CONSTRAINT "HouseholdAssessment_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: HouseholdAssessment HouseholdAssessment_memberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."HouseholdAssessment"
    ADD CONSTRAINT "HouseholdAssessment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES public."HouseholdMember"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: HouseholdMember HouseholdMember_workerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."HouseholdMember"
    ADD CONSTRAINT "HouseholdMember_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES public."Worker"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: InitialScreening InitialScreening_facilityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."InitialScreening"
    ADD CONSTRAINT "InitialScreening_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES public."Facility"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: InitialScreening InitialScreening_screenedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."InitialScreening"
    ADD CONSTRAINT "InitialScreening_screenedById_fkey" FOREIGN KEY ("screenedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: InitialScreening InitialScreening_workerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."InitialScreening"
    ADD CONSTRAINT "InitialScreening_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES public."Worker"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LocationNode LocationNode_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."LocationNode"
    ADD CONSTRAINT "LocationNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public."LocationNode"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MalariaEpisode MalariaEpisode_workerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."MalariaEpisode"
    ADD CONSTRAINT "MalariaEpisode_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES public."Worker"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Notification Notification_audienceFacilityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_audienceFacilityId_fkey" FOREIGN KEY ("audienceFacilityId") REFERENCES public."Facility"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Prescription Prescription_episodeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."Prescription"
    ADD CONSTRAINT "Prescription_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES public."MalariaEpisode"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Prescription Prescription_workerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."Prescription"
    ADD CONSTRAINT "Prescription_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES public."Worker"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ProfileCorrectionRequest ProfileCorrectionRequest_reviewedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."ProfileCorrectionRequest"
    ADD CONSTRAINT "ProfileCorrectionRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ProfileCorrectionRequest ProfileCorrectionRequest_workerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."ProfileCorrectionRequest"
    ADD CONSTRAINT "ProfileCorrectionRequest_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES public."Worker"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SiteJoinRequest SiteJoinRequest_siteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."SiteJoinRequest"
    ADD CONSTRAINT "SiteJoinRequest_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES public."ConstructionSite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SiteJoinRequest SiteJoinRequest_workerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."SiteJoinRequest"
    ADD CONSTRAINT "SiteJoinRequest_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES public."Worker"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SiteTransferRequest SiteTransferRequest_fromContractorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."SiteTransferRequest"
    ADD CONSTRAINT "SiteTransferRequest_fromContractorId_fkey" FOREIGN KEY ("fromContractorId") REFERENCES public."Contractor"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SiteTransferRequest SiteTransferRequest_fromSiteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."SiteTransferRequest"
    ADD CONSTRAINT "SiteTransferRequest_fromSiteId_fkey" FOREIGN KEY ("fromSiteId") REFERENCES public."ConstructionSite"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SiteTransferRequest SiteTransferRequest_toContractorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."SiteTransferRequest"
    ADD CONSTRAINT "SiteTransferRequest_toContractorId_fkey" FOREIGN KEY ("toContractorId") REFERENCES public."Contractor"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SiteTransferRequest SiteTransferRequest_toSiteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."SiteTransferRequest"
    ADD CONSTRAINT "SiteTransferRequest_toSiteId_fkey" FOREIGN KEY ("toSiteId") REFERENCES public."ConstructionSite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SiteTransferRequest SiteTransferRequest_workerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."SiteTransferRequest"
    ADD CONSTRAINT "SiteTransferRequest_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES public."Worker"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SymptomReport SymptomReport_workerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."SymptomReport"
    ADD CONSTRAINT "SymptomReport_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES public."Worker"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TravelRecord TravelRecord_arrivalFacilityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."TravelRecord"
    ADD CONSTRAINT "TravelRecord_arrivalFacilityId_fkey" FOREIGN KEY ("arrivalFacilityId") REFERENCES public."Facility"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TravelRecord TravelRecord_workerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."TravelRecord"
    ADD CONSTRAINT "TravelRecord_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES public."Worker"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TravelReport TravelReport_travelRecordId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."TravelReport"
    ADD CONSTRAINT "TravelReport_travelRecordId_fkey" FOREIGN KEY ("travelRecordId") REFERENCES public."TravelRecord"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TravelReport TravelReport_workerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."TravelReport"
    ADD CONSTRAINT "TravelReport_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES public."Worker"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: User User_contractorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES public."Contractor"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: User User_workerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES public."Worker"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WorkerPassToken WorkerPassToken_workerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."WorkerPassToken"
    ADD CONSTRAINT "WorkerPassToken_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES public."Worker"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WorkerSiteAssignment WorkerSiteAssignment_contractorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."WorkerSiteAssignment"
    ADD CONSTRAINT "WorkerSiteAssignment_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES public."Contractor"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WorkerSiteAssignment WorkerSiteAssignment_siteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."WorkerSiteAssignment"
    ADD CONSTRAINT "WorkerSiteAssignment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES public."ConstructionSite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WorkerSiteAssignment WorkerSiteAssignment_workerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m3_staging
--

ALTER TABLE ONLY public."WorkerSiteAssignment"
    ADD CONSTRAINT "WorkerSiteAssignment_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES public."Worker"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict YPW5YzqHiwZls1IDHsmtJFXVWSwuD67JCDwi7BJThMZ1OumtYX9qEgmhLXWW8cR

