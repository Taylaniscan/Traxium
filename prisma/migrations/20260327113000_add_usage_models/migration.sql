-- CreateEnum
CREATE TYPE "UsageFeature" AS ENUM (
    'SAVING_CARDS',
    'ACTIVE_MEMBERS',
    'INVITATIONS_SENT',
    'EVIDENCE_UPLOADS',
    'API_REQUESTS',
    'JOB_EXECUTIONS'
);

-- CreateEnum
CREATE TYPE "UsageWindow" AS ENUM (
    'LIFETIME',
    'DAY',
    'WEEK',
    'MONTH',
    'QUARTER',
    'YEAR'
);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "feature" "UsageFeature" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "window" "UsageWindow" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageCounter" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "feature" "UsageFeature" NOT NULL,
    "window" "UsageWindow" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "lastEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotaSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "feature" "UsageFeature" NOT NULL,
    "window" "UsageWindow" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "limitQuantity" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuotaSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsageEvent_organizationId_idx" ON "UsageEvent"("organizationId");
CREATE INDEX "UsageEvent_organizationId_feature_createdAt_idx" ON "UsageEvent"("organizationId", "feature", "createdAt");
CREATE INDEX "UsageEvent_organizationId_feature_window_periodStart_periodEnd_idx" ON "UsageEvent"("organizationId", "feature", "window", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "UsageCounter_organizationId_feature_window_periodStart_periodEnd_key" ON "UsageCounter"("organizationId", "feature", "window", "periodStart", "periodEnd");
CREATE INDEX "UsageCounter_organizationId_feature_window_periodStart_idx" ON "UsageCounter"("organizationId", "feature", "window", "periodStart");
CREATE INDEX "UsageCounter_organizationId_updatedAt_idx" ON "UsageCounter"("organizationId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuotaSnapshot_organizationId_feature_window_periodStart_periodEnd_key" ON "QuotaSnapshot"("organizationId", "feature", "window", "periodStart", "periodEnd");
CREATE INDEX "QuotaSnapshot_organizationId_feature_window_periodStart_idx" ON "QuotaSnapshot"("organizationId", "feature", "window", "periodStart");
CREATE INDEX "QuotaSnapshot_organizationId_updatedAt_idx" ON "QuotaSnapshot"("organizationId", "updatedAt");

-- AddForeignKey
ALTER TABLE "UsageEvent"
ADD CONSTRAINT "UsageEvent_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageCounter"
ADD CONSTRAINT "UsageCounter_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotaSnapshot"
ADD CONSTRAINT "QuotaSnapshot_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
