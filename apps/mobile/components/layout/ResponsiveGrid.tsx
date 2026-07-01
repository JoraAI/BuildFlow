import React from 'react';
import {
  View,
  ScrollView,
  FlatList,
  type ListRenderItem,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useViewport } from '@/hooks/useViewport';

const DEFAULT_GAP = 16;

function useGridLayout(gap = DEFAULT_GAP, columnsOverride?: number) {
  const { gridColumns } = useViewport();
  const columns = columnsOverride ?? gridColumns;
  const itemWidthPct = 100 / columns;

  return {
    columns,
    gap,
    itemWidthPct,
    containerStyle: { marginHorizontal: -gap / 2 } as ViewStyle,
    itemStyle: {
      width: `${itemWidthPct}%` as `${number}%`,
      paddingHorizontal: gap / 2,
      paddingBottom: gap,
    } as ViewStyle,
  };
}

interface ResponsiveGridProps {
  children: React.ReactNode;
  gap?: number;
  columns?: number;
  className?: string;
}

/** Flex-wrap grid with fixed column widths - last row items stay column-width, left-aligned. */
export function ResponsiveGrid({ children, gap = DEFAULT_GAP, columns, className = '' }: ResponsiveGridProps) {
  const { containerStyle, itemStyle } = useGridLayout(gap, columns);
  const items = React.Children.toArray(children);

  return (
    <View className={`flex-row flex-wrap ${className}`} style={containerStyle}>
      {items.map((child, i) => (
        <View key={i} style={itemStyle}>
          {child}
        </View>
      ))}
    </View>
  );
}

interface ResponsiveGridListProps<T> {
  data: T[];
  renderItem: ListRenderItem<T>;
  keyExtractor: (item: T, index: number) => string;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  ListEmptyComponent?: React.ReactElement | null;
  contentContainerClassName?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
  gap?: number;
  columns?: number;
  /** Use FlatList on mobile for virtualized scrolling (default true). */
  virtualizeMobile?: boolean;
}

export function ResponsiveGridList<T>({
  data,
  renderItem,
  keyExtractor,
  refreshControl,
  ListEmptyComponent,
  contentContainerClassName = '',
  contentContainerStyle,
  gap = DEFAULT_GAP,
  columns,
  virtualizeMobile = true,
}: ResponsiveGridListProps<T>) {
  const { isDesktop } = useViewport();
  const { containerStyle, itemStyle } = useGridLayout(gap, columns);

  if (!isDesktop) {
    if (virtualizeMobile) {
      return (
        <FlatList
          data={data}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          refreshControl={refreshControl}
          ListEmptyComponent={ListEmptyComponent ?? undefined}
          contentContainerClassName={contentContainerClassName}
          contentContainerStyle={contentContainerStyle}
          ItemSeparatorComponent={() => <View style={{ height: gap }} />}
        />
      );
    }

    return (
      <ScrollView
        refreshControl={refreshControl}
        contentContainerClassName={contentContainerClassName}
        contentContainerStyle={contentContainerStyle}
      >
        {data.length === 0 && ListEmptyComponent
          ? ListEmptyComponent
          : data.map((item, index) => (
              <View key={keyExtractor(item, index)} style={{ paddingBottom: gap }}>
                {renderItem({ item, index, separators: { highlight: () => {}, unhighlight: () => {}, updateProps: () => {} } })}
              </View>
            ))}
      </ScrollView>
    );
  }

  if (data.length === 0 && ListEmptyComponent) {
    return (
      <ScrollView
        refreshControl={refreshControl}
        contentContainerClassName={contentContainerClassName}
        contentContainerStyle={contentContainerStyle}
      >
        {ListEmptyComponent}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      refreshControl={refreshControl}
      contentContainerClassName={contentContainerClassName}
      contentContainerStyle={contentContainerStyle}
    >
      <View className="flex-row flex-wrap" style={containerStyle}>
        {data.map((item, index) => (
          <View key={keyExtractor(item, index)} style={itemStyle}>
            {renderItem({ item, index, separators: { highlight: () => {}, unhighlight: () => {}, updateProps: () => {} } })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/** Style helper for manual grid item wrapping. */
export function useResponsiveGridItem(gap = DEFAULT_GAP, columnsOverride?: number) {
  return useGridLayout(gap, columnsOverride);
}
