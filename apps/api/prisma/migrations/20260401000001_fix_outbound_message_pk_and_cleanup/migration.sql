-- AlterColumn: change OutboundMessage.id from text to uuid to match convention
-- This requires dropping and recreating the default since the column type changes.
ALTER TABLE "outbound_messages" ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid;
ALTER TABLE "outbound_messages" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- DropColumn: remove unused Food.source_ref
ALTER TABLE "foods" DROP COLUMN IF EXISTS "source_ref";

-- DropColumn: remove unused Food.confidence
ALTER TABLE "foods" DROP COLUMN IF EXISTS "confidence";
