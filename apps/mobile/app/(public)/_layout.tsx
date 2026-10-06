/**
 * Public marketing layout - no auth required.
 * Privacy / Terms stay public even when logged in (Twilio & store compliance).
 */
import { Redirect, Stack, usePathname } from 'expo-router';
import { View } from 'react-native';
import { useAuthStore } from '@/stores/auth.store';
import { MarketingAssistantFab } from '@/components/marketing/MarketingAssistantFab';

export default function PublicLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const pathname = usePathname();
  const isLegalPage = pathname === '/privacy' || pathname === '/terms';

  if (isAuthenticated && !isLegalPage) {
    return <Redirect href="/dashboard" />;
  }

  return (
    <View className="flex-1 relative">
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="pricing" />
        <Stack.Screen name="about" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="terms" />
      </Stack>
      {!isLegalPage ? <MarketingAssistantFab /> : null}
    </View>
  );
}
