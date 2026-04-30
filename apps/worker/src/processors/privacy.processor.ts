import { Job } from 'bullmq';
import { Pool } from 'pg';
import { Telegraf } from 'telegraf';
import * as Sentry from '@sentry/node';
import pino from 'pino';
import { logger } from '../logger';
import { uploadToS3, getPresignedUrl, deleteFromS3 } from '../s3';
import { sendExpoPush } from '../expo-push';
import { logMessage } from '../message-log.service';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PrivacyJobData {
  requestId: string;
  userId: string;
  requestType: 'export' | 'deletion';
}

// ── Export: data collection ───────────────────────────────────────────────────

async function collectUserData(pool: Pool, userId: string): Promise<Record<string, unknown>> {
  const [
    profile,
    targets,
    mealLogs,
    mealLogItems,
    weightLogs,
    waterLogs,
    favorites,
    mealTemplates,
    mealTemplateItems,
    voiceDrafts,
    notificationPrefs,
    subscription,
    subscriptionLedger,
    analyticsEvents,
    outboundMessages,
    consents,
    coachMemories,
    deviceTokens,
  ] = await Promise.all([
    pool.query(`SELECT * FROM profiles WHERE user_id = $1`, [userId]),
    pool.query(`SELECT * FROM targets WHERE user_id = $1 ORDER BY effective_from DESC`, [userId]),
    pool.query(
      `SELECT id, meal_type, source, logged_at, note,
              total_calories, total_protein, total_carbs, total_fat,
              total_fiber, total_sugar, total_sodium, total_saturated_fat,
              created_at, updated_at
       FROM meal_logs WHERE user_id = $1 ORDER BY logged_at DESC`,
      [userId],
    ),
    pool.query(
      `SELECT mli.id, mli.meal_log_id, mli.food_id,
              mli.quantity, mli.serving_label, mli.grams_per_unit,
              mli.snapshot_calories, mli.snapshot_protein, mli.snapshot_carbs, mli.snapshot_fat,
              mli.snapshot_fiber, mli.snapshot_sugar, mli.snapshot_sodium, mli.snapshot_saturated_fat,
              mli.snapshot_food_name, mli.created_at
       FROM meal_log_items mli
       JOIN meal_logs ml ON ml.id = mli.meal_log_id
       WHERE mli.user_id = $1
       ORDER BY mli.created_at DESC`,
      [userId],
    ),
    pool.query(
      `SELECT id, weight_kg, logged_at, created_at FROM weight_logs WHERE user_id = $1 ORDER BY logged_at DESC`,
      [userId],
    ),
    pool.query(
      `SELECT id, amount_ml, logged_at, created_at FROM water_logs WHERE user_id = $1 ORDER BY logged_at DESC`,
      [userId],
    ),
    pool.query(
      `SELECT f.id AS food_id, f.normalized_name, fav.created_at
       FROM favorites fav
       JOIN foods f ON f.id = fav.food_id
       WHERE fav.user_id = $1
       ORDER BY fav.created_at DESC`,
      [userId],
    ),
    pool.query(
      `SELECT id, name, meal_type, usage_count, last_used_at, created_at
       FROM meal_templates WHERE user_id = $1 ORDER BY usage_count DESC`,
      [userId],
    ),
    pool.query(
      `SELECT mti.id, mti.template_id, mti.food_id, mti.quantity, mti.sort_order,
              f.normalized_name AS food_name
       FROM meal_template_items mti
       JOIN meal_templates mt ON mt.id = mti.template_id
       JOIN foods f ON f.id = mti.food_id
       WHERE mt.user_id = $1`,
      [userId],
    ),
    pool.query(
      `SELECT id, status, locale, meal_type, created_at, expires_at
       FROM voice_drafts WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    ),
    pool.query(
      `SELECT morning_reminder, evening_reminder, reminder_timezone,
              quiet_hours_start, quiet_hours_end, channels, created_at, updated_at
       FROM notification_preferences WHERE user_id = $1`,
      [userId],
    ),
    pool.query(
      `SELECT tier, status, provider, current_period_start, current_period_end, created_at, updated_at
       FROM subscriptions WHERE user_id = $1`,
      [userId],
    ),
    pool.query(
      `SELECT sl.event, sl.provider, sl.created_at
       FROM subscription_ledger sl
       JOIN subscriptions s ON s.id = sl.subscription_id
       WHERE s.user_id = $1
       ORDER BY sl.created_at DESC`,
      [userId],
    ),
    pool.query(
      `SELECT event, properties, session_id, platform, created_at
       FROM analytics_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1000`,
      [userId],
    ),
    pool.query(
      `SELECT channel, message_type, content, status, sent_at
       FROM outbound_messages WHERE user_id = $1 ORDER BY sent_at DESC LIMIT 500`,
      [userId],
    ),
    pool.query(
      `SELECT consent_type, version, accepted, created_at
       FROM consents WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    ),
    pool.query(
      `SELECT category, summary, updated_at
       FROM coach_memories WHERE user_id = $1`,
      [userId],
    ),
    pool.query(`SELECT platform, active, created_at FROM device_tokens WHERE user_id = $1`, [
      userId,
    ]),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    profile: profile.rows[0] ?? null,
    targets: targets.rows,
    mealLogs: mealLogs.rows,
    mealLogItems: mealLogItems.rows,
    weightLogs: weightLogs.rows,
    waterLogs: waterLogs.rows,
    favorites: favorites.rows,
    mealTemplates: mealTemplates.rows,
    mealTemplateItems: mealTemplateItems.rows,
    voiceDrafts: voiceDrafts.rows,
    notificationPreferences: notificationPrefs.rows[0] ?? null,
    subscription: subscription.rows[0] ?? null,
    subscriptionLedger: subscriptionLedger.rows,
    analyticsEvents: analyticsEvents.rows,
    outboundMessages: outboundMessages.rows,
    consents: consents.rows,
    coachMemories: coachMemories.rows,
    deviceTokens: deviceTokens.rows,
  };
}

// ── Export delivery ───────────────────────────────────────────────────────────

interface UserDeliveryInfo {
  pushTokens: string[];
  chatId: string | null;
  locale: string;
}

async function getUserDeliveryInfo(pool: Pool, userId: string): Promise<UserDeliveryInfo> {
  const [tokensResult, telegramResult, profileResult] = await Promise.all([
    pool.query<{ token: string }>(
      `SELECT token FROM device_tokens WHERE user_id = $1 AND active = true`,
      [userId],
    ),
    pool.query<{ chat_id: string }>(
      `SELECT chat_id FROM telegram_links WHERE user_id = $1 LIMIT 1`,
      [userId],
    ),
    pool.query<{ locale: string }>(`SELECT locale FROM profiles WHERE user_id = $1 LIMIT 1`, [
      userId,
    ]),
  ]);

  return {
    pushTokens: tokensResult.rows.map((r) => r.token),
    chatId: telegramResult.rows[0]?.chat_id ?? null,
    locale: profileResult.rows[0]?.locale ?? 'mn',
  };
}

async function deliverExportUrl(
  pool: Pool,
  userId: string,
  presignedUrl: string,
  jobId: string | undefined,
  jobLogger: pino.Logger,
): Promise<void> {
  const { pushTokens, chatId, locale } = await getUserDeliveryInfo(pool, userId);

  const isMn = locale !== 'en';

  const pushTitle = isMn ? 'Өгөгдөл экспортлогдлоо ✅' : 'Data Export Ready ✅';
  const pushBody = isMn
    ? 'Таны өгөгдөл бэлэн боллоо. 7 хоногийн дотор татаж авна уу.'
    : 'Your data export is ready. The link expires in 7 days.';
  const telegramText = isMn
    ? `✅ <b>Өгөгдөл экспортлогдлоо</b>\n\nТаны хувийн өгөгдлийг татаж авах холбоос:\n<a href="${presignedUrl}">Татаж авах</a>\n\n⚠️ Холбоос 7 хоногийн дараа хүчингүй болно.`
    : `✅ <b>Your data export is ready</b>\n\nDownload your personal data:\n<a href="${presignedUrl}">Download</a>\n\n⚠️ This link expires in 7 days.`;

  const deliveries: Promise<void>[] = [];

  if (chatId) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (botToken) {
      deliveries.push(
        (async () => {
          const start = Date.now();
          try {
            const bot = new Telegraf(botToken);
            await bot.telegram.sendMessage(chatId, telegramText, { parse_mode: 'HTML' });
            jobLogger.info({ chatId }, 'Export URL delivered via Telegram');
            await logMessage({
              userId,
              channel: 'telegram',
              messageType: 'data_export',
              content: telegramText,
              status: 'sent',
              deliveryMs: Date.now() - start,
              jobId,
            });
          } catch (err) {
            jobLogger.error(
              { chatId, error: err instanceof Error ? err.message : String(err) },
              'Telegram export delivery failed',
            );
            await logMessage({
              userId,
              channel: 'telegram',
              messageType: 'data_export',
              content: telegramText,
              status: 'failed',
              deliveryMs: Date.now() - start,
              errorMessage: err instanceof Error ? err.message : String(err),
              jobId,
            });
          }
        })(),
      );
    } else {
      jobLogger.warn('TELEGRAM_BOT_TOKEN not set, skipping Telegram export delivery');
    }
  }

  if (pushTokens.length > 0) {
    deliveries.push(
      (async () => {
        const start = Date.now();
        try {
          await sendExpoPush(pushTokens, pushTitle, pushBody, {
            type: 'data_export',
            url: presignedUrl,
          });
          jobLogger.info({ tokenCount: pushTokens.length }, 'Export URL delivered via push');
          await logMessage({
            userId,
            channel: 'push',
            messageType: 'data_export',
            content: pushBody,
            status: 'sent',
            deliveryMs: Date.now() - start,
            jobId,
          });
        } catch (err) {
          jobLogger.error(
            { error: err instanceof Error ? err.message : String(err) },
            'Push export delivery failed',
          );
          await logMessage({
            userId,
            channel: 'push',
            messageType: 'data_export',
            content: pushBody,
            status: 'failed',
            deliveryMs: Date.now() - start,
            errorMessage: err instanceof Error ? err.message : String(err),
            jobId,
          });
        }
      })(),
    );
  }

  if (deliveries.length === 0) {
    jobLogger.info('No delivery channels available for export notification');
    return;
  }

  await Promise.allSettled(deliveries);
}

