/**
 * BuildFlow - Permission Catalog
 *
 * The canonical list of all permissions in the system. Each permission is a
 * dot-notation string (`module.action`) used by:
 *   - Backend `requirePermission()` middleware for route guarding
 *   - Backend `hasPermission()` for service-level checks
 *   - Frontend `usePermission()` hook for UI gating
 *
 * Permission strings are stable identifiers - do NOT rename them once shipped
 * (they are stored in the `CompanyRolePermission.permissions[]` column).
 */

export const PERMISSIONS = {
  // ── Estimates ──────────────────────────────────────────────────────
  'estimate.view': 'View estimates',
  'estimate.create': 'Create & edit estimates',
  'estimate.submit': 'Submit estimate for approval',
  'estimate.approve': 'Approve / reject estimates',
  'estimate.convert_boq': 'Convert approved estimate to BOQ',
  'estimate.export': 'Export estimates (Excel / PDF)',

  // ── BOQ ────────────────────────────────────────────────────────────
  'boq.view': 'View Bill of Quantities',
  'boq.view_rates': 'View financial rates & amounts in BOQ',
  'boq.edit': 'Create / edit / delete BOQ items',
  'boq.record_measurement': 'Record BOQ measurements (executed qty)',
  'boq.import': 'Import BOQ via CSV',

  // ── Projects & Planning ────────────────────────────────────────────
  'project.view': 'View projects',
  'project.create': 'Create new projects',
  'project.edit': 'Edit project details, budget, members',
  'project.delete': 'Soft-delete / restore projects',
  'planning.view': 'View WBS, tasks & Gantt chart',
  'planning.edit': 'Create / edit WBS items, tasks & dependencies',

  // ── Daily Operations ───────────────────────────────────────────────
  'report.view': 'View daily site reports',
  'report.create': 'Submit daily site reports',
  'attendance.checkin': 'Geo-fenced check-in / check-out',
  'attendance.view': 'View attendance records',

  // ── Procurement & Inventory ────────────────────────────────────────
  'procurement.view': 'View indents, POs & GRNs',
  'procurement.create_indent': 'Create material indents / requisitions',
  'procurement.indent_from_boq': 'Indent / purchase from BOQ list & shortfalls',
  'procurement.view_rates': 'View expected rates & estimated amounts in indents',
  'procurement.approve_indent': 'Approve material indents / requisitions',
  'procurement.create_direct_po': 'Create direct Purchase Orders without requisition',
  'procurement.override_rates': 'Override material rates during PO creation',
  'procurement.approve_po': 'Approve purchase orders',
  'procurement.record_grn': 'Record goods receipt notes (GRN)',
  'procurement.excess_order': 'Order quantities exceeding BOQ estimated limits',
  'stock.view': 'View stock levels & movements',
  'stock.manage': 'Manage stock movements (in / out / transfer)',
  'stock.adjust': 'Perform manual stock adjustments',

  // ── Subcontracting ─────────────────────────────────────────────────
  'subcontract.view': 'View subcontractor work orders',
  'subcontract.create_wo': 'Create subcontractor work orders',
  'subcontract.approve_measurement': 'Approve subcontractor measurements',

  // ── Accounting - Invoices ──────────────────────────────────────────
  'invoice.view': 'View client invoices',
  'invoice.create': 'Create client invoices (Standard / RA / Milestone)',
  'invoice.record_payment': 'Record client payments',

  // ── Accounting - Bills ─────────────────────────────────────────────
  'bill.view': 'View vendor bills',
  'bill.create': 'Create vendor bills',
  'bill.approve': 'Approve vendor bills',
  'bill.record_payment': 'Pay vendor bills',

  // ── Accounting - Export ────────────────────────────────────────────
  'tally.export': 'Export invoices & bills to Tally XML',

  // ── Financials / Sensitive Amounts ─────────────────────────────────
  'financials.view_amounts': 'View monetary amounts (rates, totals, payments)',
  'financials.view_profit': 'View profit margins & P&L',
  'financials.view_budget': 'View project budgets & budget utilization',

  // ── Change Orders ──────────────────────────────────────────────────
  'change_order.view': 'View change orders / variations',
  'change_order.create': 'Create change orders',
  'change_order.approve': 'Approve / reject change orders',

  // ── Site Petty Cash & Float ─────────────────────────────────────────
  'petty_cash.view': 'View site petty cash & expense vouchers',
  'petty_cash.create': 'Log site petty cash expenses & snap receipts',
  'petty_cash.approve': 'Approve / reject petty cash expense vouchers',

  // ── Drawings & Blueprints ───────────────────────────────────────────
  'drawing.view': 'View blueprints & architectural / structural drawings',
  'drawing.upload': 'Upload project drawings & new revisions',
  'drawing.manage': 'Manage drawing status & approval revisions',

  // ── Snag List & Quality NCRs ────────────────────────────────────────
  'snag.view': 'View snag list & defect items',
  'snag.create': 'Log new site snags & defect evidence photos',
  'snag.rectify': 'Rectify, update status & sign-off snags / NCRs',

  // ── Labor Muster & Wages ────────────────────────────────────────────
  'labor.view': 'View site gang muster & wage settlement sheets',
  'labor.muster_edit': 'Record morning gang muster & overtime hours',
  'labor.wage_settle': 'Approve & settle weekly labor wage payouts',

  // ── Proposals & Portals ────────────────────────────────────────────
  'proposal.view': 'View proposals',
  'proposal.create': 'Create & manage proposals',
  'portal.manage': 'Manage client & subcontractor portal access',

  // ── Settings (company administration) ──────────────────────────────
  'settings.company': 'Edit company profile & logo',
  'settings.users': 'Manage users, invites & roles',
  'settings.permissions': 'Customize role permissions',
  'settings.integrations': 'Manage integrations (WhatsApp, Razorpay, etc.)',
  'settings.billing': 'Manage subscription & billing',
  'settings.audit': 'View audit log',
  'settings.export': 'Export / backup company data',
  'settings.material_prices': 'Manage material prices & resource library',
  'settings.rate_regions': 'Manage rate regions & regional pricing',
  'settings.rate_analysis': 'Manage rate analysis library',
  'settings.tickets': 'Manage support tickets',

  // ── Reports ────────────────────────────────────────────────────────
  'reports.view': 'View reports hub',
  'reports.download': 'Download PDF / Excel reports',
} as const;

