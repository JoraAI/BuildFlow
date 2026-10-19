/**
 * Inventory shell navigation.
 *
 * Mobile (<1024): bottom tabs Home · Stock · Sales · Production · More
 * Desktop (≥1024): sidebar lists primary + secondary sections (no More hub)
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tabBarPaddingBottom } from '@/components/layout/fab-layout';
import { useViewport } from '@/hooks/useViewport';
import { useVisualViewportFrame } from '@/hooks/useVisualViewportFrame';
import { useAuthStore } from '@/stores/auth.store';
import { useInventoryLanguage } from '@/components/inventory/InventoryLanguageProvider';

/** Brand navy — matches theme `primary` (#1E3A5F). */
export const INVENTORY_ACCENT = '#1E3A5F';
export const INVENTORY_ACCENT_SOFT = 'rgba(30, 58, 95, 0.12)';

/** @deprecated Use INVENTORY_ACCENT — kept so older imports keep compiling. */
export const INVENTORY_PINK = INVENTORY_ACCENT;
/** @deprecated Use INVENTORY_ACCENT_SOFT */
export const INVENTORY_PINK_SOFT = INVENTORY_ACCENT_SOFT;

type NavIcon = keyof typeof Ionicons.glyphMap;

export type InventoryNavItem = {
  key: string;
  label: string;
  icon: NavIcon;
  href: string;
};

/** Primary destinations shared by mobile tabs + desktop sidebar. */
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

/** Secondary destinations — mobile More hub + desktop sidebar (no More entry). */
export const INVENTORY_SECONDARY_NAV: readonly InventoryNavItem[] = [
  { key: 'parties', label: 'Parties', icon: 'people-outline', href: '/inventory/parties' },
  { key: 'cash', label: 'Cash book', icon: 'wallet-outline', href: '/inventory/cash' },
  { key: 'onhand', label: 'On-hand stock', icon: 'layers-outline', href: '/inventory/on-hand' },
  { key: 'procurement', label: 'Purchases', icon: 'bag-outline', href: '/inventory/procurement' },
  { key: 'invoices', label: 'Invoices', icon: 'document-text-outline', href: '/inventory/invoices' },
  { key: 'bills', label: 'Bills', icon: 'newspaper-outline', href: '/inventory/bills' },
  { key: 'quotes', label: 'Quotes', icon: 'create-outline', href: '/inventory/quotes' },
  { key: 'warehouse', label: 'Warehouse', icon: 'business-outline', href: '/inventory/warehouse' },
  { key: 'reports', label: 'Reports', icon: 'bar-chart-outline', href: '/inventory/reports' },
  { key: 'activity', label: 'Activity', icon: 'time-outline', href: '/inventory/activity' },
  { key: 'backup', label: 'Backup', icon: 'cloud-upload-outline', href: '/inventory/backup' },
  { key: 'settings', label: 'Settings', icon: 'settings-outline', href: '/inventory/settings' },
] as const;

type InventoryTab = (typeof INVENTORY_PRIMARY_TABS)[number];

function visiblePrimaryTabs(vertical?: string | null, opts?: { includeMore?: boolean }): InventoryTab[] {
  const includeMore = opts?.includeMore ?? true;
  return INVENTORY_PRIMARY_TABS.filter((tab) => {
    if (tab.key === 'production') return vertical === 'ICE_CREAM';
    if (tab.key === 'more') return includeMore;
    return true;
  }) as InventoryTab[];
}

