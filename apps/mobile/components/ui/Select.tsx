/**
 * BuildFlow - Select UI primitive.
 *
 * A searchable, single-select dropdown.
 * - Mobile (<768px): bottom-sheet Modal.
 * - Tablet/Web (>=768px): centered dialog Modal.
 *
 * Options support a primary title, a secondary subtitle, an optional
 * trailing meta string, and optional grouping via `groupKey`.
 *
 * The closed state renders a compact trigger button showing either the
 * selected option's title or the provided placeholder.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SearchBar } from './SearchBar';
import { useViewport } from '@/hooks/useViewport';

export interface SelectOption {
  value: string;
  /** Primary readable label shown in the trigger and at the top of each row. */
  title: string;
  /** Secondary line (e.g. status, section, item code). */
  subtitle?: string;
  /** Optional trailing meta (e.g. "Shortfall: 12 nos"). */
  meta?: string;
  /** Optional detailed explanation shown below subtitle (smaller, muted). */
  tooltip?: string;
  /** Key used to group options. When set on at least one option, options are
   *  rendered under group headers. */
  groupKey?: string;
  /** Optional colour token for a leading status dot (e.g. 'success'). */
  tone?: 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'muted';
}

interface SelectProps {
  label?: string;
  /** Currently selected value (matches option.value). */
  value?: string;
  options: SelectOption[];
  placeholder?: string;
  /** Shown when no option is selected / value is undefined. Defaults to the placeholder. */
  onChange: (value: string | undefined) => void;
  /** When true, a "None" entry is rendered at the top to clear the selection. */
  clearable?: boolean;
  /** Title for the modal sheet. */
  title?: string;
  /** Optional search placeholder override. */
  searchPlaceholder?: string;
  /** Disable the trigger. */
  disabled?: boolean;
  /** Compact trigger variant (smaller padding). */
  compact?: boolean;
  /** Helper text under the trigger. */
  helper?: string;
}

const TONE_BG: Record<NonNullable<SelectOption['tone']>, string> = {
  primary: 'bg-primary',
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  muted: 'bg-border',
};

