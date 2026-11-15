/**
 * Table column label row that floats at the top of its scroll container.
 *
 * Content above scrolls away; rows below scroll underneath. On web this uses
 * CSS `position: sticky`. On native, prefer putting the same row in
 * `stickySubheader` (InventoryScreenList) or as `stickyHeaderIndices` data[0].
 */
import React from 'react';
import { Platform, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { COLORS } from '@/constants';

const webSticky = {
  position: 'sticky',
  top: 0,
} as unknown as ViewStyle;

export function StickyTableHeader({
  children,
  style,
  className,
  ...rest
}: ViewProps & { className?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      {...rest}
      className={className}
      style={[
        {
          zIndex: 30,
          elevation: 8,
          backgroundColor: COLORS.surface,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
          ...(Platform.OS === 'web' ? webSticky : null),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
