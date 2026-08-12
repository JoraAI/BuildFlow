/**
 * BuildFlow Mobile - Auth store (Zustand)
 */
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Role, type InventoryBusinessProfile } from '@buildflow/shared';
import type { RegisterCompanyInput } from '@buildflow/shared';
import { SECURE_STORE_KEYS } from '@/constants';
import {
  acceptInviteRequest,
  registerCompanyRequest,
  type AcceptInvitePayload,
  type AuthResponsePayload,
} from '@/services/auth.queries';
import { apiFetch } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  companyId: string;
  companyName: string;
  phone?: string | null;
  companyLogoUrl?: string | null;
  /** Role-based permissions loaded at login (string permission codes). */
  permissions?: string[];
  /** INVENTORY_PRODUCT: 'inventory' | 'construction' - drives the app shell. */
  productMode?: 'inventory' | 'construction';
  /** INVENTORY_PRODUCT: the hidden default STORE project id (null for construction). */
  defaultProjectId?: string | null;
  /** Modules enabled for the plan (drives inventory shell nav). */
  enabledModules?: string[];
  subscriptionPlan?: string;
  /** INVENTORY_HORIZONTAL_PLATFORM (Phase 0): null on construction plans. */
  inventoryProfile?: InventoryBusinessProfile | null;
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
  // FIX (NR-52): Only persist a truthy refresh token. Previously a missing/
  // undefined refreshToken was stringified to "undefined" and stored, causing
  // later refresh attempts to send "undefined" to the backend (always 400).
  if (data.refreshToken) {
    await SecureStore.setItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN, data.refreshToken);
  }
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
    queryClient.clear();
    set({ user: data.user as AuthUser, accessToken: data.accessToken, isAuthenticated: true });
  },

  registerCompany: async (input: RegisterCompanyInput) => {
    const data = await registerCompanyRequest(input);
    await persistSession(data);
    queryClient.clear();
    set({ user: data.user as AuthUser, accessToken: data.accessToken, isAuthenticated: true });
  },

  acceptInvite: async (input: AcceptInvitePayload) => {
    const data = await acceptInviteRequest(input);
    await persistSession(data);
    queryClient.clear();
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
      // Ignore - clearing local state regardless.
    }
    await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN);
    await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN);
    await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.USER);
    queryClient.clear();
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
          try {
            const user = await apiFetch<AuthUser>('/auth/me');
            await SecureStore.setItemAsync(SECURE_STORE_KEYS.USER, JSON.stringify(user));
            set({
              accessToken: token,
              user,
              isAuthenticated: true,
              isLoading: false,
            });
            return;
          } catch (err) {
            // FIX (MOB-H5): If the error is a NETWORK_ERROR (status 0), keep the
            // cached user and tokens and continue in a degraded/offline mode.
            // This is essential for field use in dead zones - the user should
            // NOT be logged out just because they're offline.
            const isNetworkError =
              err instanceof Error && (err.message.includes('NETWORK_ERROR') || (err as { status?: number }).status === 0);
            if (isNetworkError) {
              set({
                accessToken: token,
                user: parsed,
                isAuthenticated: true,
                isLoading: false,
              });
              return;
            }
            // Genuine auth failure (401 after refresh attempt) - log out.
            queryClient.clear();
            await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN);
            await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN);
            await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.USER);
            set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
            return;
          }
        }
        // Corrupt session - clear stale tokens.
        await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN);
        await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN);
        await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.USER);
      }
    } catch {
      // Corrupt storage - clear.
    }
    set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
  },

  refreshUser: async () => {
    const user = await apiFetch<AuthUser>('/auth/me');
    await SecureStore.setItemAsync(SECURE_STORE_KEYS.USER, JSON.stringify(user));
    set({ user });
  },
}));