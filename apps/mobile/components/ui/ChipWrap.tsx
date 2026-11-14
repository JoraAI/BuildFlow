/**
 * Non-scrolling wrap row for filter / selector pills.
 * Prefer this over horizontal ScrollView for Construction ERP chip UX.
 */
import React from 'react';
import { View, type ViewProps } from 'react-native';

export function ChipWrap({
  children,
  className,
  ...rest
}: ViewProps & { children: React.ReactNode; className?: string }) {
  return (
    <View className={`flex-row flex-wrap gap-2 ${className ?? ''}`} {...rest}>
      {children}
    </View>
  );
}
