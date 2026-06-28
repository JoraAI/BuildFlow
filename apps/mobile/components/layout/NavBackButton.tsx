import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type NavButtonVariant = 'default' | 'inverse' | 'subtle' | 'ghost';
type NavButtonIcon = 'back' | 'close';

const VARIANT_CLASS: Record<NavButtonVariant, string> = {
  default: 'bg-card border-border',
  inverse: 'bg-white/20 border-white/35',
  subtle: 'bg-primary/10 border-primary/25',
  ghost: '',
};

const LABEL_CLASS: Record<NavButtonVariant, string> = {
  default: 'text-primary',
  inverse: 'text-white',
  subtle: 'text-primary',
  ghost: 'text-primary',
};

const ICON_COLOR: Record<NavButtonVariant, string> = {
  default: '#1E3A5F',
  inverse: '#FFFFFF',
  subtle: '#1E3A5F',
  ghost: '#1E3A5F',
};

export function NavBackButton({
  onPress,
  label = 'Back',
  variant = 'default',
  icon = 'back',
  size = 'md',
  accessibilityLabel,
}: {
  onPress: () => void;
  label?: string;
  variant?: NavButtonVariant;
  icon?: NavButtonIcon;
  size?: 'md' | 'sm';
  accessibilityLabel?: string;
}) {
  const iconName = icon === 'close' ? 'close' : 'chevron-back';
  const iconSize = size === 'sm' ? 18 : 20;
  const isGhost = variant === 'ghost';
  const padding = isGhost
    ? 'py-1 pr-2 -ml-1'
    : size === 'sm'
      ? 'px-3 py-1.5'
      : 'px-3.5 py-2';
  const shellClass = isGhost
    ? 'rounded-lg active:opacity-70'
    : 'rounded-xl border active:opacity-80';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={8}
      className={`self-start flex-row items-center ${shellClass} ${padding} ${VARIANT_CLASS[variant]}`}
    >
      <Ionicons name={iconName} size={iconSize} color={ICON_COLOR[variant]} />
      <Text
        selectable={false}
        className={`font-semibold ml-0.5 ${size === 'sm' ? 'text-sm' : 'text-base'} ${LABEL_CLASS[variant]}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Icon-only close control for compact headers (desktop panels, modals). */
export function NavIconButton({
  onPress,
  icon = 'close',
  variant = 'default',
  accessibilityLabel = 'Close',
}: {
  onPress: () => void;
  icon?: 'close' | 'back';
  variant?: NavButtonVariant;
  accessibilityLabel?: string;
}) {
  const iconName = icon === 'back' ? 'chevron-back' : 'close';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      className={`w-10 h-10 rounded-xl border items-center justify-center ${VARIANT_CLASS[variant]} active:opacity-80`}
    >
      <Ionicons name={iconName} size={20} color={ICON_COLOR[variant]} />
    </Pressable>
  );
}

/** Row wrapper: back/close on the left, optional actions on the right. */
export function NavHeaderBar({
  onBack,
  backLabel = 'Back',
  backIcon = 'back',
  variant = 'default',
  right,
}: {
  onBack: () => void;
  backLabel?: string;
  backIcon?: NavButtonIcon;
  variant?: NavButtonVariant;
  right?: React.ReactNode;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3 mb-3">
      <NavBackButton onPress={onBack} label={backLabel} icon={backIcon} variant={variant} />
      {right ? <View className="flex-row items-center gap-2 shrink-0">{right}</View> : null}
    </View>
  );
}
