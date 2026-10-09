-- Existing workspaces retain their USD reporting basis and existing locale display.
-- Historical lead country values are left untouched; only new leads require explicit input.
ALTER TABLE "Organization"
  ADD COLUMN "reportingCurrency" "Currency" NOT NULL DEFAULT 'USD',
  ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en-US',
  ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN "measurementSystem" TEXT NOT NULL DEFAULT 'metric';

ALTER TABLE "PilotLead" ALTER COLUMN "country" DROP DEFAULT;

ALTER TABLE "SavingCard"
  ALTER COLUMN "baselinePrice" TYPE DECIMAL(22,8),
  ALTER COLUMN "newPrice" TYPE DECIMAL(22,8),
  ALTER COLUMN "referencePrice" TYPE DECIMAL(22,8),
  ALTER COLUMN "annualVolume" TYPE DECIMAL(22,6),
  ALTER COLUMN "fxRate" TYPE DECIMAL(20,10);
ALTER TABLE "SavingCard"
  ADD COLUMN "fxRateEffectiveDate" TIMESTAMP(3),
  ADD COLUMN "fxRateSource" TEXT;

ALTER TABLE "SavingCardAlternativeSupplier" ALTER COLUMN "quotedPrice" TYPE DECIMAL(22,8);
ALTER TABLE "SavingCardAlternativeSupplier" ADD COLUMN "quotedUnit" TEXT;
ALTER TABLE "SavingCardAlternativeMaterial" ALTER COLUMN "quotedPrice" TYPE DECIMAL(22,8);
ALTER TABLE "SavingCardAlternativeMaterial" ADD COLUMN "quotedUnit" TEXT;
ALTER TABLE "FxRate" ALTER COLUMN "rateToUSD" TYPE DECIMAL(20,10);
