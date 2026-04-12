-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "bucketKey" TEXT NOT NULL,
    "policy" TEXT NOT NULL,
    "action" TEXT,
    "scope" TEXT NOT NULL,
    "hits" INTEGER NOT NULL,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("bucketKey")
);

-- CreateIndex
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");

-- CreateIndex
CREATE INDEX "RateLimitBucket_policy_expiresAt_idx" ON "RateLimitBucket"("policy", "expiresAt");

-- CreateIndex
CREATE INDEX "RateLimitBucket_policy_action_expiresAt_idx" ON "RateLimitBucket"("policy", "action", "expiresAt");

-- CreateIndex
CREATE INDEX "RateLimitBucket_scope_expiresAt_idx" ON "RateLimitBucket"("scope", "expiresAt");
