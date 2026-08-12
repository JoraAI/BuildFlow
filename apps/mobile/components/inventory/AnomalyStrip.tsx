/**
 * BuildFlow - Anomaly hints strip (INVENTORY_HORIZONTAL_PLATFORM Phase 7.3).
 *
 * Rules-first checks surfaced on the Stock home (not a chatbot): unusual PO rate
 * vs WAC/last-buy, large stock-count variance, overdue invoice aging.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Card, LoadingSkeleton } from '@/components/ui';
import { useViewport } from '@/hooks/useViewport';
import { useInventoryAnomalies, type AnomalyHint } from '@/services/inventory-ai.queries';
import { useRouter } from 'expo-router';

const SEVERITY_TONE: Record<string, string> = {
  high: 'text-danger',
  medium: 'text-warning',
  low: 'text-muted',
};

export default function AnomalyStrip() {
  const { isDesktop } = useViewport();
  const router = useRouter();
  const { data, isLoading } = useInventoryAnomalies();

  if (isLoading) {
    return (
      <View className="mt-3">
        <LoadingSkeleton className="rounded-xl h-14" />
      </View>
    );
  }
  const hints: AnomalyHint[] = (data ?? []).slice(0, 4);
  if (hints.length === 0) return null;

  return (
    <View className="mt-3">
      <Text className="text-xs font-semibold text-muted mb-2 uppercase tracking-wide">Anomaly hints</Text>
      <View className={`gap-2 ${isDesktop ? 'flex-row flex-wrap' : 'flex-col'}`}>
        {hints.map((h, i) => (
          <Pressable
            key={`${h.type}-${h.referenceId ?? h.title}-${i}`}
            className={isDesktop ? 'flex-1 min-w-[220px]' : undefined}
            onPress={() => {
              // OVERDUE_INVOICE hints can jump straight to the invoices list.
              if (h.type === 'OVERDUE_INVOICE') router.push('/inventory/invoices');
            }}
            disabled={h.type !== 'OVERDUE_INVOICE'}
          >
            <Card className="p-3">
              <View className="flex-row items-center gap-2 flex-wrap">
                <Text className="text-xs font-bold uppercase tracking-wide text-muted">{h.type.replace('_', ' ')}</Text>
                <Text className={`text-xs font-semibold ${SEVERITY_TONE[h.severity] ?? 'text-muted'}`}>
                  {h.severity.toUpperCase()}
                </Text>
              </View>
              <Text className="text-sm font-semibold text-text mt-1">{h.title}</Text>
              <Text className="text-xs text-muted mt-0.5">{h.detail}</Text>
            </Card>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
