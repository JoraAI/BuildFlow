import React from 'react';
import { View, Text } from 'react-native';
import { NavHeaderBar } from '@/components/layout/NavBackButton';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Optional back navigation handler - renders left-aligned above the title */
  onBack?: () => void;
  backLabel?: string;
  /** Right-side actions (buttons, filters, etc.) */
  actions?: React.ReactNode;
  /** Optional stat chips below title on desktop */
  stats?: React.ReactNode;
  /** `inverse` for dark/hero backgrounds */
  variant?: 'default' | 'inverse';
}

export function PageHeader({
  title,
  subtitle,
  onBack,
  backLabel = 'Back',
  actions,
  stats,
  variant = 'default',
}: PageHeaderProps) {
  const isInverse = variant === 'inverse';
  return (
    <View className="mb-6 w-full">
      {onBack ? (
        <NavHeaderBar
          onBack={onBack}
          backLabel={backLabel}
          size="sm"
          variant={isInverse ? 'inverse' : 'default'}
          right={actions}
        />
      ) : actions ? (
        <View className="w-full flex-row justify-end mb-3">{actions}</View>
      ) : null}
      <Text className={`text-3xl font-bold tracking-tight ${isInverse ? 'text-white' : 'text-text'}`}>
        {title}
      </Text>
      {subtitle ? (
        <Text className={`text-base mt-1 ${isInverse ? 'text-white/75' : 'text-muted'}`}>
          {subtitle}
        </Text>
      ) : null}
      {stats ? <View className="flex-row flex-wrap gap-3 mt-4">{stats}</View> : null}
    </View>
  );
}

interface StatChipProps {
  label: string;
  value: string;
  accent?: 'primary' | 'success' | 'warning' | 'danger';
}

const ACCENT_STYLES = {
  primary: 'bg-primary/8 border-primary/20',
  success: 'bg-success/10 border-success/20',
  warning: 'bg-warning/10 border-warning/20',
  danger: 'bg-danger/10 border-danger/20',
};

const ACCENT_TEXT = {
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

export function StatChip({ label, value, accent = 'primary' }: StatChipProps) {
  return (
    <View className={`px-4 py-2.5 rounded-xl border ${ACCENT_STYLES[accent]}`}>
      <Text className="text-xs text-muted font-medium">{label}</Text>
      <Text className={`text-lg font-bold mt-0.5 ${ACCENT_TEXT[accent]}`}>{value}</Text>
    </View>
  );
}
