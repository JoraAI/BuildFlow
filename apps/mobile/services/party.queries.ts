/**
 * BuildFlow - Party master hooks (INVENTORY_HORIZONTAL_PLATFORM Phase 1.1).
 * Customers (AR) + Vendors (AP) - company-scoped, INVENTORY plan only.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export interface PartyRow {
  id: string;
  name: string;
  businessName?: string | null;
  gstin?: string | null;
  pan?: string | null;
  billingAddress?: string | null;
  shippingAddress?: string | null;
  phone?: string | null;
  email?: string | null;
  paymentTerms?: string | null;
  creditLimit?: string | number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PartyInput {
  name: string;
  businessName?: string;
  gstin?: string;
  pan?: string;
  billingAddress?: string;
  shippingAddress?: string;
  phone?: string;
  email?: string;
  paymentTerms?: string;
  creditLimit?: number;
}

export const partyKeys = {
  customers: ['parties', 'customers'] as const,
  vendors: ['parties', 'vendors'] as const,
};

export interface LedgerEntry {
  date: string;
  type: 'INVOICE' | 'PAYMENT' | 'CREDIT_NOTE' | 'BILL' | 'DEBIT_NOTE';
  refNumber: string;
  amount: number;
  balance: number;
}

export interface PartyLedger {
  partyId: string;
  partyName: string;
  outstanding: number;
  entries: LedgerEntry[];
}

/** INVENTORY_HORIZONTAL_PLATFORM (Phase 5.3): party AR/AP ledger. */
export function useCustomerLedger(customerId: string) {
  return useQuery<PartyLedger>({
    queryKey: [...partyKeys.customers, customerId, 'ledger'] as const,
    queryFn: () => apiFetch<PartyLedger>(`/inventory/parties/customers/${customerId}/ledger`),
    enabled: !!customerId,
  });
}

export function useVendorLedger(vendorId: string) {
  return useQuery<PartyLedger>({
    queryKey: [...partyKeys.vendors, vendorId, 'ledger'] as const,
    queryFn: () => apiFetch<PartyLedger>(`/inventory/parties/vendors/${vendorId}/ledger`),
    enabled: !!vendorId,
  });
}

function useList<T>(key: readonly unknown[], path: string, enabled = true) {
  return useQuery<T[]>({
    queryKey: key as readonly string[],
    queryFn: () => apiFetch<T[]>(path),
    enabled,
  });
}

/* ── Customers ─────────────────────────────────────────────────────── */

export function useCustomers() {
  return useList<PartyRow>(partyKeys.customers, '/inventory/parties/customers');
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PartyInput) =>
      apiFetch<PartyRow>('/inventory/parties/customers', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: partyKeys.customers }),
  });
}

export function useUpdateCustomer(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<PartyInput>) =>
      apiFetch<PartyRow>(`/inventory/parties/customers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: partyKeys.customers }),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<PartyRow>(`/inventory/parties/customers/${id}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: partyKeys.customers }),
  });
}

/* ── Vendors ───────────────────────────────────────────────────────── */

export function useVendors() {
  return useList<PartyRow>(partyKeys.vendors, '/inventory/parties/vendors');
}

export function useCreateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PartyInput) =>
      apiFetch<PartyRow>('/inventory/parties/vendors', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: partyKeys.vendors }),
  });
}

export function useUpdateVendor(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<PartyInput>) =>
      apiFetch<PartyRow>(`/inventory/parties/vendors/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: partyKeys.vendors }),
  });
}

export function useDeleteVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<PartyRow>(`/inventory/parties/vendors/${id}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: partyKeys.vendors }),
  });
}
