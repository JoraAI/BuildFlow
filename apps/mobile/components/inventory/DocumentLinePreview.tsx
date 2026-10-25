/**
 * Expandable line-item list for inventory documents (indent, PO, GRN, SO, challan).
 * Owners/managers can see what was ordered without opening a PDF.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type PreviewLine = {
  key: string;
  name: string;
  qty: string;
  meta?: string;
};

export function DocumentLines({
  lines,
  empty = 'No items on this document',
}: {
  lines: PreviewLine[];
  empty?: string;
}) {
  if (lines.length === 0) {
    return <Text className="text-[11px] text-muted mt-2">{empty}</Text>;
  }
  return (
    <View className="mt-2 rounded-xl bg-surface border border-border overflow-hidden">
      {lines.map((line, idx) => (
        <View
          key={line.key}
          className={`flex-row items-start justify-between gap-2 px-3 py-2 ${
            idx < lines.length - 1 ? 'border-b border-border/50' : ''
          }`}
        >
          <Text className="flex-1 text-xs text-text" numberOfLines={2}>
            {line.name}
          </Text>
          <Text className="text-xs font-semibold text-text">{line.qty}</Text>
          {line.meta ? <Text className="text-[11px] text-muted">{line.meta}</Text> : null}
        </View>
      ))}
    </View>
  );
}

export function ExpandHint({
  expanded,
  count,
  onPress,
  label = 'Items',
}: {
  expanded: boolean;
  count: number;
  onPress: () => void;
  label?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={expanded ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
      className="flex-row items-center gap-1 py-1"
    >
      <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#1E3A5F" />
      <Text className="text-[11px] font-semibold text-primary">
        {expanded ? 'Hide' : 'Show'} {label.toLowerCase()} ({count})
      </Text>
    </Pressable>
  );
}

export function PartyLabel({
  kind,
  name,
}: {
  kind: 'vendor' | 'customer';
  name?: string | null;
}) {
  const label = kind === 'vendor' ? 'Vendor' : 'Customer';
  return (
    <Text className="text-xs text-text mt-0.5" numberOfLines={1}>
      <Text className="text-muted">{label}: </Text>
      {name?.trim() ? name : 'Not set'}
    </Text>
  );
}
