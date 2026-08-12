/**
 * BuildFlow - Default Role → Permission Map
 *
 * These are the system defaults applied when a company is created. If the
 * Owner customizes permissions via Settings → Role Permissions, the company's
 * `CompanyRolePermission` row for that role is marked `isCustomized = true`
 * and these defaults are no longer consulted for that role.
 *
 * Design principles:
 *   - OWNER: full access (every permission)
 *   - PM: project management + estimation + planning (no company admin)
 *   - DPM: PM minus final approvals (submit, not approve estimates)
 *   - QC: quality control - reports, measurements, BOQ view
 *   - MECHANICAL_MANAGER: equipment + reports + limited planning view
 *   - STORE_INCHARGE: procurement + stock + GRN (no approvals beyond PO)
 *   - WEIGHBRIDGE_INCHARGE: material weighing - limited procurement/report creation
 *   - SITE_SUPERVISOR: daily reports + attendance + project view (no amounts)
 *   - ACCOUNTANT: invoices + bills + Tally + financial amounts (no project editing)
 */
import { Role } from '../enums';
import { ALL_PERMISSIONS, type Permission } from './catalog';

/** Common read-only project access (no financial amounts). */
const PROJECT_VIEW_NO_FINANCIALS: Permission[] = [
  'project.view',
  'planning.view',
  'boq.view',
  'change_order.view',
  'proposal.view',
  'report.view',
  'reports.view',
];

/** Read-only access that includes monetary amounts. */
const PROJECT_VIEW_WITH_FINANCIALS: Permission[] = [
  ...PROJECT_VIEW_NO_FINANCIALS,
  'financials.view_amounts',
  'financials.view_budget',
];

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // ── OWNER / MD - full access ──────────────────────────────────────
  OWNER: [...ALL_PERMISSIONS],

  // ── Project Manager ────────────────────────────────────────────────
  PM: [
    ...PROJECT_VIEW_WITH_FINANCIALS,
    'project.create',
    'project.edit',
    'planning.edit',
    'report.view',
    'estimate.view',
    'estimate.create',
    'estimate.submit',
    'estimate.export',
    'boq.view',
    'boq.edit',
    'boq.record_measurement',
    'boq.import',
    'procurement.view',
    'procurement.create_indent',
    'procurement.approve_indent',
    'procurement.approve_po',
    'procurement.record_grn',
    'stock.view',
    'subcontract.view',
    'change_order.view',
    'change_order.create',
    'proposal.view',
    'proposal.create',
    'portal.manage',
    'attendance.checkin',
    'attendance.view',
    'reports.view',
    'reports.download',
    'tally.export',
    'settings.material_prices',
    'settings.rate_regions',
    'settings.rate_analysis',
  ],

  // ── Deputy Project Manager ─────────────────────────────────────────
  // Same as PM but CANNOT approve estimates, change orders, or manage proposals
  DPM: [
    ...PROJECT_VIEW_WITH_FINANCIALS,
    'project.create',
    'project.edit',
    'planning.edit',
    'report.view',
    'estimate.view',
    'estimate.create',
    'estimate.submit',
    'estimate.export',
    'boq.view',
    'boq.edit',
    'boq.record_measurement',
    'procurement.view',
    'procurement.create_indent',
    'procurement.approve_indent',
    'procurement.approve_po',
    'procurement.record_grn',
    'stock.view',
    'subcontract.view',
    'change_order.view',
    'change_order.create',
    'attendance.checkin',
    'attendance.view',
    'reports.view',
    'reports.download',
    'settings.material_prices',
    'settings.rate_analysis',
  ],

  // ── Senior QC Engineer ─────────────────────────────────────────────
  QC: [
    'project.view',
    'planning.view',
    'boq.view',
    'boq.record_measurement',
    'report.view',
    'report.create',
    'attendance.checkin',
    'attendance.view',
    'procurement.view',
    'stock.view',
    'subcontract.view',
    'reports.view',
    'reports.download',
  ],

  // ── Mechanical Manager ─────────────────────────────────────────────
  MECHANICAL_MANAGER: [
    'project.view',
    'planning.view',
    'boq.view',
    'report.view',
    'report.create',
    'attendance.checkin',
    'attendance.view',
    'procurement.view',
    'stock.view',
    'subcontract.view',
    'reports.view',
    'reports.download',
  ],

  // ── Store Incharge ─────────────────────────────────────────────────
  STORE_INCHARGE: [
    'project.view',
    'boq.view',
    'procurement.view',
    'procurement.create_indent',
    'procurement.record_grn',
    'stock.view',
    'stock.manage',
    'report.view',
    'attendance.view',
    'reports.view',
  ],

  // ── WeighBridge Incharge ───────────────────────────────────────────
  WEIGHBRIDGE_INCHARGE: [
    'project.view',
    'boq.view',
    'procurement.view',
    'stock.view',
    'report.view',
    'report.create',
    'reports.view',
  ],

  // ── Site Supervisor ────────────────────────────────────────────────
  SITE_SUPERVISOR: [
    'project.view',
    'planning.view',
    'boq.view',
    'report.view',
    'report.create',
    'attendance.checkin',
    'attendance.view',
    'reports.view',
  ],

  // ── Legacy SUPERVISOR (maps to SITE_SUPERVISOR) ───────────────────
  SUPERVISOR: [
    'project.view',
    'planning.view',
    'boq.view',
    'report.view',
    'report.create',
    'attendance.checkin',
    'attendance.view',
    'reports.view',
  ],

  // ── Accountant ─────────────────────────────────────────────────────
  ACCOUNTANT: [
    'project.view',
    'invoice.view',
    'invoice.create',
    'invoice.record_payment',
    'bill.view',
    'bill.create',
    'bill.record_payment',
    'tally.export',
    'financials.view_amounts',
    'financials.view_profit',
    'financials.view_budget',
    'reports.view',
    'reports.download',
    'settings.tickets',
  ],

  // ── Inventory Manager (INVENTORY product) ─────────────────────────
  // Stock + procurement + AR/AP invoicing + Tally. No estimate, planning,
  // subcontract, change-order, proposal, or attendance admin access.
  INVENTORY_MANAGER: [
    'project.view',
    'procurement.view',
    'procurement.create_indent',
    'procurement.approve_indent',
    'procurement.approve_po',
    'procurement.record_grn',
    'stock.view',
    'stock.manage',
    'invoice.view',
    'invoice.create',
    'invoice.record_payment',
    'bill.view',
    'bill.create',
    'bill.approve',
    'bill.record_payment',
    'tally.export',
    'financials.view_amounts',
    'financials.view_profit',
    'reports.view',
    'reports.download',
    'settings.tickets',
    'settings.material_prices',
  ],
};