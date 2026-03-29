-- Prevent negative nutrition values in food_nutrients
ALTER TABLE "food_nutrients"
  ADD CONSTRAINT "chk_food_nutrients_positive"
  CHECK (
    "calories_per_100g" >= 0
    AND "protein_per_100g" >= 0
    AND "carbs_per_100g" >= 0
    AND "fat_per_100g" >= 0
  );

-- Prevent negative snapshot values in meal_log_items
ALTER TABLE "meal_log_items"
  ADD CONSTRAINT "chk_meal_log_items_positive"
  CHECK (
    "snapshot_calories" >= 0
    AND "snapshot_protein" >= 0
    AND "snapshot_carbs" >= 0
    AND "snapshot_fat" >= 0
  );

-- Prevent negative totals in meal_logs
ALTER TABLE "meal_logs"
  ADD CONSTRAINT "chk_meal_logs_positive"
  CHECK (
    "total_calories" IS NULL OR "total_calories" >= 0
  );

-- Prevent negative water amounts
ALTER TABLE "water_logs"
  ADD CONSTRAINT "chk_water_logs_positive"
  CHECK ("amount_ml" > 0);

-- Prevent negative/zero weight
ALTER TABLE "weight_logs"
  ADD CONSTRAINT "chk_weight_logs_positive"
  CHECK ("weight_kg" > 0);

-- Prevent negative body measurements
ALTER TABLE "body_measurement_logs"
  ADD CONSTRAINT "chk_body_measurements_positive"
  CHECK (
    "waist_cm" > 0
    AND "neck_cm" > 0
    AND "weight_kg" > 0
    AND "body_fat_percent" >= 0
    AND "body_fat_percent" <= 100
  );
