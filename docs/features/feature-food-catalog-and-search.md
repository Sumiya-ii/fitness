# Food Catalog & Search

Last updated: 2026-03-06

## Scope
- CRUD for foods and serving/nutrient records.
- Search-backed food selection for logging flows.

## User flow
1. User searches food by text from logging flows.
2. API returns food with servings and nutrient basis.
3. Food may include localization and barcode linkage.

## API surface
- `POST /foods`
- `GET /foods`
- `GET /foods/:id`
- `PUT /foods/:id`
- `DELETE /foods/:id`

## Data model
- `Food`, `FoodServing`, `FoodNutrient`, `FoodAlias`, `FoodLocalization`, `FoodSource`, `Barcode`

## Current logic/rules
- Nutrition is stored normalized per 100g.
- Serving definitions provide unit-to-gram conversion.
- Search module and indexer support query workflows.

## Current gaps / next improvements
- Access control for food CRUD should remain admin-only in production routing/policy.
