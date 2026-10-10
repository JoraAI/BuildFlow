/**
 * Shared filter/mode pills for inventory list screens.
 *
 * Use SegmentedTabs (horizontal scroll) for 4+ / long labels.
 * Use SegmentedTabsInline for 3–4 short labels that wrap on one row.
 * Use SegmentedTrack for equal-width mode switches (e.g. CheckoutCart Browse | Cart).
 */
import React from 'react';
import { ScrollView, Pressable, Text, View } from 'react-native';

export type SegmentedTab<T extends string = string> = {
  value: T;
  label: string;
};

function TabPill<T extends string>({
  tab,
  active,
  onChange,
}: {
  tab: SegmentedTab<T>;
  active: boolean;
  onChange: (next: T) => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={() => onChange(tab.value)}
      className={`self-start px-3 py-1.5 rounded-lg border ${
        active ? 'bg-primary border-primary' : 'bg-card border-border'
      }`}
    >
      <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-muted'}`}>
        {tab.label}
      </Text>
    </Pressable>
  );
}

export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
  contentContainerClassName,
}: {
  tabs: readonly SegmentedTab<T>[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
  contentContainerClassName?: string;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // RN Web: horizontal ScrollView otherwise stretches to parent height (tall pill columns).
      style={{ flexGrow: 0, flexShrink: 0, maxHeight: 48 }}
      className={`shrink-0 self-start ${className ?? ''}`}
      contentContainerClassName={
        contentContainerClassName ?? 'px-4 gap-2 pb-2 items-center flex-row'
      }
      contentContainerStyle={{ flexGrow: 0, alignItems: 'center' }}
    >
      {tabs.map((t) => (
        <TabPill key={t.value} tab={t} active={t.value === value} onChange={onChange} />
      ))}
    </ScrollView>
  );
}

/** Non-scrolling wrap row when tabs fit on one line. */
export function SegmentedTabsInline<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: readonly SegmentedTab<T>[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
}) {
  return (
    <View className={`flex-row flex-wrap ${className ?? 'gap-2'}`}>
      {tabs.map((t) => (
        <TabPill key={t.value} tab={t} active={t.value === value} onChange={onChange} />
      ))}
    </View>
  );
}

/**
 * Equal-width segmented control in a track (POS Browse | Cart).
 * Not filter chips — active segment is card + primary text inside a muted track.
 */
export function SegmentedTrack<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: readonly SegmentedTab<T>[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
}) {
  return (
    <View className={`flex-row bg-surface rounded-lg p-0.5 border border-border ${className ?? ''}`}>
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <Pressable
            key={t.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(t.value)}
            className={`flex-1 py-2 rounded-md items-center ${
              active ? 'bg-card border border-border' : ''
            }`}
          >
            <Text className={`text-sm font-semibold ${active ? 'text-primary' : 'text-muted'}`}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
