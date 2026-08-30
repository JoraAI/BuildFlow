/**
 * BuildFlow Inventory shell - navigation.
 *
 * INVENTORY_PRODUCT: inventory tenants get a dedicated shell with
 * Stock | Procurement | Invoices | Bills | Settings. No construction
 * sidebar / "Projects" concept for end users.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tabBarPaddingBottom } from '@/components/layout/fab-layout';
import { useViewport } from '@/hooks/useViewport';
import { useVisualViewportFrame } from '@/hooks/useVisualViewportFrame';
import { useAuthStore } from '@/stores/auth.store';
import { getInventoryLabel, getInventoryLabelMode } from '@buildflow/shared';
import { useInventoryLanguage } from '@/components/inventory/InventoryLanguageProvider';

export const INVENTORY_TABS = [
  { key: 'index', label: 'Stock', icon: 'cube-outline', href: '/inventory' },
  { key: 'materials', label: 'Materials', icon: 'layers-outline', href: '/inventory/materials' },
  { key: 'parties', label: 'Parties', icon: 'people-outline', href: '/inventory/parties' },
  // Event & client estimates / quotations.
  { key: 'quotes', label: 'Quotes', icon: 'document-text-outline', href: '/inventory/quotes' },
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 2.1): formal sales flow (SO/DC/returns/notes).
  { key: 'sales', label: 'Sales', icon: 'receipt-outline', href: '/inventory/sales' },
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 3): multi-warehouse / transfers / counts.
  { key: 'warehouse', label: 'Warehouse', icon: 'business-outline', href: '/inventory/warehouse' },
  { key: 'procurement', label: 'Procurement', icon: 'cart-outline', href: '/inventory/procurement' },
  { key: 'invoices', label: 'Invoices', icon: 'cash-outline', href: '/inventory/invoices' },
  { key: 'bills', label: 'Bills', icon: 'newspaper-outline', href: '/inventory/bills' },
  { key: 'settings', label: 'Settings', icon: 'settings-outline', href: '/inventory/settings' },
] as const;

type InventoryTab = (typeof INVENTORY_TABS)[number];

function isActiveTab(tab: InventoryTab, pathname: string): boolean {
  if (tab.key === 'index') {
    return (
      pathname === '/inventory' ||
      pathname === '/inventory/' ||
      pathname.startsWith('/inventory/stock/')
    );
  }
  return pathname.startsWith(tab.href);
}

/**
 * INVENTORY_HORIZONTAL_PLATFORM (Phase 0): item label for the nav, e.g.
 * "Items" (generic) vs "Materials" (MATERIAL_SUPPLIER keeps construction wording).
 */
function useItemsLabel(): string {
  const user = useAuthStore((s) => s.user);
  return getInventoryLabel('item_plural', getInventoryLabelMode(user?.inventoryProfile ?? null));
}

function translatedItemsLabel(
  itemsLabel: string,
  translate: (key: string, fallback?: string) => string,
): string {
  if (itemsLabel === 'Materials') return translate('inventory.materials', 'Materials');
  if (itemsLabel === 'Items') return translate('inventory.items', 'Items');
  return itemsLabel;
}

function translatedTabLabel(
  tab: InventoryTab,
  itemsLabel: string,
  translate: (key: string, fallback?: string) => string,
): string {
  if (tab.key === 'materials') return translatedItemsLabel(itemsLabel, translate);
  if (tab.key === 'index') return translate('inventory.tab.stock', tab.label);
  return translate(`inventory.tab.${tab.key}`, tab.label);
}

/** Bottom tab bar for inventory shell (mobile/tablet). */
export function InventoryMobileTabBar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { isPhone, isWeb } = useViewport();
  const { chromeBottom } = useVisualViewportFrame();
  const itemsLabel = useItemsLabel();
  const { translate } = useInventoryLanguage();

  const renderTab = (tab: InventoryTab, widthClass: string) => {
    const isActive = isActiveTab(tab, pathname);
    const label = translatedTabLabel(tab, itemsLabel, translate);
    return (
      <Pressable
        key={tab.key}
        onPress={() => router.push(tab.href as never)}
        className={`${widthClass} items-center py-2 active:opacity-70`}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: isActive }}
      >
        <View
          className={`w-10 h-7 items-center justify-center rounded-full mb-0.5 ${
            isActive ? 'bg-primary/10' : ''
          }`}
        >
          <Ionicons name={tab.icon} size={22} color={isActive ? '#1E3A5F' : '#64748B'} />
        </View>
        <Text
          className={`text-[10px] font-semibold ${
            isActive ? 'text-primary' : 'text-muted'
          }`}
          numberOfLines={1}
        >
          {label}
        </Text>
        {isActive && <View className="w-1 h-1 rounded-full bg-accent mt-0.5" />}
      </Pressable>
    );
  };

  return (
    <View
      className="bg-card border-t border-border"
      style={{ paddingBottom: tabBarPaddingBottom(insets.bottom, isWeb, chromeBottom) }}
    >
      {isPhone ? (
        // INVENTORY_UX_POLISH (§1.4.1): horizontal scroll so all 9 tabs stay
        // reachable on narrow phones instead of clipping.
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 4, paddingTop: 6 }}
        >
          {INVENTORY_TABS.map((tab) => renderTab(tab, 'w-[76px] shrink-0'))}
        </ScrollView>
      ) : (
        <View className="flex-row items-stretch px-1 pt-1.5">
          {INVENTORY_TABS.map((tab) => renderTab(tab, 'flex-1'))}
        </View>
      )}
    </View>
  );
}

/** Vertical nav rail for inventory shell (desktop web). */
export function InventorySidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const itemsLabel = useItemsLabel();
  const { translate } = useInventoryLanguage();

  return (
    <View className="w-56 bg-card border-r border-border py-4 px-3 gap-1">
      <Text className="text-xs font-bold text-muted uppercase px-3 pb-2">
        {translate('inventory.shell.store', 'Store')}
      </Text>
      {INVENTORY_TABS.map((tab) => {
        const isActive = isActiveTab(tab, pathname);
        const label = translatedTabLabel(tab, itemsLabel, translate);
        return (
          <Pressable
            key={tab.key}
            onPress={() => router.push(tab.href as never)}
            className={`flex-row items-center px-3 py-2.5 rounded-xl ${
              isActive ? 'bg-primary/10' : 'active:bg-surface'
            }`}
          >
            <Ionicons name={tab.icon} size={18} color={isActive ? '#1E3A5F' : '#64748B'} />
            <Text
              className={`ml-3 text-sm font-semibold ${
                isActive ? 'text-primary' : 'text-muted'
              }`}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
