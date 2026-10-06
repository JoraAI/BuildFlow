import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api';

const TOKEN_KEY = 'bf_buyer_access_token';

/** SecureStore is unreliable on web; use localStorage there. */
async function storageGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

async function storageSet(key: string, value: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (typeof localStorage === 'undefined') return;
      if (value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    } catch {
      // ignore quota / private mode
    }
    return;
  }
  if (value) await SecureStore.setItemAsync(key, value);
  else await SecureStore.deleteItemAsync(key);
}

export async function setBuyerToken(token: string | null) {
  await storageSet(TOKEN_KEY, token);
}

export async function getBuyerToken() {
  return storageGet(TOKEN_KEY);
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
