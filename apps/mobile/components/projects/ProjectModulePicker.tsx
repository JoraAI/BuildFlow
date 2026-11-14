/**
 * Project detail module switcher — grouped picker instead of horizontal tab scroll.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PROJECT_MODULE_GROUPS, type ProjectTabId } from '@/constants/project-workflow';
import { useTranslation } from '@/hooks/useTranslation';

export type ModuleTabItem = { label: string; value: ProjectTabId };

interface ProjectModulePickerProps {
  tabs: ModuleTabItem[];
  value: ProjectTabId;
  onChange: (next: ProjectTabId) => void;
  hint?: string;
  /** Extra horizontal padding when not inside a desktop max-width column. */
  padded?: boolean;
}

export function ProjectModulePicker({
  tabs,
  value,
  onChange,
  hint,
  padded = true,
}: ProjectModulePickerProps) {
  const [open, setOpen] = useState(false);
  const { t: translate } = useTranslation();
  const allowed = useMemo(() => new Set(tabs.map((t) => t.value)), [tabs]);
  const current = tabs.find((t) => t.value === value) ?? tabs[0];

  const groups = useMemo(
    () =>
      PROJECT_MODULE_GROUPS.map((g) => ({
        title: g.title,
        items: g.tabs
          .filter((id) => allowed.has(id))
          .map((id) => tabs.find((t) => t.value === id)!)
          .filter(Boolean),
      })).filter((g) => g.items.length > 0),
    [allowed, tabs],
  );

  return (
    <View className="bg-surface border-b border-border">
      <View className={padded ? 'px-4 py-2' : 'py-2'}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Switch project module"
          onPress={() => setOpen(true)}
          className="flex-row items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-border bg-card active:opacity-90"
        >
          <View className="flex-1 min-w-0">
            <Text className="text-[10px] font-semibold uppercase text-muted">Module</Text>
            <Text className="text-sm font-bold text-text" numberOfLines={1}>
              {current ? translate(current.label) : 'Overview'}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={18} color="#64748B" />
        </Pressable>
        {hint ? <Text className="text-xs text-muted mt-1.5 px-0.5">{hint}</Text> : null}
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-black/50 justify-end md:justify-center md:items-center p-0 md:p-6" onPress={() => setOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="bg-card rounded-t-2xl md:rounded-2xl border border-border w-full md:max-w-lg max-h-[80%]"
          >
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
              <Text className="text-base font-bold text-text">Project modules</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color="#64748B" />
              </Pressable>
            </View>
            <ScrollView className="px-4 py-3" showsVerticalScrollIndicator={false}>
              {groups.map((group) => (
                <View key={group.title} className="mb-4">
                  <Text className="text-[10px] font-bold uppercase text-muted mb-2">{group.title}</Text>
                  <View className="gap-1.5">
                    {group.items.map((item) => {
                      const active = item.value === value;
                      return (
                        <Pressable
                          key={item.value}
                          onPress={() => {
                            onChange(item.value);
                            setOpen(false);
                          }}
                          className={`flex-row items-center justify-between px-3 py-2.5 rounded-xl border ${
                            active ? 'bg-primary border-primary' : 'bg-surface border-border'
                          }`}
                        >
                          <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-text'}`}>
                            {translate(item.label)}
                          </Text>
                          {active ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
