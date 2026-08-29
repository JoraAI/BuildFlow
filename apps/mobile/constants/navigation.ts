/**
 * BuildFlow - Navigation configuration shared by sidebar & tab bar.
 */
import { Role } from '@buildflow/shared';
import { Ionicons } from '@expo/vector-icons';
import { ROLE_TABS } from '@/constants';

export type TabName = keyof typeof TAB_CONFIG;

export const TAB_CONFIG = {
  dashboard: { label: 'Home', icon: 'grid-outline' as const, href: '/dashboard' },
  projects: { label: 'Projects', icon: 'business-outline' as const, href: '/projects' },
  proposals: { label: 'Proposals', icon: 'calculator-outline' as const, href: '/proposals' },
  planning: { label: 'Planning', icon: 'calendar-outline' as const, href: '/planning' },
  reports: { label: 'Reports', icon: 'document-text-outline' as const, href: '/reports' },
  accounting: { label: 'Accounting', icon: 'cash-outline' as const, href: '/accounting' },
  settings: { label: 'Settings', icon: 'settings-outline' as const, href: '/settings' },
  chat: { label: 'Assistant', icon: 'chatbubble-ellipses-outline' as const, href: '/chat' },
  notifications: { label: 'Alerts', icon: 'notifications-outline' as const, href: '/notifications' },
} satisfies Record<
  string,
  { label: string; icon: keyof typeof Ionicons.glyphMap; href: string }
>;

/** Tabs reachable via FAB / top bar - excluded from sidebar & bottom nav. */
export const OVERLAY_ONLY_TABS = ['chat'] as const;

/** Tabs shown to every role in overflow / top bar (not primary bottom nav). */
export const UNIVERSAL_TABS = ['notifications'] as const;

/** Primary bottom-bar tabs on mobile (overflow goes in Menu). */
export const MOBILE_PRIMARY_TABS = ['dashboard', 'projects', 'planning', 'reports'] as const;

/** Nested / detail routes - must be hidden from the tab navigator. */
export const HIDDEN_TAB_SCREENS = [
  'projects/[id]',
  'projects/create',
  'proposals/create',
  'proposals/[id]',
  'estimation',
  'estimation/[id]',
  'estimation/create',
  'estimation/compare',
  'estimation/rate-analysis/index',
  'estimation/rate-analysis/[id]',
  'reports/[id]',
  'reports/create',
  'reports/check-in',
  'reports/check-in.web',
  'accounting/create-bill',
  'accounting/create-invoice',
  'accounting/invoice/[id]',
  'accounting/bill/[id]',
  'accounting/project/[id]',
  'settings/rate-regions',
  'settings/audit',
  'settings/company',
  'settings/export',
  'settings/integrations',
  'settings/material-prices',
  'settings/users',
  'settings/billing',
  'settings/profile',
  'settings/tickets/index',
  'settings/tickets/create',
  'settings/permissions',
  'reports-hub/index',
] as const;

export function getAllowedTabs(role: Role): TabName[] {
  return [...(ROLE_TABS[role] ?? ['dashboard']), ...UNIVERSAL_TABS] as TabName[];
}

export function getMobilePrimaryTabs(role: Role): TabName[] {
  const allowed = new Set(getAllowedTabs(role));
  return MOBILE_PRIMARY_TABS.filter((t) => allowed.has(t));
}

export function getMobileOverflowTabs(role: Role): TabName[] {
  const allowed = getAllowedTabs(role);
  const primary = new Set<string>(MOBILE_PRIMARY_TABS);
  return allowed.filter((t) => !primary.has(t));
}

/** Standalone screens not in the tab navigator but linked from sidebar / More menu. */
export const APP_LINKS = {
  reportsHub: {
    label: 'Reports Hub',
    icon: 'bar-chart-outline' as const,
    href: '/reports-hub',
    roles: ['OWNER', 'PM', 'ACCOUNTANT'] as const satisfies readonly Role[],
  },
} as const;

export type AppLinkName = keyof typeof APP_LINKS;

export function getAppLinksForRole(role: Role): (typeof APP_LINKS)[AppLinkName][] {
  return Object.values(APP_LINKS).filter((link) =>
    (link.roles as readonly Role[]).includes(role),
  );
}

