# Subscription & QPay

Last updated: 2026-03-06

## Scope
- Entitlement status.
- QPay invoice creation, callback/status verification, and activation.

## User flow
1. User opens paywall and chooses plan.
2. Mobile requests `POST /qpay/invoice`, displays QR/deep links.
3. Mobile polls invoice status.
4. On verified payment, backend upgrades subscription to `pro`.

## API surface
- `GET /subscriptions/status`
- `POST /subscriptions/webhook` (public, store-provider flow)
- `POST /qpay/invoice`
- `GET /qpay/callback` (public)
- `GET /qpay/invoice/:invoiceId/status`

## Data model
- `Subscription`, `SubscriptionLedger`
- `QPayInvoice`
- `IdempotencyKey` for webhook dedupe

## Current logic/rules
- QPay callback token check supported (`QPAY_CALLBACK_TOKEN`).
- Payment validation requires exact amount and `MNT` currency match.
- Invoice TTL expiration supported; stale pending invoices become `expired`.
- Finalization is idempotent via transactional pending->paid transition.

## Current gaps / next improvements
- Native store subscription verification remains needed for full Apple/Google production parity.
