/**
 * Platform admin API client (separate JWT from tenant auth).
 */
import { API_BASE_URL } from '@/constants';
import * as SecureStore from 'expo-secure-store';

const PLATFORM_TOKEN_KEY = 'buildflow_platform_access_token';

export async function getPlatformToken(): Promise<string | null> {
  return SecureStore.getItemAsync(PLATFORM_TOKEN_KEY);
}

export async function setPlatformToken(token: string | null): Promise<void> {
  if (token) await SecureStore.setItemAsync(PLATFORM_TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(PLATFORM_TOKEN_KEY);
}

export async function platformFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getPlatformToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/platform${path}`, { ...init, headers });
  const body = await res.json().catch(() => ({ success: false }));
  if (!res.ok || !body.success) {
    throw new Error(body.error?.message ?? 'Platform request failed');
  }
  return body.data as T;
}
