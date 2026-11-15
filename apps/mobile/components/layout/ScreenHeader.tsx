import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { usePathname } from 'expo-router';
import { useViewport } from '@/hooks/useViewport';
import { isNestedAppRoute } from '@/constants/navigation';
import { NavBackButton } from '@/components/layout/NavBackButton';

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
    <View className="px-4 pt-3 pb-2">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 min-w-0">
          <Text className="text-xl font-bold text-text">{title}</Text>
          {subtitle ? <Text className="text-sm text-muted mt-0.5">{subtitle}</Text> : null}
        </View>
        {actions ? <View className="shrink-0">{actions}</View> : null}
      </View>
    </View>
  );
}

/**
 * Form / wizard header — single compact row (back + title + actions)
 * so detail screens keep maximum workable height across roles.
 */
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
  /** Override back visibility. Default: nested / secondary routes on all viewports. */
  showBack?: boolean;
}) {
  const { isDesktop } = useViewport();
  const pathname = usePathname();
  const onNested = isNestedAppRoute(pathname);
  const showBackButton = showBack ?? onNested;

  return (
    <View
      className={`w-full self-stretch border-b border-border bg-surface shrink-0 ${
        isDesktop ? 'px-6 py-2.5' : 'px-3 py-2'
      }`}
      style={{ zIndex: 20, elevation: 3 }}
    >
      <View className="w-full flex-row items-center gap-2">
        {showBackButton ? (
          <NavBackButton
            onPress={onCancel}
            label={cancelLabel}
            icon={cancelIcon}
            size="sm"
          />
        ) : null}
        <View className="flex-1 min-w-0">
          <Text
            className={`font-bold text-text ${isDesktop ? 'text-lg' : 'text-base'}`}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text className="text-xs text-muted" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ? <View className="flex-row items-center gap-2 shrink-0">{right}</View> : null}
      </View>
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
      className={`px-3 py-1.5 rounded-lg border ${
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
    <View className={`flex-row pb-2 gap-2 flex-wrap ${isDesktop ? 'px-0 mb-3' : 'px-4'}`}>
      {children}
    </View>
  );
}