// ── Export processor ──────────────────────────────────────────────────────────

async function processExport(
  pool: Pool,
  requestId: string,
  userId: string,
  jobId: string | undefined,
): Promise<void> {
  const jobLogger = logger.child({ processor: 'privacy_export', requestId, userId });

  // Idempotency guard — skip if already completed (e.g. on a BullMQ retry after delivery failure)
  const existing = await pool.query<{ status: string }>(
    `SELECT status FROM privacy_requests WHERE id = $1 AND user_id = $2`,
    [requestId, userId],
  );
  if (existing.rows[0]?.status === 'completed') {
    jobLogger.info('Export already completed — skipping duplicate run');
    return;
  }

  // Mark as processing
  await pool.query(
    `UPDATE privacy_requests SET status = 'processing', updated_at = NOW() WHERE id = $1`,
    [requestId],
  );

  jobLogger.info('Collecting user data for export');
  const data = await collectUserData(pool, userId);

  const json = JSON.stringify(data, null, 2);
  const buffer = Buffer.from(json, 'utf8');

  const s3Key = `exports/${userId}/${requestId}.json`;

  if (!process.env.S3_BUCKET) {
    // No S3 configured — complete with a placeholder note
    jobLogger.warn('S3_BUCKET not set, completing export without file URL');
    await pool.query(
      `UPDATE privacy_requests
       SET status = 'completed', completed_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [requestId],
    );
    return;
  }

  jobLogger.info({ s3Key }, 'Uploading export to S3');
  await uploadToS3(s3Key, buffer, 'application/json');

  // Pre-signed URL valid for 7 days
  const SEVEN_DAYS = 7 * 24 * 60 * 60;
  const presignedUrl = await getPresignedUrl(s3Key, SEVEN_DAYS);

  await pool.query(
    `UPDATE privacy_requests
     SET status = 'completed', completed_at = NOW(), result_url = $2, updated_at = NOW()
     WHERE id = $1`,
    [requestId, presignedUrl],
  );

  jobLogger.info('Data export completed, delivering URL to user');
  await deliverExportUrl(pool, userId, presignedUrl, jobId, jobLogger);
}

// ── Deletion processor ────────────────────────────────────────────────────────

async function processDeletion(pool: Pool, requestId: string, userId: string): Promise<void> {
  const jobLogger = logger.child({ processor: 'privacy_deletion', requestId, userId });

  // Verify request is still pending (user cannot cancel after this point)
  const check = await pool.query(
    `SELECT status FROM privacy_requests WHERE id = $1 AND user_id = $2`,
    [requestId, userId],
  );

  if (!check.rows[0] || check.rows[0].status !== 'pending') {
    jobLogger.warn(
      { status: check.rows[0]?.status },
      'Deletion request is no longer pending — skipping',
    );
    return;
  }

  // Mark as processing before touching any data
  await pool.query(
    `UPDATE privacy_requests SET status = 'processing', updated_at = NOW() WHERE id = $1`,
    [requestId],
  );

  jobLogger.info('Beginning account deletion in transaction');

  // Collect S3 voice file keys before deletion
  const voiceKeys = await pool.query<{ s3_key: string }>(
    `SELECT s3_key FROM voice_drafts WHERE user_id = $1 AND s3_key IS NOT NULL`,
    [userId],
  );

  // Atomically delete all user data respecting FK order
  await pool.query('BEGIN');
  try {
    // Leaf tables (no children pointing at them within the user scope)
    await pool.query(`DELETE FROM meal_log_items WHERE user_id = $1`, [userId]);
    await pool.query(
      `DELETE FROM meal_template_items
       WHERE template_id IN (SELECT id FROM meal_templates WHERE user_id = $1)`,
      [userId],
    );
    await pool.query(`DELETE FROM favorites WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM water_logs WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM weight_logs WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM analytics_events WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM consents WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM outbound_messages WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM device_tokens WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM coach_memories WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM voice_drafts WHERE user_id = $1`, [userId]);
    await pool.query(
      `DELETE FROM subscription_ledger
       WHERE subscription_id IN (SELECT id FROM subscriptions WHERE user_id = $1)`,
      [userId],
    );

    // Parent tables (children now gone)
    await pool.query(`DELETE FROM meal_logs WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM meal_templates WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM telegram_links WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM notification_preferences WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM subscriptions WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM targets WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM profiles WHERE user_id = $1`, [userId]);

    // Mark the PrivacyRequest completed BEFORE deleting the user row — the CASCADE
    // on User → PrivacyRequest would wipe it otherwise, destroying the audit trail.
    await pool.query(
      `UPDATE privacy_requests
       SET status = 'completed', completed_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [requestId],
    );

    // Delete the user record — cascade handles any remaining FK references
    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);

    await pool.query('COMMIT');
  } catch (err) {
    await pool.query('ROLLBACK');
    throw err;
  }

  jobLogger.info('Database rows deleted — cleaning up S3 artifacts');

  // Best-effort S3 cleanup (voice files + export files)
  const s3Cleanups: Promise<void>[] = [
    // Delete the export file if one was previously generated for this user
    deleteFromS3(`exports/${userId}/${requestId}.json`),
    // Delete all voice files
    ...voiceKeys.rows.map((row) => deleteFromS3(row.s3_key)),
  ];
  await Promise.allSettled(s3Cleanups);

  jobLogger.info('Account deletion completed');
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

