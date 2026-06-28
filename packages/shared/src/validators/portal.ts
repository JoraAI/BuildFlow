import { z } from 'zod';

export const createPortalAccessSchema = z.object({
  label: z.string().min(1).max(100),
  scopes: z.array(z.enum(['VIEW_PROGRESS', 'VIEW_INVOICES', 'PAY_INVOICES'])).min(1),
  expiresInDays: z.coerce.number().int().min(1).max(365).default(30),
});
export type CreatePortalAccessInput = z.infer<typeof createPortalAccessSchema>;

export const createReportScheduleSchema = z.object({
  reportType: z.enum(['GST_SUMMARY', 'TDS_REPORT', 'COMPANY_DASHBOARD', 'PROJECT_PL']),
  cronExpr: z.string().min(1).max(50),
  recipients: z.array(z.string().email()).min(1),
});
export type CreateReportScheduleInput = z.infer<typeof createReportScheduleSchema>;

export const setProjectMembersSchema = z.object({
  members: z.array(
    z.object({
      userId: z.string().uuid(),
      role: z.enum(['OWNER', 'PM', 'SUPERVISOR', 'ACCOUNTANT']),
    }),
  ),
});
