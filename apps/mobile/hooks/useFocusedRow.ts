/**
 * Brief highlight + optional scroll-into-view when `focus` lands from cross-nav.
 */
import { useEffect, useRef } from 'react';
import type { FlatList } from 'react-native';

export function useFocusedRow<T extends { id: string }>(opts: {
  focusId: string | null;
  data: T[];
  clearFocus: () => void;
  highlightMs?: number;
}) {
  const { focusId, data, clearFocus, highlightMs = 2500 } = opts;
  const listRef = useRef<FlatList<T>>(null);
  const clearedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!focusId) return;
    if (clearedFor.current === focusId) return;
    const index = data.findIndex((row) => row.id === focusId);
    if (index >= 0) {
      try {
        listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.2 });
      } catch {
        /* FlatList may not be measured yet */
      }
    }
    const t = setTimeout(() => {
      clearedFor.current = focusId;
      clearFocus();
    }, highlightMs);
    return () => clearTimeout(t);
  }, [focusId, data, clearFocus, highlightMs]);

  const isFocused = (id: string) => Boolean(focusId && focusId === id);

  const focusedClassName = (id: string) =>
    isFocused(id) ? 'border border-primary bg-primary/5' : '';

  return { listRef, isFocused, focusedClassName };
}
