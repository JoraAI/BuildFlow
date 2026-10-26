/**
 * Tappable hub tile used on Reports and Backup.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { INVENTORY_ACCENT, INVENTORY_ACCENT_SOFT } from '@/components/navigation/InventoryTabBar';

export function InventoryHubCard({
  icon,
  title,
  subtitle,
  meta,
  onPress,
  onDownload,
  downloadLabel = 'Download Excel',
  downloadBusy,
  disabled,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
  meta?: string;
  onPress: () => void;
  onDownload?: () => void;
  downloadLabel?: string;
  downloadBusy?: boolean;
  disabled?: boolean;
}) {
  return (
    <View className="flex-1 min-w-[148px] rounded-2xl border border-border bg-card overflow-hidden">
      <Pressable
        onPress={onPress}
        disabled={disabled}
        className="px-4 py-3.5 active:bg-surface"
      >
        <View className="flex-row items-start gap-3">
          <View
            className="w-10 h-10 rounded-xl items-center justify-center"
            style={{ backgroundColor: INVENTORY_ACCENT_SOFT }}
          >
            <Ionicons name={icon} size={20} color={INVENTORY_ACCENT} />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-sm font-semibold text-text" numberOfLines={1}>
              {title}
            </Text>
            <Text className="text-xs text-muted mt-0.5" numberOfLines={2}>
              {subtitle}
            </Text>
            {meta ? (
              <Text className="text-[11px] font-semibold mt-2" style={{ color: INVENTORY_ACCENT }}>
                {meta}
              </Text>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={16} color={INVENTORY_ACCENT} />
        </View>
      </Pressable>
      {onDownload ? (
        <Pressable
          onPress={onDownload}
          disabled={disabled || downloadBusy}
          className="px-4 py-2.5 border-t border-border/70 active:bg-surface"
        >
          <Text className="text-xs font-semibold" style={{ color: INVENTORY_ACCENT }}>
            {downloadBusy ? 'Preparing…' : downloadLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
