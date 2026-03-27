-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM (
    'MONTH',
    'YEAR'
);

-- CreateEnum
CREATE TYPE "PriceType" AS ENUM (
    'LICENSED',
    'METERED'
);

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM (
    'INCOMPLETE',
    'INCOMPLETE_EXPIRED',
    'TRIALING',
    'ACTIVE',
    'PAST_DUE',
    'CANCELED',
    'UNPAID',
    'PAUSED'
);

-- CreateTable
CREATE TABLE "ProductPlan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "stripeProductId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanPrice" (
    "id" TEXT NOT NULL,
    "productPlanId" TEXT NOT NULL,
    "stripePriceId" TEXT,
    "type" "PriceType" NOT NULL,
    "interval" "BillingInterval" NOT NULL,
    "intervalCount" INTEGER NOT NULL DEFAULT 1,
    "currencyCode" TEXT NOT NULL,
    "unitAmount" INTEGER NOT NULL,
    "usageFeature" "UsageFeature",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingCustomer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "billingCustomerId" TEXT NOT NULL,
    "productPlanId" TEXT,
    "planPriceId" TEXT,
    "stripeSubscriptionId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "currencyCode" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "trialStart" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "stripeEventId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'stripe',
    "eventType" TEXT NOT NULL,
    "apiVersion" TEXT,
    "livemode" BOOLEAN NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "processingError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductPlan_code_key" ON "ProductPlan"("code");
CREATE UNIQUE INDEX "ProductPlan_stripeProductId_key" ON "ProductPlan"("stripeProductId");
CREATE INDEX "ProductPlan_isActive_code_idx" ON "ProductPlan"("isActive", "code");

-- CreateIndex
CREATE UNIQUE INDEX "PlanPrice_stripePriceId_key" ON "PlanPrice"("stripePriceId");
CREATE INDEX "PlanPrice_productPlanId_idx" ON "PlanPrice"("productPlanId");
CREATE INDEX "PlanPrice_productPlanId_isActive_idx" ON "PlanPrice"("productPlanId", "isActive");
CREATE INDEX "PlanPrice_type_interval_currencyCode_idx" ON "PlanPrice"("type", "interval", "currencyCode");
CREATE INDEX "PlanPrice_usageFeature_idx" ON "PlanPrice"("usageFeature");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCustomer_organizationId_key" ON "BillingCustomer"("organizationId");
CREATE UNIQUE INDEX "BillingCustomer_stripeCustomerId_key" ON "BillingCustomer"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");
CREATE INDEX "Subscription_organizationId_idx" ON "Subscription"("organizationId");
CREATE INDEX "Subscription_organizationId_status_idx" ON "Subscription"("organizationId", "status");
CREATE INDEX "Subscription_billingCustomerId_status_idx" ON "Subscription"("billingCustomerId", "status");
CREATE INDEX "Subscription_productPlanId_idx" ON "Subscription"("productPlanId");
CREATE INDEX "Subscription_planPriceId_idx" ON "Subscription"("planPriceId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_stripeEventId_key" ON "WebhookEvent"("stripeEventId");
CREATE INDEX "WebhookEvent_organizationId_idx" ON "WebhookEvent"("organizationId");
CREATE INDEX "WebhookEvent_organizationId_receivedAt_idx" ON "WebhookEvent"("organizationId", "receivedAt");
CREATE INDEX "WebhookEvent_source_eventType_receivedAt_idx" ON "WebhookEvent"("source", "eventType", "receivedAt");
CREATE INDEX "WebhookEvent_processedAt_idx" ON "WebhookEvent"("processedAt");

-- AddForeignKey
ALTER TABLE "PlanPrice"
ADD CONSTRAINT "PlanPrice_productPlanId_fkey"
FOREIGN KEY ("productPlanId") REFERENCES "ProductPlan"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCustomer"
ADD CONSTRAINT "BillingCustomer_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription"
ADD CONSTRAINT "Subscription_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription"
ADD CONSTRAINT "Subscription_billingCustomerId_fkey"
FOREIGN KEY ("billingCustomerId") REFERENCES "BillingCustomer"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription"
ADD CONSTRAINT "Subscription_productPlanId_fkey"
FOREIGN KEY ("productPlanId") REFERENCES "ProductPlan"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription"
ADD CONSTRAINT "Subscription_planPriceId_fkey"
FOREIGN KEY ("planPriceId") REFERENCES "PlanPrice"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent"
ADD CONSTRAINT "WebhookEvent_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