export async function processPrivacyJob(job: Job<PrivacyJobData>): Promise<void> {
  const { requestId, userId, requestType } = job.data;

  if (!requestId || !userId || !requestType) {
    logger.warn(
      { jobId: job.id, data: job.data },
      '[Privacy] Job data missing required fields — skipping',
    );
    return;
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    logger.warn('[Privacy] DATABASE_URL not set — skipping');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });

  try {
    if (requestType === 'export') {
      await processExport(pool, requestId, userId, job.id ? String(job.id) : undefined);
    } else if (requestType === 'deletion') {
      await processDeletion(pool, requestId, userId);
    } else {
      logger.warn({ requestType }, '[Privacy] Unknown requestType — skipping');
    }
  } catch (err) {
    logger.error(
      {
        jobId: job.id,
        requestId,
        userId,
        requestType,
        attempt: job.attemptsMade,
        error: err instanceof Error ? err.message : String(err),
      },
      '[Privacy] Job failed',
    );

    // Mark request as failed in DB so the user sees the status
    try {
      await pool.query(
        `UPDATE privacy_requests
         SET status = 'failed', completed_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [requestId],
      );
    } catch (updateErr) {
      logger.error(
        { requestId, error: String(updateErr) },
        '[Privacy] Could not update request to failed status',
      );
    }

    const isFinalAttempt =
      job.opts?.attempts !== undefined && job.attemptsMade >= job.opts.attempts;

    if (isFinalAttempt) {
      Sentry.captureException(err, {
        tags: { processor: 'privacy', requestType },
        extra: { requestId, userId },
      });
    }

    throw err;
  } finally {
    await pool.end();
  }
}
