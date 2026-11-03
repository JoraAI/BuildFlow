/**
 * Root entry redirect - Expo Router has no implicit `/` route when all
 * screens live inside route groups. Web: construction → `/dashboard`,
 * inventory → `/inventory`. Native locked variants refuse the wrong product.
 */
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/auth.store';
import { WrongProductScreen } from '@/components/auth/WrongProductScreen';
import { homeHrefForProduct, isProductMismatch } from '@/utils/product-home';

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  if (!isAuthenticated) {
    return <Redirect href="/(public)" />;
  }

  if (isProductMismatch(user?.productMode)) {
    return <WrongProductScreen />;
  }

  return <Redirect href={homeHrefForProduct(user?.productMode)} />;
}
