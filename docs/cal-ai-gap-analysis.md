# Cal AI vs. Coach — Backend Gap Analysis & Implementation Roadmap

> **Goal**: Implement every item in priority order to achieve full feature parity with Cal AI.
> **Scope**: Backend only — API endpoints, data models, queue processors, business logic.
> **Last updated**: 2026-03-26

---

## Executive Summary

Coach has a solid NestJS/Prisma backend with the right architectural patterns. The main gaps versus Cal AI fall into five categories:

1. **Nutrition data model** — Coach tracks 5 nutrients; Cal AI tracks 7+ (missing sodium, sugar, saturated fat)
2. **Exercise & net calories** — WorkoutLog schema exists but has zero API surface; Cal AI treats exercise as first-class
3. **Health platform integration** — Cal AI reads/writes Apple Health & Google Fit; Coach has nothing
4. **Missing food logging modes** — custom user foods, saved meal templates, recipes, nutrition label OCR
5. **Body composition & advanced analytics** — Cal AI has BMI, body fat %, rollover calories, step-adjusted budgets

---

## Priority 1 — Core Data Model & Calculation Fixes

_Must-haves. Everything downstream depends on these being right._

---

### P1.1 — Expand FoodNutrient Model (Sodium, Sugar, Saturated Fat, Cholesterol)

**Cal AI**: Uses FatSecret API which provides full macro + micronutrient data including sodium, sugar, fiber, saturated fat, cholesterol per food item. Sodium accuracy is imperfect but the field exists and is surfaced.

**Coach today**: `FoodNutrient` stores only `caloriesPer100g`, `proteinPer100g`, `carbsPer100g`, `fatPer100g`, `fiberPer100g`. Sugar and sodium are absent from the database schema entirely.

**Gap**: AI voice/photo parsers already return `sugar` and `sodium` in their JSON output (visible in `stt.processor.ts` and `photo.processor.ts`) but there is nowhere to persist them in the food DB or snapshot them in `MealLogItem`.

**What to build**:

1. **Prisma migration** — add to `FoodNutrient`:
   - `sodiumMgPer100g` (DECIMAL 8,2, nullable)
   - `sugarPer100g` (DECIMAL 8,2, nullable)
   - `saturatedFatPer100g` (DECIMAL 8,2, nullable)
   - `cholesterolMgPer100g` (DECIMAL 8,2, nullable)
   - `potassiumMgPer100g` (DECIMAL 8,2, nullable)

2. **Prisma migration** — add snapshot fields to `MealLogItem`:
   - `snapshotSodiumMg` (DECIMAL 8,2, nullable)
   - `snapshotSugar` (DECIMAL 8,2, nullable)
   - `snapshotSaturatedFat` (DECIMAL 8,2, nullable)

3. **Prisma migration** — add aggregate fields to `MealLog`:
   - `totalSodiumMg` (DECIMAL 8,2, nullable)
   - `totalSugar` (DECIMAL 8,2, nullable)
   - `totalSaturatedFat` (DECIMAL 8,2, nullable)

4. **Update `foods.service.ts`** — include new fields in create/update DTOs and nutrient calculation logic.

5. **Update `meal-logs.service.ts`** — snapshot new fields when logging; recalculate aggregates.

6. **Update `dashboard.service.ts`** — include new nutrient totals in daily dashboard response.

7. **Update `voice` and `photo` parsers** — map `sugar` and `sodium` from AI output into the new snapshot fields.

8. **Update `Target` model** — add optional daily targets:
   - `sodiumTargetMg` (INT, nullable, default 2300)
   - `sugarTargetG` (INT, nullable)
   - `fiberTargetG` (INT, nullable, default 25)

9. **Update `targets.service.ts`** — expose new target fields in create/update endpoints.

**Files to change**: `schema.prisma`, `foods.service.ts`, `meal-logs.service.ts`, `meal-logs.dto.ts`, `dashboard.service.ts`, `targets.service.ts`, `targets.dto.ts`, `stt.processor.ts`, `photo.processor.ts`

---

### P1.2 — Switch BMR Formula to Mifflin-St Jeor

**Cal AI**: Uses Mifflin-St Jeor — the modern clinical standard, consistently shown to be more accurate than Harris-Benedict across multiple meta-analyses.

**Coach today**: Uses Harris-Benedict in `target-calculator.ts`.

**Mifflin-St Jeor formulas**:

