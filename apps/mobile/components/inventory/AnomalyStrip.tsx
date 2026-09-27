/**
 * BuildFlow - Anomaly hints (compact inline banner).
 */
import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Card, LoadingSkeleton } from '@/components/ui';
import { useInventoryAnomalies, type AnomalyHint } from '@/services/inventory-ai.queries';
import { useRouter } from 'expo-router';
import { inventoryInvoicesHref } from '@/utils/navigation-paths';

const SEVERITY_TONE: Record<string, string> = {
  high: 'text-danger',
  medium: 'text-warning',
  low: 'text-muted',
};

export default function AnomalyStrip() {
  const router = useRouter();
  const { data, isLoading } = useInventoryAnomalies();
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <View className="mb-2">
        <LoadingSkeleton className="rounded-xl h-11" />
      </View>
    );
  }
  const hints: AnomalyHint[] = data ?? [];
  if (hints.length === 0) return null;

  const top = hints[0];

  return (
    <View className="mb-2">
      <Pressable onPress={() => setExpanded((v) => !v)}>
        <Card className="px-3 py-2.5 flex-row items-center gap-2 border-warning/30 bg-warning/5">
          <View className="flex-1 min-w-0">
            <Text className="text-xs font-bold text-warning">
              {hints.length} need{hints.length === 1 ? 's' : ''} attention
            </Text>
            <Text className="text-[11px] text-muted mt-0.5" numberOfLines={1}>
              {top.title}
            </Text>
          </View>
          <Text className="text-xs font-bold text-primary">{expanded ? 'Hide' : 'Review'}</Text>
        </Card>
      </Pressable>
      {expanded ? (
        <View className="mt-2 gap-2">
          {hints.slice(0, 4).map((h, i) => (
            <Pressable
              key={`${h.type}-${h.referenceId ?? h.title}-${i}`}
              onPress={() => {
                if (h.type === 'OVERDUE_INVOICE') {
                  router.push(inventoryInvoicesHref({ status: 'OVERDUE' }) as never);
                }
              }}
              disabled={h.type !== 'OVERDUE_INVOICE'}
            >
              <Card className="p-3">
                <View className="flex-row items-center gap-2 flex-wrap">
                  <Text className="text-[10px] font-bold uppercase tracking-wide text-muted">
                    {h.type.replace('_', ' ')}
                  </Text>
                  <Text className={`text-[10px] font-semibold ${SEVERITY_TONE[h.severity] ?? 'text-muted'}`}>
                    {h.severity.toUpperCase()}
                  </Text>
                </View>
                <Text className="text-sm font-semibold text-text mt-1">{h.title}</Text>
                <Text className="text-xs text-muted mt-0.5">{h.detail}</Text>
              </Card>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
