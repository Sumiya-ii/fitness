import { Pool } from 'pg';
import * as Sentry from '@sentry/node';
import { logger } from './logger';

export interface LogParams {
  userId: string;
  channel: 'telegram' | 'push';
  messageType: string;
  content: string;
  status: 'sent' | 'failed';
  errorMessage?: string;
  // AI generation metadata (null for static messages)
  aiModel?: string;
  promptTokens?: number;
  completionTokens?: number;
  generationMs?: number;
  // Delivery timing
  deliveryMs?: number;
  // BullMQ job tracing
  jobId?: string | number;
  // Extra context
  metadata?: Record<string, unknown>;
}

let _pool: Pool | null = null;

function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return _pool;
}

/**
 * Log an outbound message to the database.
 * Never throws — logging must not break message delivery.
 */
export async function logMessage(params: LogParams): Promise<void> {
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO outbound_messages
         (id, user_id, channel, message_type, content, status, error_message,
          ai_model, prompt_tokens, completion_tokens, generation_ms, delivery_ms,
          job_id, metadata, sent_at, updated_at)
       VALUES
         (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now(), now())`,
      [
        params.userId,
        params.channel,
        params.messageType,
        params.content,
        params.status,
        params.errorMessage ?? null,
        params.aiModel ?? null,
        params.promptTokens ?? null,
        params.completionTokens ?? null,
        params.generationMs ?? null,
        params.deliveryMs ?? null,
        params.jobId !== undefined ? String(params.jobId) : null,
        params.metadata !== undefined ? JSON.stringify(params.metadata) : null,
      ],
    );
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        userId: params.userId,
        channel: params.channel,
        messageType: params.messageType,
      },
      '[MessageLog] Failed to persist log',
    );
    Sentry.captureException(err, {
      tags: { service: 'message_log' },
      extra: { userId: params.userId, channel: params.channel, messageType: params.messageType },
    });
  }
}
