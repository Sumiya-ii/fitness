import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { getDeviceTimezone } from '../utils/timezone';

// Paywall callback — registered from App.tsx after store is initialized.
// Avoids a circular dependency between client ↔ subscription store.
let _onPaywallRequired: (() => void) | null = null;
let _shouldSuppressPaywall: (() => boolean) | null = null;
export function setPaywallCallback(cb: () => void, suppressCheck?: () => boolean): void {
  _onPaywallRequired = cb;
  _shouldSuppressPaywall = suppressCheck ?? null;
}

function normalizeBaseUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function resolveBaseUrl(): string {
  const envBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (envBaseUrl) {
    return normalizeBaseUrl(envBaseUrl);
  }

  // Android emulator cannot reach host localhost directly.
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000/api/v1';
  }

  return 'http://localhost:3000/api/v1';
}

const BASE_URL = resolveBaseUrl();
const TOKEN_KEY = 'auth_token';

async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// ---------------------------------------------------------------------------
// Auto-verify: when a premium endpoint returns 403 but the client believes
// the user is pro (RC entitlement arrived but webhook hasn't), call
// POST /subscriptions/verify to sync the DB, then retry the original request.
// Uses a singleton promise so concurrent 403s only trigger one verify call.
// ---------------------------------------------------------------------------
let _verifyPromise: Promise<boolean> | null = null;

async function tryVerifyAndRetry(originalFetch: () => Promise<Response>): Promise<Response | null> {
  // Always attempt verify on 403 — the store might have stale state
  // (e.g. default 'free' before initial fetch, or webhook lag).
  // Deduplicate concurrent verify calls
  if (!_verifyPromise) {
    _verifyPromise = (async () => {
      try {
        const token = await getToken();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(`${BASE_URL}/subscriptions/verify`, {
          method: 'POST',
          headers,
        });
        if (!res.ok) return false;
        const json = (await res.json()) as { data?: { tier?: string } };
        return json.data?.tier === 'pro';
      } catch {
        return false;
      } finally {
        // Clear after a short delay so rapid-fire 403s reuse the same result
        setTimeout(() => {
          _verifyPromise = null;
        }, 2000);
      }
    })();
  }

  const verified = await _verifyPromise;
  if (!verified) return null;

  // Retry the original request now that the DB is synced
  const retryRes = await originalFetch();
  return retryRes;
}

async function request<T>(
  method: string,
  path: string,
  options?: { body?: unknown; headers?: Record<string, string> },
): Promise<T> {
  const url = path.startsWith('http')
    ? path
    : `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Timezone': getDeviceTimezone(),
    ...options?.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const init: RequestInit = {
    method,
    headers,
  };
  if (options?.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  const doFetch = () => fetch(url, init);
  const res = await doFetch();

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 403 && text.includes('Pro subscription required')) {
      // Attempt auto-verify + retry before showing paywall
      const retryRes = await tryVerifyAndRetry(doFetch);
      if (retryRes?.ok) {
        const contentType = retryRes.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          return retryRes.json() as Promise<T>;
        }
        return retryRes.text() as unknown as T;
      }

      // Verify failed or user is genuinely free — show paywall
      if (!_shouldSuppressPaywall?.()) {
        _onPaywallRequired?.();
      }
    }
    throw new Error(`API error ${res.status}: ${text}`);
  }
  const contentType = res.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return res.json() as Promise<T>;
  }
  return res.text() as unknown as T;
}

export const api = {
  async get<T>(path: string, headers?: Record<string, string>): Promise<T> {
    return request<T>('GET', path, { headers });
  },
  async post<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return request<T>('POST', path, { body, headers });
  },
  async put<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return request<T>('PUT', path, { body, headers });
  },
  async patch<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return request<T>('PATCH', path, { body, headers });
  },
  async delete<T>(path: string, headers?: Record<string, string>): Promise<T> {
    return request<T>('DELETE', path, { headers });
  },
  async upload<T>(path: string, formData: FormData): Promise<T> {
    const url = path.startsWith('http')
      ? path
      : `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
    const token = await getToken();
    const headers: Record<string, string> = { 'X-Timezone': getDeviceTimezone() };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const doFetch = () =>
      fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });
    const res = await doFetch();

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 403 && text.includes('Pro subscription required')) {
        const retryRes = await tryVerifyAndRetry(doFetch);
        if (retryRes?.ok) {
          const contentType = retryRes.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            return retryRes.json() as Promise<T>;
          }
          return retryRes.text() as unknown as T;
        }

        if (!_shouldSuppressPaywall?.()) {
          _onPaywallRequired?.();
        }
      }
      throw new Error(`API error ${res.status}: ${text}`);
    }
    const contentType = res.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return res.json() as Promise<T>;
    }
    return res.text() as unknown as T;
  },
  getToken,
  setToken,
  clearToken,
};
