-- Baseline migration for a database that was created before Prisma Migrate history existed.
-- Apply this normally on an empty database.
-- If the target database already contains this schema, mark it as applied with:
-- prisma migrate resolve --applied 20260323200000_init

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('HEAD_OF_GLOBAL_PROCUREMENT', 'GLOBAL_CATEGORY_LEADER', 'TACTICAL_BUYER', 'PROCUREMENT_ANALYST', 'FINANCIAL_CONTROLLER');

-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "Phase" AS ENUM ('IDEA', 'VALIDATED', 'REALISED', 'ACHIEVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('ONE_TIME', 'RECURRING', 'MULTI_YEAR');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('EUR', 'USD');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ForecastSource" AS ENUM ('MANUAL_ENTRY', 'ERP_CSV_UPLOAD');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "activeOrganizationId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL DEFAULT 'MEMBER',
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Buyer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Buyer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "annualTarget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plant" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessUnit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingCard" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "savingType" TEXT NOT NULL,
    "phase" "Phase" NOT NULL DEFAULT 'IDEA',
    "supplierId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "alternativeSupplierId" TEXT,
    "alternativeSupplierManualName" TEXT,
    "alternativeMaterialId" TEXT,
    "alternativeMaterialManualName" TEXT,
    "categoryId" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "businessUnitId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "baselinePrice" DOUBLE PRECISION NOT NULL,
    "newPrice" DOUBLE PRECISION NOT NULL,
    "annualVolume" DOUBLE PRECISION NOT NULL,
    "volumeUnit" TEXT NOT NULL DEFAULT 'units',
    "currency" "Currency" NOT NULL,
    "fxRate" DOUBLE PRECISION NOT NULL,
    "calculatedSavings" DOUBLE PRECISION NOT NULL,
    "calculatedSavingsUSD" DOUBLE PRECISION NOT NULL,
    "frequency" "Frequency" NOT NULL,
    "savingDriver" TEXT,
    "implementationComplexity" TEXT,
    "qualificationStatus" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "impactStartDate" TIMESTAMP(3) NOT NULL,
    "impactEndDate" TIMESTAMP(3) NOT NULL,
    "financeLocked" BOOLEAN NOT NULL DEFAULT false,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialConsumptionForecast" (
    "id" TEXT NOT NULL,
    "savingCardId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "supplierId" TEXT,
    "period" TIMESTAMP(3) NOT NULL,
    "forecastQty" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'units',
    "source" "ForecastSource" NOT NULL DEFAULT 'MANUAL_ENTRY',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialConsumptionForecast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialConsumptionActual" (
    "id" TEXT NOT NULL,
    "savingCardId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "supplierId" TEXT,
    "period" TIMESTAMP(3) NOT NULL,
    "actualQty" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'units',
    "source" "ForecastSource" NOT NULL DEFAULT 'MANUAL_ENTRY',
    "invoiceRef" TEXT,
    "confirmedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialConsumptionActual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingCardStakeholder" (
    "id" TEXT NOT NULL,
    "savingCardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavingCardStakeholder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingCardEvidence" (
    "id" TEXT NOT NULL,
    "savingCardId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageBucket" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileType" TEXT NOT NULL,
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavingCardEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingCardAlternativeSupplier" (
    "id" TEXT NOT NULL,
    "savingCardId" TEXT NOT NULL,
    "supplierId" TEXT,
    "supplierNameManual" TEXT,
    "country" TEXT NOT NULL,
    "quotedPrice" DOUBLE PRECISION NOT NULL,
    "currency" "Currency" NOT NULL,
    "leadTimeDays" INTEGER NOT NULL,
    "moq" INTEGER NOT NULL,
    "paymentTerms" TEXT NOT NULL,
    "qualityRating" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "notes" TEXT,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavingCardAlternativeSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingCardAlternativeMaterial" (
    "id" TEXT NOT NULL,
    "savingCardId" TEXT NOT NULL,
    "materialId" TEXT,
    "materialNameManual" TEXT,
    "supplierId" TEXT,
    "supplierNameManual" TEXT,
    "specification" TEXT NOT NULL,
    "quotedPrice" DOUBLE PRECISION NOT NULL,
    "currency" "Currency" NOT NULL,
    "performanceImpact" TEXT NOT NULL,
    "qualificationStatus" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "notes" TEXT,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavingCardAlternativeMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingCardComment" (
    "id" TEXT NOT NULL,
    "savingCardId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavingCardComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "savingCardId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "phase" "Phase" NOT NULL,
    "approved" BOOLEAN NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'APPROVED',
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhaseChangeRequest" (
    "id" TEXT NOT NULL,
    "savingCardId" TEXT NOT NULL,
    "currentPhase" "Phase" NOT NULL,
    "requestedPhase" "Phase" NOT NULL,
    "requestedById" TEXT NOT NULL,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhaseChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhaseChangeRequestApproval" (
    "id" TEXT NOT NULL,
    "phaseChangeRequestId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhaseChangeRequestApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhaseHistory" (
    "id" TEXT NOT NULL,
    "savingCardId" TEXT NOT NULL,
    "fromPhase" "Phase",
    "toPhase" "Phase" NOT NULL,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhaseHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "savingCardId" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FxRate" (
    "id" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "rateToEUR" DOUBLE PRECISION NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnualTarget" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnualTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE INDEX "User_activeOrganizationId_idx" ON "User"("activeOrganizationId");

-- CreateIndex
CREATE UNIQUE INDEX "User_organizationId_email_key" ON "User"("organizationId", "email");

-- CreateIndex
CREATE INDEX "OrganizationMembership_userId_idx" ON "OrganizationMembership"("userId");

-- CreateIndex
CREATE INDEX "OrganizationMembership_organizationId_idx" ON "OrganizationMembership"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationMembership_organizationId_role_idx" ON "OrganizationMembership"("organizationId", "role");

-- CreateIndex
CREATE INDEX "OrganizationMembership_organizationId_status_idx" ON "OrganizationMembership"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMembership_userId_organizationId_key" ON "OrganizationMembership"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "Buyer_organizationId_idx" ON "Buyer"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Buyer_organizationId_name_key" ON "Buyer"("organizationId", "name");

-- CreateIndex
CREATE INDEX "Supplier_organizationId_idx" ON "Supplier"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_organizationId_name_key" ON "Supplier"("organizationId", "name");

-- CreateIndex
CREATE INDEX "Material_organizationId_idx" ON "Material"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Material_organizationId_name_key" ON "Material"("organizationId", "name");

-- CreateIndex
CREATE INDEX "Category_organizationId_idx" ON "Category"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_organizationId_name_key" ON "Category"("organizationId", "name");

-- CreateIndex
CREATE INDEX "Plant_organizationId_idx" ON "Plant"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Plant_organizationId_name_key" ON "Plant"("organizationId", "name");

-- CreateIndex
CREATE INDEX "BusinessUnit_organizationId_idx" ON "BusinessUnit"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessUnit_organizationId_name_key" ON "BusinessUnit"("organizationId", "name");

-- CreateIndex
CREATE INDEX "SavingCard_organizationId_idx" ON "SavingCard"("organizationId");

-- CreateIndex
CREATE INDEX "SavingCard_organizationId_phase_idx" ON "SavingCard"("organizationId", "phase");

-- CreateIndex
CREATE INDEX "SavingCard_organizationId_categoryId_idx" ON "SavingCard"("organizationId", "categoryId");

-- CreateIndex
CREATE INDEX "SavingCard_organizationId_buyerId_idx" ON "SavingCard"("organizationId", "buyerId");

-- CreateIndex
CREATE INDEX "MaterialConsumptionForecast_savingCardId_period_idx" ON "MaterialConsumptionForecast"("savingCardId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialConsumptionForecast_savingCardId_materialId_period_key" ON "MaterialConsumptionForecast"("savingCardId", "materialId", "period");

-- CreateIndex
CREATE INDEX "MaterialConsumptionActual_savingCardId_period_idx" ON "MaterialConsumptionActual"("savingCardId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialConsumptionActual_savingCardId_materialId_period_key" ON "MaterialConsumptionActual"("savingCardId", "materialId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "SavingCardStakeholder_savingCardId_userId_key" ON "SavingCardStakeholder"("savingCardId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PhaseChangeRequestApproval_phaseChangeRequestId_approverId_key" ON "PhaseChangeRequestApproval"("phaseChangeRequestId", "approverId");

-- CreateIndex
CREATE INDEX "AnnualTarget_organizationId_idx" ON "AnnualTarget"("organizationId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_activeOrganizationId_fkey" FOREIGN KEY ("activeOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Buyer" ADD CONSTRAINT "Buyer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plant" ADD CONSTRAINT "Plant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessUnit" ADD CONSTRAINT "BusinessUnit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingCard" ADD CONSTRAINT "SavingCard_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingCard" ADD CONSTRAINT "SavingCard_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingCard" ADD CONSTRAINT "SavingCard_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingCard" ADD CONSTRAINT "SavingCard_alternativeSupplierId_fkey" FOREIGN KEY ("alternativeSupplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingCard" ADD CONSTRAINT "SavingCard_alternativeMaterialId_fkey" FOREIGN KEY ("alternativeMaterialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingCard" ADD CONSTRAINT "SavingCard_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingCard" ADD CONSTRAINT "SavingCard_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingCard" ADD CONSTRAINT "SavingCard_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingCard" ADD CONSTRAINT "SavingCard_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialConsumptionForecast" ADD CONSTRAINT "MaterialConsumptionForecast_savingCardId_fkey" FOREIGN KEY ("savingCardId") REFERENCES "SavingCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialConsumptionForecast" ADD CONSTRAINT "MaterialConsumptionForecast_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialConsumptionForecast" ADD CONSTRAINT "MaterialConsumptionForecast_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialConsumptionForecast" ADD CONSTRAINT "MaterialConsumptionForecast_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialConsumptionActual" ADD CONSTRAINT "MaterialConsumptionActual_savingCardId_fkey" FOREIGN KEY ("savingCardId") REFERENCES "SavingCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialConsumptionActual" ADD CONSTRAINT "MaterialConsumptionActual_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialConsumptionActual" ADD CONSTRAINT "MaterialConsumptionActual_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialConsumptionActual" ADD CONSTRAINT "MaterialConsumptionActual_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingCardStakeholder" ADD CONSTRAINT "SavingCardStakeholder_savingCardId_fkey" FOREIGN KEY ("savingCardId") REFERENCES "SavingCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingCardStakeholder" ADD CONSTRAINT "SavingCardStakeholder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingCardEvidence" ADD CONSTRAINT "SavingCardEvidence_savingCardId_fkey" FOREIGN KEY ("savingCardId") REFERENCES "SavingCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingCardEvidence" ADD CONSTRAINT "SavingCardEvidence_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingCardAlternativeSupplier" ADD CONSTRAINT "SavingCardAlternativeSupplier_savingCardId_fkey" FOREIGN KEY ("savingCardId") REFERENCES "SavingCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingCardAlternativeSupplier" ADD CONSTRAINT "SavingCardAlternativeSupplier_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingCardAlternativeMaterial" ADD CONSTRAINT "SavingCardAlternativeMaterial_savingCardId_fkey" FOREIGN KEY ("savingCardId") REFERENCES "SavingCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingCardAlternativeMaterial" ADD CONSTRAINT "SavingCardAlternativeMaterial_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingCardAlternativeMaterial" ADD CONSTRAINT "SavingCardAlternativeMaterial_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingCardComment" ADD CONSTRAINT "SavingCardComment_savingCardId_fkey" FOREIGN KEY ("savingCardId") REFERENCES "SavingCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingCardComment" ADD CONSTRAINT "SavingCardComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_savingCardId_fkey" FOREIGN KEY ("savingCardId") REFERENCES "SavingCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhaseChangeRequest" ADD CONSTRAINT "PhaseChangeRequest_savingCardId_fkey" FOREIGN KEY ("savingCardId") REFERENCES "SavingCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhaseChangeRequest" ADD CONSTRAINT "PhaseChangeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhaseChangeRequestApproval" ADD CONSTRAINT "PhaseChangeRequestApproval_phaseChangeRequestId_fkey" FOREIGN KEY ("phaseChangeRequestId") REFERENCES "PhaseChangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhaseChangeRequestApproval" ADD CONSTRAINT "PhaseChangeRequestApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhaseHistory" ADD CONSTRAINT "PhaseHistory_savingCardId_fkey" FOREIGN KEY ("savingCardId") REFERENCES "SavingCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhaseHistory" ADD CONSTRAINT "PhaseHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_savingCardId_fkey" FOREIGN KEY ("savingCardId") REFERENCES "SavingCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnualTarget" ADD CONSTRAINT "AnnualTarget_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnualTarget" ADD CONSTRAINT "AnnualTarget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMENT ON COLUMN "User"."organizationId" IS
'DEPRECATED: legacy single-organization backfill source. Do not use for tenant resolution.';

CREATE OR REPLACE FUNCTION "resolveLegacyOrganizationMembershipRole"(user_role "Role")
RETURNS "OrganizationRole"
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE
    WHEN user_role IN (
      'HEAD_OF_GLOBAL_PROCUREMENT',
      'GLOBAL_CATEGORY_LEADER',
      'FINANCIAL_CONTROLLER'
    ) THEN 'ADMIN'::"OrganizationRole"
    ELSE 'MEMBER'::"OrganizationRole"
  END
$$;

INSERT INTO "OrganizationMembership" (
  "id",
  "userId",
  "organizationId",
  "role",
  "status",
  "createdAt",
  "updatedAt"
)
SELECT
  'membership_' || md5("id" || ':' || "organizationId"),
  "id",
  "organizationId",
  "resolveLegacyOrganizationMembershipRole"("role"),
  'ACTIVE'::"MembershipStatus",
  "createdAt",
  "updatedAt"
FROM "User"
ON CONFLICT ("userId", "organizationId") DO NOTHING;

WITH "rankedActiveMemberships" AS (
  SELECT
    membership."userId",
    membership."organizationId",
    ROW_NUMBER() OVER (
      PARTITION BY membership."userId"
      ORDER BY membership."createdAt" ASC, membership."organizationId" ASC
    ) AS "position"
  FROM "OrganizationMembership" AS membership
  WHERE membership."status" = 'ACTIVE'
),
"preferredActiveOrganizations" AS (
  SELECT
    user_record."id" AS "userId",
    COALESCE(
      current_membership."organizationId",
      legacy_membership."organizationId",
      first_membership."organizationId"
    ) AS "organizationId"
  FROM "User" AS user_record
  LEFT JOIN "rankedActiveMemberships" AS current_membership
    ON current_membership."userId" = user_record."id"
   AND current_membership."organizationId" = user_record."activeOrganizationId"
  LEFT JOIN "rankedActiveMemberships" AS legacy_membership
    ON legacy_membership."userId" = user_record."id"
   AND legacy_membership."organizationId" = user_record."organizationId"
  LEFT JOIN "rankedActiveMemberships" AS first_membership
    ON first_membership."userId" = user_record."id"
   AND first_membership."position" = 1
)
UPDATE "User" AS user_record
SET "activeOrganizationId" = preferred."organizationId"
FROM "preferredActiveOrganizations" AS preferred
WHERE user_record."id" = preferred."userId"
  AND preferred."organizationId" IS NOT NULL
  AND user_record."activeOrganizationId" IS DISTINCT FROM preferred."organizationId";

CREATE OR REPLACE FUNCTION "syncLegacyUserMembershipAfterWrite"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."organizationId" IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO "OrganizationMembership" (
    "id",
    "userId",
    "organizationId",
    "role",
    "status",
    "createdAt",
    "updatedAt"
  )
  VALUES (
    'membership_' || md5(NEW."id" || ':' || NEW."organizationId"),
    NEW."id",
    NEW."organizationId",
    "resolveLegacyOrganizationMembershipRole"(NEW."role"),
    'ACTIVE'::"MembershipStatus",
    COALESCE(NEW."createdAt", CURRENT_TIMESTAMP),
    COALESCE(NEW."updatedAt", CURRENT_TIMESTAMP)
  )
  ON CONFLICT ("userId", "organizationId") DO NOTHING;

  IF NEW."activeOrganizationId" IS NULL THEN
    UPDATE "User"
    SET "activeOrganizationId" = NEW."organizationId"
    WHERE "id" = NEW."id"
      AND "activeOrganizationId" IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "User_sync_legacy_membership_after_write" ON "User";

CREATE TRIGGER "User_sync_legacy_membership_after_write"
AFTER INSERT OR UPDATE OF "organizationId", "role"
ON "User"
FOR EACH ROW
EXECUTE FUNCTION "syncLegacyUserMembershipAfterWrite"();
