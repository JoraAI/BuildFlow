import { apiFetch } from '@/lib/api-client';
import type { RegisterCompanyInput } from '@buildflow/shared';

export interface AuthConfig {
  allowPublicCompanyRegistration: boolean;
}

export interface InvitePreview {
  email: string | null;
  phone: string | null;
  role: string;
  companyName: string;
  expiresAt: string;
  inviteChannel: 'email' | 'phone';
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
  otp: string;
}

export interface OtpSendResult {
  sent: true;
  expiresInSec: number;
  destinationMasked?: string;
  phoneMasked: string;
  channel?: 'sms' | 'email';
  devCode?: string;
}

export interface AuthResponsePayload {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    companyId: string;
    companyName: string;
    productMode?: 'inventory' | 'construction';
    defaultProjectId?: string | null;
    subscriptionPlan?: string;
    inventoryProfile?: string | null;
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

export function sendInviteOtpRequest(token: string) {
  return apiFetch<OtpSendResult>('/auth/invite/send-otp', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export function sendLoginOtpRequest(emailOrPhone: string) {
  return apiFetch<OtpSendResult>('/auth/login/send-otp', {
    method: 'POST',
    body: JSON.stringify({ email: emailOrPhone }),
  });
}
