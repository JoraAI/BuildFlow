/**
 * BuildFlow - Shared Constants
 */
import { Role } from '../enums';

/* ------------------------------------------------------------------ */
/* Role display meta                                                   */
/* ------------------------------------------------------------------ */

export const ROLE_META: Record<
  Role,
  { label: string; short: string; color: string; description: string }
> = {
  OWNER: {
    label: 'Owner / Director',
    short: 'Owner',
    color: '#1E3A5F',
    description: 'Full access, financial dashboards, multi-project overview',
  },
  PM: {
    label: 'Project Manager / Engineer',
    short: 'PM',
    color: '#2563EB',
    description: 'Project planning, scheduling, cost estimation, resources',
  },
  SUPERVISOR: {
    label: 'Site Supervisor / Foreman',
    short: 'Supervisor',
    color: '#10B981',
    description: 'Daily reports, progress updates, material tracking',
  },
  ACCOUNTANT: {
    label: 'Accountant / Finance',
    short: 'Accountant',
    color: '#7C3AED',
    description: 'Invoicing, GST, TDS, bills, ledgers',
  },
};

/* ------------------------------------------------------------------ */
/* Role-based tab navigation (tab keys present in app/(app)/_layout)   */
/* ------------------------------------------------------------------ */

export const ROLE_TABS: Record<Role, string[]> = {
  OWNER: ['dashboard', 'projects', 'proposals', 'planning', 'reports', 'accounting', 'settings'],
  PM: ['dashboard', 'projects', 'proposals', 'planning', 'reports', 'accounting'],
  SUPERVISOR: ['dashboard', 'projects', 'reports'],
  ACCOUNTANT: ['dashboard', 'accounting', 'reports'],
};

export type TabKey =
  | 'dashboard'
  | 'projects'
  | 'proposals'
  | 'planning'
  | 'reports'
  | 'accounting'
  | 'settings';

/* ------------------------------------------------------------------ */
/* Status meta (label + color)                                         */
/* ------------------------------------------------------------------ */

export const PROJECT_TYPE_META = {
  HEAVY: { label: 'Heavy Civil', color: '#7C2D12', budgetHint: '> ₹50 Cr' },
  LARGE: { label: 'Large', color: '#9A3412', budgetHint: '₹10–50 Cr' },
  MID: { label: 'Mid', color: '#C2410C', budgetHint: '₹2–10 Cr' },
  MINI: { label: 'Mini', color: '#F97316', budgetHint: '< ₹2 Cr' },
} as const;

export const PROJECT_STATUS_META = {
  PLANNING: { label: 'Planning', color: '#64748B', badge: 'muted' },
  IN_PROGRESS: { label: 'In Progress', color: '#2563EB', badge: 'info' },
  ON_HOLD: { label: 'On Hold', color: '#F59E0B', badge: 'warning' },
  COMPLETED: { label: 'Completed', color: '#10B981', badge: 'success' },
  CANCELLED: { label: 'Cancelled', color: '#EF4444', badge: 'danger' },
} as const;

export const TASK_STATUS_META = {
  NOT_STARTED: { label: 'Not Started', color: '#64748B' },
  IN_PROGRESS: { label: 'In Progress', color: '#2563EB' },
  COMPLETED: { label: 'Completed', color: '#10B981' },
  DELAYED: { label: 'Delayed', color: '#EF4444' },
  ON_HOLD: { label: 'On Hold', color: '#F59E0B' },
} as const;

export const ESTIMATE_STATUS_META = {
  DRAFT: { label: 'Draft', color: '#64748B' },
  REVIEWED: { label: 'Submitted', color: '#2563EB' },
  APPROVED: { label: 'Approved', color: '#10B981' },
  REJECTED: { label: 'Rejected', color: '#EF4444' },
  SUPERSEDED: { label: 'Superseded', color: '#94A3B8' },
} as const;

export const PROPOSAL_STATUS_META = {
  DRAFT: { label: 'Draft', color: '#64748B' },
  IN_REVIEW: { label: 'In Review', color: '#2563EB' },
  APPROVED: { label: 'Approved', color: '#10B981' },
  SENT: { label: 'Sent', color: '#8B5CF6' },
  WON: { label: 'Won', color: '#059669' },
  LOST: { label: 'Lost', color: '#EF4444' },
  ARCHIVED: { label: 'Archived', color: '#94A3B8' },
} as const;

/* ------------------------------------------------------------------ */
/* Units (civil engineering)                                           */
/* ------------------------------------------------------------------ */

export const COMMON_UNITS = [
  'cum',
  'sqm',
  'sqft',
  'rmt',
  'no',
  'bag',
  'kg',
  'ton',
  'brass',
  'set',
  'day',
  'month',
  'ls',
] as const;

export type Unit = (typeof COMMON_UNITS)[number];

/* ------------------------------------------------------------------ */
/* Default add-on percentages for new estimates                        */
/* ------------------------------------------------------------------ */

export const DEFAULT_ESTIMATE_ADDONS = {
  overheadPct: 8,
  contingencyPct: 5,
  profitMarginPct: 10,
} as const;

/* ------------------------------------------------------------------ */
/* Common HSN/SAC codes (construction, India)                          */
/* ------------------------------------------------------------------ */

export const COMMON_HSN_CODES = {
  CEMENT: '2523',
  STEEL_TMT: '7213',
  AGGREGATE_SAND: '2517',
  BRICKS: '6810',
  TILES: '6907',
  PIPES_PVC: '3917',
  PLYWOOD: '4412',
  ELECTRICAL_WIRE: '8544',
  CONSTRUCTION_WORKS: '9954',
  CONSULTING: '9983',
} as const;

export * from './material-hsn';

/* ------------------------------------------------------------------ */
/* GST rates (India common slabs) + TDS                                */
/* ------------------------------------------------------------------ */

export const GST_RATES = {
  ZERO: 0,
  FIVE: 5,
  TWELVE: 12,
  EIGHTEEN: 18,
  TWENTY_EIGHT: 28,
} as const;

/** TDS u/s 194C (contractor) - single (non-transport) rate, in %. */
export const TDS_SECTION_194C_RATE = 2;

/* ------------------------------------------------------------------ */
/* Indian states (GSTIN first 2 digits) - subset, commonly used.       */
/* Full 37-state list can be extended later; key states included here.  */
/* ------------------------------------------------------------------ */

export const INDIAN_STATES: ReadonlyArray<{ code: string; name: string }> = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '07', name: 'Delhi' },
  { code: '06', name: 'Haryana' },
  { code: '05', name: 'Uttarakhand' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '20', name: 'Jharkhand' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '32', name: 'Kerala' },
  { code: '24', name: 'Gujarat' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '19', name: 'West Bengal' },
  { code: '10', name: 'Bihar' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
];

/** Lookup: state name by GSTIN prefix code. */
export const STATE_BY_CODE: Record<string, string> = INDIAN_STATES.reduce(
  (acc, s) => {
    acc[s.code] = s.name;
    return acc;
  },
  {} as Record<string, string>,
);