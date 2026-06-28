/**
 * Root entry redirect - Expo Router has no implicit `/` route when all
 * screens live inside route groups. This lightweight redirect sends the
 * user to `/dashboard` when authenticated, or `/login` otherwise.
 */
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/auth.store';

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return <Redirect href={isAuthenticated ? '/dashboard' : '/(public)'} />;
}