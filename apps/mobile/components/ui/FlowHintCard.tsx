import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FlowHintCardProps {
  title: string;
  steps: string[];
  /** Storage key segment; when set, user can dismiss permanently. */
  dismissKey?: string;
  defaultCollapsed?: boolean;
  onDismiss?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function FlowHintCard({
  title,
  steps,
  defaultCollapsed = false,
  collapsed: controlledCollapsed,
  onToggleCollapse,
}: FlowHintCardProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const toggle = onToggleCollapse ?? (() => setInternalCollapsed((v) => !v));

  return (
    <View className="rounded-xl border border-primary/20 bg-primary/5 p-3 gap-2">
      <Pressable onPress={toggle} className="flex-row items-center justify-between gap-2">
        <View className="flex-row items-center gap-2 flex-1">
          <Ionicons name="bulb-outline" size={18} color="#1E3A5F" />
          <Text className="text-sm font-semibold text-primary flex-1">{title}</Text>
        </View>
        <Ionicons name={collapsed ? 'chevron-down' : 'chevron-up'} size={18} color="#64748B" />
      </Pressable>
      {!collapsed && (
        <View className="gap-1.5 pl-1">
          {steps.map((step, i) => (
            <View key={i} className="flex-row gap-2">
              <Text className="text-xs font-bold text-primary w-4">{i + 1}.</Text>
              <Text className="text-xs text-text flex-1 leading-4">{step}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
