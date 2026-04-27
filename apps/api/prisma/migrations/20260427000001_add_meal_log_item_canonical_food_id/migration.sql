-- Add canonical_food_id to meal_log_items for cross-source food identity.
--
-- Voice and photo items have foodId=NULL (no catalog row); without a stable
-- identifier we can't group "бууз" / "buuz" / "Бууз" into one entry for the
-- recents list or for the per-user calibration loop.
--
-- Idempotent: skip the column add if it already exists, ignore the index if
-- it conflicts with a prior partial migration.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meal_log_items' AND column_name = 'canonical_food_id'
  ) THEN
    ALTER TABLE "meal_log_items"
      ADD COLUMN "canonical_food_id" VARCHAR(50);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "meal_log_items_user_id_canonical_food_id_idx"
  ON "meal_log_items" ("user_id", "canonical_food_id");
