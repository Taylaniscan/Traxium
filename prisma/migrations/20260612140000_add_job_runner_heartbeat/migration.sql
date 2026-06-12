-- Singleton heartbeat recording the most recent successful job-worker pass.
CREATE TABLE "JobRunnerHeartbeat" (
  "id" TEXT NOT NULL,
  "lastSuccessfulRunAt" TIMESTAMP(3) NOT NULL,
  "processedJobs" INTEGER NOT NULL DEFAULT 0,
  "durationMs" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JobRunnerHeartbeat_pkey" PRIMARY KEY ("id")
);