- Men: `BMR = (10 × weight_kg) + (6.25 × height_cm) − (5 × age_years) + 5`
- Women: `BMR = (10 × weight_kg) + (6.25 × height_cm) − (5 × age_years) − 161`

This is a pure logic change in one function. TDEE multipliers remain the same (sedentary: 1.2 → extra active: 1.9).

**Files to change**: `apps/api/src/targets/target-calculator.ts`, `apps/api/src/targets/target-calculator.spec.ts`

---

### P1.3 — Expose WorkoutLog API (Exercise Logging + Calorie Burn)

**Cal AI**: Exercise logging is a first-class feature. Users log workouts; calories burned are deducted from the daily budget, computing a net calorie figure. Step count from Apple Health also auto-adjusts the budget.

**Coach today**: `WorkoutLog` Prisma model exists (workoutType, durationMin, note, loggedAt) but has **no controller, no service, no endpoints**. The model is orphaned.

**What to build**:

1. **`WorkoutCalorieCalculator`** (new utility) — MET-based burn estimation:
   - MET table for common activities (running: 9.8, walking: 3.5, cycling: 7.5, swimming: 6.0, weight training: 3.5, yoga: 2.5, HIIT: 8.0, etc.)
   - Formula: `calories_burned = MET × weight_kg × duration_hours`
   - Add `caloriesBurned` field to `WorkoutLog` schema (INT, nullable — null if not calculated)

2. **`WorkoutLogsController`** and **`WorkoutLogsService`**:
   - `POST /api/v1/workout-logs` — log workout (workoutType, durationMin, loggedAt, note)
     - Auto-calculates and stores `caloriesBurned`
   - `GET /api/v1/workout-logs` — list logs (date param, defaults to today)
   - `PATCH /api/v1/workout-logs/:id` — update entry
   - `DELETE /api/v1/workout-logs/:id` — delete entry
   - `GET /api/v1/workout-logs/history` — paginated history (days param)

3. **Update `DashboardService`** — add exercise data to daily dashboard response:
   - `caloriesBurned` (sum of WorkoutLog.caloriesBurned for the day)
   - `netCalories` (totalCaloriesConsumed − caloriesBurned)
   - `exerciseLogs` (array of workouts for the day)

4. **Prisma migration** — add `caloriesBurned INT` to `WorkoutLog`.

5. **`WorkoutsModule`** — register the module, add to `AppModule`.

**Files to create**: `workout-logs.controller.ts`, `workout-logs.service.ts`, `workout-logs.dto.ts`, `workout-logs.module.ts`, `workout-calorie-calculator.ts`, `workout-calorie-calculator.spec.ts`

**Files to change**: `schema.prisma`, `dashboard.service.ts`, `app.module.ts`

---

### P1.4 — Net Calorie Dashboard & Step-Based Budget Adjustment

**Cal AI**: Dashboard primary metric is `netCalories = consumed − burned`. On active days, step count increases the calorie budget automatically.

**Coach today**: Dashboard shows consumed vs. target with no exercise offset. No step data.

**What to build**:

1. **Dashboard response** — expose `netCalories` once workout logs are wired (from P1.3):
   - `netCalories`: `totalCaloriesConsumed - caloriesBurned`
   - `caloriesBudget`: `calorieTarget + caloriesBurned` (gross budget = base target + what you burned)
   - `netRemaining`: `caloriesBudget - totalCaloriesConsumed`

2. **Step-based adjustment** (defer to P2.2 when Apple Health integration is available):
   - Accept `stepsToday` as optional query param on `GET /dashboard`
   - Calculate extra calories burned from steps: `stepCalories = steps × 0.04` (standard estimate, weight-adjusted)
   - Add step burn to `caloriesBudget`

3. **Profile model** — add `netCaloriesMode` (boolean, default true) to allow users to toggle between gross and net calorie display.

**Files to change**: `dashboard.service.ts`, `dashboard.dto.ts`

---

## Priority 2 — Food Logging Completeness

_Without these, users hit walls in daily logging and churn._

---

### P2.1 — Custom Food Creation (User-Defined Reusable Foods)

**Cal AI**: Users can create custom named foods (name, serving size, calories, protein, carbs, fat) saved to their personal food library and reusable forever. These are stored in Firebase under the user's UID.

**Coach today**: `quick-add` creates a **one-time non-reusable** meal log entry. The food is anonymous — it has no name in the database and cannot be searched or re-logged. The `Food` schema has `sourceType: user` but the API never creates user foods.

**What to build**:

