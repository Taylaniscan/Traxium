-- Convert money and quantity columns from double precision (Float) to fixed-precision
-- DECIMAL so finance-facing figures are exact and reconcile to the cent.

ALTER TABLE "SavingCard"
  ALTER COLUMN "baselinePrice" SET DATA TYPE DECIMAL(18,4),
  ALTER COLUMN "newPrice" SET DATA TYPE DECIMAL(18,4),
  ALTER COLUMN "annualVolume" SET DATA TYPE DECIMAL(18,4),
  ALTER COLUMN "fxRate" SET DATA TYPE DECIMAL(18,8),
  ALTER COLUMN "calculatedSavings" SET DATA TYPE DECIMAL(18,4),
  ALTER COLUMN "calculatedSavingsUSD" SET DATA TYPE DECIMAL(18,4);

ALTER TABLE "Category"
  ALTER COLUMN "annualTarget" SET DATA TYPE DECIMAL(18,4);

ALTER TABLE "AnnualTarget"
  ALTER COLUMN "targetValue" SET DATA TYPE DECIMAL(18,4);

ALTER TABLE "FxRate"
  ALTER COLUMN "rateToEUR" SET DATA TYPE DECIMAL(18,8);

ALTER TABLE "SavingCardAlternativeSupplier"
  ALTER COLUMN "quotedPrice" SET DATA TYPE DECIMAL(18,4);

ALTER TABLE "SavingCardAlternativeMaterial"
  ALTER COLUMN "quotedPrice" SET DATA TYPE DECIMAL(18,4);

ALTER TABLE "MaterialConsumptionForecast"
  ALTER COLUMN "forecastQty" SET DATA TYPE DECIMAL(18,4);

ALTER TABLE "MaterialConsumptionActual"
  ALTER COLUMN "actualQty" SET DATA TYPE DECIMAL(18,4);
