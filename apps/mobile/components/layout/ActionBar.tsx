import React from 'react';
import { View } from 'react-native';
import { useViewport } from '@/hooks/useViewport';

interface ActionBarProps {
  children: React.ReactNode;
}

/**
 * Sticky footer for screen actions.
 * - Desktop: horizontal toolbar, right-aligned, wrapping.
 * - Phone: primary action full-width; remaining actions wrap (no horizontal scroll).
 */
export function ActionBar({ children }: ActionBarProps) {
  const { isPhone } = useViewport();

  if (isPhone) {
    const childArray = React.Children.toArray(children);
    const primary = childArray[0];
    const rest = childArray.slice(1);

    return (
      <View className="border-t border-border bg-card p-4 gap-2 shrink-0">
        {primary}
        {rest.length > 0 ? (
          <View className="flex-row flex-wrap gap-2 py-1">{rest}</View>
        ) : null}
      </View>
    );
  }

  // Desktop + tablet: horizontal toolbar
  return (
    <View className="border-t border-border bg-card px-8 py-4 flex-row flex-wrap items-center justify-end gap-2 shrink-0">
      {children}
    </View>
  );
}
