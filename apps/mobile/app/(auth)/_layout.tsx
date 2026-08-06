/**
 * (auth) layout - unauthenticated screens (login, forgot password).
 */
import { Redirect, Stack } from 'expo-router';
import { View } from 'react-native';
import { useAuthStore } from '@/stores/auth.store';
import { MarketingAssistantFab } from '@/components/marketing/MarketingAssistantFab';

export default function AuthLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (isAuthenticated) {
    return <Redirect href="/dashboard" />;
  }

  return (
    <View className="flex-1">
      <Stack screenOptions={{ headerShown: false }} />
      <MarketingAssistantFab />
    </View>
  );
}