import * as SecureStore from 'expo-secure-store';

const BASE_URL = 'http://localhost:3000/api/v1';
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
  options?: { body?: unknown; headers?: Record<string, string> }
): Promise<T> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
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
  async delete<T>(path: string, headers?: Record<string, string>): Promise<T> {
    return request<T>('DELETE', path, { headers });
  },
  getToken,
  setToken,
  clearToken,
};
