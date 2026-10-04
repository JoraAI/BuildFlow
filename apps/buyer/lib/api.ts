import * as SecureStore from 'expo-secure-store';

const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api';

const TOKEN_KEY = 'bf_buyer_access_token';

export async function setBuyerToken(token: string | null) {
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function getBuyerToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function buyerFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getBuyerToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error?.message || body?.message || `Request failed (${res.status})`);
  }
  return body.data as T;
}
