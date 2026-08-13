/**
 * Full-screen wait overlay so users know a mutation is in flight
 * and do not tap the same action again.
 */
import React, { useCallback, useRef, useState } from 'react';
import { Modal, View, Text, ActivityIndicator } from 'react-native';

export function BusyOverlay({
  visible,
  title = 'Updating…',
  subtitle = 'Please wait. Do not tap again until this finishes.',
}: {
  visible: boolean;
  title?: string;
  subtitle?: string;
}) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View className="flex-1 bg-black/50 items-center justify-center px-8">
        <View className="bg-card rounded-2xl px-6 py-5 items-center max-w-sm w-full border border-border">
          <ActivityIndicator size="large" />
          <Text className="text-base font-bold text-text mt-4 text-center">{title}</Text>
          <Text className="text-xs text-muted mt-2 text-center">{subtitle}</Text>
        </View>
      </View>
    </Modal>
  );
}

/** Run an async action under a busy flag (no-ops if already busy). */
export function useBusy() {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const run = useCallback(async (fn: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);
  return { busy, run, setBusy };
}
