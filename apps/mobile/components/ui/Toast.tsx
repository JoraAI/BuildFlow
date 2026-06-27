/**
 * BuildFlow — Toast / Snackbar
 *
 * Zustand-driven so any screen or mutation hook can call
 * `useToast.getState().show(...)` without prop drilling.
 * Mount <ToastHost /> once in the root layout.
 */
import { create } from 'zustand';
import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '@/constants';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
  durationMs: number;
}

interface ToastState {
  toasts: ToastItem[];
  show: (message: string, variant?: ToastVariant, durationMs?: number) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  show: (message, variant = 'info', durationMs = 3500) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, variant, message, durationMs }] }));
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Convenience helpers usable outside React components. */
export const toast = {
  success: (m: string, d?: number) => useToast.getState().show(m, 'success', d),
  error: (m: string, d?: number) => useToast.getState().show(m, 'error', d),
  warning: (m: string, d?: number) => useToast.getState().show(m, 'warning', d),
  info: (m: string, d?: number) => useToast.getState().show(m, 'info', d),
};

const VARIANT_COLORS: Record<ToastVariant, string> = {
  success: COLORS.success,
  error: COLORS.danger,
  warning: COLORS.warning,
  info: COLORS.primary,
};

function ToastRow({ item }: { item: ToastItem }): JSX.Element {
  const dismiss = useToast((s) => s.dismiss);
  useEffect(() => {
    const t = setTimeout(() => dismiss(item.id), item.durationMs);
    return () => clearTimeout(t);
  }, [item.id, item.durationMs, dismiss]);

  return (
    <Pressable
      onPress={() => dismiss(item.id)}
      style={[styles.row, { borderLeftColor: VARIANT_COLORS[item.variant] }]}
    >
      <Text style={styles.text}>{item.message}</Text>
    </Pressable>
  );
}

/** Mount once near the root of the app (e.g. in app/_layout.tsx). */
export function ToastHost(): JSX.Element {
  const toasts = useToast((s) => s.toasts);
  if (toasts.length === 0) return <></>;
  return (
    <View style={styles.host} pointerEvents="box-none">
      {toasts.slice(-3).map((t) => (
        <ToastRow key={t.id} item={t} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    gap: 8,
    zIndex: 9999,
  },
  row: {
    backgroundColor: COLORS.text,
    borderRadius: 8,
    borderLeftWidth: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});