1. **`POST /api/v1/foods/custom`** — create a user-owned food:
   - Required: `name`, `servingSizeG`, `calories`, `protein`, `carbs`, `fat`
   - Optional: `fiber`, `sodium`, `sugar`, `servingLabel`
   - Sets: `sourceType = 'user'`, `status = 'approved'`, `userId` on the food
   - Creates `FoodNutrient` row (converts to per-100g)
   - Creates `FoodServing` row (the custom serving size)

2. **Add `userId` FK to `Food` model** — to associate user-created foods with their creator; owned foods are only visible to the creator + admins.

3. **`GET /api/v1/foods/mine`** — list user's custom foods (paginated).

4. **`PUT /api/v1/foods/custom/:id`** — update user-created food (owner only).

5. **`DELETE /api/v1/foods/custom/:id`** — delete user-created food (owner only; soft-delete if already logged).

6. **Search integration** — include user's own foods in food search results (scope `userId` filter in Typesense query).

7. **Convert `quick-add` to use custom food flow** — when user quick-adds, create a named custom food in DB (so it appears in recents + favorites and can be re-logged). Deprecate anonymous quick-add.

**Files to change**: `schema.prisma`, `foods.service.ts`, `foods.controller.ts`, `foods.dto.ts`

---

### P2.2 — Saved Meal Templates (Full Meal Re-logging)

**Cal AI**: Frequently eaten meals (e.g., "my usual breakfast") can be saved as a named template containing multiple food items. Logging that meal again is one tap.

**Coach today**: `Favorite` model supports `mealLogId` but there is no API to log from a saved meal, and the favorite is never reconstructed — it links to a historical log.

**What to build**:

1. **New `SavedMeal` model**:

   ```prisma
   model SavedMeal {
     id        String   @id @default(uuid())
     userId    String
     user      User     @relation(fields: [userId], references: [id])
     name      String   @db.VarChar(200)
     items     SavedMealItem[]
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt
   }

   model SavedMealItem {
     id           String    @id @default(uuid())
     savedMealId  String
     savedMeal    SavedMeal @relation(fields: [savedMealId], references: [id], onDelete: Cascade)
     foodId       String
     food         Food      @relation(fields: [foodId], references: [id])
     quantity     Decimal   @db.Decimal(8, 2)
     servingLabel String    @db.VarChar(100)
     gramsPerUnit Decimal   @db.Decimal(8, 2)
   }
   ```

2. **`SavedMealsController`** + **`SavedMealsService`**:
   - `POST /api/v1/saved-meals` — create saved meal from current log or from scratch
   - `GET /api/v1/saved-meals` — list user's saved meals
   - `GET /api/v1/saved-meals/:id` — get saved meal with items + nutrition preview
   - `DELETE /api/v1/saved-meals/:id` — delete saved meal
   - `POST /api/v1/saved-meals/:id/log` — **log this saved meal** (mealType, loggedAt params)
     - Creates a `MealLog` + `MealLogItems` from the saved meal template
     - Snapshots current nutrition at log time (not saved meal creation time)

3. **`POST /api/v1/meal-logs/:id/save`** — convenience endpoint to save an existing log as a meal template (name param).

**Files to create**: `saved-meals.controller.ts`, `saved-meals.service.ts`, `saved-meals.module.ts`, `saved-meals.dto.ts`

---

### P2.3 — Recipe Management

**Cal AI**: Users build multi-ingredient recipes (e.g., "my protein shake: 1 scoop whey + 250ml milk + 1 banana"). The app calculates aggregate nutrition per serving. Recipes are saved as a custom food type and can be logged like any other food.

**Coach today**: No recipe concept exists anywhere in the codebase.

**What to build**:

1. **New Prisma models**:

   ```prisma
   model Recipe {
     id           String         @id @default(uuid())
     userId       String
     user         User           @relation(fields: [userId], references: [id])
     name         String         @db.VarChar(200)
     servings     Int            @default(1)
     ingredients  RecipeIngredient[]
     // Denormalized aggregate per serving (recalculated on save)
     caloriesPerServing    Int
     proteinPerServing     Decimal @db.Decimal(8, 2)
     carbsPerServing       Decimal @db.Decimal(8, 2)
     fatPerServing         Decimal @db.Decimal(8, 2)
     fiberPerServing       Decimal? @db.Decimal(8, 2)
     sodiumMgPerServing    Decimal? @db.Decimal(8, 2)
     sugarPerServing       Decimal? @db.Decimal(8, 2)
     createdAt    DateTime       @default(now())
     updatedAt    DateTime       @updatedAt
   }

   model RecipeIngredient {
     id           String  @id @default(uuid())
     recipeId     String
     recipe       Recipe  @relation(fields: [recipeId], references: [id], onDelete: Cascade)
     foodId       String
     food         Food    @relation(fields: [foodId], references: [id])
     quantity     Decimal @db.Decimal(8, 2)
     servingLabel String  @db.VarChar(100)
     gramsPerUnit Decimal @db.Decimal(8, 2)
   }
   ```

