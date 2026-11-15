/**
 * Shared page header for inventory list screens.
 * Optional onBack uses the same left-aligned NavBackButton as Construction ERP.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { Button } from '@/components/ui';
import { NavHeaderBar } from '@/components/layout/NavBackButton';
import { useViewport } from '@/hooks/useViewport';

export function InventoryPageHeader({
  title,
  subtitle,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  secondaryLabel,
  onSecondary,
  onBack,
  backLabel = 'Back',
}: {
  title: string;
  subtitle?: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  onBack?: () => void;
  backLabel?: string;
}) {
  const { isPhone, isDesktop } = useViewport();
  const actions =
    (primaryLabel && onPrimary) || (secondaryLabel && onSecondary) ? (
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
    ) : null;

  return (
    <View className={`w-full px-4 pt-4 pb-2 ${isPhone ? '' : 'shrink-0'} gap-2`}>
      {onBack ? (
        <NavHeaderBar onBack={onBack} backLabel={backLabel} size="sm" right={actions} className="mb-1" />
      ) : null}
      <View
        className={`${
          isDesktop && !onBack ? 'flex-row items-end justify-between gap-4' : 'gap-2'
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
        {!onBack ? actions : null}
      </View>
    </View>
  );
}
