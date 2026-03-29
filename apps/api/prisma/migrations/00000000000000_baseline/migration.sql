-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "firebase_uid" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "display_name" TEXT,
    "locale" VARCHAR(5) NOT NULL DEFAULT 'mn',
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'Asia/Ulaanbaatar',
    "unit_system" VARCHAR(10) NOT NULL DEFAULT 'metric',
    "gender" VARCHAR(20),
    "birth_date" DATE,
    "height_cm" DECIMAL(5,1),
    "weight_kg" DECIMAL(5,1),
    "goal_weight_kg" DECIMAL(5,1),
    "activity_level" VARCHAR(30),
    "diet_preference" VARCHAR(30),
    "water_target_ml" INTEGER NOT NULL DEFAULT 2000,
    "onboarding_completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "targets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "goal_type" VARCHAR(20) NOT NULL,
    "calorie_target" INTEGER NOT NULL,
    "protein_grams" INTEGER NOT NULL,
    "carbs_grams" INTEGER NOT NULL,
    "fat_grams" INTEGER NOT NULL,
    "weekly_rate_kg" DECIMAL(4,2) NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foods" (
    "id" UUID NOT NULL,
    "normalized_name" VARCHAR(500) NOT NULL,
    "locale" VARCHAR(5) NOT NULL DEFAULT 'mn',
    "status" VARCHAR(20) NOT NULL DEFAULT 'approved',
    "source_type" VARCHAR(30) NOT NULL,
    "source_ref" TEXT,
    "confidence" DECIMAL(3,2),
    "verified_by" UUID,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "foods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_servings" (
    "id" UUID NOT NULL,
    "food_id" UUID NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "label_mn" VARCHAR(100),
    "grams_per_unit" DECIMAL(8,2) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "food_servings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_nutrients" (
    "id" UUID NOT NULL,
    "food_id" UUID NOT NULL,
    "calories_per_100g" DECIMAL(8,2) NOT NULL,
    "protein_per_100g" DECIMAL(8,2) NOT NULL,
    "carbs_per_100g" DECIMAL(8,2) NOT NULL,
    "fat_per_100g" DECIMAL(8,2) NOT NULL,
    "fiber_per_100g" DECIMAL(8,2),
    "sugar_per_100g" DECIMAL(8,2),
    "sodium_per_100g" DECIMAL(8,2),
    "saturated_fat_per_100g" DECIMAL(8,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "food_nutrients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_aliases" (
    "id" UUID NOT NULL,
    "food_id" UUID NOT NULL,
    "alias" VARCHAR(500) NOT NULL,
    "locale" VARCHAR(5) NOT NULL DEFAULT 'mn',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "food_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_localizations" (
    "id" UUID NOT NULL,
    "food_id" UUID NOT NULL,
    "locale" VARCHAR(5) NOT NULL,
    "name" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "food_localizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "barcodes" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "food_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "barcodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "meal_type" VARCHAR(20),
    "source" VARCHAR(20) NOT NULL,
    "logged_at" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "total_calories" INTEGER,
    "total_protein" DECIMAL(8,2),
    "total_carbs" DECIMAL(8,2),
    "total_fat" DECIMAL(8,2),
    "total_fiber" DECIMAL(8,2),
    "total_sugar" DECIMAL(8,2),
    "total_sodium" DECIMAL(8,2),
    "total_saturated_fat" DECIMAL(8,2),

    CONSTRAINT "meal_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_log_items" (
    "id" UUID NOT NULL,
    "meal_log_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "food_id" UUID,
    "quantity" DECIMAL(8,2) NOT NULL,
    "serving_label" VARCHAR(100) NOT NULL,
    "grams_per_unit" DECIMAL(8,2) NOT NULL,
    "snapshot_calories" INTEGER NOT NULL,
    "snapshot_protein" DECIMAL(8,2) NOT NULL,
    "snapshot_carbs" DECIMAL(8,2) NOT NULL,
    "snapshot_fat" DECIMAL(8,2) NOT NULL,
    "snapshot_fiber" DECIMAL(8,2),
    "snapshot_sugar" DECIMAL(8,2),
    "snapshot_sodium" DECIMAL(8,2),
    "snapshot_saturated_fat" DECIMAL(8,2),
    "snapshot_food_name" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_log_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "water_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount_ml" INTEGER NOT NULL,
    "logged_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "water_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weight_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "weight_kg" DECIMAL(5,1) NOT NULL,
    "logged_at" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weight_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "body_measurement_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "waist_cm" DECIMAL(5,1) NOT NULL,
    "neck_cm" DECIMAL(5,1) NOT NULL,
    "hip_cm" DECIMAL(5,1),
    "weight_kg" DECIMAL(5,1) NOT NULL,
    "body_fat_percent" DECIMAL(4,1) NOT NULL,
    "fat_mass_kg" DECIMAL(5,1) NOT NULL,
    "lean_mass_kg" DECIMAL(5,1) NOT NULL,
    "bmi" DECIMAL(4,1) NOT NULL,
    "bmi_category" VARCHAR(20) NOT NULL,
    "logged_at" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "body_measurement_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "workout_type" VARCHAR(50) NOT NULL,
    "duration_min" INTEGER,
    "calorie_burned" INTEGER,
    "note" TEXT,
    "logged_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_links" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "telegram_user_id" TEXT NOT NULL,
    "chat_id" VARCHAR(255),
    "telegram_username" TEXT,
    "link_code" VARCHAR(20),
    "link_code_expires_at" TIMESTAMP(3),
    "linked_at" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "morning_reminder" BOOLEAN NOT NULL DEFAULT true,
    "evening_reminder" BOOLEAN NOT NULL DEFAULT true,
    "reminder_timezone" VARCHAR(50) NOT NULL DEFAULT 'Asia/Ulaanbaatar',
    "quiet_hours_start" VARCHAR(5),
    "quiet_hours_end" VARCHAR(5),
    "channels" TEXT[] DEFAULT ARRAY['push']::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "platform" VARCHAR(10) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tier" VARCHAR(20) NOT NULL DEFAULT 'free',
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "provider" VARCHAR(20),
    "provider_sub_id" TEXT,
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_ledger" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "event" VARCHAR(50) NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "provider_event_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qpay_invoices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan" VARCHAR(20) NOT NULL,
    "amount_mnt" INTEGER NOT NULL,
    "qpay_invoice_id" VARCHAR(255),
    "sender_invoice_no" VARCHAR(50) NOT NULL,
    "qr_text" TEXT,
    "qr_image" TEXT,
    "urls" JSONB,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "paid_at" TIMESTAMP(3),
    "qpay_payment_id" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qpay_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_queue" (
    "id" UUID NOT NULL,
    "entity_type" VARCHAR(30) NOT NULL,
    "entity_id" UUID NOT NULL,
    "submitted_by" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moderation_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "consent_type" VARCHAR(50) NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "accepted" BOOLEAN NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "privacy_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "request_type" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "completed_at" TIMESTAMP(3),
    "result_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "privacy_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL,
    "external_system" VARCHAR(30) NOT NULL,
    "external_event_id" VARCHAR(255) NOT NULL,
    "response_status" INTEGER,
    "response_body" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_drafts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "job_id" TEXT,
    "s3_key" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'waiting',
    "locale" VARCHAR(5),
    "transcription" TEXT,
    "parsed_items" JSONB,
    "meal_type" VARCHAR(20),
    "total_calories" DECIMAL(8,2),
    "total_protein" DECIMAL(8,2),
    "total_carbs" DECIMAL(8,2),
    "total_fat" DECIMAL(8,2),
    "total_sugar" DECIMAL(8,2),
    "total_sodium" DECIMAL(8,2),
    "total_saturated_fat" DECIMAL(8,2),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "actor_role" VARCHAR(20) NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" UUID NOT NULL,
    "changes" JSONB,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "event" VARCHAR(100) NOT NULL,
    "properties" JSONB,
    "session_id" VARCHAR(100),
    "platform" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_templates" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "meal_type" VARCHAR(20),
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_template_items" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "food_id" UUID NOT NULL,
    "serving_id" UUID NOT NULL,
    "quantity" DECIMAL(8,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "food_id" UUID NOT NULL,
    "meal_log_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_messages" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "channel" VARCHAR(20) NOT NULL,
    "message_type" VARCHAR(50) NOT NULL,
    "content" TEXT NOT NULL,
    "status" VARCHAR(10) NOT NULL,
    "error_message" TEXT,
    "ai_model" VARCHAR(30),
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "generation_ms" INTEGER,
    "delivery_ms" INTEGER,
    "job_id" VARCHAR(100),
    "metadata" JSONB,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbound_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_memories" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "summary" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coach_memories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_firebase_uid_key" ON "users"("firebase_uid");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_user_id_key" ON "profiles"("user_id");

-- CreateIndex
CREATE INDEX "targets_user_id_effective_from_idx" ON "targets"("user_id", "effective_from" DESC);

-- CreateIndex
CREATE INDEX "foods_locale_normalized_name_idx" ON "foods"("locale", "normalized_name");

-- CreateIndex
CREATE INDEX "food_servings_food_id_idx" ON "food_servings"("food_id");

-- CreateIndex
CREATE INDEX "food_nutrients_food_id_idx" ON "food_nutrients"("food_id");

-- CreateIndex
CREATE UNIQUE INDEX "food_nutrients_food_id_key" ON "food_nutrients"("food_id");

-- CreateIndex
CREATE INDEX "food_aliases_food_id_idx" ON "food_aliases"("food_id");

-- CreateIndex
CREATE INDEX "food_aliases_locale_alias_idx" ON "food_aliases"("locale", "alias");

-- CreateIndex
CREATE UNIQUE INDEX "food_localizations_food_id_locale_key" ON "food_localizations"("food_id", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "barcodes_code_key" ON "barcodes"("code");

-- CreateIndex
CREATE INDEX "barcodes_food_id_idx" ON "barcodes"("food_id");

-- CreateIndex
CREATE INDEX "meal_logs_user_id_logged_at_idx" ON "meal_logs"("user_id", "logged_at" DESC);

-- CreateIndex
CREATE INDEX "meal_log_items_meal_log_id_created_at_idx" ON "meal_log_items"("meal_log_id", "created_at");

-- CreateIndex
CREATE INDEX "meal_log_items_user_id_created_at_idx" ON "meal_log_items"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "meal_log_items_food_id_idx" ON "meal_log_items"("food_id");

-- CreateIndex
CREATE INDEX "water_logs_user_id_logged_at_idx" ON "water_logs"("user_id", "logged_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "weight_logs_user_id_logged_at_key" ON "weight_logs"("user_id", "logged_at");

-- CreateIndex
CREATE INDEX "body_measurement_logs_user_id_logged_at_idx" ON "body_measurement_logs"("user_id", "logged_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "body_measurement_logs_user_id_logged_at_key" ON "body_measurement_logs"("user_id", "logged_at");

-- CreateIndex
CREATE INDEX "workout_logs_user_id_logged_at_idx" ON "workout_logs"("user_id", "logged_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_links_user_id_key" ON "telegram_links"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_links_telegram_user_id_key" ON "telegram_links"("telegram_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_token_key" ON "device_tokens"("token");

-- CreateIndex
CREATE INDEX "device_tokens_user_id_idx" ON "device_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_user_id_key" ON "subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "subscriptions_provider_sub_id_idx" ON "subscriptions"("provider_sub_id");

-- CreateIndex
CREATE INDEX "subscription_ledger_subscription_id_created_at_idx" ON "subscription_ledger"("subscription_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "qpay_invoices_sender_invoice_no_key" ON "qpay_invoices"("sender_invoice_no");

-- CreateIndex
CREATE INDEX "qpay_invoices_user_id_created_at_idx" ON "qpay_invoices"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "qpay_invoices_qpay_invoice_id_idx" ON "qpay_invoices"("qpay_invoice_id");

-- CreateIndex
CREATE INDEX "moderation_queue_status_created_at_idx" ON "moderation_queue"("status", "created_at");

-- CreateIndex
CREATE INDEX "moderation_queue_submitted_by_idx" ON "moderation_queue"("submitted_by");

-- CreateIndex
CREATE INDEX "moderation_queue_entity_id_idx" ON "moderation_queue"("entity_id");

-- CreateIndex
CREATE INDEX "consents_user_id_idx" ON "consents"("user_id");

-- CreateIndex
CREATE INDEX "privacy_requests_user_id_idx" ON "privacy_requests"("user_id");

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_external_system_external_event_id_key" ON "idempotency_keys"("external_system", "external_event_id");

-- CreateIndex
CREATE INDEX "voice_drafts_user_id_created_at_idx" ON "voice_drafts"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "voice_drafts_expires_at_idx" ON "voice_drafts"("expires_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "analytics_events_event_created_at_idx" ON "analytics_events"("event", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_user_id_created_at_idx" ON "analytics_events"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "meal_templates_user_id_usage_count_idx" ON "meal_templates"("user_id", "usage_count" DESC);

-- CreateIndex
CREATE INDEX "meal_template_items_template_id_sort_order_idx" ON "meal_template_items"("template_id", "sort_order");

-- CreateIndex
CREATE INDEX "meal_template_items_food_id_idx" ON "meal_template_items"("food_id");

-- CreateIndex
CREATE INDEX "meal_template_items_serving_id_idx" ON "meal_template_items"("serving_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_food_id_key" ON "favorites"("user_id", "food_id");

-- CreateIndex
CREATE INDEX "outbound_messages_user_id_idx" ON "outbound_messages"("user_id");

-- CreateIndex
CREATE INDEX "outbound_messages_message_type_idx" ON "outbound_messages"("message_type");

-- CreateIndex
CREATE INDEX "outbound_messages_status_idx" ON "outbound_messages"("status");

-- CreateIndex
CREATE INDEX "outbound_messages_sent_at_id_idx" ON "outbound_messages"("sent_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "outbound_messages_channel_idx" ON "outbound_messages"("channel");

-- CreateIndex
CREATE UNIQUE INDEX "coach_memories_user_id_category_key" ON "coach_memories"("user_id", "category");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "targets" ADD CONSTRAINT "targets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_servings" ADD CONSTRAINT "food_servings_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "foods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_nutrients" ADD CONSTRAINT "food_nutrients_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "foods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_aliases" ADD CONSTRAINT "food_aliases_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "foods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_localizations" ADD CONSTRAINT "food_localizations_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "foods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barcodes" ADD CONSTRAINT "barcodes_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "foods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_log_items" ADD CONSTRAINT "meal_log_items_meal_log_id_fkey" FOREIGN KEY ("meal_log_id") REFERENCES "meal_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_log_items" ADD CONSTRAINT "meal_log_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_log_items" ADD CONSTRAINT "meal_log_items_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "foods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "water_logs" ADD CONSTRAINT "water_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weight_logs" ADD CONSTRAINT "weight_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "body_measurement_logs" ADD CONSTRAINT "body_measurement_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_links" ADD CONSTRAINT "telegram_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_ledger" ADD CONSTRAINT "subscription_ledger_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qpay_invoices" ADD CONSTRAINT "qpay_invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_drafts" ADD CONSTRAINT "voice_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_templates" ADD CONSTRAINT "meal_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_template_items" ADD CONSTRAINT "meal_template_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "meal_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_template_items" ADD CONSTRAINT "meal_template_items_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "foods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_template_items" ADD CONSTRAINT "meal_template_items_serving_id_fkey" FOREIGN KEY ("serving_id") REFERENCES "food_servings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "foods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_meal_log_id_fkey" FOREIGN KEY ("meal_log_id") REFERENCES "meal_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_memories" ADD CONSTRAINT "coach_memories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