2. **`RecipesController`** + **`RecipesService`**:
   - `POST /api/v1/recipes` — create recipe with ingredients list
   - `GET /api/v1/recipes` — list user's recipes
   - `GET /api/v1/recipes/:id` — get recipe with full ingredient breakdown
   - `PUT /api/v1/recipes/:id` — update recipe (recalculates aggregate nutrition)
   - `DELETE /api/v1/recipes/:id` — delete recipe
   - `POST /api/v1/recipes/:id/log` — log recipe as meal (servingsConsumed, mealType, loggedAt)

3. **Nutrition aggregator** — service function: given ingredients (foodId + quantity + gramsPerUnit), sum all nutrients across ingredients, divide by recipe servings count to get per-serving values.

4. **Include recipes in food search** — search endpoint should return recipes alongside foods so users can log either.

**Files to create**: `recipes.controller.ts`, `recipes.service.ts`, `recipes.module.ts`, `recipes.dto.ts`, `recipe-nutrition-calculator.ts`

---

### P2.4 — Nutrition Label OCR

**Cal AI**: Users can photograph a food packaging nutrition label. The app OCRs the label and extracts serving size, calories, macros, sodium, sugar — pre-filling a custom food entry with verified values (more reliable than AI estimation).

**Coach today**: `POST /photos/upload` sends images to GPT-4o Vision with a food recognition prompt. There is no label-detection mode.

**What to build**:

1. **Add `inputMode` param to `POST /api/v1/photos/upload`**: `'food'` (default, existing) or `'label'`

2. **Label parsing prompt** in `photo.processor.ts` — when `inputMode === 'label'`:
   - System prompt shifts from "identify food and estimate portions" to "extract nutrition facts from this label"
   - Output schema: `{ servingSize, servingSizeUnit, calories, protein, carbs, fat, fiber, sodium, sugar, saturatedFat, cholesterol, totalServings }`
   - Return as `AiParseResult` with `inputType = 'label'`

3. **New response path in draft endpoint** — `GET /photos/drafts/:id` returns label data in a format suitable for pre-filling a custom food creation form.

4. **No separate endpoint needed** — reuse the existing upload + queue + draft pattern.

**Files to change**: `photo.processor.ts`, `photos.service.ts`, `photos.dto.ts`

---

## Priority 3 — Body Composition & Advanced Goals

_The second layer of engagement and retention after daily logging._

---

### P3.1 — BMI Calculation

**Cal AI**: BMI is calculated from height + weight and displayed on the profile/analytics screen. Used as a progress metric alongside weight.

**Coach today**: `Profile` stores `heightCm` and `weightKg` but the API never computes BMI.

**What to build**:

1. **Add computed `bmi` field to `GET /api/v1/profile` response**:
   - Formula: `weight_kg / (height_m)²`
   - Return: `{ bmi: 24.1, bmiCategory: 'normal' }` (underweight <18.5, normal 18.5-24.9, overweight 25-29.9, obese ≥30)

2. **Add `bmi` to `GET /api/v1/weight-logs/trend` response** — calculate BMI for each historical weight entry using stored height.

3. **No new model needed** — pure calculation in service layer.

**Files to change**: `profile.service.ts`, `weight-logs.service.ts`

---

### P3.2 — Body Composition Tracking (US Navy Method)

**Cal AI**: Uses the US Navy circumference method to estimate body fat %. Requires neck, waist, and (for women) hip measurements. Also stores progress photos (front + side views) for visual tracking.

**Coach today**: Weight-only tracking. No circumference measurements, no body fat estimation.

**What to build**:

1. **New `BodyMeasurementLog` model**:

   ```prisma
   model BodyMeasurementLog {
     id         String   @id @default(uuid())
     userId     String
     user       User     @relation(fields: [userId], references: [id])
     loggedAt   DateTime
     neckCm     Decimal? @db.Decimal(5, 1)
     waistCm    Decimal? @db.Decimal(5, 1)
     hipCm      Decimal? @db.Decimal(5, 1)  -- women only
     // Calculated at log time
     bodyFatPct Decimal? @db.Decimal(4, 1)
     leanMassKg Decimal? @db.Decimal(5, 1)
     fatMassKg  Decimal? @db.Decimal(5, 1)
     createdAt  DateTime @default(now())
   }
   ```

