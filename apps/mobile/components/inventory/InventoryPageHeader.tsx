/**
 * Shared page header for inventory list screens.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { Button } from '@/components/ui';
import { useViewport } from '@/hooks/useViewport';

export function InventoryPageHeader({
  title,
  subtitle,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  secondaryLabel,
  onSecondary,
}: {
  title: string;
  subtitle?: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  const { isPhone, isDesktop } = useViewport();

  return (
    <View
      className={`px-4 pt-4 pb-2 shrink-0 ${
        isDesktop ? 'flex-row items-end justify-between gap-4' : 'gap-2'
      }`}
    >
      <View className="min-w-0 flex-1">
        <Text className={`font-bold text-text ${isPhone ? 'text-xl' : 'text-2xl'}`}>{title}</Text>
        {subtitle ? (
          <Text className="text-sm text-muted mt-0.5" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {(primaryLabel && onPrimary) || (secondaryLabel && onSecondary) ? (
        <View className="flex-row items-center gap-2 flex-wrap">
          {secondaryLabel && onSecondary ? (
            <Button label={secondaryLabel} variant="secondary" size="sm" onPress={onSecondary} />
          ) : null}
          {primaryLabel && onPrimary ? (
            <Button
              label={primaryLabel}
              variant="accent"
              size="sm"
              disabled={primaryDisabled}
              onPress={onPrimary}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
