-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "annualTarget" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Plant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BusinessUnit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SavingCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "savingType" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'IDEA',
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
    "baselinePrice" REAL NOT NULL,
    "newPrice" REAL NOT NULL,
    "annualVolume" REAL NOT NULL,
    "currency" TEXT NOT NULL,
    "fxRate" REAL NOT NULL,
    "calculatedSavings" REAL NOT NULL,
    "calculatedSavingsUSD" REAL NOT NULL,
    "frequency" TEXT NOT NULL,
    "savingDriver" TEXT,
    "implementationComplexity" TEXT,
    "qualificationStatus" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "impactStartDate" DATETIME NOT NULL,
    "impactEndDate" DATETIME NOT NULL,
    "financeLocked" BOOLEAN NOT NULL DEFAULT false,
    "cancellationReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SavingCard_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SavingCard_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SavingCard_alternativeSupplierId_fkey" FOREIGN KEY ("alternativeSupplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SavingCard_alternativeMaterialId_fkey" FOREIGN KEY ("alternativeMaterialId") REFERENCES "Material" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SavingCard_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SavingCard_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SavingCard_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SavingCard_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavingCardStakeholder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "savingCardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavingCardStakeholder_savingCardId_fkey" FOREIGN KEY ("savingCardId") REFERENCES "SavingCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavingCardStakeholder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavingCardEvidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "savingCardId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageBucket" TEXT NOT NULL,
"storagePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileType" TEXT NOT NULL,
    "uploadedById" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavingCardEvidence_savingCardId_fkey" FOREIGN KEY ("savingCardId") REFERENCES "SavingCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavingCardAlternativeSupplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "savingCardId" TEXT NOT NULL,
    "supplierId" TEXT,
    "supplierNameManual" TEXT,
    "country" TEXT NOT NULL,
    "quotedPrice" REAL NOT NULL,
    "currency" TEXT NOT NULL,
    "leadTimeDays" INTEGER NOT NULL,
    "moq" INTEGER NOT NULL,
    "paymentTerms" TEXT NOT NULL,
    "qualityRating" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "notes" TEXT,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavingCardAlternativeSupplier_savingCardId_fkey" FOREIGN KEY ("savingCardId") REFERENCES "SavingCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavingCardAlternativeSupplier_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavingCardAlternativeMaterial" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "savingCardId" TEXT NOT NULL,
    "materialId" TEXT,
    "materialNameManual" TEXT,
    "supplierId" TEXT,
    "supplierNameManual" TEXT,
    "specification" TEXT NOT NULL,
    "quotedPrice" REAL NOT NULL,
    "currency" TEXT NOT NULL,
    "performanceImpact" TEXT NOT NULL,
    "qualificationStatus" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "notes" TEXT,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavingCardAlternativeMaterial_savingCardId_fkey" FOREIGN KEY ("savingCardId") REFERENCES "SavingCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavingCardAlternativeMaterial_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SavingCardAlternativeMaterial_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavingCardComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "savingCardId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavingCardComment_savingCardId_fkey" FOREIGN KEY ("savingCardId") REFERENCES "SavingCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavingCardComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "savingCardId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Approval_savingCardId_fkey" FOREIGN KEY ("savingCardId") REFERENCES "SavingCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Approval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PhaseChangeRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "savingCardId" TEXT NOT NULL,
    "currentPhase" TEXT NOT NULL,
    "requestedPhase" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "cancellationReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PhaseChangeRequest_savingCardId_fkey" FOREIGN KEY ("savingCardId") REFERENCES "SavingCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PhaseChangeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PhaseChangeRequestApproval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phaseChangeRequestId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "decidedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PhaseChangeRequestApproval_phaseChangeRequestId_fkey" FOREIGN KEY ("phaseChangeRequestId") REFERENCES "PhaseChangeRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PhaseChangeRequestApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PhaseHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "savingCardId" TEXT NOT NULL,
    "fromPhase" TEXT,
    "toPhase" TEXT NOT NULL,
    "changedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PhaseHistory_savingCardId_fkey" FOREIGN KEY ("savingCardId") REFERENCES "SavingCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "savingCardId" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_savingCardId_fkey" FOREIGN KEY ("savingCardId") REFERENCES "SavingCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FxRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "currency" TEXT NOT NULL,
    "rateToEUR" REAL NOT NULL,
    "validFrom" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AnnualTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "targetValue" REAL NOT NULL,
    "categoryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnnualTarget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_name_key" ON "Supplier"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Material_name_key" ON "Material"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Plant_name_key" ON "Plant"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessUnit_name_key" ON "BusinessUnit"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SavingCardStakeholder_savingCardId_userId_key" ON "SavingCardStakeholder"("savingCardId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PhaseChangeRequestApproval_phaseChangeRequestId_approverId_key" ON "PhaseChangeRequestApproval"("phaseChangeRequestId", "approverId");

