-- Lower card-creation friction: plant and business unit become optional.
-- Drop the NOT NULL constraints; the foreign keys already allow the referenced
-- rows and now tolerate NULL (Unassigned).
ALTER TABLE "SavingCard" ALTER COLUMN "plantId" DROP NOT NULL;
ALTER TABLE "SavingCard" ALTER COLUMN "businessUnitId" DROP NOT NULL;
