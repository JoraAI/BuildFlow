/**
 * Inventory shell layout (INVENTORY_PRODUCT).
 *
 * Inventory tenants land here instead of the construction app shell. The shell
 * exposes Stock | Procurement | Invoices | Bills | Settings - no construction
 * "Projects" navigator. Construction users are redirected to /dashboard.
 */
import React from 'react';
import { Redirect, Stack, usePathname } from 'expo-router';
import { View, Text, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/auth.store';
import { useViewport } from '@/hooks/useViewport';
import { InventorySidebar, InventoryMobileTabBar } from '@/components/navigation/InventoryTabBar';
import { CompanyLogo } from '@/components/ui/Avatar';
import { AssistantFab } from '@/components/navigation/AssistantFab';
import { AssistantOverlay } from '@/components/assistant/AssistantOverlay';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { InventoryLanguageProvider, useInventoryLanguage } from '@/components/inventory/InventoryLanguageProvider';
// INVENTORY_HORIZONTAL_PLATFORM (Phase 8.5): in-app notification bell.
import { useRouter } from 'expo-router';
import { useUnreadCount } from '@/services/chat.queries';

export default function InventoryLayout() {
  return (
    <InventoryLanguageProvider>
      <InventoryLayoutBody />
    </InventoryLanguageProvider>
  );
}

function InventoryLayoutBody() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { isDesktop } = useViewport();
  const pathname = usePathname();
  const router = useRouter();
  const { translate } = useInventoryLanguage();
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 8.5): unread badge on the bell.
  const { data: unreadCount } = useUnreadCount();

  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!user) return null;

  // INVENTORY_PRODUCT: only inventory tenants see the shell.
  if (user.productMode !== 'inventory') {
    return <Redirect href="/dashboard" />;
  }

  // Detail routes (invoices/[id], bills/[id]) render their own back-header -
  // hide the shell top bar so headers don't double-pad. Bottom nav stays.
  // Reports (/inventory/reports) renders its own back-header too.
  const isDetailRoute =
    pathname.startsWith('/inventory/invoices/') ||
    pathname.startsWith('/inventory/bills/') ||
    pathname.startsWith('/inventory/stock/') ||
    pathname === '/inventory/reports';

  return (
    <View className="flex-1 bg-surface min-h-0">
      <OfflineBanner />
      <View className="flex-1 flex-row min-h-0">
        {isDesktop && <InventorySidebar />}

        <View className="flex-1 flex-col min-w-0 min-h-0">
          {/* Top bar (hidden on detail routes which render their own header) */}
          {!isDetailRoute ? (
            <View
              className="bg-card border-b border-border px-6 flex-row items-center gap-3 shrink-0"
              style={{
                zIndex: 100,
                elevation: 8,
                paddingTop: Platform.OS !== 'web' ? insets.top : 0,
                minHeight: 56 + (Platform.OS !== 'web' ? insets.top : 0),
              }}
            >
              <View className="flex-row items-center gap-2 shrink-0">
                <View className="w-8 h-8 rounded-lg bg-primary items-center justify-center">
                  <Text className="text-accent font-bold text-sm">BF</Text>
                </View>
                <Text className="text-sm font-bold text-text">
                  {translate('inventory.shell.title', 'BuildFlow · Inventory')}
                </Text>
              </View>
              <View className="flex-1" />
              <Pressable
                onPress={() => router.push('/inventory/notifications')}
                className="relative p-2 rounded-lg border border-border bg-surface items-center justify-center"
              >
                <Text className="text-lg text-text">🔔</Text>
                {Number(unreadCount ?? 0) > 0 ? (
                  <View className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-danger items-center justify-center px-1">
                    <Text className="text-[10px] font-bold text-white">{unreadCount}</Text>
                  </View>
                ) : null}
              </Pressable>
              <View className="flex-row items-center bg-surface rounded-lg px-3 py-1.5 border border-border gap-2 max-w-[220px]">
                <CompanyLogo name={user.companyName} logoUrl={user.companyLogoUrl} size={26} />
                <Text className="text-sm font-semibold text-text" numberOfLines={1}>
                  {user.companyName}
                </Text>
              </View>
            </View>
          ) : null}

          <View className="flex-1 min-h-0">
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="stock/[resourceId]" />
              <Stack.Screen name="materials" />
              <Stack.Screen name="parties" />
              <Stack.Screen name="sales" />
              <Stack.Screen name="warehouse" />
              <Stack.Screen name="procurement" />
              <Stack.Screen name="invoices/index" />
              <Stack.Screen name="invoices/[id]" />
              <Stack.Screen name="bills/index" />
              <Stack.Screen name="bills/[id]" />
              <Stack.Screen name="reports" />
              <Stack.Screen name="notifications" />
              <Stack.Screen name="settings" />
            </Stack>
          </View>

          {!isDesktop && <InventoryMobileTabBar />}
          <AssistantFab />
          <AssistantOverlay />
        </View>
      </View>
    </View>
  );
}
