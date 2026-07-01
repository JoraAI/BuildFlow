/**
 * BuildFlow - Domain Types
 *
 * Plain TS interfaces for all 24 Prisma models (DTO shapes - fields that the
 * app cares about). Backend services map Prisma rows into these. Enums are
 * imported from ../enums.
 */

import type {
  Role,
  ProjectType,
  ProjectStatus,
  TaskStatus,
  TaskConstraintType,
  DependencyType,
  ResourceType,
  CostType,
  EstimateStatus,
  InvoiceStatus,
  BillStatus,
  BillCategory,
  MessageType,
} from '../enums';

/* ------------------------------------------------------------------ */
/* API response envelope                                               */
/* ------------------------------------------------------------------ */

export interface ApiMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export interface AuthUser {
  id: string;
  companyId: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthLoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

/* ------------------------------------------------------------------ */
/* 1. Company                                                          */
/* ------------------------------------------------------------------ */

export interface Company {
  id: string;
  name: string;
  gstin: string;
  pan: string;
  address: string | null;
  logoUrl: string | null;
  state: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* 2. User  (see AuthUser above for the safe/auth projection)          */
/* ------------------------------------------------------------------ */

export interface User extends AuthUser {
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* 3. Project                                                          */
/* ------------------------------------------------------------------ */

export interface Project {
  id: string;
  companyId: string;
  name: string;
  code: string;
  type: ProjectType;
  status: ProjectStatus;
  clientName: string;
  clientContact: string | null;
  locationLat: number | null;
  locationLng: number | null;
  locationAddress: string | null;
  startDate: string | null;
  endDate: string | null;
  budget: number;
  createdBy: string;
  createdAt: string;
  /** Computed summary - present on detail/summary endpoints. */
  stats?: ProjectStats;
}

export interface ProjectStats {
  plannedProgressPct: number;
  actualProgressPct: number;
  scheduleVarianceDays: number;
  budgetUtilizationPct: number;
  tasksOverdueCount: number;
  approvedEstimateTotal: number;
  estimateVsActualVariance: number;
  /** Sum of approved/ paid bill totals (committed obligations). */
  committedSpend: number;
  /** Sum of bill paidAmount (cash out). */
  paidSpend: number;
}

/* ------------------------------------------------------------------ */
/* 4. WBSItem                                                          */
/* ------------------------------------------------------------------ */

export interface WBSItem {
  id: string;
  projectId: string;
  parentId: string | null;
  code: string;
  name: string;
  level: number;
  orderIndex: number;
  children?: WBSItem[];
}

/* ------------------------------------------------------------------ */
/* 5. Task                                                             */
/* ------------------------------------------------------------------ */

export interface Task {
  id: string;
  projectId: string;
  wbsId: string | null;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  durationDays: number;
  progressPct: number;
  status: TaskStatus;
  assignedTo: string | null;
  constraintType: TaskConstraintType | null;
  createdAt: string;
  /** CPM-computed (returned by gantt/critical-path endpoints). */
  earlyStart?: string;
  earlyFinish?: string;
  lateStart?: string;
  lateFinish?: string;
  float?: number;
  isCritical?: boolean;
}

/* ------------------------------------------------------------------ */
/* 6. TaskPredecessor                                                  */
/* ------------------------------------------------------------------ */

export interface TaskPredecessor {
  id: string;
  taskId: string;
  predecessorId: string;
  type: DependencyType;
  lagDays: number;
}

/* ------------------------------------------------------------------ */
/* 7. Resource                                                         */
/* ------------------------------------------------------------------ */

export interface Resource {
  id: string;
  companyId: string;
  name: string;
  type: ResourceType;
  unit: string;
  rate: number;
  gstRate: number;
  hsnSacCode: string | null;
  brandOrSpec: string | null;
  category: string | null;
  imageUrl: string | null;
  lastRateUpdatedAt: string | null;
  isActive: boolean;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* 8. TaskResource                                                     */
/* ------------------------------------------------------------------ */

export interface TaskResource {
  id: string;
  taskId: string;
  resourceId: string;
  quantity: number;
  unit: string;
  rate: number;
  totalCost: number;
}

/* ------------------------------------------------------------------ */
/* 9. BOQItem                                                          */
/* ------------------------------------------------------------------ */

export interface BOQItem {
  id: string;
  projectId: string;
  wbsId: string | null;
  itemCode: string;
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  amount: number;
  category: string | null;
  estimateItemId: string | null;
}

/* ------------------------------------------------------------------ */
/* 10. Estimate                                                        */
/* ------------------------------------------------------------------ */

export interface Estimate {
  id: string;
  projectId: string;
  companyId: string;
  name: string;
  version: number;
  status: EstimateStatus;
  totalMaterialCost: number;
  totalLabourCost: number;
  totalEquipmentCost: number;
  totalSubcontractorCost: number;
  totalMiscCost: number;
  subtotal: number;
  overheadPct: number;
  overheadAmount: number;
  contingencyPct: number;
  contingencyAmount: number;
  profitMarginPct: number;
  profitMarginAmount: number;
  gstAmount: number;
  grandTotal: number;
  notes: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  sections?: EstimateSection[];
  summary?: EstimateSummary;
}

/* ------------------------------------------------------------------ */
/* 11. EstimateSection                                                 */
/* ------------------------------------------------------------------ */

export interface EstimateSection {
  id: string;
  estimateId: string;
  name: string;
  orderIndex: number;
  description: string | null;
  items?: EstimateItem[];
}

/* ------------------------------------------------------------------ */
/* 12. EstimateItem                                                    */
/* ------------------------------------------------------------------ */

export interface EstimateItem {
  id: string;
  estimateId: string;
  sectionId: string;
  wbsItemId: string | null;
  itemCode: string | null;
  description: string;
  unit: string;
  quantity: number;
  resourceId: string | null;
  rate: number;
  amount: number;
  type: CostType;
  notes: string | null;
}

/* ------------------------------------------------------------------ */
/* 13. RateAnalysis                                                    */
/* ------------------------------------------------------------------ */

export interface RateAnalysis {
  id: string;
  companyId: string;
  name: string;
  unit: string;
  description: string | null;
  totalRate: number;
  components?: RateAnalysisComponent[];
  stale?: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* 14. RateAnalysisComponent                                           */
/* ------------------------------------------------------------------ */

export interface RateAnalysisComponent {
  id: string;
  rateAnalysisId: string;
  resourceId: string | null;
  quantityPerUnit: number;
  unit: string;
  rate: number;
  amount: number;
  type: CostType;
  /** For MISC rows without a linked resource. */
  miscName?: string | null;
}

/* ------------------------------------------------------------------ */
/* 15. MaterialPriceHistory                                            */
/* ------------------------------------------------------------------ */

export interface MaterialPriceHistory {
  id: string;
  resourceId: string;
  companyId: string;
  rate: number;
  effectiveDate: string;
  notes: string | null;
  recordedBy: string;
}

/* ------------------------------------------------------------------ */
/* 16. DailyReport                                                     */
/* ------------------------------------------------------------------ */

export interface DailyReport {
  id: string;
  projectId: string;
  reportedBy: string;
  reportDate: string;
  weather: string | null;
  workDone: string | null;
  issues: string | null;
  photos: string[];
  workersCount: number;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* 17. MaterialUsage                                                   */
/* ------------------------------------------------------------------ */

export interface MaterialUsage {
  id: string;
  dailyReportId: string;
  resourceId: string;
  quantityUsed: number;
  notes: string | null;
}

/* ------------------------------------------------------------------ */
/* 18. Invoice                                                         */
/* ------------------------------------------------------------------ */

export interface Invoice {
  id: string;
  projectId: string;
  companyId: string;
  invoiceNumber: string;
  clientName: string;
  clientGstin: string | null;
  invoiceDate: string;
  dueDate: string;
  status: InvoiceStatus;
  subtotal: number;
  gstRate: number;
  gstAmount: number;
  tdsRate: number;
  tdsAmount: number;
  total: number;
  paidAmount: number;
  notes: string | null;
  lineItems?: InvoiceLineItem[];
}

/* ------------------------------------------------------------------ */
/* 19. InvoiceLineItem                                                 */
/* ------------------------------------------------------------------ */

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  boqItemId: string | null;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  gstRate: number;
  hsnSacCode: string | null;
}

/* ------------------------------------------------------------------ */
/* 20. Bill                                                            */
/* ------------------------------------------------------------------ */

export interface Bill {
  id: string;
  projectId: string;
  companyId: string;
  billNumber: string;
  vendorName: string;
  vendorGstin: string | null;
  billDate: string;
  dueDate: string | null;
  status: BillStatus;
  subtotal: number;
  gstAmount: number;
  tdsAmount: number;
  total: number;
  category: BillCategory;
  approvedBy: string | null;
}

/* ------------------------------------------------------------------ */
/* 21. JournalEntry                                                    */
/* ------------------------------------------------------------------ */

export interface JournalEntry {
  id: string;
  companyId: string;
  projectId: string | null;
  entryDate: string;
  description: string | null;
  reference: string | null;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  createdBy: string;
}

/* ------------------------------------------------------------------ */
/* 22. ChatMessage                                                     */
/* ------------------------------------------------------------------ */

export interface ChatMessage {
  id: string;
  companyId: string;
  senderId: string;
  projectId: string | null;
  message: string;
  messageType: MessageType;
  fileUrl: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* 23. Notification                                                    */
/* ------------------------------------------------------------------ */

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  referenceId: string | null;
  isRead: boolean;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* 24. AuditLog                                                        */
/* ------------------------------------------------------------------ */

export interface AuditLog {
  id: string;
  companyId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Computed aggregates (not DB models)                                 */
/* ------------------------------------------------------------------ */

export interface EstimateSummary {
  materialCost: number;
  labourCost: number;
  equipmentCost: number;
  subcontractorCost: number;
  miscCost: number;
  subtotal: number;
  overheadAmount: number;
  contingencyAmount: number;
  profitAmount: number;
  grandTotalBeforeGst: number;
  gstAmount: number;
  grandTotal: number;
  materialPct: number;
  labourPct: number;
  equipmentPct: number;
  subPct: number;
  miscPct: number;
}