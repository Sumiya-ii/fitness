-- Backfill user_id on meal_log_items from parent meal_logs
ALTER TABLE "meal_log_items" ADD COLUMN IF NOT EXISTS "user_id" UUID;

UPDATE "meal_log_items" mli
SET "user_id" = ml."user_id"
FROM "meal_logs" ml
WHERE mli."meal_log_id" = ml."id"
  AND mli."user_id" IS NULL;

ALTER TABLE "meal_log_items" ALTER COLUMN "user_id" SET NOT NULL;

-- Add FK if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'meal_log_items_user_id_fkey') THEN
    ALTER TABLE "meal_log_items" ADD CONSTRAINT "meal_log_items_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Add index if not exists
CREATE INDEX IF NOT EXISTS "meal_log_items_user_id_created_at_idx"
  ON "meal_log_items"("user_id", "created_at" DESC);

-- Fix favorites: delete orphan null food_id rows, then enforce NOT NULL + FK
DELETE FROM "favorites" WHERE "food_id" IS NULL;

ALTER TABLE "favorites" ALTER COLUMN "food_id" SET NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'favorites_food_id_fkey') THEN
    ALTER TABLE "favorites" ADD CONSTRAINT "favorites_food_id_fkey"
      FOREIGN KEY ("food_id") REFERENCES "foods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Add updated_at default for outbound_messages so raw INSERTs work
ALTER TABLE "outbound_messages" ALTER COLUMN "updated_at" SET DEFAULT NOW();
