-- Re-pivot foreign-exchange rates to USD as the canonical reporting currency.
ALTER TABLE "FxRate" RENAME COLUMN "rateToEUR" TO "rateToUSD";
