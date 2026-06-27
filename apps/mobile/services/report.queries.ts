/**
 * BuildFlow — React Query hooks for Daily Reports & Attendance.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { apiFetch } from '../lib/api-client';
import type {
  CreateDailyReportInput,
  UpdateDailyReportInput,
  CheckInInput,
} from '@buildflow/shared';

/* ------------------------------------------------------------------ */
/* Keys                                                                */
/* ------------------------------------------------------------------ */
export const reportKeys = {
  all: ['reports'] as const,
  list: (projectId: string, from?: string, to?: string) =>
    ['reports', 'list', projectId, from, to] as const,
  calendar: (projectId: string, month: string) =>
    ['reports', 'calendar', projectId, month] as const,
  detail: (id: string) => ['reports', 'detail', id] as const,
  photos: (id: string) => ['reports', 'photos', id] as const,
  attendance: (projectId: string, date?: string) =>
    ['attendance', projectId, date] as const,
};

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
export interface ReportListItem {
  id: string;
  reportDate: string;
  weather: string | null;
  siteStatus: string | null;
  workDone: string | null;
  issues: string | null;
  photos: string[];
  workersCount: number;
  reportedByUser: { id: string; name: string };
  materialUsages: {
    id: string;
    quantityUsed: number;
    notes: string | null;
    resource: { id: string; name: string; unit: string };
  }[];
}

export interface CalendarEntry { id: string; date: string; }

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

export function useReports(projectId: string, from?: string, to?: string) {
  return useQuery({
    queryKey: reportKeys.list(projectId, from, to),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (from) params.set('fromDate', from);
      if (to) params.set('toDate', to);
      return apiFetch<ReportListItem[]>(
        `/projects/${projectId}/reports?${params.toString()}`,
      );
    },
    enabled: !!projectId,
    staleTime: 2 * 60 * 1000, // 2 min per offline strategy
  });
}

export function useReportCalendar(projectId: string, month: string) {
  return useQuery({
    queryKey: reportKeys.calendar(projectId, month),
    queryFn: () =>
      apiFetch<CalendarEntry[]>(
        `/projects/${projectId}/reports/calendar?month=${month}`,
      ),
    enabled: !!projectId && !!month,
  });
}

export function useReport(reportId: string | undefined) {
  return useQuery({
    queryKey: reportKeys.detail(reportId ?? ''),
    queryFn: () => apiFetch<ReportListItem>(`/reports/${reportId}`),
    enabled: !!reportId,
  });
}

export function useReportPhotos(reportId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: reportKeys.photos(reportId ?? ''),
    queryFn: () =>
      apiFetch<{ urls: string[] }>(`/reports/${reportId}/photos/urls`),
    enabled: !!reportId && enabled,
  });
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

export function useCreateReport(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDailyReportInput) =>
      apiFetch<ReportListItem>(`/projects/${projectId}/reports`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({
        queryKey: reportKeys.calendar(projectId, new Date().toISOString().slice(0, 7)),
      });
    },
  });
}

export function useUpdateReport(reportId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateDailyReportInput) =>
      apiFetch<ReportListItem>(`/reports/${reportId}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

/**
 * Upload a photo via the S3 pre-signed URL flow:
 * 1. Get presigned PUT URL from backend
 * 2. PUT the blob directly to S3
 * 3. Confirm upload with the returned key
 */
export function useUploadReportPhoto(reportId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (opts: { uri: string; filename: string; contentType: string }) => {
      // 1. Presign
      const { key, uploadUrl } = await apiFetch<{ key: string; uploadUrl: string }>(
        `/reports/${reportId}/photos`,
        {
          method: 'POST',
          body: JSON.stringify({ filename: opts.filename, contentType: opts.contentType }),
        },
      );

      // 2. Upload to S3
      const blob = await (await fetch(opts.uri)).blob();
      await fetch(uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': opts.contentType },
      });

      // 3. Confirm
      return apiFetch<{ photos: string[] }>(
        `/reports/${reportId}/photos/confirm`,
        { method: 'POST', body: JSON.stringify({ s3Keys: [key] }) },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Attendance / Geo-fence                                              */
/* ------------------------------------------------------------------ */

export interface AttendanceRecord {
  id: string;
  userId: string;
  projectId: string;
  checkInAt: string;
  checkOutAt: string | null;
  checkInLat: number;
  checkInLng: number;
  distanceFromSite: number;
  withinFence: boolean;
  notes: string | null;
  user: { id: string; name: string };
}

export function useAttendance(projectId: string, date?: string) {
  return useQuery({
    queryKey: reportKeys.attendance(projectId, date),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (date) params.set('date', date);
      return apiFetch<AttendanceRecord[]>(
        `/projects/${projectId}/attendance?${params.toString()}`,
      );
    },
    enabled: !!projectId,
  });
}

export function useCheckIn(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CheckInInput) =>
      apiFetch<AttendanceRecord>(`/projects/${projectId}/checkin`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance'] });
    },
  });
}

export function useCheckOut(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<AttendanceRecord>(`/projects/${projectId}/checkout`, {
        method: 'POST',
        body: '{}',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance'] });
    },
  });
}