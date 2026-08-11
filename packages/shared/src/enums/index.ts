/**
 * BuildFlow - Domain Enums (shared between frontend & backend)
 *
 * These mirror the Prisma enums in apps/backend/prisma/schema.prisma.
 * Keep them in sync. String values are SCREAMING_SNAKE_CASE and stored as-is in DB.
 */

export const Role = {
  OWNER: 'OWNER',
  PM: 'PM',
  DPM: 'DPM',
  QC: 'QC',
  MECHANICAL_MANAGER: 'MECHANICAL_MANAGER',
  STORE_INCHARGE: 'STORE_INCHARGE',
  WEIGHBRIDGE_INCHARGE: 'WEIGHBRIDGE_INCHARGE',
  SITE_SUPERVISOR: 'SITE_SUPERVISOR',
  /** @deprecated Use SITE_SUPERVISOR — kept for migration compatibility */
  SUPERVISOR: 'SUPERVISOR',
  ACCOUNTANT: 'ACCOUNTANT',
  /** Inventory product role - hidden from construction companies. */
  INVENTORY_MANAGER: 'INVENTORY_MANAGER',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

/** All selectable roles for invites / UI dropdowns (excludes deprecated). */
export const ALL_ROLES: Role[] = [
  Role.OWNER,
  Role.PM,
  Role.DPM,
  Role.QC,
  Role.MECHANICAL_MANAGER,
  Role.STORE_INCHARGE,
  Role.WEIGHBRIDGE_INCHARGE,
  Role.SITE_SUPERVISOR,
  Role.ACCOUNTANT,
  Role.INVENTORY_MANAGER,
];

/** Roles that can access the Accounting module (default permissions). */
export const ACCOUNTING_ROLES: Role[] = [Role.OWNER, Role.ACCOUNTANT];

/**
 * Human-readable labels for each role, used in invite UI and user management.
 */
export const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Owner / MD',
  PM: 'Project Manager',
  DPM: 'Deputy Project Manager',
  QC: 'Senior QC Engineer',
  MECHANICAL_MANAGER: 'Mechanical Manager',
  STORE_INCHARGE: 'Store Incharge',
  WEIGHBRIDGE_INCHARGE: 'WeighBridge Incharge',
  SITE_SUPERVISOR: 'Site Supervisor',
  SUPERVISOR: 'Site Supervisor (legacy)',
  ACCOUNTANT: 'Accountant',
  INVENTORY_MANAGER: 'Inventory Manager',
};

/**
 * Roles that can be assigned via invite (Owner is assigned at company creation only).
 * Construction companies — INVENTORY_MANAGER is hidden from them.
 */
export const INVITABLE_ROLES: Role[] = [
  Role.PM,
  Role.DPM,
  Role.QC,
  Role.MECHANICAL_MANAGER,
  Role.STORE_INCHARGE,
  Role.WEIGHBRIDGE_INCHARGE,
  Role.SITE_SUPERVISOR,
  Role.ACCOUNTANT,
];

/**
 * INVENTORY_PRODUCT: invitable roles per plan family.
 *   INVENTORY: OWNER + INVENTORY_MANAGER only.
 *   Construction: existing roles except INVENTORY_MANAGER.
 */
export const INVITABLE_ROLES_BY_PRODUCT: Record<'inventory' | 'construction', Role[]> = {
  inventory: [Role.OWNER, Role.INVENTORY_MANAGER],
  construction: INVITABLE_ROLES,
};

export const ProjectType = {
  HEAVY: 'HEAVY',
  LARGE: 'LARGE',
  MID: 'MID',
  MINI: 'MINI',
} as const;
export type ProjectType = (typeof ProjectType)[keyof typeof ProjectType];

export const ProjectStatus = {
  PLANNING: 'PLANNING',
  IN_PROGRESS: 'IN_PROGRESS',
  ON_HOLD: 'ON_HOLD',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const TaskStatus = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  DELAYED: 'DELAYED',
  ON_HOLD: 'ON_HOLD',
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

/** CPM dependency types: Finish-Start, Start-Start, Finish-Finish, Start-Finish */
export const DependencyType = {
  FS: 'FS',
  SS: 'SS',
  FF: 'FF',
  SF: 'SF',
} as const;
export type DependencyType = (typeof DependencyType)[keyof typeof DependencyType];

export const ResourceType = {
  LABOUR: 'LABOUR',
  MATERIAL: 'MATERIAL',
  EQUIPMENT: 'EQUIPMENT',
  SUBCONTRACTOR: 'SUBCONTRACTOR',
} as const;
export type ResourceType = (typeof ResourceType)[keyof typeof ResourceType];

/** Used by EstimateItem and RateAnalysisComponent. */
export const CostType = {
  MATERIAL: 'MATERIAL',
  LABOUR: 'LABOUR',
  EQUIPMENT: 'EQUIPMENT',
  SUBCONTRACTOR: 'SUBCONTRACTOR',
  MISC: 'MISC',
} as const;
export type CostType = (typeof CostType)[keyof typeof CostType];

export const EstimateStatus = {
  DRAFT: 'DRAFT',
  REVIEWED: 'REVIEWED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SUPERSEDED: 'SUPERSEDED',
} as const;
export type EstimateStatus = (typeof EstimateStatus)[keyof typeof EstimateStatus];

export const ProposalStatus = {
  DRAFT: 'DRAFT',
  IN_REVIEW: 'IN_REVIEW',
  APPROVED: 'APPROVED',
  SENT: 'SENT',
  WON: 'WON',
  LOST: 'LOST',
  ARCHIVED: 'ARCHIVED',
} as const;
export type ProposalStatus = (typeof ProposalStatus)[keyof typeof ProposalStatus];

export const InvoiceStatus = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const BillStatus = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  PAID: 'PAID',
  REJECTED: 'REJECTED',
} as const;
export type BillStatus = (typeof BillStatus)[keyof typeof BillStatus];

export const BillCategory = {
  MATERIAL: 'MATERIAL',
  LABOUR: 'LABOUR',
  EQUIPMENT: 'EQUIPMENT',
  SUBCONTRACTOR: 'SUBCONTRACTOR',
  OTHER: 'OTHER',
} as const;
export type BillCategory = (typeof BillCategory)[keyof typeof BillCategory];

export const MessageType = {
  TEXT: 'TEXT',
  IMAGE: 'IMAGE',
  FILE: 'FILE',
} as const;
export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export const TaskConstraintType = {
  ASAP: 'ASAP',
  ALAP: 'ALAP',
  MUST_START_ON: 'MUST_START_ON',
  MUST_FINISH_ON: 'MUST_FINISH_ON',
  START_NO_EARLIER_THAN: 'START_NO_EARLIER_THAN',
  START_NO_LATER_THAN: 'START_NO_LATER_THAN',
} as const;
export type TaskConstraintType = (typeof TaskConstraintType)[keyof typeof TaskConstraintType];