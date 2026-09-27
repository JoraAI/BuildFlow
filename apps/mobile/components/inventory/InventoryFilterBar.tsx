/**
 * Sticky search + optional status chips for inventory list screens.
 * Phone: search full-width, chips on second row (scroll).
 * Desktop: search + chips on one row.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Input, Button } from '@/components/ui';
import { useViewport } from '@/hooks/useViewport';
import { SegmentedTabs, SegmentedTabsInline, type SegmentedTab } from '@/components/inventory/SegmentedTabs';

export function InventoryFilterBar<S extends string>({
  query,
  onQueryChange,
  placeholder,
  statusTabs,
  status,
  onStatusChange,
  rightSlot,
  resultCount,
  onClear,
  isFiltered,
}: {
  query: string;
  onQueryChange: (next: string) => void;
  placeholder: string;
  statusTabs?: readonly SegmentedTab<S>[];
  status?: S;
  onStatusChange?: (next: S) => void;
  rightSlot?: React.ReactNode;
  resultCount?: { shown: number; total: number };
  onClear?: () => void;
  isFiltered?: boolean;
}) {
  const { isPhone } = useViewport();
  const showStatus = Boolean(statusTabs?.length && status != null && onStatusChange);

  const searchRow = (
    <View className="flex-row items-center gap-2">
      <View className="flex-1 min-w-0">
        <Input
          label=""
          compact
          fullWidth
          value={query}
          onChangeText={onQueryChange}
          placeholder={placeholder}
          autoCapitalize="none"
          accessibilityLabel={placeholder}
        />
      </View>
      {rightSlot}
      {isFiltered && onClear && !isPhone ? (
        <Button label="Clear" variant="ghost" size="sm" onPress={onClear} />
      ) : null}
    </View>
  );

  const statusRow =
    showStatus && statusTabs && status != null && onStatusChange ? (
      isPhone ? (
        <SegmentedTabs
          tabs={statusTabs}
          value={status}
          onChange={onStatusChange}
          className=""
          contentContainerClassName="gap-2 pr-1"
        />
      ) : (
        <SegmentedTabsInline tabs={statusTabs} value={status} onChange={onStatusChange} className="gap-2" />
      )
    ) : null;

  return (
    <View className="px-4 pb-2 shrink-0 gap-2">
      {isPhone ? (
        <>
          {searchRow}
          {statusRow}
        </>
      ) : (
        <View className="flex-row flex-wrap items-center gap-3">
          <View className="flex-1 min-w-[220px]">{searchRow}</View>
          {statusRow}
        </View>
      )}
      <View className="flex-row items-center justify-between gap-2">
        {resultCount ? (
          <Text className="text-[11px] text-muted">
            Showing {resultCount.shown} of {resultCount.total}
          </Text>
        ) : (
          <View />
        )}
        {isFiltered && onClear && isPhone ? (
          <Pressable onPress={onClear} accessibilityRole="button">
            <Text className="text-xs font-bold text-primary">Clear filters</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
