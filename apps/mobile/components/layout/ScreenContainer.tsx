import React from 'react';
import { View, ScrollView, Platform, type ViewStyle } from 'react-native';
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
  const { isDesktop, isTablet, isWideDesktop } = useViewport();

  const listPaddingBottom = reserveAssistantFab
    ? mobileListBottomPadding(reserveAssistantFab === 'withScreenFab')
    : isTablet && !isDesktop
      ? mobileListBottomPadding(false)
      : undefined;

  // FIX (UI-L18): Consistent max-width across desktop AND tablet tiers.
  // Tablet (768-1023px) also gets padding + centered max-width so content
  // doesn't stretch full-bleed on iPads in landscape.
  const constrainedClass = constrained
    ? isWideDesktop
      ? 'max-w-7xl'
      : isDesktop
        ? 'max-w-6xl'
        : isTablet
          ? 'max-w-4xl'
          : ''
    : '';

  const paddingClass = isDesktop ? 'px-8 py-6' : isTablet ? 'px-6 py-4' : '';

  const inner = (
    <View
      className={`w-full ${scrollable ? '' : 'flex-1'} ${constrainedClass} ${paddingClass} ${className}`}
    >
      {children}
    </View>
  );

  if (!isDesktop && !isTablet) {
    return (
      <View
        className={`flex-1 ${className}`}
        style={listPaddingBottom ? { paddingBottom: listPaddingBottom } : undefined}
      >
        {children}
      </View>
    );
  }

  if (scrollable) {
    return (
      <ScrollView
        className="flex-1 bg-surface min-h-0"
        style={Platform.OS === 'web' ? ({ flex: 1, overflow: 'scroll' } as ViewStyle) : { flex: 1 }}
        contentContainerClassName="items-center pb-10 flex-grow"
        contentContainerStyle={listPaddingBottom ? { paddingBottom: listPaddingBottom } : undefined}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
      >
        {inner}
      </ScrollView>
    );
  }

  return (
    <View
      className="flex-1 bg-surface items-center"
      style={listPaddingBottom ? { paddingBottom: listPaddingBottom } : undefined}
    >
      {inner}
    </View>
  );
}
