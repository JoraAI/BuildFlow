import React from 'react';
import { View, Text } from 'react-native';
import { MarketingContent } from '@/components/marketing/MarketingContent';
import { useViewport } from '@/hooks/useViewport';

export function MarketingSection({
  id,
  eyebrow,
  title,
  subtitle,
  children,
  className = '',
  centered = false,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  centered?: boolean;
}) {
  const { isMarketingDesktop } = useViewport();
  const py = isMarketingDesktop ? 'py-20' : 'py-12';

  return (
    <View nativeID={id} className={`w-full ${py} ${className}`}>
      <MarketingContent>
        <View className={`mb-8 ${centered ? 'items-center' : ''}`}>
          {eyebrow ? (
            <Text className="text-accent text-sm font-bold uppercase tracking-wider mb-2">
              {eyebrow}
            </Text>
          ) : null}
          <Text
            className={`font-bold text-text ${isMarketingDesktop ? 'text-4xl' : 'text-2xl'} ${
              centered ? 'text-center' : ''
            }`}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              className={`text-muted mt-2 ${isMarketingDesktop ? 'text-lg' : 'text-base'} ${
                centered ? 'text-center max-w-2xl' : ''
              }`}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {children}
      </MarketingContent>
    </View>
  );
}
