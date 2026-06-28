/**
 * Month grid calendar for date selection (web + native).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { todayDateOnly } from '@/utils/date-field';
import {
  WEEKDAY_LABELS,
  buildMonthGrid,
  clampMonthView,
  isDateSelectable,
  isValidDateOnly,
  monthIndexFromDateOnly,
  toDateOnly,
} from '@/utils/date-calendar';

export type DateCalendarProps = {
  value?: string;
  onSelect: (dateOnly: string) => void;
  minimumDate?: string;
  maximumDate?: string;
};

export function DateCalendar({ value, onSelect, minimumDate, maximumDate }: DateCalendarProps) {
  const initial = value ? monthIndexFromDateOnly(value) : monthIndexFromDateOnly(todayDateOnly());
  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.monthIndex);

  useEffect(() => {
    if (value && isValidDateOnly(value)) {
      const next = monthIndexFromDateOnly(value);
      setViewYear(next.year);
      setViewMonth(next.monthIndex);
    }
  }, [value]);

  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
  const today = todayDateOnly();

  const shiftMonth = (delta: number) => {
    const next = clampMonthView(viewYear, viewMonth + delta);
    setViewYear(next.year);
    setViewMonth(next.monthIndex);
  };

  return (
    <View className="bg-card rounded-xl border border-border p-3 w-[280px]">
      <View className="flex-row items-center justify-between mb-3">
        <Pressable
          onPress={() => shiftMonth(-1)}
          hitSlop={8}
          className="w-8 h-8 rounded-lg items-center justify-center active:bg-surface"
          accessibilityLabel="Previous month"
        >
          <Ionicons name="chevron-back" size={18} color="#1E3A5F" />
        </Pressable>
        <Text className="text-sm font-bold text-text">{monthLabel}</Text>
        <Pressable
          onPress={() => shiftMonth(1)}
          hitSlop={8}
          className="w-8 h-8 rounded-lg items-center justify-center active:bg-surface"
          accessibilityLabel="Next month"
        >
          <Ionicons name="chevron-forward" size={18} color="#1E3A5F" />
        </Pressable>
      </View>

      <View className="flex-row mb-1">
        {WEEKDAY_LABELS.map((label) => (
          <View key={label} className="flex-1 items-center py-1">
            <Text className="text-[10px] font-semibold text-muted uppercase">{label}</Text>
          </View>
        ))}
      </View>

      <View className="flex-row flex-wrap">
        {grid.map((day, index) => {
          if (day === null) {
            return <View key={`empty-${index}`} className="w-[14.28%] aspect-square" />;
          }

          const dateOnly = toDateOnly(viewYear, viewMonth, day);
          const selectable = isDateSelectable(dateOnly, minimumDate, maximumDate);
          const selected = value === dateOnly;
          const isToday = dateOnly === today;

          return (
            <Pressable
              key={dateOnly}
              disabled={!selectable}
              onPress={() => onSelect(dateOnly)}
              className="w-[14.28%] aspect-square items-center justify-center p-0.5"
            >
              <View
                className={`w-full h-full rounded-lg items-center justify-center ${
                  selected
                    ? 'bg-primary'
                    : isToday
                      ? 'border border-primary/40 bg-primary/5'
                      : selectable
                        ? 'active:bg-surface'
                        : 'opacity-30'
                }`}
              >
                <Text
                  className={`text-sm ${
                    selected ? 'text-white font-bold' : selectable ? 'text-text' : 'text-muted'
                  }`}
                >
                  {day}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
