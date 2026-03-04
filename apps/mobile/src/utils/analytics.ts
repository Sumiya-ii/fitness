import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api';

const ANALYTICS_QUEUE_KEY = '@coach/analytics_queue';

/** PRD Section 10.2: Required analytics events */
export const EVENTS = {
  ONBOARDING_COMPLETED: 'onboarding_completed',
  TARGET_GENERATED: 'target_generated',
  MEAL_LOG_STARTED: 'meal_log_started',
  MEAL_LOG_SAVED: 'meal_log_saved',
  VOICE_LOG_PROCESSED: 'voice_log_processed',
  PHOTO_LOG_PROCESSED: 'photo_log_processed',
  TELEGRAM_LINKED: 'telegram_linked',
  WEEKLY_CHECKIN_COMPLETED: 'weekly_checkin_completed',
  SUBSCRIPTION_STARTED: 'subscription_started',
  SUBSCRIPTION_CANCELED: 'subscription_canceled',
} as const;

export type AnalyticsEventName = (typeof EVENTS)[keyof typeof EVENTS];

interface QueuedEvent {
  event: string;
  properties?: Record<string, unknown>;
  sessionId?: string;
  platform?: string;
  timestamp: number;
}

let flushScheduled = false;

async function getQueue(): Promise<QueuedEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(ANALYTICS_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function setQueue(queue: QueuedEvent[]): Promise<void> {
  try {
    await AsyncStorage.setItem(ANALYTICS_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Ignore storage errors
  }
}

async function sendEvent(
  event: string,
  properties?: Record<string, unknown>,
  sessionId?: string,
  platform?: string
): Promise<boolean> {
  const token = await api.getToken();
  if (!token) return false;

  try {
    await api.post<{ ok: boolean }>('/analytics/events', {
      event,
      properties: properties ?? {},
      sessionId: sessionId ?? undefined,
      platform: platform ?? 'mobile',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Flush queued events. Call on app init or when back online.
 */
export async function flushAnalyticsQueue(): Promise<void> {
  if (flushScheduled) return;
  flushScheduled = true;

  const queue = await getQueue();
  if (queue.length === 0) {
    flushScheduled = false;
    return;
  }

  const failed: QueuedEvent[] = [];
  for (const item of queue) {
    const ok = await sendEvent(
      item.event,
      item.properties,
      item.sessionId,
      item.platform
    );
    if (!ok) failed.push(item);
  }

  await setQueue(failed);
  flushScheduled = false;
}

/**
 * Track an analytics event. Queues events when offline (send fails); flush when online.
 */
export async function trackEvent(
  event: string,
  properties?: Record<string, unknown>
): Promise<void> {
  const sessionId = `session_${Date.now()}`;
  const platform = 'mobile';

  const ok = await sendEvent(event, properties, sessionId, platform);
  if (!ok) {
    const queue = await getQueue();
    queue.push({
      event,
      properties,
      sessionId,
      platform,
      timestamp: Date.now(),
    });
    await setQueue(queue);
  }
}