2. **`BodyFatCalculator`** — US Navy method:
   - Men: `%BF = 495 / (1.0324 - 0.19077 × log10(waist - neck) + 0.15456 × log10(height)) - 450`
   - Women: `%BF = 495 / (1.29579 - 0.35004 × log10(waist + hip - neck) + 0.22100 × log10(height)) - 450`
   - Returns: `bodyFatPct`, `leanMassKg`, `fatMassKg` (derived from current weight)

3. **`BodyMeasurementsController`** + **`BodyMeasurementsService`**:
   - `POST /api/v1/body-measurements` — log measurements (auto-calculates body fat %)
   - `GET /api/v1/body-measurements` — history (days param)
   - `GET /api/v1/body-measurements/latest` — most recent entry

4. **Update `GET /api/v1/profile`** — include latest body composition data in profile response.

5. **Update `Target`** — add optional `bodyFatTarget` (DECIMAL 4,1) for users who prefer body fat % as their primary goal.

**Files to create**: `body-measurements.controller.ts`, `body-measurements.service.ts`, `body-measurements.module.ts`, `body-fat-calculator.ts`, `body-fat-calculator.spec.ts`

---

### P3.3 — Rollover Calories (Premium Feature)

**Cal AI**: Unused calories from under-eating days carry forward to the next day's budget (configurable via premium settings). Encourages flexible dieting without "wasted" days.

**Coach today**: Each day is independent; no carryover mechanism exists.

**What to build**:

1. **`Profile` model** — add `caloriRolloverEnabled` (boolean, default false).

2. **New `CalorieRolloverLog` model** (tracks rollover state per day):

   ```prisma
   model CalorieRolloverLog {
     id           String   @id @default(uuid())
     userId       String
     user         User     @relation(fields: [userId], references: [id])
     date         DateTime @db.Date
     baseTarget   Int
     consumed     Int
     rolloverIn   Int      @default(0)  -- carried in from yesterday
     rolloverOut  Int      @default(0)  -- deficit/surplus carried to tomorrow
     effectiveTarget Int   -- baseTarget + rolloverIn
     @@unique([userId, date])
   }
   ```

