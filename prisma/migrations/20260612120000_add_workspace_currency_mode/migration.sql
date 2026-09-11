-- USD-native workspace controls. New workspaces default to USD-only (single currency).
ALTER TABLE "Organization"
  ADD COLUMN "defaultCurrency" "Currency" NOT NULL DEFAULT 'USD',
  ADD COLUMN "multiCurrencyEnabled" BOOLEAN NOT NULL DEFAULT false;
