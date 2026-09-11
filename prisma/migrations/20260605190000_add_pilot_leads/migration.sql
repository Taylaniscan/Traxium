-- CreateEnum
CREATE TYPE "PilotLeadStatus" AS ENUM (
    'NEW',
    'REVIEWED',
    'QUALIFIED',
    'DISQUALIFIED',
    'CONTACTED',
    'CONVERTED',
    'ARCHIVED'
);

-- CreateTable
CREATE TABLE "PilotLead" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fullName" TEXT NOT NULL,
    "workEmail" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "jobTitle" TEXT,
    "phone" TEXT,
    "companySize" TEXT,
    "industry" TEXT,
    "country" TEXT NOT NULL DEFAULT 'United States',
    "state" TEXT,
    "currentTracking" TEXT,
    "savingsPain" TEXT,
    "monthlyReporting" TEXT,
    "hasSavingsTracker" BOOLEAN NOT NULL DEFAULT false,
    "estimatedSpend" TEXT,
    "timeline" TEXT,
    "message" TEXT,
    "source" TEXT NOT NULL DEFAULT 'public_pilot_form',
    "status" "PilotLeadStatus" NOT NULL DEFAULT 'NEW',
    "dedupeKey" TEXT NOT NULL,
    "ipHash" TEXT,
    "userAgentHash" TEXT,

    CONSTRAINT "PilotLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PilotLead_dedupeKey_createdAt_idx" ON "PilotLead"("dedupeKey", "createdAt");

-- CreateIndex
CREATE INDEX "PilotLead_status_createdAt_idx" ON "PilotLead"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PilotLead_workEmail_createdAt_idx" ON "PilotLead"("workEmail", "createdAt");