3. **Rollover calculation logic** in `DashboardService`:
   - When fetching today's dashboard: check yesterday's `CalorieRolloverLog`
   - If user under-ate yesterday: `rolloverIn = min(yesterday_deficit, maxRollover)` (cap at 500 kcal)
   - If user over-ate: `rolloverIn = 0` (don't punish over-eating days, or optionally subtract)
   - `effectiveTarget = baseTarget + rolloverIn`

4. **Rollover computation as nightly worker job** (new processor):
   - Run nightly for all users with rollover enabled
   - Computes previous day's final rollover, writes `CalorieRolloverLog`
   - Queue: `calorie-rollover`

5. **Subscription guard** — rollover is a Pro feature only.

**Files to create**: `calorie-rollover.processor.ts`
**Files to change**: `schema.prisma`, `dashboard.service.ts`, `profile.service.ts`, `profile.dto.ts`

---

## Priority 4 — Platform Integrations

_Major retention and accuracy boost, but requires mobile-side work too._

---

### P4.1 — Apple Health / HealthKit Integration

**Cal AI**: Reads and writes Apple HealthKit:

- **Reads**: step count, active calories burned, workout sessions, weight, water intake
- **Writes**: nutrition data (calories, protein, carbs, fat) back to Health app

**Coach today**: No HealthKit integration of any kind.

**Backend requirements** (mobile does the HealthKit calls, backend receives the data):

1. **New endpoint `POST /api/v1/health-sync`** — mobile sends daily HealthKit summary:

   ```typescript
   {
     date: string,           // YYYY-MM-DD
     stepsCount?: number,
     activeCaloriesBurned?: number,
     restingCaloriesBurned?: number,
     workouts?: [{ type, durationMin, caloriesBurned, startTime }],
     weightKg?: number,
     waterMl?: number,
     source: 'apple_health' | 'google_fit'
   }
   ```

2. **`HealthSyncService`** — processes HealthKit batch:
   - Upserts weight log if `weightKg` provided
   - Creates workout logs for each workout (marks as `source = 'apple_health'`, skips duplicates)
   - Creates water log if `waterMl` provided
   - Updates `Profile.stepCount` (new field) for step-based budget adjustment

3. **Step-based calorie adjustment** — add to dashboard calculation:
   - `stepCaloriesBurned = steps × 0.04 × (weightKg / 70)` (weight-normalized)
   - Add to `caloriesBudget` alongside explicit workout logs

4. **New `Profile` fields**:
   - `appleHealthEnabled` (boolean, default false)
   - `googleFitEnabled` (boolean, default false)

5. **Nutrition write-back** (optional) — after meal log is confirmed, emit an event that the mobile app uses to write to HealthKit. No backend changes needed — mobile handles HealthKit writes directly after receiving the API response.

**Files to create**: `health-sync.controller.ts`, `health-sync.service.ts`, `health-sync.module.ts`, `health-sync.dto.ts`

---

### P4.2 — Data Export (CSV)

**Cal AI**: Premium feature — users can export their full food diary as a CSV file. Privacy policy states "export or delete all your data at any time."

**Coach today**: `data-export` BullMQ processor and `PrivacyRequest` model both exist but the processor is a stub (`// TODO`).

**What to build**:

1. **Implement `data-export.processor.ts`**:
   - Input: `userId`, `requestId`
   - Query: all `MealLog` + `MealLogItem` + `WeightLog` + `WorkoutLog` + `WaterLog` for user
   - Generate CSV with columns: date, meal_type, food_name, quantity, serving, calories, protein, carbs, fat, fiber, sodium, sugar, source
   - Upload CSV to S3 with signed URL (7-day expiry)
   - Update `PrivacyRequest.resultUrl` and `status = 'completed'`
   - Notify user via push + Telegram

2. **`GET /api/v1/privacy/export/:requestId/download`** — return signed S3 download URL.

3. **Apple Health export format** — optionally generate an Apple Health XML alongside CSV (future enhancement).

**Files to change**: `data-export.processor.ts`
**Files to create**: `csv-export.service.ts`

---

## Priority 5 — Enhanced Food Database

_Grows food coverage to match Cal AI's reach._

---

### P5.1 — Restaurant Food Database (Mongolian Chains)

**Cal AI**: Post-acquisition access to 380+ restaurant chains via MFP. Pre-acquisition used photo recognition for restaurant meals.

**Coach today**: General food database seeded with Mongolian staple foods. No restaurant-specific entries.

**What to build**:

1. **Seed Mongolian restaurant menus** — add `Food` rows with `sourceType = 'import'` and `sourceRef = 'restaurant:<name>'` for common Mongolian chains:
   - Moby Dick / Moby's (common Mongolian fast food)
   - Lotus (supermarket chain prepared foods)
   - KFC Mongolia, Burger King Mongolia, Pizza Hut Mongolia (known chains in UB)
   - Common coffee shop items (Grand Khaan, etc.)

2. **`FoodSource` strategy** — tag restaurant foods:
   - `sourceType = 'restaurant'`
   - `sourceRef = 'restaurant_name:menu_item_id'`

3. **Search filter** — expose `sourceType=restaurant` filter on `GET /api/v1/foods` so mobile can show a "Restaurant" category in the food search UI.

4. **Admin import endpoint** — `POST /api/v1/admin/foods/import` — bulk import food array (JSON) with auto-nutrient calculation. Allows the team to add restaurant menus via data file without manual entry.

**Files to change**: `foods.service.ts`, `foods.controller.ts`, `foods.dto.ts`
**Files to create**: `apps/api/prisma/seeds/restaurants.ts`

---

### P5.2 — International Food Database Integration (FatSecret or USDA)

**Cal AI**: FatSecret API (2.3M+ foods, confirmed Premier Partner). Provides global food coverage, barcode data, allergen data, recipe data.

**Coach today**: Seeded Mongolian food database only. No external API integration for food lookup.

**What to build**:

1. **FatSecret API client** (or USDA FoodData Central as free alternative):
   - Food search by name + locale
   - Food detail by ID (full nutrient panel)
   - Barcode lookup
   - NLP food description matching

2. **`FoodSearchService`** — federated search:
   - First query local Typesense index (Coach + custom + restaurant foods)
   - If <5 local results: fan out to FatSecret/USDA API
   - Map external results to Coach food schema format (per 100g normalization)
   - Cache external results in local DB with `sourceType = 'import'`, `sourceRef = 'fatsecret:<id>'` or `'usda:<fdcId>'`

3. **Cache TTL strategy** — external food records cached indefinitely (nutrition doesn't change); barcode records cached 90 days.

4. **`GET /api/v1/barcodes/:code`** — update to fall back to FatSecret barcode API when not found locally.

**Environment variables to add**:

- `FATSECRET_CLIENT_ID`
- `FATSECRET_CLIENT_SECRET`
- or `USDA_API_KEY` (free, no contract required)

**Files to create**: `fatsecret-client.service.ts` (or `usda-client.service.ts`), `federated-food-search.service.ts`

---

## Priority 6 — AI & Recognition Enhancements

_Closes the accuracy gap with Cal AI's vision pipeline._

---

### P6.1 — LiDAR-Assisted Portion Estimation (iOS Pro)

**Cal AI**: On LiDAR-equipped iPhones (iPhone 12 Pro+), depth sensor data is sent alongside the photo. The AI uses actual 3D volume data for portion estimation — significantly more accurate than purely visual estimation.

**Coach today**: Photos sent as flat base64 images. No depth data path exists.

**What to build**:

1. **Update `POST /api/v1/photos/upload`** — accept optional `depthData` field:

   ```typescript
   {
     photo: base64,
     depthData?: {    // sent by mobile only on LiDAR devices
       width: number,
       height: number,
       depthValues: number[]  // float32 array, one value per pixel, in meters
     },
     inputMode?: 'food' | 'label'
   }
   ```

2. **Update `photo.processor.ts`** — if `depthData` is present:
   - Calculate volume from depth map (integrate depth values over food region)
   - Convert volume to estimated grams using food density lookup table
   - Override AI portion estimate with depth-derived weight estimate
   - Flag result as `'lidar_assisted'` in `AiParseResult.modelVersion`

3. **Density lookup table** — in-code table mapping food categories to densities (g/cm³):
   - Cooked pasta: 1.1
   - Rice: 0.9
   - Meat: 1.05
   - Salad greens: 0.3
   - Soup/liquid: 1.0
   - Bread: 0.3
   - etc.

**Files to change**: `photo.processor.ts`, `photos.dto.ts`, `photos.service.ts`

---

### P6.2 — RAG-Augmented Food Recognition

**Cal AI**: Uses Retrieval-Augmented Generation — when AI identifies a food, it cross-references against a known food database to refine uncertain identifications and reduce hallucination.

**Coach today**: Pure prompt-to-LLM with static system prompt. No retrieval augmentation.

**What to build**:

1. **During photo/voice parsing** — after initial AI identification, retrieve top-5 matching foods from local DB/Typesense by name similarity.

2. **Inject retrieved food records** into the second-pass AI prompt:

   ```
   "I've identified this as possibly 'buuz'. Here are the verified nutritional values for similar foods:
   - Буз (steamed dumpling, beef): 210 kcal, 12g protein, 18g carbs, 9g fat per 100g
   - Буз (steamed dumpling, mutton): 225 kcal, 13g protein, 18g carbs, 11g fat per 100g
   Use these as reference anchors. Confirm or refine your estimate."
   ```

3. **`RagFoodMatchingService`** — takes AI initial identification → Typesense search → returns top candidates → formats for prompt injection.

4. **Measure accuracy improvement** — log `preRagCalories` and `postRagCalories` in `AiParseResult.metadata` to track improvement.

**Files to change**: `photo.processor.ts`, `stt.processor.ts`
**Files to create**: `rag-food-matching.service.ts`

---

## Priority 7 — Social & Advanced Features

_Growth and retention layer. Implement last._

---

### P7.1 — AI Meal Planning

**Cal AI**: Premium AI generates personalized weekly meal plans based on calorie goals, macro targets, dietary preferences, and eating history. Outputs: weekly plan, recipes with instructions, shopping list, daily nutrition breakdown.

**Coach today**: AI coach chat exists (Pro), but no meal planning endpoint.

**What to build**:

1. **`POST /api/v1/meal-plans/generate`** (Pro-gated):
   - Input: `weekStartDate`, optional preferences override
   - Worker job: `MEAL_PLAN_GENERATION`
   - GPT-4o prompt includes: current Target, dietPreference, last 30 days of MealLogs (most-eaten foods), any dietary restrictions from profile

2. **`MealPlan` model**:

   ```prisma
   model MealPlan {
     id          String   @id @default(uuid())
     userId      String
     weekStart   DateTime @db.Date
     days        Json     // Array of day plans
     shoppingList Json    // Aggregated ingredients
     status      String   @default("generating")
     createdAt   DateTime @default(now())
   }
   ```

3. **`GET /api/v1/meal-plans`** — list generated plans.
4. **`GET /api/v1/meal-plans/:id`** — get plan with full day breakdown.
5. **`POST /api/v1/meal-plans/:id/log-day`** — log all meals from a plan day in one action.

**Files to create**: `meal-plans.controller.ts`, `meal-plans.service.ts`, `meal-plan-generation.processor.ts`

---

### P7.2 — Social Groups & Friends

**Cal AI**: Public groups feature — users join groups, see each other's meal logs, mutual accountability, group chat. The breach confirmed 22K lines of group chat data.

**Coach today**: Entirely solo app. No social infrastructure.

**What to build**:

1. **`Group` and `GroupMember` models** — group with members, privacy setting (public/private/invite-only).

2. **`GroupMealFeed`** — shared view of members' meal logs (respects privacy settings).

3. **Group chat** — real-time via WebSocket (NestJS Gateway) or simple message polling.

4. **Friend connections** — `UserFriendship` model (pending/accepted/blocked states).

5. **Privacy controls** — `Profile.shareToGroups` toggle; meal logs marked `isPrivate` are excluded from group feed.

**Note**: This is the largest single feature — scope it as a separate project milestone.

---

## Summary Table (Prioritized)

| #    | Feature                                    | Effort | Impact | Status        |
| ---- | ------------------------------------------ | ------ | ------ | ------------- |
| P1.1 | Expand nutrients (sodium, sugar, sat. fat) | M      | High   | Missing       |
| P1.2 | Mifflin-St Jeor BMR formula                | XS     | Medium | Wrong formula |
| P1.3 | WorkoutLog API + calorie burn              | M      | High   | Schema only   |
| P1.4 | Net calorie dashboard                      | S      | High   | Missing       |
| P2.1 | Custom user foods                          | M      | High   | Schema only   |
| P2.2 | Saved meal templates                       | M      | High   | Missing       |
| P2.3 | Recipe management                          | L      | Medium | Missing       |
| P2.4 | Nutrition label OCR                        | S      | Medium | Missing       |
| P3.1 | BMI calculation                            | XS     | Low    | Missing       |
| P3.2 | Body composition (US Navy)                 | M      | Medium | Missing       |
| P3.3 | Rollover calories                          | M      | Medium | Missing       |
| P4.1 | Apple Health / Google Fit sync             | L      | High   | Missing       |
| P4.2 | Data export CSV                            | S      | Medium | Stub only     |
| P5.1 | Mongolian restaurant DB                    | M      | Medium | Missing       |
| P5.2 | FatSecret/USDA integration                 | L      | High   | Missing       |
| P6.1 | LiDAR-assisted portions                    | M      | Medium | Missing       |
| P6.2 | RAG-augmented recognition                  | M      | Medium | Missing       |
| P7.1 | AI meal planning                           | L      | Medium | Missing       |
| P7.2 | Social groups                              | XL     | Low    | Missing       |

**Effort**: XS = hours, S = 1 day, M = 2–4 days, L = 1 week, XL = 2+ weeks

---

## What Coach Does Better Than Cal AI

For reference — areas where Coach's backend is architecturally superior:

| Feature                     | Coach                                         | Cal AI                                      |
| --------------------------- | --------------------------------------------- | ------------------------------------------- |
| Database                    | PostgreSQL + Prisma (relational, typed, safe) | Firebase NoSQL (flexible but breach-prone)  |
| Auth                        | Firebase Auth + JWT (industry standard)       | Firebase + 4-digit PIN (criticized as weak) |
| Multi-channel notifications | Push + Telegram + Email infrastructure        | Push only (at launch)                       |
| AI coach memory             | Persistent CoachMemory model per category     | No persistent coach memory                  |
| Meal timing insights        | Dedicated BullMQ processor                    | Not documented                              |
| Adaptive target             | Automatic target adjustment processor         | Not documented                              |
| Webhook idempotency         | IdempotencyKey model (safe replay)            | Not documented                              |
| Audit logging               | Full AuditLog model                           | Not documented                              |
| Localization                | Mongolian-first, multi-locale food model      | English-first                               |
| Moderation queue            | Admin moderation workflow built-in            | Not documented                              |
| Privacy / GDPR              | Consent model, export/deletion flows          | Retroactive (breach was unauthenticated)    |
