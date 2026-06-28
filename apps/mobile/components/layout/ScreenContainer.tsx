import React from 'react';
import { View, ScrollView } from 'react-native';
import { useViewport } from '@/hooks/useViewport';
import { mobileListBottomPadding } from '@/components/layout/fab-layout';

interface ScreenContainerProps {
  children: React.ReactNode;
  className?: string;
  /** When true, content is centered with max-width on wide viewports. */
  constrained?: boolean;
  /** Wrap in ScrollView on desktop for consistent page scrolling. */
  scrollable?: boolean;
  /** Reserve bottom space on mobile for the assistant FAB (and optional screen FAB). */
  reserveAssistantFab?: boolean | 'withScreenFab';
}

/**
 * Responsive page wrapper - centers and constrains content on desktop web.
 */
export function ScreenContainer({
  children,
  className = '',
  constrained = true,
  scrollable = false,
  reserveAssistantFab = false,
}: ScreenContainerProps) {
  const { isDesktop, isWideDesktop } = useViewport();

  const mobilePaddingBottom = reserveAssistantFab
    ? mobileListBottomPadding(reserveAssistantFab === 'withScreenFab')
    : undefined;

  const inner = (
    <View
      className={`flex-1 w-full ${constrained && isDesktop ? (isWideDesktop ? 'max-w-7xl' : 'max-w-6xl') : ''} ${isDesktop ? 'px-8 py-6' : ''} ${className}`}
    >
      {children}
    </View>
  );

  if (!isDesktop) {
    return (
      <View
        className={`flex-1 ${className}`}
        style={mobilePaddingBottom ? { paddingBottom: mobilePaddingBottom } : undefined}
      >
        {children}
      </View>
    );
  }

  if (scrollable) {
    return (
      <ScrollView
        className="flex-1 bg-surface"
        contentContainerClassName="items-center pb-10"
        showsVerticalScrollIndicator={false}
      >
        {inner}
      </ScrollView>
    );
  }

  return (
    <View className="flex-1 bg-surface items-center">
      {inner}
    </View>
  );
}
