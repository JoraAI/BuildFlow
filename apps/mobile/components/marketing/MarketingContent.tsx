import React from 'react';
import { View } from 'react-native';
import { useViewport } from '@/hooks/useViewport';

/** Shared max-width + horizontal padding for all marketing sections. */
export function MarketingContent({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { isDesktop } = useViewport();
  const px = isDesktop ? 'px-8' : 'px-4';

  return (
    <View className={`w-full max-w-6xl self-center ${px} ${className}`}>{children}</View>
  );
}
