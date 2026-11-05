-- CreateEnum
CREATE TYPE "FacilityType" AS ENUM ('PHC', 'UHC');

-- CreateEnum
CREATE TYPE "HouseholdRelationship" AS ENUM ('SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'OTHER_FAMILY', 'ROOMMATE', 'OTHER');

-- CreateEnum
CREATE TYPE "TravelDirection" AS ENUM ('LEAVING_GOA', 'ENTERING_GOA');

-- CreateEnum
CREATE TYPE "DepartureConfirmationStatus" AS ENUM ('PENDING_CONFIRMATION', 'CONFIRMED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CorrectionStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "TranslationStatus" AS ENUM ('PENDING', 'TRANSLATED', 'FAILED', 'REVIEWED');

-- CreateEnum
CREATE TYPE "EscalationAlertStatus" AS ENUM ('SENT', 'ACKNOWLEDGED', 'ACTIONED');

-- AlterTable
ALTER TABLE "InitialScreening" ADD COLUMN     "facilityId" TEXT,
ADD COLUMN     "screenedById" TEXT;

-- AlterTable
ALTER TABLE "TravelRecord" ADD COLUMN     "arrivalConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "arrivalFacilityId" TEXT,
ADD COLUMN     "arrivalFever" BOOLEAN,
ADD COLUMN     "arrivalHealthWorkerId" TEXT,
ADD COLUMN     "arrivalReferred" BOOLEAN,
ADD COLUMN     "arrivalTestedOrTreated" BOOLEAN,
ADD COLUMN     "departureAdminAt" TIMESTAMP(3),
ADD COLUMN     "departureAdminId" TEXT,
ADD COLUMN     "departureCancelReason" TEXT,
ADD COLUMN     "departureStatus" "DepartureConfirmationStatus",
ADD COLUMN     "direction" "TravelDirection",
ADD COLUMN     "district" TEXT,
ADD COLUMN     "originDistrict" TEXT,
ADD COLUMN     "originState" TEXT,
ADD COLUMN     "originTown" TEXT,
ADD COLUMN     "purpose" TEXT,
ADD COLUMN     "town" TEXT;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "acknowledgedAt" TIMESTAMP(3),
ADD COLUMN     "actionTaken" TEXT,
ADD COLUMN     "actionTakenAt" TIMESTAMP(3),
ADD COLUMN     "actionTakenById" TEXT,
ADD COLUMN     "audienceFacilityId" TEXT;

-- CreateTable
CREATE TABLE "Facility" (
    "id" TEXT NOT NULL,
    "facilityCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FacilityType" NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'Goa',
    "district" TEXT NOT NULL,
    "taluka" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Facility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityStaffAssignment" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "assignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacilityStaffAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityEscalationAlert" (
    "id" TEXT NOT NULL,
    "diagnosticResultId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "EscalationAlertStatus" NOT NULL DEFAULT 'SENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacilityEscalationAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscalationRecipient" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "actionTaken" TEXT,
    "actionTakenAt" TIMESTAMP(3),
    "status" "EscalationAlertStatus" NOT NULL DEFAULT 'SENT',

    CONSTRAINT "EscalationRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseholdMember" (
    "id" TEXT NOT NULL,
    "memberCode" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "fullName" TEXT,
    "relationship" "HouseholdRelationship" NOT NULL,
    "ageOrDob" TEXT,
    "gender" TEXT,
    "preferredLanguage" "Language" NOT NULL DEFAULT 'en',
    "phoneAvailable" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT,
    "livesInSameRoom" BOOLEAN NOT NULL DEFAULT true,
    "isDependent" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "lastUpdatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseholdMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseholdAssessment" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memberPresent" BOOLEAN NOT NULL DEFAULT true,
    "workerPresent" BOOLEAN NOT NULL DEFAULT false,
    "symptoms" JSONB NOT NULL DEFAULT '[]',
    "clinicalHistory" TEXT,
    "examinationFindings" TEXT,
    "testRequested" BOOLEAN NOT NULL DEFAULT false,
    "testType" "TestType",
    "testResult" "DiagnosticResultValue",
    "diagnosis" TEXT,
    "treatment" TEXT,
    "referralInfo" TEXT,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "nextFollowUpDate" TIMESTAMP(3),
    "clinicalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseholdAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppInstallConsent" (
    "id" TEXT NOT NULL,
    "workerId" TEXT,
    "version" TEXT NOT NULL,
    "language" "Language" NOT NULL,
    "status" "ConsentStatus" NOT NULL,
    "deviceInfo" TEXT,
    "appVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppInstallConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSubmissionConsent" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "language" "Language" NOT NULL,
    "status" "ConsentStatus" NOT NULL,
    "formId" TEXT NOT NULL,
    "deviceInfo" TEXT,
    "appVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataSubmissionConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileCorrectionRequest" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "currentValue" TEXT NOT NULL,
    "proposedValue" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "CorrectionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileCorrectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranslationRecord" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "originalText" TEXT NOT NULL,
    "originalLanguage" "Language" NOT NULL,
    "translatedText" TEXT,
    "status" "TranslationStatus" NOT NULL DEFAULT 'PENDING',
    "service" TEXT NOT NULL DEFAULT 'backend-internal',
    "reviewerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranslationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Facility_facilityCode_key" ON "Facility"("facilityCode");

-- CreateIndex
CREATE INDEX "Facility_type_idx" ON "Facility"("type");

-- CreateIndex
CREATE INDEX "Facility_district_idx" ON "Facility"("district");

-- CreateIndex
CREATE INDEX "Facility_taluka_idx" ON "Facility"("taluka");

-- CreateIndex
CREATE INDEX "Facility_active_idx" ON "Facility"("active");

-- CreateIndex
CREATE INDEX "FacilityStaffAssignment_facilityId_active_idx" ON "FacilityStaffAssignment"("facilityId", "active");

-- CreateIndex
CREATE INDEX "FacilityStaffAssignment_userId_active_idx" ON "FacilityStaffAssignment"("userId", "active");

-- CreateIndex
CREATE INDEX "FacilityStaffAssignment_role_idx" ON "FacilityStaffAssignment"("role");

-- CreateIndex
CREATE INDEX "FacilityEscalationAlert_diagnosticResultId_idx" ON "FacilityEscalationAlert"("diagnosticResultId");

-- CreateIndex
CREATE INDEX "FacilityEscalationAlert_facilityId_idx" ON "FacilityEscalationAlert"("facilityId");

-- CreateIndex
CREATE INDEX "FacilityEscalationAlert_adminId_idx" ON "FacilityEscalationAlert"("adminId");

-- CreateIndex
CREATE INDEX "FacilityEscalationAlert_status_idx" ON "FacilityEscalationAlert"("status");

-- CreateIndex
CREATE INDEX "EscalationRecipient_alertId_idx" ON "EscalationRecipient"("alertId");

-- CreateIndex
CREATE INDEX "EscalationRecipient_clinicianId_idx" ON "EscalationRecipient"("clinicianId");

-- CreateIndex
CREATE INDEX "EscalationRecipient_status_idx" ON "EscalationRecipient"("status");

-- CreateIndex
CREATE UNIQUE INDEX "HouseholdMember_memberCode_key" ON "HouseholdMember"("memberCode");

-- CreateIndex
CREATE INDEX "HouseholdMember_workerId_idx" ON "HouseholdMember"("workerId");

-- CreateIndex
CREATE INDEX "HouseholdMember_workerId_fullName_idx" ON "HouseholdMember"("workerId", "fullName");

-- CreateIndex
CREATE INDEX "HouseholdMember_isDependent_idx" ON "HouseholdMember"("isDependent");

-- CreateIndex
CREATE INDEX "HouseholdMember_active_idx" ON "HouseholdMember"("active");

-- CreateIndex
CREATE INDEX "HouseholdAssessment_memberId_idx" ON "HouseholdAssessment"("memberId");

-- CreateIndex
CREATE INDEX "HouseholdAssessment_clinicianId_idx" ON "HouseholdAssessment"("clinicianId");

-- CreateIndex
CREATE INDEX "HouseholdAssessment_assessedAt_idx" ON "HouseholdAssessment"("assessedAt");

-- CreateIndex
CREATE INDEX "AppInstallConsent_workerId_idx" ON "AppInstallConsent"("workerId");

-- CreateIndex
CREATE INDEX "AppInstallConsent_status_idx" ON "AppInstallConsent"("status");

-- CreateIndex
CREATE INDEX "DataSubmissionConsent_workerId_idx" ON "DataSubmissionConsent"("workerId");

-- CreateIndex
CREATE INDEX "DataSubmissionConsent_formId_idx" ON "DataSubmissionConsent"("formId");

-- CreateIndex
CREATE INDEX "DataSubmissionConsent_status_idx" ON "DataSubmissionConsent"("status");

-- CreateIndex
CREATE INDEX "ProfileCorrectionRequest_workerId_idx" ON "ProfileCorrectionRequest"("workerId");

-- CreateIndex
CREATE INDEX "ProfileCorrectionRequest_status_idx" ON "ProfileCorrectionRequest"("status");

-- CreateIndex
CREATE INDEX "ProfileCorrectionRequest_reviewedById_idx" ON "ProfileCorrectionRequest"("reviewedById");

-- CreateIndex
CREATE INDEX "TranslationRecord_entityType_entityId_idx" ON "TranslationRecord"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "TranslationRecord_status_idx" ON "TranslationRecord"("status");

-- CreateIndex
CREATE INDEX "InitialScreening_facilityId_idx" ON "InitialScreening"("facilityId");

-- CreateIndex
CREATE INDEX "InitialScreening_screenedById_idx" ON "InitialScreening"("screenedById");

-- CreateIndex
CREATE INDEX "TravelRecord_direction_idx" ON "TravelRecord"("direction");

-- CreateIndex
CREATE INDEX "TravelRecord_departureStatus_idx" ON "TravelRecord"("departureStatus");

-- CreateIndex
CREATE INDEX "TravelRecord_arrivalFacilityId_idx" ON "TravelRecord"("arrivalFacilityId");

-- CreateIndex
CREATE INDEX "Notification_audienceFacilityId_idx" ON "Notification"("audienceFacilityId");

-- AddForeignKey
ALTER TABLE "InitialScreening" ADD CONSTRAINT "InitialScreening_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitialScreening" ADD CONSTRAINT "InitialScreening_screenedById_fkey" FOREIGN KEY ("screenedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelRecord" ADD CONSTRAINT "TravelRecord_arrivalFacilityId_fkey" FOREIGN KEY ("arrivalFacilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_audienceFacilityId_fkey" FOREIGN KEY ("audienceFacilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityStaffAssignment" ADD CONSTRAINT "FacilityStaffAssignment_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityStaffAssignment" ADD CONSTRAINT "FacilityStaffAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityEscalationAlert" ADD CONSTRAINT "FacilityEscalationAlert_diagnosticResultId_fkey" FOREIGN KEY ("diagnosticResultId") REFERENCES "DiagnosticResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityEscalationAlert" ADD CONSTRAINT "FacilityEscalationAlert_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityEscalationAlert" ADD CONSTRAINT "FacilityEscalationAlert_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalationRecipient" ADD CONSTRAINT "EscalationRecipient_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "FacilityEscalationAlert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalationRecipient" ADD CONSTRAINT "EscalationRecipient_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdMember" ADD CONSTRAINT "HouseholdMember_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdAssessment" ADD CONSTRAINT "HouseholdAssessment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "HouseholdMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdAssessment" ADD CONSTRAINT "HouseholdAssessment_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppInstallConsent" ADD CONSTRAINT "AppInstallConsent_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSubmissionConsent" ADD CONSTRAINT "DataSubmissionConsent_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileCorrectionRequest" ADD CONSTRAINT "ProfileCorrectionRequest_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileCorrectionRequest" ADD CONSTRAINT "ProfileCorrectionRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

