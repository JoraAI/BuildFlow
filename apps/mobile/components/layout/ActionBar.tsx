import React from 'react';
import { View, ScrollView } from 'react-native';
import { useViewport } from '@/hooks/useViewport';

interface ActionBarProps {
  children: React.ReactNode;
}

/**
 * FIX (UI-H4): Sticky footer for screen actions.
 * - Desktop: horizontal toolbar, right-aligned, wrapping.
 * - Phone: horizontally scrollable row instead of stacking 7 full-width buttons.
 *   The first child is rendered full-width as the primary action; remaining
 *   children scroll horizontally so users don't have to scroll past multiple
 *   buttons to find the one they need.
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
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2 py-1"
          >
            {rest}
          </ScrollView>
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
