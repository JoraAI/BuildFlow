/**
 * BuildFlow Mobile — Auth store (Zustand)
 *
 * Holds the authenticated user + tokens (persisted to SecureStore).
 * Hydrated from SecureStore on app launch.
 */
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Role } from '@buildflow/shared';
import { SECURE_STORE_KEYS } from '@/constants';
import { apiFetch } from '@/lib/api-client';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  companyId: string;
  companyName: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email: string, password: string) => {
    const data = await apiFetch<{ user: AuthUser; accessToken: string; refreshToken: string }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
    );
    await SecureStore.setItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN, data.accessToken);
    await SecureStore.setItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN, data.refreshToken);
    await SecureStore.setItemAsync(SECURE_STORE_KEYS.USER, JSON.stringify(data.user));
    set({ user: data.user, accessToken: data.accessToken, isAuthenticated: true });
  },

  logout: async () => {
    const refreshToken = await SecureStore.getItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN);
    try {
      await apiFetch('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Ignore — clearing local state regardless.
    }
    await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN);
    await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN);
    await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.USER);
    set({ user: null, accessToken: null, isAuthenticated: false });
  },

  hydrate: async () => {
    try {
      const [token, userStr] = await Promise.all([
        SecureStore.getItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN),
        SecureStore.getItemAsync(SECURE_STORE_KEYS.USER),
      ]);
      if (token && userStr) {
        set({
          accessToken: token,
          user: JSON.parse(userStr) as AuthUser,
          isAuthenticated: true,
          isLoading: false,
        });
        return;
      }
    } catch {
      // Corrupt storage — clear.
    }
    set({ isLoading: false });
  },

  refreshUser: async () => {
    const user = await apiFetch<AuthUser>('/auth/me');
    await SecureStore.setItemAsync(SECURE_STORE_KEYS.USER, JSON.stringify(user));
    set({ user });
  },
}));