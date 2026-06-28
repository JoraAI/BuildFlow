import React from 'react';
import { View, Text } from 'react-native';
import { NavHeaderBar } from '@/components/layout/NavBackButton';
import { navigateAuthBack } from '@/utils/navigation';

export function AuthFormHeader({
  backHref,
  title,
  subtitle,
  backLabel = 'Back',
}: {
  backHref: string;
  title?: string;
  subtitle?: string;
  backLabel?: string;
}) {
  return (
    <View className="px-8 pt-6 pb-4 border-b border-border shrink-0 bg-card">
      <NavHeaderBar
        onBack={() => navigateAuthBack(backHref)}
        backLabel={backLabel}
      />
      {title ? <Text className="text-2xl font-bold text-text">{title}</Text> : null}
      {subtitle ? <Text className="text-sm text-muted mt-1">{subtitle}</Text> : null}
    </View>
  );
}