function isPathActive(
  href: string,
  pathname: string,
  key?: string,
  opts?: { onHandAsStock?: boolean },
): boolean {
  if (key === 'home' || href === '/inventory') {
    return pathname === '/inventory' || pathname === '/inventory/';
  }
  if (key === 'stock' || href === '/inventory/materials') {
    if (pathname.startsWith('/inventory/materials') || pathname.startsWith('/inventory/stock/')) {
      return true;
    }
    // Mobile tabs: on-hand is under Stock. Desktop sidebar has its own On-hand row.
    return Boolean(opts?.onHandAsStock && pathname.startsWith('/inventory/on-hand'));
  }
  if (key === 'more' || href === '/inventory/more') {
    if (pathname.startsWith('/inventory/more')) return true;
    // on-hand highlights Stock on mobile, not More
    if (pathname.startsWith('/inventory/on-hand')) return false;
    return INVENTORY_SECONDARY_NAV.some(
      (item) =>
        item.key !== 'onhand' &&
        (pathname === item.href || pathname.startsWith(`${item.href}/`)),
    );
  }
  if (key === 'onhand' || href === '/inventory/on-hand') {
    return pathname.startsWith('/inventory/on-hand');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function translatedTabLabel(
  tab: InventoryTab,
  translate: (key: string, fallback?: string) => string,
): string {
  return translate(`inventory.tab.${tab.key}`, tab.label);
}

/** Bottom tab bar for inventory shell (phone + tablet). */
export function InventoryMobileTabBar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { isWeb } = useViewport();
  const { chromeBottom } = useVisualViewportFrame();
  const { translate } = useInventoryLanguage();
  const vertical = useAuthStore((s) => s.user?.inventoryVertical);
  const tabs = visiblePrimaryTabs(vertical, { includeMore: true });

  return (
    <View
      className="bg-card border-t border-border"
      style={{ paddingBottom: tabBarPaddingBottom(insets.bottom, isWeb, chromeBottom) }}
    >
      <View className="flex-row items-stretch px-1 pt-1.5">
        {tabs.map((tab) => {
          const isActive = isPathActive(tab.href, pathname, tab.key, { onHandAsStock: true });
          const label = translatedTabLabel(tab, translate);
          const color = isActive ? INVENTORY_ACCENT : '#64748B';
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
                style={isActive ? { backgroundColor: INVENTORY_ACCENT_SOFT } : undefined}
              >
                <Ionicons name={tab.icon} size={22} color={color} />
              </View>
              <Text
                className={`text-[10px] font-semibold ${isActive ? '' : 'text-muted'}`}
                style={isActive ? { color: INVENTORY_ACCENT } : undefined}
                numberOfLines={1}
              >
                {label}
              </Text>
              {isActive ? (
                <View
                  className="w-1 h-1 rounded-full mt-0.5"
                  style={{ backgroundColor: INVENTORY_ACCENT }}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SidebarLink({
  item,
  pathname,
  onPress,
}: {
  item: InventoryNavItem;
  pathname: string;
  onPress: () => void;
}) {
  const isActive = isPathActive(item.href, pathname, item.key);
  const color = isActive ? INVENTORY_ACCENT : '#64748B';
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center px-3 py-2.5 rounded-xl ${isActive ? '' : 'active:bg-surface'}`}
      style={isActive ? { backgroundColor: INVENTORY_ACCENT_SOFT } : undefined}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
    >
      <Ionicons name={item.icon} size={18} color={color} />
      <Text
        className={`ml-3 text-sm font-semibold flex-1 ${isActive ? '' : 'text-muted'}`}
        style={isActive ? { color: INVENTORY_ACCENT } : undefined}
        numberOfLines={1}
      >
        {item.label}
      </Text>
    </Pressable>
  );
}

/** Vertical nav rail for inventory shell (desktop). Lists sections — no More hub. */
export function InventorySidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { translate } = useInventoryLanguage();
  const vertical = useAuthStore((s) => s.user?.inventoryVertical);
  const primary = visiblePrimaryTabs(vertical, { includeMore: false });

  return (
    <View className="w-60 bg-card border-r border-border py-4 px-3">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <Text className="text-xs font-bold text-muted uppercase px-3 pb-2">
          {translate('inventory.shell.store', 'Store')}
        </Text>
        {primary.map((tab) => (
          <SidebarLink
            key={tab.key}
            item={{ key: tab.key, label: translatedTabLabel(tab, translate), icon: tab.icon, href: tab.href }}
            pathname={pathname}
            onPress={() => router.push(tab.href as never)}
          />
        ))}

        <Text className="text-xs font-bold text-muted uppercase px-3 pt-4 pb-2">
          {translate('inventory.shell.operations', 'Operations')}
        </Text>
        {INVENTORY_SECONDARY_NAV.filter((item) =>
          ['parties', 'cash', 'onhand', 'procurement', 'invoices', 'bills', 'quotes', 'warehouse'].includes(
            item.key,
          ),
        ).map((item) => (
          <SidebarLink
            key={item.key}
            item={item}
            pathname={pathname}
            onPress={() => router.push(item.href as never)}
          />
        ))}

        <Text className="text-xs font-bold text-muted uppercase px-3 pt-4 pb-2">
          {translate('inventory.shell.admin', 'Admin')}
        </Text>
        {INVENTORY_SECONDARY_NAV.filter((item) =>
          ['reports', 'activity', 'backup', 'settings'].includes(item.key),
        ).map((item) => (
          <SidebarLink
            key={item.key}
            item={item}
            pathname={pathname}
            onPress={() => router.push(item.href as never)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
