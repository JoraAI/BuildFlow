import { apiFetch } from '@/lib/api-client';
import type { RegisterCompanyInput } from '@buildflow/shared';

export interface AuthConfig {
  allowPublicCompanyRegistration: boolean;
}

export interface InvitePreview {
  email: string;
  role: string;
  companyName: string;
  expiresAt: string;
}

export function fetchAuthConfig() {
  return apiFetch<AuthConfig>('/auth/config');
}

export function fetchInvitePreview(token: string) {
  return apiFetch<InvitePreview>(`/auth/invite/${encodeURIComponent(token)}`);
}

export type { RegisterCompanyInput };

export interface AcceptInvitePayload {
  token: string;
  name: string;
  password: string;
}

export interface AuthResponsePayload {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    companyId: string;
    companyName: string;
  };
  accessToken: string;
  refreshToken: string;
}

export function registerCompanyRequest(body: RegisterCompanyInput) {
  return apiFetch<AuthResponsePayload>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function acceptInviteRequest(body: AcceptInvitePayload) {
  return apiFetch<AuthResponsePayload>('/auth/accept-invite', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
