-- Admin module foundation: stakeholder identities + first-login guard

ALTER TABLE "User" ADD COLUMN "stakeholderCode" TEXT;
ALTER TABLE "User" ADD COLUMN "mustChangeCredential" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
CREATE UNIQUE INDEX "User_stakeholderCode_key" ON "User"("stakeholderCode");

-- Worker join requests
CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');
CREATE TYPE "TravelReportStatus" AS ENUM ('OPEN', 'REVIEWED', 'RESOLVED');

CREATE TABLE "SiteJoinRequest" (
  "id" TEXT NOT NULL,
  "workerId" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
  "decidedById" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SiteJoinRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TravelReport" (
  "id" TEXT NOT NULL,
  "travelRecordId" TEXT NOT NULL,
  "workerId" TEXT NOT NULL,
  "departureDate" TIMESTAMP(3),
  "destinationState" TEXT,
  "reason" TEXT NOT NULL,
  "status" "TravelReportStatus" NOT NULL DEFAULT 'OPEN',
  "reviewNote" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "submittedByContractorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TravelReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "audienceRole" "Role",
  "audienceUserId" TEXT,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "dedupeKey" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TravelReport_travelRecordId_key" ON "TravelReport"("travelRecordId");
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

CREATE INDEX "SiteJoinRequest_workerId_idx" ON "SiteJoinRequest"("workerId");
CREATE INDEX "SiteJoinRequest_siteId_idx" ON "SiteJoinRequest"("siteId");
CREATE INDEX "SiteJoinRequest_status_idx" ON "SiteJoinRequest"("status");
CREATE INDEX "TravelReport_workerId_idx" ON "TravelReport"("workerId");
CREATE INDEX "TravelReport_status_idx" ON "TravelReport"("status");
CREATE INDEX "Notification_audienceRole_idx" ON "Notification"("audienceRole");
CREATE INDEX "Notification_audienceUserId_idx" ON "Notification"("audienceUserId");
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

ALTER TABLE "SiteJoinRequest" ADD CONSTRAINT "SiteJoinRequest_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SiteJoinRequest" ADD CONSTRAINT "SiteJoinRequest_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "ConstructionSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TravelReport" ADD CONSTRAINT "TravelReport_travelRecordId_fkey" FOREIGN KEY ("travelRecordId") REFERENCES "TravelRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TravelReport" ADD CONSTRAINT "TravelReport_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One open (PENDING) join request per worker.
CREATE UNIQUE INDEX "one_pending_join_request_per_worker"
  ON "SiteJoinRequest"("workerId") WHERE "status" = 'PENDING';
