import React from 'react';
import { View } from 'react-native';
import { useViewport } from '@/hooks/useViewport';

interface ActionBarProps {
  children: React.ReactNode;
}

/** Sticky footer for screen actions - horizontal toolbar on desktop, stacked on mobile. */
export function ActionBar({ children }: ActionBarProps) {
  const { isDesktop } = useViewport();

  if (isDesktop) {
    return (
      <View className="border-t border-border bg-card px-8 py-4 flex-row flex-wrap items-center justify-end gap-2 shrink-0">
        {children}
      </View>
    );
  }

  return <View className="border-t border-border bg-card p-4 gap-2 shrink-0">{children}</View>;
}
