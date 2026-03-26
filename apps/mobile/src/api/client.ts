import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

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
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
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
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) {
      const text = await res.text();
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
