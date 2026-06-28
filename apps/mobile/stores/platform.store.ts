import { create } from 'zustand';
import { platformFetch, setPlatformToken, getPlatformToken } from '@/lib/platform-api-client';

interface PlatformAdmin {
  id: string;
  name: string;
  email: string;
}

interface PlatformState {
  admin: PlatformAdmin | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const usePlatformStore = create<PlatformState>((set) => ({
  admin: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    const data = await platformFetch<{
      admin: PlatformAdmin;
      accessToken: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await setPlatformToken(data.accessToken);
    set({ admin: data.admin, isAuthenticated: true });
  },

  logout: async () => {
    await setPlatformToken(null);
    set({ admin: null, isAuthenticated: false });
  },

  hydrate: async () => {
    try {
      const token = await getPlatformToken();
      if (!token) {
        set({ isLoading: false });
        return;
      }
      const admin = await platformFetch<PlatformAdmin>('/auth/me');
      set({ admin, isAuthenticated: true, isLoading: false });
    } catch {
      await setPlatformToken(null);
      set({ admin: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