export function isReportsHubPath(pathname: string): boolean {
  return normalizePath(pathname).startsWith('/reports-hub');
}

export interface Breadcrumb {
  label: string;
  href?: string;
}

/** Parse a project id from `/projects/:id` (excludes `create`). */
export function getProjectIdFromPath(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] !== 'projects' || !segments[1] || segments[1] === 'create') return null;
  return segments[1];
}

/** Project id from a returnTo href (e.g. `/projects/uuid?tab=procurement`). */
export function getProjectIdFromReturnTo(returnTo: string | null | undefined): string | null {
  if (!returnTo) return null;
  const pathOnly = returnTo.split('?')[0] ?? returnTo;
  return getProjectIdFromPath(pathOnly);
}

export function getActiveTabFromPath(
  pathname: string,
  returnTo?: string | null,
  from?: string | string[] | null,
): string {
  const fromStr = Array.isArray(from) ? from[0] : from;
  let source = returnTo?.split('?')[0];
  if (!source && fromStr) {
    if (fromStr === 'proposals' || fromStr === 'estimation') {
      source = '/proposals';
    } else if (fromStr === 'dashboard') {
      source = '/dashboard';
    } else if (fromStr === 'projects') {
      source = '/projects';
    } else if (fromStr === 'settings') {
      source = '/settings';
    } else if (fromStr in TAB_CONFIG) {
      source = `/${fromStr}`;
    }
  }
  if (!source) {
    source = pathname;
  }
  if (isReportsHubPath(source)) return 'reportsHub';
  const segment = source.split('/').filter(Boolean)[0] ?? 'dashboard';
  return segment in TAB_CONFIG ? segment : 'dashboard';
}

function nestedRouteLabel(segments: string[]): string | null {
  const [root, second] = segments;
  if (root === 'accounting' && second === 'bill') return 'Bill';
  if (root === 'accounting' && second === 'invoice') return 'Invoice';
  if (root === 'accounting' && second === 'project') return 'Project accounts';
  if (root === 'reports' && second && second !== 'create' && !second.startsWith('check-in')) return 'Report';
  if (root === 'projects' && second === 'create') return 'New project';
  if (root === 'proposals' && second === 'create') return 'New proposal';
  if (root === 'settings' && second) return SETTINGS_CHILD_LABELS[second] ?? second.replace(/-/g, ' ');
  if (root === 'estimation' && second === 'rate-analysis') return 'Rate Analysis';
  return null;
}

/** Build breadcrumb trail for the top bar. */
export function getBreadcrumbs(
  pathname: string,
  projectName?: string,
  returnTo?: string | null,
  from?: string | string[] | null,
): Breadcrumb[] {
  const normalized = normalizePath(pathname);
  const segments = normalized.split('/').filter(Boolean);
  const fromStr = Array.isArray(from) ? from[0] : from;

  if (returnTo) {
    const basePath = returnTo.split('?')[0] ?? returnTo;
    const rawCrumbs = getBreadcrumbs(basePath, projectName);
    const baseCrumbs = rawCrumbs.map((c, i, arr) => {
      if (i === arr.length - 1 && !c.href) {
        return { ...c, href: basePath };
      }
      return c;
    });
    const childLabel = nestedRouteLabel(segments);
    return childLabel ? [...baseCrumbs, { label: childLabel }] : baseCrumbs;
  }

  if (fromStr && (fromStr === 'proposals' || fromStr === 'dashboard' || fromStr === 'projects')) {
    const basePath = `/${fromStr}`;
    const rawCrumbs = getBreadcrumbs(basePath, projectName);
    const baseCrumbs = rawCrumbs.map((c, i, arr) => {
      if (i === arr.length - 1 && !c.href) {
        return { ...c, href: basePath };
      }
      return c;
    });
    const childLabel = nestedRouteLabel(segments);
    return childLabel ? [...baseCrumbs, { label: childLabel }] : baseCrumbs;
  }

  const crumbs: Breadcrumb[] = [{ label: 'BuildFlow', href: '/dashboard' }];

  if (segments.length === 0) {
    crumbs.push({ label: 'Home' });
    return crumbs;
  }

  const [root, second] = segments;

  if (root in TAB_CONFIG) {
    const config = TAB_CONFIG[root as TabName];
    const hasNestedRoute =
      !!second &&
      ((root === 'projects' && second !== 'create') ||
        (root === 'proposals' && second !== 'create') ||
        root === 'settings');
    crumbs.push({
      label: config.label,
      href: hasNestedRoute ? config.href : undefined,
    });
  }

  if (root === 'proposals' && second) {
    if (second === 'create') {
      crumbs.push({ label: 'New Proposal' });
    } else {
      crumbs.push({ label: 'Proposal' });
    }
  }

  if (root === 'projects' && second) {
    if (second === 'create') {
      crumbs.push({ label: 'New Project' });
    } else {
      crumbs.push({ label: projectName ?? 'Project' });
    }
  }

  if (root === 'settings' && second) {
    crumbs.push({
      label: SETTINGS_CHILD_LABELS[second] ?? second.replace(/-/g, ' '),
    });
  }

  if (root === 'reports-hub') {
    crumbs.push({ label: 'Reports Hub' });
  }

  return crumbs;
}

