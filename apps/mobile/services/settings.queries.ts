/**
 * BuildFlow - React Query hooks for Settings (Company, Users, Audit, Export).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { apiFetch, apiFetchList, apiDownload, downloadJsonObject } from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface CompanyProfile {
  id: string;
  name: string;
  gstin: string;
  pan: string;
  address: string | null;
  logoUrl: string | null;
  logoDisplayUrl?: string | null;
  state: string;
  createdAt: string;
}

export interface MyProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  companyId: string;
  companyName: string;
  companyLogoUrl: string | null;
}

export interface SupportTicketRow {
  id: string;
  companyId: string;
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  scope: string;
  category: string;
  subject: string;
  description: string;
  payload: unknown;
  status: string;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  companyName?: string;
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export interface AuditLogRow {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const settingsKeys = {
  company: ['settings', 'company'] as const,
  users: ['settings', 'users'] as const,
  invites: ['settings', 'invites'] as const,
  audit: (page: number, limit: number) => ['settings', 'audit', page, limit] as const,
  me: ['settings', 'me'] as const,
  myTickets: ['settings', 'tickets', 'mine'] as const,
  ticketInbox: ['settings', 'tickets', 'inbox'] as const,
  integrations: ['settings', 'integrations'] as const,
  subscription: ['settings', 'subscription'] as const,
};

// ---------------------------------------------------------------------------
// Company
// ---------------------------------------------------------------------------
export function useCompany() {
  return useQuery<CompanyProfile>({
    queryKey: settingsKeys.company,
    queryFn: () => apiFetch<CompanyProfile>('/settings/company'),
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CompanyProfile>) =>
      apiFetch('/settings/company', { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.company });
      qc.invalidateQueries({ queryKey: settingsKeys.me });
    },
  });
}

export function useMyProfile() {
  return useQuery<MyProfile>({
    queryKey: settingsKeys.me,
    queryFn: () => apiFetch<MyProfile>('/settings/me'),
  });
}

export function useUpdateMyProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; phone?: string | null }) =>
      apiFetch<MyProfile>('/settings/me', { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.me });
    },
  });
}

// RPT-C2b: Report branding settings hooks
export interface ReportSettings {
  accentColor?: string;
  showLogo?: boolean;
  showWatermark?: boolean;
  footerText?: string;
}

export const settingsReportKeys = {
  reportSettings: ['settings', 'report-settings'] as const,
};

export function useReportSettings() {
  return useQuery<ReportSettings>({
    queryKey: settingsReportKeys.reportSettings,
    queryFn: () => apiFetch<ReportSettings>('/settings/report-settings'),
  });
}

export function useUpdateReportSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ReportSettings>) =>
      apiFetch<ReportSettings>('/settings/report-settings', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsReportKeys.reportSettings });
    },
  });
}

export function useCompanyLogoUpload() {
  return useMutation({
    mutationFn: async (input: { uri: string; filename: string; contentType: string }) => {
      const { uploadUrl, logoUrl } = await apiFetch<{ uploadUrl: string; logoUrl: string }>(
        '/settings/company/logo/upload-url',
        { method: 'POST', body: JSON.stringify({ filename: input.filename, contentType: input.contentType }) },
      );
      const blob = await fetch(input.uri).then((r) => r.blob());
      await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': input.contentType } });
      return logoUrl;
    },
  });
}

export function useMyTickets() {
  return useQuery<SupportTicketRow[]>({
    queryKey: settingsKeys.myTickets,
    queryFn: () => apiFetch<SupportTicketRow[]>('/settings/tickets/mine'),
  });
}

export function useTicketInbox() {
  return useQuery<SupportTicketRow[]>({
    queryKey: settingsKeys.ticketInbox,
    queryFn: () => apiFetch<SupportTicketRow[]>('/settings/tickets/inbox'),
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      category: string;
      subject: string;
      description: string;
      payload?: Record<string, unknown>;
      scope?: 'COMPANY' | 'PLATFORM';
    }) =>
      apiFetch<SupportTicketRow>('/settings/tickets', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.myTickets });
      qc.invalidateQueries({ queryKey: settingsKeys.ticketInbox });
    },
  });
}

export function useUpdateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      ticketId,
      data,
    }: {
      ticketId: string;
      data: { status?: string; resolutionNote?: string; applyChanges?: boolean };
    }) =>
      apiFetch<SupportTicketRow>(`/settings/tickets/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.myTickets });
      qc.invalidateQueries({ queryKey: settingsKeys.ticketInbox });
    },
  });
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export function useUsers() {
  return useQuery<UserRow[]>({
    queryKey: settingsKeys.users,
    queryFn: () => apiFetch<UserRow[]>('/settings/users'),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      data,
    }: {
      userId: string;
      data: Partial<Pick<UserRow, 'name' | 'phone' | 'role' | 'isActive'>>;
    }) => apiFetch(`/settings/users/${userId}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.users });
    },
  });
}

// ---------------------------------------------------------------------------
// Audit Log
// ---------------------------------------------------------------------------
export function useAuditLog(page = 1, limit = 50) {
  return useQuery({
    queryKey: settingsKeys.audit(page, limit),
    queryFn: () => apiFetchList<AuditLogRow>(`/settings/audit?page=${page}&limit=${limit}`),
  });
}

// ---------------------------------------------------------------------------
// Data Export
// ---------------------------------------------------------------------------
async function shareDownloadedFile(
  fileUri: string | null,
  mimeType: string,
  dialogTitle: string,
): Promise<void> {
  if (!fileUri) {
    if (Platform.OS === 'web') return;
    throw new Error('Export file was not saved');
  }
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, { mimeType, dialogTitle });
    return;
  }
  Alert.alert('Exported', `File saved to ${fileUri}`);
}

export function useExportData() {
  return useMutation({
    mutationFn: async () => {
      const data = await apiFetch<unknown>('/settings/export');
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `buildflow-export-${stamp}.json`;
      const fileUri = await downloadJsonObject(data, filename);
      await shareDownloadedFile(fileUri, 'application/json', 'BuildFlow JSON Export');
      return filename;
    },
  });
}

export function useExportZip() {
  return useMutation({
    mutationFn: async () => {
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `buildflow-export-${stamp}.zip`;
      const fileUri = await apiDownload(
        '/settings/export/zip',
        filename,
        'application/zip',
      );
      await shareDownloadedFile(fileUri, 'application/zip', 'BuildFlow Data Export');
      return filename;
    },
  });
}

export interface PendingInvite {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
  invitedBy: { name: string };
}

export interface InviteCreated {
  inviteId: string;
  token: string;
  inviteUrl: string;
  expiresAt: string;
}

export function usePendingInvites() {
  return useQuery<PendingInvite[]>({
    queryKey: settingsKeys.invites,
    queryFn: () => apiFetch<PendingInvite[]>('/settings/users/invites'),
  });
}

export function useCreateInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; role: 'PM' | 'SUPERVISOR' | 'ACCOUNTANT' }) =>
      apiFetch<InviteCreated>('/settings/users/invite', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.invites });
    },
  });
}

export function useRevokeInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      apiFetch(`/settings/users/invites/${inviteId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.invites });
    },
  });
}

export function useResendInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      apiFetch<InviteCreated>(`/settings/users/invites/${inviteId}/resend`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.invites });
    },
  });
}

// ---------------------------------------------------------------------------
// Integrations (company-scoped)
// ---------------------------------------------------------------------------
export type IntegrationSource = 'company' | 'platform' | 'none';

export interface IntegrationProviderStatus {
  configured: boolean;
  source: IntegrationSource;
  settings: Record<string, string>;
  webhookUrl?: string | null;
}

export interface IntegrationsOverview {
  twilio: IntegrationProviderStatus;
  razorpay: IntegrationProviderStatus;
  stripe: IntegrationProviderStatus;
  tally: IntegrationProviderStatus;
  maps: IntegrationProviderStatus;
  llm: IntegrationProviderStatus;
  s3: IntegrationProviderStatus;
}

export type IntegrationSlug =
  | 'twilio'
  | 'razorpay'
  | 'stripe'
  | 'tally'
  | 'google-maps'
  | 'llm'
  | 's3';

export function useIntegrations() {
  return useQuery<IntegrationsOverview>({
    queryKey: settingsKeys.integrations,
    queryFn: () => apiFetch<IntegrationsOverview>('/settings/integrations'),
  });
}

export function useUpdateIntegration(slug: IntegrationSlug) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiFetch(`/settings/integrations/${slug}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.integrations });
    },
  });
}

/** @deprecated Use useIntegrations */
export function useEnvStatus() {
  return useIntegrations();
}

// ---------------------------------------------------------------------------
// Subscription / billing
// ---------------------------------------------------------------------------
export interface BillingAvailability {
  razorpay: boolean;
  stripe: boolean;
  plans: Record<string, number>;
}

export interface SubscriptionUsage {
  projectCount: number;
  userCount: number;
  maxProjects: number | null;
  maxUsers: number | null;
}

export interface SubscriptionSummary {
  plan: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';
  trialStartsAt: string;
  trialEndsAt: string | null;
  daysRemaining: number | null;
  isTrial: boolean;
  lastPaymentAt: string | null;
  usage: SubscriptionUsage;
  billing?: BillingAvailability;
}

export function useSubscription() {
  return useQuery<SubscriptionSummary>({
    queryKey: settingsKeys.subscription,
    queryFn: () => apiFetch<SubscriptionSummary>('/settings/subscription'),
  });
}

export function useCreateSubscriptionCheckout() {
  return useMutation({
    mutationFn: (data: { plan: string; gateway: 'razorpay' | 'stripe' }) =>
      apiFetch<{ paymentUrl: string; gateway: string; amount: number; plan: string }>(
        '/settings/subscription/checkout',
        { method: 'POST', body: JSON.stringify(data) },
      ),
  });
}
