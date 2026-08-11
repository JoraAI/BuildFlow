import { router } from 'expo-router';
import { useAssistantStore } from '@/stores/assistant.store';
export {
  parseReturnTo,
  withReturnTo,
  projectTabHref,
  billDetailHref,
  invoiceDetailHref,
  inventoryBillDetailHref,
  inventoryInvoiceDetailHref,
  reportDetailHref,
  createReportHref,
} from './navigation-paths';

/**
 * Navigate to a parent route. Use instead of router.back() on hidden tab screens -
 * router.back() in Expo Tabs often jumps to the wrong tab (e.g. Assistant) or a blank screen.
 */
export function dismissTo(href: string) {
  useAssistantStore.getState().close();
  router.replace(href as never);
}

/**
 * Nested app screen back: when returnTo is set, always navigate there (Expo Tabs history is unreliable).
 * Otherwise pop stack when possible, else replace with fallback.
 */
export function navigateAppBack(fallbackHref: string, returnTo?: string | null) {
  useAssistantStore.getState().close();
  if (returnTo) {
    dismissTo(returnTo);
    return;
  }
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallbackHref as never);
}

/**
 * Auth/marketing back: pop history when possible, otherwise replace with a safe fallback.
 * Avoids router.push on Back (which stacks duplicate routes) and handles deep links.
 */
export function navigateAuthBack(fallbackHref: string) {
  useAssistantStore.getState().close();
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallbackHref as never);
}

/** Common cancel targets for nested / form screens. */
export const DISMISS = {
  projects: '/projects',
  projectsCreate: '/projects',
  proposals: '/proposals',
  proposalDetail: (id: string) => `/proposals/${id}`,
  estimation: '/proposals',
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
