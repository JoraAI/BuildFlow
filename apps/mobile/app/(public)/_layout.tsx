/**
 * Public marketing layout - no auth required.
 */
import { Redirect, Stack } from 'expo-router';
import { View } from 'react-native';
import { useAuthStore } from '@/stores/auth.store';
import { MarketingAssistantFab } from '@/components/marketing/MarketingAssistantFab';

export default function PublicLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (isAuthenticated) {
    return <Redirect href="/dashboard" />;
  }

  return (
    <View className="flex-1">
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="pricing" />
        <Stack.Screen name="about" />
      </Stack>
      <MarketingAssistantFab />
    </View>
  );
}
