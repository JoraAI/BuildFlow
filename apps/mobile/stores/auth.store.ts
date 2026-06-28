/**
 * BuildFlow Mobile — Auth store (Zustand)
 */
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Role } from '@buildflow/shared';
import type { RegisterCompanyInput } from '@buildflow/shared';
import { SECURE_STORE_KEYS } from '@/constants';
import {
  acceptInviteRequest,
  registerCompanyRequest,
  type AcceptInvitePayload,
  type AuthResponsePayload,
} from '@/services/auth.queries';
import { apiFetch } from '@/lib/api-client';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  companyId: string;
  companyName: string;
  phone?: string | null;
  companyLogoUrl?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  registerCompany: (input: RegisterCompanyInput) => Promise<void>;
  acceptInvite: (input: AcceptInvitePayload) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

async function persistSession(data: AuthResponsePayload) {
  await SecureStore.setItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN, data.accessToken);
  await SecureStore.setItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN, data.refreshToken);
  await SecureStore.setItemAsync(SECURE_STORE_KEYS.USER, JSON.stringify(data.user));
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email: string, password: string) => {
    const data = await apiFetch<AuthResponsePayload>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await persistSession(data);
    set({ user: data.user as AuthUser, accessToken: data.accessToken, isAuthenticated: true });
  },

  registerCompany: async (input: RegisterCompanyInput) => {
    const data = await registerCompanyRequest(input);
    await persistSession(data);
    set({ user: data.user as AuthUser, accessToken: data.accessToken, isAuthenticated: true });
  },

  acceptInvite: async (input: AcceptInvitePayload) => {
    const data = await acceptInviteRequest(input);
    await persistSession(data);
    set({ user: data.user as AuthUser, accessToken: data.accessToken, isAuthenticated: true });
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
        const parsed = JSON.parse(userStr) as AuthUser | null;
        if (parsed?.id && parsed?.email && parsed?.role) {
          set({
            accessToken: token,
            user: parsed,
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        }
        // Corrupt session — clear stale tokens.
        await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN);
        await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN);
        await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.USER);
      }
    } catch {
      // Corrupt storage — clear.
    }
    set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
  },

  refreshUser: async () => {
    const user = await apiFetch<AuthUser>('/auth/me');
    await SecureStore.setItemAsync(SECURE_STORE_KEYS.USER, JSON.stringify(user));
    set({ user });
  },
}));
