import { Platform } from 'react-native';
import { API_BASE_URL, SECURE_STORE_KEYS } from '@/constants';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import { useAuthStore } from '@/stores/auth.store';

export type DownloadMimeType =
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  | 'application/pdf'
  | 'application/zip'
  | 'application/json';

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown[];
  constructor(code: string, message: string, status: number, details?: unknown[]) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: { page: number; limit: number; total: number; totalPages: number };
  error?: { code: string; message: string; details?: unknown[] };
}

let isRefreshing = false;
type QueueFn = (token: string | null) => void;
let failedQueue: QueueFn[] = [];
const processQueue = (token: string | null) => {
  failedQueue.forEach((cb) => cb(token));
  failedQueue = [];
};

/**
 * Auth endpoints that should NEVER trigger a token refresh cycle.
 * `/auth/me` is intentionally excluded — it's a protected endpoint that
 * must be retryable with a refreshed token (otherwise tab duplication /
 * page reload with an expired access token causes premature sign-out).
 * `/auth/accept-invite` also needs refresh for the same reason.
 */
const NO_REFRESH_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout', '/auth/register', '/auth/forgot', '/auth/reset'];
const shouldSkipRefresh = (path: string) => NO_REFRESH_PATHS.some((p) => path.includes(p));

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const accessToken = await SecureStore.getItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(
      'NETWORK_ERROR',
      'Unable to connect. Check your internet connection.',
      0,
    );
  }
  const body: ApiResponse<T> = await res.json().catch(() => ({ success: false, data: null as T }));

  if (res.status === 401 && !shouldSkipRefresh(path)) {
    // Try refresh once (also applies to /auth/me — otherwise tab duplication
    // with an expired access token causes a premature sign-out).
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const newToken = await refreshAccessToken();
        isRefreshing = false;
        processQueue(newToken);
        if (newToken) {
          headers.Authorization = `Bearer ${newToken}`;
          const retryRes = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
          const retryBody: ApiResponse<T> = await retryRes.json();
          if (!retryRes.ok || !retryBody.success) {
            throw new ApiError(retryBody.error?.code ?? 'ERROR', retryBody.error?.message ?? 'Request failed', retryRes.status, retryBody.error?.details);
          }
          return retryBody.data;
        }
      } catch {
        isRefreshing = false;
        await useAuthStore.getState().logout();
        throw new ApiError('SESSION_EXPIRED', 'Session expired. Please login again.', 401);
      }
    } else {
      return new Promise<T>((resolve, reject) => {
        failedQueue.push((token) => {
          if (!token) return reject(new ApiError('SESSION_EXPIRED', 'Session expired', 401));
          apiFetch<T>(path, { ...init, headers: { ...headers, Authorization: `Bearer ${token}` } })
            .then(resolve)
            .catch(reject);
        });
      });
    }
  }

  if (!res.ok || !body.success) {
    throw new ApiError(body.error?.code ?? 'ERROR', body.error?.message ?? 'Request failed', res.status, body.error?.details);
  }
  return body.data;
}

export interface ApiListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Paginated list fetch - returns data + meta (apiFetch strips meta). */
export async function apiFetchList<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ data: T[]; meta: ApiListMeta }> {
  const accessToken = await SecureStore.getItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  const body: ApiResponse<T[]> = await res.json().catch(() => ({
    success: false,
    data: [] as T[],
  }));

  if (!res.ok || !body.success) {
    throw new ApiError(
      body.error?.code ?? 'ERROR',
      body.error?.message ?? 'Request failed',
      res.status,
      body.error?.details,
    );
  }

  if (!body.meta) {
    throw new ApiError('INVALID_RESPONSE', 'Missing pagination metadata', res.status);
  }

  return { data: body.data, meta: body.meta };
}

async function fetchWithAuthRetry(path: string, init: RequestInit = {}): Promise<Response> {
  const accessToken = await SecureStore.getItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN);
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(
      'NETWORK_ERROR',
      'Unable to connect. Check your internet connection.',
      0,
    );
  }

  if (res.status === 401 && !shouldSkipRefresh(path)) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const newToken = await refreshAccessToken();
        isRefreshing = false;
        processQueue(newToken);
        if (newToken) {
          headers.Authorization = `Bearer ${newToken}`;
          return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
        }
        await useAuthStore.getState().logout();
        throw new ApiError('SESSION_EXPIRED', 'Session expired. Please login again.', 401);
      } catch {
        isRefreshing = false;
        await useAuthStore.getState().logout();
        throw new ApiError('SESSION_EXPIRED', 'Session expired. Please login again.', 401);
      }
    } else {
      return new Promise<Response>((resolve, reject) => {
        failedQueue.push((token) => {
          if (!token) {
            reject(new ApiError('SESSION_EXPIRED', 'Session expired', 401));
            return;
          }
          fetchWithAuthRetry(path, {
            ...init,
            headers: { ...headers, Authorization: `Bearer ${token}` },
          })
            .then(resolve)
            .catch(reject);
        });
      });
    }
  }

  return res;
}

async function parseDownloadError(res: Response): Promise<never> {
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = await res.json().catch(() => null);
    const message =
      body?.error?.message ?? body?.message ?? `Download failed (${res.status})`;
    throw new ApiError(body?.error?.code ?? 'DOWNLOAD_FAILED', message, res.status);
  }
  throw new ApiError('DOWNLOAD_FAILED', `Download failed (${res.status})`, res.status);
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

/**
 * Save a blob as a download (web) or to the app documents directory (native).
 * Returns the local file URI on native, or null on web after triggering the browser download.
 */
export async function saveDownloadBlob(blob: Blob, filename: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    triggerBrowserDownload(blob, filename);
    return null;
  }
  const base64 = await blobToBase64(blob);
  const fileUri = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return fileUri;
}

/** Download a JSON object as a `.json` file. */
export async function downloadJsonObject(data: unknown, filename: string): Promise<string | null> {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  return saveDownloadBlob(blob, filename);
}

/**
 * Download a binary file from the API and save it locally or trigger a browser download.
 * Returns the local file URI on native, or null on web.
 */
export async function apiDownload(
  path: string,
  filename: string,
  _mimeType: DownloadMimeType,
): Promise<string | null> {
  const res = await fetchWithAuthRetry(path);
  if (!res.ok) {
    await parseDownloadError(res);
  }
  const blob = await res.blob();
  return saveDownloadBlob(blob, filename);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // strip "data:application/...;base64,"
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN);
  if (!refreshToken) return null;
  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return null;
  const body = await res.json();
  if (!body.success) return null;
  await SecureStore.setItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN, body.data.accessToken);
  return body.data.accessToken;
}
