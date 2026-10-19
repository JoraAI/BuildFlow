/**
 * Inventory shell navigation — Home · Stock · Sales · Production · More
 * (matches Creamy Kulfi / ice-cream ops mockup). Secondary screens live under More.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tabBarPaddingBottom } from '@/components/layout/fab-layout';
import { useViewport } from '@/hooks/useViewport';
import { useVisualViewportFrame } from '@/hooks/useVisualViewportFrame';
import { useAuthStore } from '@/stores/auth.store';
import { useInventoryLanguage } from '@/components/inventory/InventoryLanguageProvider';

/** Pink accent from mockup CTAs */
export const INVENTORY_PINK = '#EC4899';
export const INVENTORY_PINK_SOFT = 'rgba(236, 72, 153, 0.12)';

export const INVENTORY_PRIMARY_TABS = [
  { key: 'home', label: 'Home', icon: 'home-outline' as const, href: '/inventory' },
  { key: 'stock', label: 'Stock', icon: 'cube-outline' as const, href: '/inventory/materials' },
  { key: 'sales', label: 'Sales', icon: 'receipt-outline' as const, href: '/inventory/sales' },
  {
    key: 'production',
    label: 'Production',
    icon: 'nutrition-outline' as const,
    href: '/inventory/production',
  },
  { key: 'more', label: 'More', icon: 'menu-outline' as const, href: '/inventory/more' },
] as const;

type InventoryTab = (typeof INVENTORY_PRIMARY_TABS)[number];

function visibleInventoryTabs(vertical?: string | null): InventoryTab[] {
  return INVENTORY_PRIMARY_TABS.filter((tab) => {
    if (tab.key === 'production') return vertical === 'ICE_CREAM';
    return true;
  }) as InventoryTab[];
}

function isActiveTab(tab: InventoryTab, pathname: string): boolean {
  if (tab.key === 'home') {
    return pathname === '/inventory' || pathname === '/inventory/';
  }
  if (tab.key === 'stock') {
    return (
      pathname.startsWith('/inventory/materials') ||
      pathname.startsWith('/inventory/stock/') ||
      pathname.startsWith('/inventory/on-hand')
    );
  }
  if (tab.key === 'more') {
    return (
      pathname.startsWith('/inventory/more') ||
      pathname.startsWith('/inventory/parties') ||
      pathname.startsWith('/inventory/quotes') ||
      pathname.startsWith('/inventory/warehouse') ||
      pathname.startsWith('/inventory/procurement') ||
      pathname.startsWith('/inventory/invoices') ||
      pathname.startsWith('/inventory/bills') ||
      pathname.startsWith('/inventory/reports') ||
      pathname.startsWith('/inventory/settings') ||
      pathname.startsWith('/inventory/cash') ||
      pathname.startsWith('/inventory/activity') ||
      pathname.startsWith('/inventory/backup')
    );
  }
  return pathname.startsWith(tab.href);
}

function translatedTabLabel(
  tab: InventoryTab,
  translate: (key: string, fallback?: string) => string,
): string {
  return translate(`inventory.tab.${tab.key}`, tab.label);
}

/** Bottom tab bar for inventory shell (mobile/tablet). */
export function InventoryMobileTabBar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { isWeb } = useViewport();
  const { chromeBottom } = useVisualViewportFrame();
  const { translate } = useInventoryLanguage();
  const vertical = useAuthStore((s) => s.user?.inventoryVertical);
  const tabs = visibleInventoryTabs(vertical);

  return (
    <View
      className="bg-card border-t border-border"
      style={{ paddingBottom: tabBarPaddingBottom(insets.bottom, isWeb, chromeBottom) }}
    >
      <View className="flex-row items-stretch px-1 pt-1.5">
        {tabs.map((tab) => {
          const isActive = isActiveTab(tab, pathname);
          const label = translatedTabLabel(tab, translate);
          const color = isActive ? INVENTORY_PINK : '#64748B';
          return (
            <Pressable
              key={tab.key}
              onPress={() => router.push(tab.href as never)}
              className="flex-1 items-center py-2 active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: isActive }}
            >
              <View
                className="w-10 h-7 items-center justify-center rounded-full mb-0.5"
                style={isActive ? { backgroundColor: INVENTORY_PINK_SOFT } : undefined}
              >
                <Ionicons name={tab.icon} size={22} color={color} />
              </View>
              <Text
                className={`text-[10px] font-semibold ${isActive ? '' : 'text-muted'}`}
                style={isActive ? { color: INVENTORY_PINK } : undefined}
                numberOfLines={1}
              >
                {label}
              </Text>
              {isActive ? (
                <View
                  className="w-1 h-1 rounded-full mt-0.5"
                  style={{ backgroundColor: INVENTORY_PINK }}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Vertical nav rail for inventory shell (desktop web). */
export function InventorySidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { translate } = useInventoryLanguage();
  const vertical = useAuthStore((s) => s.user?.inventoryVertical);
  const tabs = visibleInventoryTabs(vertical);

  return (
    <View className="w-56 bg-card border-r border-border py-4 px-3 gap-1">
      <Text className="text-xs font-bold text-muted uppercase px-3 pb-2">
        {translate('inventory.shell.store', 'Store')}
      </Text>
      {tabs.map((tab) => {
        const isActive = isActiveTab(tab, pathname);
        const label = translatedTabLabel(tab, translate);
        const color = isActive ? INVENTORY_PINK : '#64748B';
        return (
          <Pressable
            key={tab.key}
            onPress={() => router.push(tab.href as never)}
            className={`flex-row items-center px-3 py-2.5 rounded-xl ${
              isActive ? '' : 'active:bg-surface'
            }`}
            style={isActive ? { backgroundColor: INVENTORY_PINK_SOFT } : undefined}
          >
            <Ionicons name={tab.icon} size={18} color={color} />
            <Text
              className={`ml-3 text-sm font-semibold ${isActive ? '' : 'text-muted'}`}
              style={isActive ? { color: INVENTORY_PINK } : undefined}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
