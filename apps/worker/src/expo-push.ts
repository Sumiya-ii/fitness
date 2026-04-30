import * as Sentry from '@sentry/node';
import { deactivateExpiredTokens } from './db';
import { logger } from './logger';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound?: 'default';
  data?: Record<string, unknown>;
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * Send Expo push notifications and automatically deactivate any tokens
 * that Expo reports as DeviceNotRegistered (uninstalled / expired).
 */
export async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  if (tokens.length === 0) return;

  const messages: ExpoPushMessage[] = tokens.map((to) => ({
    to,
    title,
    body,
    sound: 'default',
    data,
  }));

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    throw new Error(`Expo Push API error: ${response.status}`);
  }

  // Parse the per-token results and deactivate any dead tokens
  let tickets: ExpoPushTicket[] = [];
  try {
    const json = (await response.json()) as { data?: ExpoPushTicket[] };
    tickets = json.data ?? [];
  } catch {
    return; // If we can't parse the response, don't crash — delivery was best-effort
  }

  const deadTokens = tokens.filter(
    (_, i) =>
      i < tickets.length &&
      tickets[i]?.status === 'error' &&
      tickets[i]?.details?.error === 'DeviceNotRegistered',
  );

  if (deadTokens.length > 0) {
    logger.info({ count: deadTokens.length }, '[ExpoPush] Deactivating expired tokens');
    await deactivateExpiredTokens(deadTokens).catch((err) => {
      logger.error(
        { error: err instanceof Error ? err.message : String(err) },
        '[ExpoPush] Failed to deactivate tokens',
      );
      Sentry.captureException(err, {
        tags: { service: 'expo_push', stage: 'deactivate_tokens' },
        extra: { deadTokenCount: deadTokens.length },
      });
    });
  }
}
