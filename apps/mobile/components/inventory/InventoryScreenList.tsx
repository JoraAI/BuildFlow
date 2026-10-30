/**
 * Inventory list shell: on phone, page chrome (title, tabs, filters) scrolls
 * with the rows so the screen is one vertical scroll. The bottom nav lives in
 * the inventory layout, outside this list. On tablet/desktop chrome stays
 * sticky above the list.
 */
import React from 'react';
import { FlatList, type FlatListProps, View, type StyleProp, type ViewStyle } from 'react-native';
import { useViewport } from '@/hooks/useViewport';
import { ASSISTANT_FAB_HEIGHT, FAB_GAP } from '@/components/layout/fab-layout';

/** Extra list padding. Inventory tab bar is in the shell flex flow, not overlaid. */
export function inventoryPageListPadding(hasScreenFab = false): number {
  return 28 + (hasScreenFab ? ASSISTANT_FAB_HEIGHT + FAB_GAP : 0);
}

export function useInventoryUnifiedScroll(): boolean {
  const { isPhone } = useViewport();
  return isPhone;
}

/** Render chrome in the scrolling header (phone) or sticky above the list (wide). */
export function InventoryScrollChrome({
  children,
  slot,
}: {
  children: React.ReactNode;
  slot: 'sticky' | 'scroll';
}) {
  const unify = useInventoryUnifiedScroll();
  if (slot === 'scroll') return unify ? <>{children}</> : null;
  return unify ? null : <>{children}</>;
}

type Props<T> = Omit<FlatListProps<T>, 'ListHeaderComponent'> & {
  chrome: React.ReactNode;
  listHeader?: React.ReactNode;
  hasScreenFab?: boolean;
  listRef?: React.Ref<FlatList<T>>;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export function InventoryScreenList<T>({
  chrome,
  listHeader,
  hasScreenFab = false,
  listRef,
  contentContainerStyle,
  style,
  className,
  ...rest
}: Props<T>) {
  const unify = useInventoryUnifiedScroll();
  const pad = unify ? inventoryPageListPadding(hasScreenFab) : 24;

  return (
    <View className="flex-1 min-h-0">
      {!unify ? chrome : null}
      <FlatList
        ref={listRef}
        {...rest}
        className={className ?? 'flex-1'}
        style={[{ flex: 1, minHeight: 0 }, style]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        nestedScrollEnabled
        ListHeaderComponent={
          <View>
            {unify ? <View className="-mx-4">{chrome}</View> : null}
            {listHeader}
          </View>
        }
        contentContainerStyle={[
          { paddingBottom: pad, flexGrow: 1, paddingHorizontal: 16 },
          contentContainerStyle,
        ]}
      />
    </View>
  );
}
