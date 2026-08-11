/**
 * Root entry redirect - Expo Router has no implicit `/` route when all
 * screens live inside route groups. This lightweight redirect sends the
 * user to `/dashboard` (construction) or `/inventory` (INVENTORY product)
 * when authenticated, or `/login` otherwise.
 */
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/auth.store';

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const home = user?.productMode === 'inventory' ? '/inventory' : '/dashboard';
  return <Redirect href={isAuthenticated ? home : '/(public)'} />;
}