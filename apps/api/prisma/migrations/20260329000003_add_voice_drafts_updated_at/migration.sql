-- AlterTable (idempotent): add updated_at to voice_drafts if missing
-- Production was set up before the baseline included this column.
-- Default to CURRENT_TIMESTAMP for existing rows, then Prisma @updatedAt handles it going forward.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voice_drafts' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE "voice_drafts"
      ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- AlterTable (idempotent): add updated_at to outbound_messages if missing
-- Same root cause: production DB pre-dates the baseline migration that introduced this column.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'outbound_messages' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE "outbound_messages"
      ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- Ensure the column has a default for raw INSERTs (no-op if already set)
ALTER TABLE "outbound_messages" ALTER COLUMN "updated_at" SET DEFAULT NOW();