export function Select({
  label,
  value,
  options,
  placeholder = 'Select…',
  onChange,
  clearable = false,
  title = 'Select',
  searchPlaceholder = 'Search…',
  disabled = false,
  compact = false,
  helper,
}: SelectProps) {
  const { isDesktop } = useViewport();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Reset search each time the sheet opens.
  useEffect(() => {
    if (open) setSearch('');
  }, [open]);

  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );

  // Filter + group
  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? options.filter(
          (o) =>
            o.title.toLowerCase().includes(q) ||
            (o.subtitle?.toLowerCase().includes(q) ?? false) ||
            (o.meta?.toLowerCase().includes(q) ?? false) ||
            (o.groupKey?.toLowerCase().includes(q) ?? false),
        )
      : options;

    const hasGroups = filtered.some((o) => !!o.groupKey);
    if (!hasGroups) return [{ group: '', items: filtered }];
    const map = new Map<string, SelectOption[]>();
    for (const o of filtered) {
      const g = o.groupKey ?? 'Other';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(o);
    }
    return Array.from(map.entries()).map(([group, items]) => ({ group, items }));
  }, [options, search]);

  const handleSelect = (v: string | undefined) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <View className={compact ? '' : 'mb-3'}>
      {label ? (
        <Text className="text-sm font-semibold text-text mb-1.5">{label}</Text>
      ) : null}

      <Pressable
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
        className={`flex-row items-center justify-between rounded-lg border bg-card ${
          disabled ? 'opacity-50 border-border' : 'border-border active:opacity-90'
        } ${compact ? 'px-2.5 py-2' : 'px-3 py-3'}`}
      >
        <View className="flex-1 min-w-0 flex-row items-center gap-2">
          {selected?.tone ? (
            <View className={`w-2 h-2 rounded-full ${TONE_BG[selected.tone]}`} />
          ) : null}
          <View className="flex-1 min-w-0">
            {selected ? (
              <>
                <Text className="text-sm text-text" numberOfLines={1}>
                  {selected.title}
                </Text>
                {selected.subtitle ? (
                  <Text className="text-xs text-muted" numberOfLines={1}>
                    {selected.subtitle}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text className="text-sm text-muted">{placeholder}</Text>
            )}
          </View>
        </View>
        <Text className="text-muted ml-2">▾</Text>
      </Pressable>

      {helper ? <Text className="text-xs text-muted mt-1">{helper}</Text> : null}

      <Modal
        visible={open}
        transparent
        animationType={isDesktop ? 'fade' : 'slide'}
        onRequestClose={() => setOpen(false)}
      >
        <Pressable className="flex-1 bg-black/40" onPress={() => setOpen(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            className="flex-1 justify-end md:justify-center"
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              className={`bg-card rounded-t-2xl md:rounded-2xl ${
                isDesktop ? 'mx-auto w-full max-w-lg my-auto' : ''
              }`}
              style={isDesktop ? { maxHeight: '80%' } : { maxHeight: '85%' }}
            >
              {/* Header */}
              <View className="px-4 pt-4 pb-2 border-b border-border">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-base font-semibold text-text">{title}</Text>
                  <Pressable
                    onPress={() => setOpen(false)}
                    hitSlop={8}
                    className="w-7 h-7 items-center justify-center rounded-full active:bg-border"
                  >
                    <Text className="text-muted text-base">✕</Text>
                  </Pressable>
                </View>
                <SearchBar
                  value={search}
                  onChangeText={setSearch}
                  placeholder={searchPlaceholder}
                />
              </View>

              {/* List */}
              <ScrollView
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                contentContainerClassName="p-2"
              >
                {options.length === 0 ? (
                  <Text className="text-sm text-muted text-center py-6">
                    No options available.
                  </Text>
                ) : grouped.length === 0 ? (
                  <Text className="text-sm text-muted text-center py-6">
                    No matches for “{search}”.
                  </Text>
                ) : (
                  <>
                    {clearable && (
                      <SelectRow
                        title={value ? 'Clear selection' : placeholder}
                        subtitle={value ? 'No selection' : undefined}
                        selected={!value}
                        tone="muted"
                        onPress={() => handleSelect(undefined)}
                      />
                    )}
                    {grouped.map(({ group, items }) => (
                      <View key={group || 'ungrouped'}>
                        {group ? (
                          <Text className="text-[11px] font-semibold uppercase tracking-wide text-muted px-2 pt-3 pb-1">
                            {group}
                          </Text>
                        ) : null}
                        {items.map((o) => (
                          <SelectRow
                            key={o.value}
                            title={o.title}
                            subtitle={o.subtitle}
                            meta={o.meta}
                            tooltip={o.tooltip}
                            tone={o.tone}
                            selected={o.value === value}
                            onPress={() => handleSelect(o.value)}
                          />
                        ))}
                      </View>
                    ))}
                  </>
                )}
              </ScrollView>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ---------------- internal row ---------------- */

function SelectRow({
  title,
  subtitle,
  meta,
  tooltip,
  tone,
  selected,
  onPress,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  tooltip?: string;
  tone?: SelectOption['tone'];
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-start gap-2 px-2.5 py-2.5 rounded-lg mb-0.5 ${
        selected ? 'bg-primary/5 border border-primary/30' : 'border border-transparent'
      } active:bg-surface`}
    >
      {tone ? (
        <View className={`w-2.5 h-2.5 mt-1 rounded-full ${TONE_BG[tone]}`} />
      ) : null}
      <View className="flex-1 min-w-0">
        <Text className="text-sm text-text" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-xs text-muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {tooltip ? (
          <Text className="text-[10px] text-muted mt-0.5" numberOfLines={2}>
            {tooltip}
          </Text>
        ) : null}
      </View>
      {meta ? (
        <Text className="text-xs text-muted ml-2 mt-1 shrink-0" numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
      {selected ? <Text className="text-primary text-sm ml-2 mt-1">✓</Text> : null}
    </Pressable>
  );
}

/** Small helper to render an inline spinner while options are loading. */
export function SelectLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View className="flex-row items-center justify-center gap-2 py-4">
      <ActivityIndicator />
      <Text className="text-sm text-muted">{label}</Text>
    </View>
  );
}