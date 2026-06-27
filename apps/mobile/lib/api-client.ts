import { API_BASE_URL, SECURE_STORE_KEYS } from '@/constants';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import { useAuthStore } from '@/stores/auth.store';

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

  if (res.status === 401 && !path.includes('/auth/')) {
    // Try refresh once
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

/**
 * Download a binary file (Excel/PDF) from the API and save+share it.
 * Returns the local file URI.
 */
export async function apiDownload(
  path: string,
  filename: string,
  mimeType:
    | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    | 'application/pdf'
    | 'application/zip',
): Promise<string> {
  const accessToken = await SecureStore.getItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN);
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!res.ok) {
    throw new ApiError('DOWNLOAD_FAILED', `Download failed (${res.status})`, res.status);
  }
  const blob = await res.blob();
  const base64 = await blobToBase64(blob);
  const fileUri = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
  return fileUri;
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
