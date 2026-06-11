-- Fiscal year definition used to prorate in-year savings value.
ALTER TABLE "Organization"
  ADD COLUMN "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 1;

-- Cost avoidance reference price (the avoided / quoted price) and periodized savings.
ALTER TABLE "SavingCard"
  ADD COLUMN "referencePrice" DECIMAL(18,4),
  ADD COLUMN "annualizedRunRate" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "annualizedRunRateUSD" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "inYearValue" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "inYearValueUSD" DECIMAL(18,4) NOT NULL DEFAULT 0;

-- Backfill the annualized run-rate from the existing annual savings so historical
-- cards report a sensible run-rate immediately. In-year value is left at 0 until the
-- card is next saved, at which point it is recomputed against the fiscal year.
UPDATE "SavingCard"
SET
  "annualizedRunRate" = "calculatedSavings",
  "annualizedRunRateUSD" = "calculatedSavingsUSD";
