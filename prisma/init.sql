-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('HEAD_OF_GLOBAL_PROCUREMENT', 'GLOBAL_CATEGORY_LEADER', 'TACTICAL_BUYER', 'PROCUREMENT_ANALYST', 'FINANCIAL_CONTROLLER');

-- CreateEnum
CREATE TYPE "Phase" AS ENUM ('IDEA', 'VALIDATED', 'REALISED', 'ACHIEVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('ONE_TIME', 'RECURRING', 'MULTI_YEAR');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('EUR', 'USD');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

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
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "User_organizationId_email_key" ON "User"("organizationId", "email");

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
CREATE UNIQUE INDEX "SavingCardStakeholder_savingCardId_userId_key" ON "SavingCardStakeholder"("savingCardId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PhaseChangeRequestApproval_phaseChangeRequestId_approverId_key" ON "PhaseChangeRequestApproval"("phaseChangeRequestId", "approverId");

-- CreateIndex
CREATE INDEX "AnnualTarget_organizationId_idx" ON "AnnualTarget"("organizationId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
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
