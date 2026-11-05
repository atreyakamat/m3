-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'ENDED', 'TRANSFERRED');

-- AlterTable
ALTER TABLE "SiteTransferRequest" ADD COLUMN     "fromContractorId" TEXT,
ADD COLUMN     "toContractorId" TEXT;

-- AlterTable
ALTER TABLE "WorkerSiteAssignment" ADD COLUMN     "contractorId" TEXT,
ADD COLUMN     "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "ContractorSite" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "ContractorSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerPassToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerPassToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContractorSite_contractorId_idx" ON "ContractorSite"("contractorId");

-- CreateIndex
CREATE INDEX "ContractorSite_siteId_idx" ON "ContractorSite"("siteId");

-- CreateIndex
CREATE INDEX "ContractorSite_active_idx" ON "ContractorSite"("active");

-- CreateIndex
CREATE UNIQUE INDEX "ContractorSite_contractorId_siteId_key" ON "ContractorSite"("contractorId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerPassToken_tokenHash_key" ON "WorkerPassToken"("tokenHash");

-- CreateIndex
CREATE INDEX "WorkerPassToken_workerId_idx" ON "WorkerPassToken"("workerId");

-- CreateIndex
CREATE INDEX "WorkerPassToken_tokenHash_idx" ON "WorkerPassToken"("tokenHash");

-- CreateIndex
CREATE INDEX "WorkerPassToken_expiresAt_idx" ON "WorkerPassToken"("expiresAt");

-- CreateIndex
CREATE INDEX "SiteTransferRequest_fromContractorId_idx" ON "SiteTransferRequest"("fromContractorId");

-- CreateIndex
CREATE INDEX "SiteTransferRequest_toContractorId_idx" ON "SiteTransferRequest"("toContractorId");

-- CreateIndex
CREATE INDEX "WorkerSiteAssignment_contractorId_idx" ON "WorkerSiteAssignment"("contractorId");

-- AddForeignKey
ALTER TABLE "ContractorSite" ADD CONSTRAINT "ContractorSite_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorSite" ADD CONSTRAINT "ContractorSite_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "ConstructionSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerSiteAssignment" ADD CONSTRAINT "WorkerSiteAssignment_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteTransferRequest" ADD CONSTRAINT "SiteTransferRequest_fromContractorId_fkey" FOREIGN KEY ("fromContractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteTransferRequest" ADD CONSTRAINT "SiteTransferRequest_toContractorId_fkey" FOREIGN KEY ("toContractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerPassToken" ADD CONSTRAINT "WorkerPassToken_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill data: migrate existing site contractor assignments into ContractorSite
INSERT INTO "ContractorSite" ("id", "contractorId", "siteId", "active", "assignedAt")
SELECT gen_random_uuid(), "contractorId", "id", true, CURRENT_TIMESTAMP
FROM "ConstructionSite"
WHERE "contractorId" IS NOT NULL
ON CONFLICT ("contractorId", "siteId") DO NOTHING;

-- Backfill data: populate contractorId on existing WorkerSiteAssignment from ConstructionSite
UPDATE "WorkerSiteAssignment" wsa
SET "contractorId" = cs."contractorId"
FROM "ConstructionSite" cs
WHERE wsa."siteId" = cs."id"
  AND cs."contractorId" IS NOT NULL
  AND wsa."contractorId" IS NULL;

-- Backfill status on WorkerSiteAssignment
UPDATE "WorkerSiteAssignment"
SET "status" = CASE WHEN "active" = true THEN 'ACTIVE'::"AssignmentStatus" ELSE 'ENDED'::"AssignmentStatus" END;
