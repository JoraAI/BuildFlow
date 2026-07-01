import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { usePathname } from 'expo-router';
import { useViewport } from '@/hooks/useViewport';
import { isPrimaryAppTabRoute, isNestedAppRoute } from '@/constants/navigation';
import { NavHeaderBar } from '@/components/layout/NavBackButton';

/** Standard list screen title block (matches Projects mobile header). */
export function MobileScreenHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <View className="px-4 pt-4 pb-2">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-2xl font-bold text-text">{title}</Text>
          {subtitle ? <Text className="text-sm text-muted mt-0.5">{subtitle}</Text> : null}
        </View>
        {actions ? <View className="shrink-0">{actions}</View> : null}
      </View>
    </View>
  );
}

/** Form / wizard header - use navigateAppBack/dismissTo for onCancel, never raw router.back(). */
export function FormScreenHeader({
  title,
  subtitle,
  onCancel,
  cancelLabel = 'Back',
  cancelIcon = 'back',
  right,
  showBack,
}: {
  title: string;
  subtitle?: string;
  onCancel: () => void;
  cancelLabel?: string;
  cancelIcon?: 'back' | 'close';
  right?: React.ReactNode;
  /** Override back visibility. Default: mobile nested routes only (hidden on desktop). */
  showBack?: boolean;
}) {
  const { isDesktop } = useViewport();
  const pathname = usePathname();
  const onPrimaryTab = isPrimaryAppTabRoute(pathname);
  const onNested = isNestedAppRoute(pathname);
  const showBackButton = showBack ?? (!onPrimaryTab && (!isDesktop || onNested));

  return (
    <View
      className={`border-b border-border bg-surface ${isDesktop ? 'px-8 py-5' : 'px-4 py-3'}`}
    >
      {showBackButton ? (
        <NavHeaderBar
          onBack={onCancel}
          backLabel={cancelLabel}
          backIcon={cancelIcon}
          right={right}
        />
      ) : right ? (
        <View className="flex-row justify-end mb-3">{right}</View>
      ) : null}
      <Text className={`font-bold text-text ${isDesktop ? 'text-2xl' : 'text-xl'}`}>
        {title}
      </Text>
      {subtitle ? <Text className="text-sm text-muted mt-1">{subtitle}</Text> : null}
    </View>
  );
}

/** Pill filter chips matching Projects screen style. */
export function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`px-4 py-2 rounded-lg border ${
        active ? 'bg-primary border-primary' : 'bg-card border-border'
      }`}
    >
      <Text className={`text-sm font-medium ${active ? 'text-white' : 'text-muted'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

export function FilterChipRow({ children }: { children: React.ReactNode }) {
  const { isDesktop } = useViewport();
  return (
    <View className={`flex-row pb-2 gap-2 flex-wrap ${isDesktop ? 'px-0 mb-4' : 'px-4'}`}>
      {children}
    </View>
  );
}
