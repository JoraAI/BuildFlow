/**
 * Segmented pill tabs for inventory list screens.
 */
import React from 'react';
import { ScrollView, Pressable, Text, View } from 'react-native';

export type SegmentedTab<T extends string = string> = {
  value: T;
  label: string;
};

export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: readonly SegmentedTab<T>[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="shrink-0"
      contentContainerClassName="px-4 gap-2 pb-2"
    >
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <Pressable
            key={t.value}
            onPress={() => onChange(t.value)}
            className={`px-3 py-1.5 rounded-lg border ${
              active ? 'bg-primary border-primary' : 'bg-card border-border'
            }`}
          >
            <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-muted'}`}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Optional non-scrolling row when tabs fit on one line. */
export function SegmentedTabsInline<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: readonly SegmentedTab<T>[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <Pressable
            key={t.value}
            onPress={() => onChange(t.value)}
            className={`px-3 py-1.5 rounded-lg border ${
              active ? 'bg-primary border-primary' : 'bg-card border-border'
            }`}
          >
            <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-muted'}`}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
