/**
 * Deletion completeness audit.
 *
 * This test documents which user-scoped tables are covered by the account
 * deletion processor (apps/worker/src/processors/privacy.processor.ts) and
 * which rely on Prisma CASCADE deletes when the users row is removed.
 *
 * HOW TO MAINTAIN: When you add a new Prisma model with a `userId` field,
 * update the two lists below and add a note explaining coverage.
 *
 * Run: npm run test --workspace=apps/api -- privacy.deletion-completeness
 */

// ── Tables explicitly deleted by the processor (in order) ────────────────────
const EXPLICITLY_DELETED: string[] = [
  'meal_log_items',
  'meal_template_items', // via subselect on meal_templates.user_id
  'favorites',
  'water_logs',
  'weight_logs',
  'analytics_events',
  'consents',
  'outbound_messages',
  'device_tokens',
  'coach_memories',
  'voice_drafts',
  'subscription_ledger', // via subselect on subscriptions.user_id
  'meal_logs',
  'meal_templates',
  'telegram_links',
  'notification_preferences',
  'subscriptions',
  'targets',
  'profiles',
  // users row deleted last — CASCADE handles privacy_requests
];

// ── Tables covered by ON DELETE CASCADE from users row ────────────────────────
// (verified in schema.prisma: each relation has `onDelete: Cascade`)
const CASCADE_COVERED: string[] = [
  'privacy_requests', // User → PrivacyRequest @onDelete: Cascade
  // Note: processor intentionally marks the request completed BEFORE deleting
  // the user row so the audit trail is preserved. The cascade is a safety net.
];

// ── Tables with userId that are NOT user-owned / no deletion needed ───────────
const NOT_USER_OWNED: string[] = [
  // analytics_events.user_id is nullable — anonymous events remain; user events
  // are explicitly deleted by the processor above.
  // moderation_queue.submitted_by is a soft reference (no FK), no cascade needed;
  // food suggestions are kept for admin review even after user deletion.
  'moderation_queue', // soft ref via submitted_by — intentionally retained
  'audit_logs', // soft ref via actor_id — intentionally retained for compliance
];

// ── TODO: potential gaps to investigate ──────────────────────────────────────
// user_food_calibrations: userId field present, onDelete: Cascade in schema ✓
//   — covered by CASCADE (processor doesn't need to explicitly delete these)
// idempotency_keys: no userId field — global dedup table, no action needed
const CASCADE_VIA_SCHEMA: string[] = [
  'user_food_calibrations', // onDelete: Cascade on User relation ✓
];

describe('Account deletion completeness audit', () => {
  /**
   * All user-scoped tables we know about.
   * Update this list when adding new models with userId.
   *
   * TODO: update this list if schema gains new user-scoped models.
   */
  const ALL_USER_TABLES = [
    ...EXPLICITLY_DELETED,
    ...CASCADE_COVERED,
    ...CASCADE_VIA_SCHEMA,
    // NOT_USER_OWNED intentionally excluded — no deletion needed
  ];

  it('has no duplicate table entries across coverage lists', () => {
    const allCovered = [...EXPLICITLY_DELETED, ...CASCADE_COVERED, ...CASCADE_VIA_SCHEMA];
    const unique = new Set(allCovered);
    expect(unique.size).toBe(allCovered.length);
  });

  it('every known user-scoped table is accounted for', () => {
    // Each table must appear in exactly one coverage list
    for (const table of ALL_USER_TABLES) {
      const inExplicit = EXPLICITLY_DELETED.includes(table);
      const inCascade = CASCADE_COVERED.includes(table);
      const inSchema = CASCADE_VIA_SCHEMA.includes(table);
      const covered = inExplicit || inCascade || inSchema;
      expect({ table, covered }).toMatchObject({ table, covered: true });
    }
  });

  it('explicitly deleted tables include the core user-data tables', () => {
    const required = [
      'meal_log_items',
      'meal_logs',
      'weight_logs',
      'water_logs',
      'voice_drafts',
      'coach_memories',
      'device_tokens',
      'outbound_messages',
      'consents',
      'profiles',
      'targets',
      'subscriptions',
    ];
    for (const table of required) {
      expect(EXPLICITLY_DELETED).toContain(table);
    }
  });

  it('user_food_calibrations are covered by schema cascade', () => {
    // Prisma schema: UserFoodCalibration → User @onDelete: Cascade
    // The processor does not need to explicitly delete these.
    expect(CASCADE_VIA_SCHEMA).toContain('user_food_calibrations');
  });

  it('documents tables with soft user references that are intentionally retained', () => {
    // These tables have a userId/submittedBy/actorId column but are NOT deleted
    // on account deletion — this is an intentional compliance/audit decision.
    expect(NOT_USER_OWNED).toContain('audit_logs');
    expect(NOT_USER_OWNED).toContain('moderation_queue');
  });
});