export type Permission = keyof typeof PERMISSIONS;

/** Array form of all permissions (useful for seeding "full access" roles). */
export const ALL_PERMISSIONS: Permission[] = Object.keys(PERMISSIONS) as Permission[];

/**
 * Permissions grouped by module - used by the settings UI to render
 * a grouped permission matrix.
 */
export const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  {
    label: 'Estimates',
    permissions: [
      'estimate.view',
      'estimate.create',
      'estimate.submit',
      'estimate.approve',
      'estimate.convert_boq',
      'estimate.export',
    ],
  },
  {
    label: 'BOQ',
    permissions: ['boq.view', 'boq.view_rates', 'boq.edit', 'boq.record_measurement', 'boq.import'],
  },
  {
    label: 'Projects & Planning',
    permissions: [
      'project.view',
      'project.create',
      'project.edit',
      'project.delete',
      'planning.view',
      'planning.edit',
    ],
  },
  {
    label: 'Daily Operations',
    permissions: ['report.view', 'report.create', 'attendance.checkin', 'attendance.view'],
  },
  {
    label: 'Procurement & Inventory',
    permissions: [
      'procurement.view',
      'procurement.create_indent',
      'procurement.indent_from_boq',
      'procurement.view_rates',
      'procurement.approve_indent',
      'procurement.create_direct_po',
      'procurement.override_rates',
      'procurement.approve_po',
      'procurement.record_grn',
      'procurement.excess_order',
      'stock.view',
      'stock.manage',
      'stock.adjust',
    ],
  },
  {
    label: 'Subcontracting',
    permissions: ['subcontract.view', 'subcontract.create_wo', 'subcontract.approve_measurement'],
  },
  {
    label: 'Invoices (Money In)',
    permissions: ['invoice.view', 'invoice.create', 'invoice.record_payment'],
  },
  {
    label: 'Bills (Money Out)',
    permissions: ['bill.view', 'bill.create', 'bill.approve', 'bill.record_payment'],
  },
  {
    label: 'Accounting Export',
    permissions: ['tally.export'],
  },
  {
    label: 'Financials',
    permissions: ['financials.view_amounts', 'financials.view_profit', 'financials.view_budget'],
  },
  {
    label: 'Change Orders',
    permissions: ['change_order.view', 'change_order.create', 'change_order.approve'],
  },
  {
    label: 'Site Petty Cash',
    permissions: ['petty_cash.view', 'petty_cash.create', 'petty_cash.approve'],
  },
  {
    label: 'Drawings & Blueprints',
    permissions: ['drawing.view', 'drawing.upload', 'drawing.manage'],
  },
  {
    label: 'Snag List & Quality NCRs',
    permissions: ['snag.view', 'snag.create', 'snag.rectify'],
  },
  {
    label: 'Labor Muster & Wages',
    permissions: ['labor.view', 'labor.muster_edit', 'labor.wage_settle'],
  },
  {
    label: 'Proposals & Portals',
    permissions: ['proposal.view', 'proposal.create', 'portal.manage'],
  },
  {
    label: 'Settings',
    permissions: [
      'settings.company',
      'settings.users',
      'settings.permissions',
      'settings.integrations',
      'settings.billing',
      'settings.audit',
      'settings.export',
      'settings.material_prices',
      'settings.rate_regions',
      'settings.rate_analysis',
      'settings.tickets',
    ],
  },
  {
    label: 'Reports',
    permissions: ['reports.view', 'reports.download'],
  },
];