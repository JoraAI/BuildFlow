/**
 * (auth) layout - unauthenticated screens (login, forgot password).
 */
import { Redirect, Stack } from 'expo-router';
import { View } from 'react-native';
import { useAuthStore } from '@/stores/auth.store';
import { MarketingAssistantFab } from '@/components/marketing/MarketingAssistantFab';
import { homeHrefForProduct, isProductMismatch } from '@/utils/product-home';

export default function AuthLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const productMode = useAuthStore((s) => s.user?.productMode);

  if (isAuthenticated) {
    // Wrong native product → root WrongProductScreen; else product home.
    return (
      <Redirect href={isProductMismatch(productMode) ? '/' : homeHrefForProduct(productMode)} />
    );
  }

  return (
    <View className="flex-1 relative">
      <Stack screenOptions={{ headerShown: false }} />
      <MarketingAssistantFab />
    </View>
  );
}