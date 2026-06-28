/**
 * BuildFlow - DateField: calendar picker only (no manual typing).
 */
import React, { useState } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDateOnlyLabel } from '@/utils/date-field';
import { isValidDateOnly } from '@/utils/date-calendar';
import { DateCalendar } from '@/components/ui/DateCalendar';
import { useViewport } from '@/hooks/useViewport';

export type DateFieldProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  /** YYYY-MM-DD inclusive minimum (e.g. today for future-only fields). */
  minimumDate?: string;
  maximumDate?: string;
  placeholder?: string;
  error?: string;
  helper?: string;
  disabled?: boolean;
  /** Stretch to container width on desktop (default: compact). */
  fullWidth?: boolean;
};

export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  placeholder = 'Select date',
  error,
  helper,
  disabled = false,
  fullWidth = false,
}: DateFieldProps) {
  const { isDesktop } = useViewport();
  const [calendarOpen, setCalendarOpen] = useState(false);

  const widthClass =
    fullWidth || !isDesktop ? 'w-full' : 'w-full max-w-[280px] self-start';

  const fieldShell = `flex-row items-center rounded-lg border bg-card px-3 min-h-[46px] ${
    error ? 'border-danger' : 'border-border'
  } ${disabled ? 'opacity-60' : 'active:bg-surface/80'}`;

  const handleCalendarSelect = (dateOnly: string) => {
    onChange(dateOnly);
    setCalendarOpen(false);
  };

  const displayValue =
    value && isValidDateOnly(value) ? formatDateOnlyLabel(value) : null;

  return (
    <View className={`mb-4 ${widthClass}`}>
      {label ? <Text className="text-sm font-semibold text-text mb-1.5">{label}</Text> : null}

      <Pressable
        onPress={() => !disabled && setCalendarOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}, ${displayValue ?? placeholder}` : 'Select date'}
        className={fieldShell}
      >
        <Ionicons name="calendar-outline" size={18} color="#64748B" style={{ marginRight: 10 }} />
        <Text
          className={`flex-1 text-base ${displayValue ? 'text-text font-medium' : 'text-muted'}`}
          numberOfLines={1}
        >
          {displayValue ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#94A3B8" />
      </Pressable>

      <Modal
        visible={calendarOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/45 items-center justify-center px-4 py-8"
          onPress={() => setCalendarOpen(false)}
        >
          <Pressable
            className="w-full max-w-[320px] bg-card rounded-2xl border border-border p-4 shadow-lg"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-base font-bold text-text">{label ?? 'Select date'}</Text>
              <Pressable onPress={() => setCalendarOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color="#64748B" />
              </Pressable>
            </View>
            <View className="items-center">
              <DateCalendar
                value={isValidDateOnly(value) ? value : undefined}
                onSelect={handleCalendarSelect}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {error ? <Text className="text-xs text-danger mt-1">{error}</Text> : null}
      {helper && !error ? <Text className="text-xs text-muted mt-1">{helper}</Text> : null}
    </View>
  );
}
