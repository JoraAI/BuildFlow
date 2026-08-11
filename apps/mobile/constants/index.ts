/**
 * BuildFlow Mobile - App constants
 */
import { Role } from '@buildflow/shared';

/**
 * Expo inlines `process.env.EXPO_PUBLIC_*` at build time (static dot access only).
 * Do not use optional chaining or dynamic access — Vercel builds will keep localhost.
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export const SECURE_STORE_KEYS = {
  ACCESS_TOKEN: 'bf_access_token',
  REFRESH_TOKEN: 'bf_refresh_token',
  USER: 'bf_user',
} as const;

/** Maps each role to the tabs it may see (default; overridable per company). */
export const ROLE_TABS: Record<Role, readonly string[]> = {
  OWNER: ['dashboard', 'projects', 'proposals', 'planning', 'reports', 'accounting', 'settings'],
  PM: ['dashboard', 'projects', 'proposals', 'planning', 'reports', 'accounting'],
  DPM: ['dashboard', 'projects', 'planning', 'reports'],
  QC: ['dashboard', 'projects', 'reports'],
  MECHANICAL_MANAGER: ['dashboard', 'projects', 'reports'],
  STORE_INCHARGE: ['dashboard', 'projects', 'reports'],
  WEIGHBRIDGE_INCHARGE: ['dashboard', 'projects', 'reports'],
  SITE_SUPERVISOR: ['dashboard', 'projects', 'reports'],
  SUPERVISOR: ['dashboard', 'projects', 'reports'],
  ACCOUNTANT: ['dashboard', 'accounting', 'reports'],
  // INVENTORY_PRODUCT: inventory shell tabs are rendered by inventory/_layout.
  INVENTORY_MANAGER: ['dashboard', 'accounting', 'reports'],
} as const;

export const SCREEN_PADDING = 16;

/** BuildFlow design-system palette (spec v2.0). */
export const COLORS = {
  primary: '#1E3A5F',
  accent: '#F59E0B',
  success: '#10B981',
  warning: '#F97316',
  danger: '#EF4444',
  surface: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0F172A',
  muted: '#64748B',
} as const;

/** React Query stale times per spec: offline-first cache strategy. */
export const STALE_TIMES = {
  PROJECT_LIST: 5 * 60 * 1000, // 5 min
  TASKS: 2 * 60 * 1000, // 2 min
  RESOURCES: 60 * 60 * 1000, // 1 hr
  RATE_ANALYSIS: 60 * 60 * 1000, // 1 hr
  USER_PROFILE: 30 * 60 * 1000, // 30 min
} as const;