import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { platformFetch } from '@/lib/platform-api-client';
import type { SupportTicketRow } from '@/services/settings.queries';

export const platformKeys = {
  companies: (q?: string) => ['platform', 'companies', q] as const,
  company: (id: string) => ['platform', 'company', id] as const,
  tickets: ['platform', 'tickets'] as const,
};

export function usePlatformCompanies(q?: string) {
  return useQuery({
    queryKey: platformKeys.companies(q),
    queryFn: () =>
      platformFetch<
        Array<{
          id: string;
          name: string;
          gstin: string;
          subscriptionPlan: string;
          subscriptionStatus: string;
          trialEndsAt: string | null;
          _count: { users: number };
        }>
      >(`/companies${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  });
}

export function usePlatformCompany(id: string) {
  return useQuery({
    queryKey: platformKeys.company(id),
    queryFn: () => platformFetch(`/companies/${id}`),
    enabled: !!id,
  });
}

export function usePlatformTickets() {
  return useQuery({
    queryKey: platformKeys.tickets,
    queryFn: () => platformFetch<(SupportTicketRow & { companyName: string })[]>('/tickets'),
  });
}

export function usePlatformUpdateCompany(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      platformFetch(`/companies/${companyId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: platformKeys.company(companyId) }),
  });
}

export function usePlatformUpdateSubscription(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      platformFetch(`/companies/${companyId}/subscription`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: platformKeys.company(companyId) }),
  });
}

export function usePlatformUpdateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, data }: { ticketId: string; data: Record<string, unknown> }) =>
      platformFetch(`/tickets/${ticketId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: platformKeys.tickets }),
  });
}
