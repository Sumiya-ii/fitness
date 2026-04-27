-- Per-user food calibration table (Phase B).
--
-- After the user repeatedly corrects AI estimates for a canonical food
-- (e.g. бууз: 360 kcal -> 280 kcal), we record the ratio and scale future
-- estimates by the median of the last N samples. Ratio bounded to
-- [0.4, 2.5] in app code so a single bad sample can't flip the dial.
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS "user_food_calibrations" (
  "id"                UUID         NOT NULL DEFAULT gen_random_uuid(),
  "user_id"           UUID         NOT NULL,
  "canonical_food_id" VARCHAR(50)  NOT NULL,
  "median_ratio"      DECIMAL(4,3) NOT NULL,
  "recent_samples"    JSONB        NOT NULL,
  "sample_count"      INTEGER      NOT NULL DEFAULT 0,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_food_calibrations_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_food_calibrations_user_id_fkey'
  ) THEN
    ALTER TABLE "user_food_calibrations"
      ADD CONSTRAINT "user_food_calibrations_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "user_food_calibrations_user_id_canonical_food_id_key"
  ON "user_food_calibrations" ("user_id", "canonical_food_id");

CREATE INDEX IF NOT EXISTS "user_food_calibrations_user_id_idx"
  ON "user_food_calibrations" ("user_id");
