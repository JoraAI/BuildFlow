/**
 * BuildFlow — React Query hooks for Settings (Company, Users, Audit, Export).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiDownload } from '@/lib/api-client';

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
  state: string;
  createdAt: string;
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
  audit: (page: number, limit: number) => ['settings', 'audit', page, limit] as const,
};

// ---------------------------------------------------------------------------
// Company
// ---------------------------------------------------------------------------
export function useCompany() {
  return useQuery<CompanyProfile>({
    queryKey: settingsKeys.company,
    queryFn: () => apiFetch<CompanyProfile>('/api/settings/company'),
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CompanyProfile>) =>
      apiFetch('/api/settings/company', { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.company });
    },
  });
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export function useUsers() {
  return useQuery<UserRow[]>({
    queryKey: settingsKeys.users,
    queryFn: () => apiFetch<UserRow[]>('/api/settings/users'),
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
    }) => apiFetch(`/api/settings/users/${userId}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.users });
    },
  });
}

// ---------------------------------------------------------------------------
// Audit Log
// ---------------------------------------------------------------------------
export function useAuditLog(page = 1, limit = 50) {
  return useQuery<{ data: AuditLogRow[]; meta: { total: number; totalPages: number } }>({
    queryKey: settingsKeys.audit(page, limit),
    queryFn: async () => {
      const res = await apiFetch(`/api/settings/audit?page=${page}&limit=${limit}`);
      return res as unknown as { data: AuditLogRow[]; meta: { total: number; totalPages: number } };
    },
  });
}

// ---------------------------------------------------------------------------
// Data Export
// ---------------------------------------------------------------------------
export function useExportData() {
  return useMutation({
    mutationFn: () => apiFetch('/api/settings/export'),
  });
}

export function useExportZip() {
  return useMutation({
    mutationFn: async () => {
      const stamp = new Date().toISOString().slice(0, 10);
      return apiDownload(
        '/api/settings/export/zip',
        `buildflow-export-${stamp}.zip`,
        'application/zip',
      );
    },
  });
}

// ---------------------------------------------------------------------------
// Integrations status
// ---------------------------------------------------------------------------
export interface IntegrationStatus {
  tally: boolean;
  twilio: boolean;
  maps: boolean;
  razorpay: boolean;
  stripe: boolean;
}

export function useEnvStatus() {
  return useQuery<IntegrationStatus>({
    queryKey: ['settings', 'integrations'] as const,
    queryFn: () => apiFetch<IntegrationStatus>('/api/settings/integrations'),
  });
}
