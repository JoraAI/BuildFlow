/**
 * BuildFlow - Gang Labor Muster & Wage Settlement React Query hooks.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export interface GangMusterLine {
  trade: string;
  headcount: number;
  otHours: number;
  dailyRate: number;
  supervisorName?: string;
}

export interface WageSettlementLine {
  id: string;
  workerName: string;
  trade: string;
  daysWorked: number;
  dailyRate: number;
  otHours: number;
  otRate: number;
  advanceDeduction: number;
  netPay: number;
  status: 'PENDING' | 'PAID';
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  projectId: string;
  checkInAt: string;
  checkOutAt?: string | null;
  withinFence?: boolean;
  distanceFromSite?: number | null;
  notes?: string | null;
  user?: { id: string; name: string };
}

export const laborKeys = {
  all: ['labor'] as const,
  attendance: (projectId: string, date?: string) =>
    [...laborKeys.all, 'attendance', projectId, date] as const,
  muster: (projectId: string, date?: string) =>
    [...laborKeys.all, 'muster', projectId, date] as const,
  wages: (projectId: string, weekStart?: string) =>
    [...laborKeys.all, 'wages', projectId, weekStart] as const,
};

export function useProjectAttendance(projectId: string, date?: string) {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return useQuery({
    queryKey: laborKeys.attendance(projectId, date),
    queryFn: () =>
      apiFetch<{ rows: AttendanceRecord[]; total: number }>(
        `/projects/${projectId}/attendance${query}`,
      ),
    enabled: !!projectId,
  });
}

export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      lat,
      lng,
      notes,
    }: {
      projectId: string;
      lat: number;
      lng: number;
      notes?: string;
    }) =>
      apiFetch<AttendanceRecord>(`/projects/${projectId}/attendance/check-in`, {
        method: 'POST',
        body: JSON.stringify({ lat, lng, notes }),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: laborKeys.attendance(vars.projectId) });
    },
  });
}

export function useCheckOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      notes,
    }: {
      projectId: string;
      notes?: string;
    }) =>
      apiFetch<AttendanceRecord>(`/projects/${projectId}/attendance/check-out`, {
        method: 'POST',
        body: JSON.stringify({ notes }),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: laborKeys.attendance(vars.projectId) });
    },
  });
}
