-- CreateEnum
CREATE TYPE "Role" AS ENUM ('WORKER', 'HEALTH_WORKER', 'CONTRACTOR', 'CLINICIAN', 'PATHOLOGIST', 'RESEARCH_LAB', 'ADMIN');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('en', 'hi', 'bn', 'mr');

-- CreateEnum
CREATE TYPE "ScreeningStatus" AS ENUM ('DRAFT', 'COMPLETE');

-- CreateEnum
CREATE TYPE "EpisodeStatus" AS ENUM ('SUSPECTED', 'CONFIRMED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "TestType" AS ENUM ('RDT', 'MICROSCOPY');

-- CreateEnum
CREATE TYPE "DiagnosticResultValue" AS ENUM ('POSITIVE', 'NEGATIVE', 'INCONCLUSIVE');

-- CreateEnum
CREATE TYPE "PlasmodiumSpecies" AS ENUM ('P_FALCIPARUM', 'P_VIVAX', 'MIXED', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "LocationLevel" AS ENUM ('STATE', 'DISTRICT', 'TALUKA', 'AREA');

-- CreateEnum
CREATE TYPE "TransferInitiator" AS ENUM ('WORKER', 'CONTRACTOR');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING_WORKER_RESPONSE', 'PENDING_CURRENT_CONTRACTOR', 'PENDING_DESTINATION_CONTRACTOR', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Decision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "displayName" TEXT NOT NULL,
    "username" TEXT,
    "passwordHash" TEXT,
    "phone" TEXT,
    "pinHash" TEXT,
    "workerId" TEXT,
    "contractorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Worker" (
    "id" TEXT NOT NULL,
    "workerCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "preferredLanguage" "Language" NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contractor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationNode" (
    "id" TEXT NOT NULL,
    "level" "LocationLevel" NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "LocationNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstructionSite" (
    "id" TEXT NOT NULL,
    "siteCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "contractorId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConstructionSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerSiteAssignment" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "transferId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerSiteAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InitialScreening" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "status" "ScreeningStatus" NOT NULL DEFAULT 'DRAFT',
    "version" TEXT NOT NULL,
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InitialScreening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MalariaEpisode" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "status" "EpisodeStatus" NOT NULL DEFAULT 'SUSPECTED',
    "onsetDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MalariaEpisode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticResult" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "testType" "TestType" NOT NULL,
    "result" "DiagnosticResultValue" NOT NULL,
    "species" "PlasmodiumSpecies",
    "testDate" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiagnosticResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SymptomReport" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "episodeId" TEXT,
    "symptoms" JSONB NOT NULL DEFAULT '[]',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SymptomReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "episodeId" TEXT,
    "question" TEXT NOT NULL,
    "response" TEXT,
    "note" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteTransferRequest" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "fromSiteId" TEXT,
    "toSiteId" TEXT NOT NULL,
    "initiatorType" "TransferInitiator" NOT NULL,
    "initiatorId" TEXT NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING_WORKER_RESPONSE',
    "workerDecision" "Decision" NOT NULL DEFAULT 'PENDING',
    "workerDecisionAt" TIMESTAMP(3),
    "fromContractorDecision" "Decision" NOT NULL DEFAULT 'PENDING',
    "fromContractorDecisionAt" TIMESTAMP(3),
    "toContractorDecision" "Decision" NOT NULL DEFAULT 'PENDING',
    "toContractorDecisionAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "effectiveAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteTransferRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "userId" TEXT,
    "entityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_workerId_key" ON "User"("workerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_contractorId_key" ON "User"("contractorId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Worker_workerCode_key" ON "Worker"("workerCode");

-- CreateIndex
CREATE UNIQUE INDEX "Worker_phone_key" ON "Worker"("phone");

-- CreateIndex
CREATE INDEX "Worker_phone_idx" ON "Worker"("phone");

-- CreateIndex
CREATE INDEX "LocationNode_level_idx" ON "LocationNode"("level");

-- CreateIndex
CREATE INDEX "LocationNode_parentId_idx" ON "LocationNode"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "ConstructionSite_siteCode_key" ON "ConstructionSite"("siteCode");

-- CreateIndex
CREATE INDEX "ConstructionSite_areaId_idx" ON "ConstructionSite"("areaId");

-- CreateIndex
CREATE INDEX "ConstructionSite_contractorId_idx" ON "ConstructionSite"("contractorId");

-- CreateIndex
CREATE INDEX "WorkerSiteAssignment_workerId_idx" ON "WorkerSiteAssignment"("workerId");

-- CreateIndex
CREATE INDEX "WorkerSiteAssignment_siteId_idx" ON "WorkerSiteAssignment"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "InitialScreening_workerId_key" ON "InitialScreening"("workerId");

-- CreateIndex
CREATE INDEX "MalariaEpisode_workerId_idx" ON "MalariaEpisode"("workerId");

-- CreateIndex
CREATE INDEX "DiagnosticResult_episodeId_idx" ON "DiagnosticResult"("episodeId");

-- CreateIndex
CREATE INDEX "Prescription_workerId_idx" ON "Prescription"("workerId");

-- CreateIndex
CREATE INDEX "Prescription_episodeId_idx" ON "Prescription"("episodeId");

-- CreateIndex
CREATE INDEX "SymptomReport_workerId_idx" ON "SymptomReport"("workerId");

-- CreateIndex
CREATE INDEX "FollowUp_workerId_idx" ON "FollowUp"("workerId");

-- CreateIndex
CREATE INDEX "SiteTransferRequest_workerId_idx" ON "SiteTransferRequest"("workerId");

-- CreateIndex
CREATE INDEX "SiteTransferRequest_status_idx" ON "SiteTransferRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_scope_key_key" ON "IdempotencyKey"("scope", "key");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationNode" ADD CONSTRAINT "LocationNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "LocationNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionSite" ADD CONSTRAINT "ConstructionSite_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "LocationNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionSite" ADD CONSTRAINT "ConstructionSite_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerSiteAssignment" ADD CONSTRAINT "WorkerSiteAssignment_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerSiteAssignment" ADD CONSTRAINT "WorkerSiteAssignment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "ConstructionSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitialScreening" ADD CONSTRAINT "InitialScreening_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MalariaEpisode" ADD CONSTRAINT "MalariaEpisode_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticResult" ADD CONSTRAINT "DiagnosticResult_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "MalariaEpisode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "MalariaEpisode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SymptomReport" ADD CONSTRAINT "SymptomReport_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteTransferRequest" ADD CONSTRAINT "SiteTransferRequest_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteTransferRequest" ADD CONSTRAINT "SiteTransferRequest_fromSiteId_fkey" FOREIGN KEY ("fromSiteId") REFERENCES "ConstructionSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteTransferRequest" ADD CONSTRAINT "SiteTransferRequest_toSiteId_fkey" FOREIGN KEY ("toSiteId") REFERENCES "ConstructionSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