const SETTINGS_CHILD_LABELS: Record<string, string> = {
  company: 'Company Profile',
  users: 'Users & Roles',
  billing: 'Billing & plan',
  audit: 'Audit Log',
  export: 'Data Export',
  integrations: 'Integrations',
  'material-prices': 'Material Prices',
  profile: 'My Profile',
  tickets: 'Support requests',
  permissions: 'Role Permissions',
  help: 'How BuildFlow works',
  'report-branding': 'Reports & Branding',
  'rate-regions': 'Rate Regions',
};

/** Unsplash - free for commercial use (Unsplash License). */
export const BRAND_IMAGES = {
  sidebarTexture:
    'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=800&q=80&auto=format&fit=crop',
  planningHero:
    'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=1200&q=80&auto=format&fit=crop',
  loginHero:
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1400&q=80&auto=format&fit=crop',
  dashboardHero:
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&q=80&auto=format&fit=crop',
} as const;

/** Sidebar navigation groups for desktop layout. */
export const NAV_GROUPS: { title: string; tabs: TabName[]; appLinks?: AppLinkName[] }[] = [
  { title: 'Workspace', tabs: ['dashboard', 'projects', 'planning'] },
  { title: 'Operations', tabs: ['proposals', 'reports'] },
  { title: 'Finance', tabs: ['accounting'], appLinks: ['reportsHub'] },
  { title: 'Alerts', tabs: ['notifications'] },
  { title: 'Admin', tabs: ['settings'] },
];

/** Top-level tab index routes - show global mobile header on these only. */
export const PRIMARY_TAB_PATHS = [
  '/dashboard',
  '/projects',
  '/planning',
  '/proposals',
  '/reports',
  '/accounting',
  '/settings',
] as const;

function normalizePath(pathname: string): string {
  const stripped = pathname.replace(/\/$/, '');
  return stripped || '/dashboard';
}

/** True on main tab list screens (mobile global header visible). */
export function isPrimaryAppTabRoute(pathname: string): boolean {
  return (PRIMARY_TAB_PATHS as readonly string[]).includes(normalizePath(pathname));
}

/** Convert a hidden-screen glob like `projects/[id]` to a safe RegExp. */
function hiddenScreenToRegex(screen: string): RegExp {
  const parts = screen.split('/').map((segment) => {
    if (segment.startsWith('[') && segment.endsWith(']')) {
      return '[^/]+';
    }
    return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });
  return new RegExp(`^${parts.join('/')}$`);
}

/** True on detail / form / secondary screens (FormScreenHeader instead of global header). */
export function isNestedAppRoute(pathname: string): boolean {
  const normalized = normalizePath(pathname);
  if (normalized.startsWith('/notifications')) return true;
  if (normalized.startsWith('/reports-hub')) return true;
  if (isPrimaryAppTabRoute(pathname)) return false;
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0) return false;
  const pathTail = segments.join('/');
  return (
    HIDDEN_TAB_SCREENS.some((screen) => {
      if (hiddenScreenToRegex(screen).test(pathTail)) return true;
      const root = screen.split('/')[0];
      return pathTail === root;
    }) ||
    segments.length > 1
  );
}
