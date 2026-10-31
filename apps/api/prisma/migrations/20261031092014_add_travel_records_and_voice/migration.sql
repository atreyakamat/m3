-- AlterTable
ALTER TABLE "ConstructionSite" ADD COLUMN     "address" TEXT;

-- AlterTable
ALTER TABLE "SymptomReport" ADD COLUMN     "voiceData" TEXT;

-- CreateTable
CREATE TABLE "TravelRecord" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "planningTravel" BOOLEAN NOT NULL DEFAULT false,
    "departureDate" TIMESTAMP(3),
    "returnDate" TIMESTAMP(3),
    "destination" TEXT,
    "state" TEXT,
    "hadFeverOrMalaria" BOOLEAN NOT NULL DEFAULT false,
    "treatmentGiven" BOOLEAN NOT NULL DEFAULT false,
    "completedCourse" BOOLEAN NOT NULL DEFAULT false,
    "treatmentPlace" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TravelRecord_workerId_idx" ON "TravelRecord"("workerId");

-- AddForeignKey
ALTER TABLE "TravelRecord" ADD CONSTRAINT "TravelRecord_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
