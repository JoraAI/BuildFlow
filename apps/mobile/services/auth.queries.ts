import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { AuthUser } from '@/stores/auth.store';
import { STALE_TIMES } from '@/constants';

export function useCurrentUser() {
  return useQuery<AuthUser>({
    queryKey: ['auth', 'me'],
    queryFn: () => apiFetch<AuthUser>('/auth/me'),
    staleTime: STALE_TIMES.USER_PROFILE,
    retry: 1,
  });
}
