# Nutrition Logging

Coach supports meal logging through food search, quick add, AI photo logging, and Telegram text/voice logging. In-app voice logging is not part of v1.

Barcode lookup and barcode submission are not part of the product. The backend does not expose barcode endpoints, the database does not keep a barcode table, and the mobile app does not request barcode scanner support.

Photo logging is Pro-gated at every visible entry point. Offline meal writes are queued with idempotency keys and replayed when connectivity returns; permanent replay failures are retained in a failed queue and surfaced in the sync banner.

The dashboard shows calorie, macro, water, step, streak, and meal history data only. It does not include workout-adjusted net calories in v1. Step tracking is currently based on phone motion data, not Apple Health.
