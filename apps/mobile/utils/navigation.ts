import { router } from 'expo-router';
import { useAssistantStore } from '@/stores/assistant.store';

/**
 * Navigate to a parent route. Use instead of router.back() on hidden tab screens —
 * router.back() in Expo Tabs often jumps to the wrong tab (e.g. Assistant) or a blank screen.
 */
export function dismissTo(href: string) {
  useAssistantStore.getState().close();
  router.replace(href as never);
}

/** Common cancel targets for nested / form screens. */
export const DISMISS = {
  projects: '/projects',
  projectsCreate: '/projects',
  estimation: '/estimation',
  estimationForProject: (projectId: string) => `/projects/${projectId}`,
  estimateTab: (projectId: string) => `/projects/${projectId}?tab=estimate`,
  rateAnalysis: '/estimation/rate-analysis',
  reports: '/reports',
  accounting: '/accounting',
  settings: '/settings',
  dashboard: '/dashboard',
  chat: '/dashboard',
  notifications: '/dashboard',
} as const;

/** Settings child screens → settings hub. */
export function goBackToSettings() {
  dismissTo(DISMISS.settings);
}
