import React, { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { AdaptiveSheet } from '@/components/layout/AdaptiveSheet';
import {
  Card,
  Button,
  EmptyState,
  LoadingSkeleton,
  Input,
  ProgressBar,
} from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';
import { formatINR } from '@/utils/format';
import {
  useBoq,
  useRecordBoqMeasurement,
  useBoqVsActual,
  type BoqItem,
  type BoqGroup,
  type BoqVsActualLine,
} from '@/services/boq.queries';
import { alertAsync } from '@/utils/confirm';

interface BoqTabProps {
  projectId: string;
}

export function BoqTab({ projectId }: BoqTabProps) {
  const user = useAuthStore((s) => s.user);
  const canMeasure =
    user?.role === 'OWNER' || user?.role === 'PM' || user?.role === 'SUPERVISOR';

  const { data: boq, isLoading } = useBoq(projectId);
  const { data: vsActual } = useBoqVsActual(projectId);
  const recordMeasurement = useRecordBoqMeasurement(projectId);

  const [measureItem, setMeasureItem] = useState<BoqItem | null>(null);
  const [qty, setQty] = useState('');
  const [notes, setNotes] = useState('');

  const onRecord = () => {
    if (!measureItem) return;
    const quantity = parseFloat(qty);
    if (!quantity || quantity <= 0) {
      void alertAsync('Invalid quantity', 'Enter a quantity greater than zero.');
      return;
    }
    recordMeasurement.mutate(
      { boqItemId: measureItem.id, quantity, notes: notes.trim() || undefined },
      {
        onSuccess: async () => {
          setMeasureItem(null);
          setQty('');
          setNotes('');
          await alertAsync('Recorded', 'Executed quantity updated.');
        },
        onError: (e: Error) => Alert.alert('Error', e.message),
      },
    );
  };

  if (isLoading) {
    return <LoadingSkeleton className="h-48 rounded-xl" />;
  }

  if (!boq || boq.items.length === 0) {
    return (
      <EmptyState
        title="No BOQ items"
        description="Add BOQ items manually, import from CSV, or convert from an approved estimate."
      />
    );
  }

  return (
    <View className="gap-3">
      <Card>
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-sm font-bold text-text">BOQ Summary</Text>
          <Text className="text-lg font-bold text-primary">{formatINR(boq.total)}</Text>
        </View>
        <Text className="text-xs text-muted">
          Sanctioned quantities are from BOQ. Executed qty is measured on site. Billed cumulative
          comes from Running Account invoices.
        </Text>
      </Card>

      {boq.grouped.map((g: BoqGroup) => (
        <Card key={g.category}>
          <View className="flex-row justify-between items-center">
            <Text className="text-sm font-semibold text-text">{g.category}</Text>
            <Text className="text-sm font-bold text-text">{formatINR(g.amount)}</Text>
          </View>
        </Card>
      ))}

      <Text className="text-sm font-bold text-text mt-2">Line items</Text>
      {boq.items.map((item: BoqItem) => {
        const sanctioned = parseFloat(item.quantity);
        const executed = item.executedQty ?? 0;
        const billed = item.billedCumulativeQty ?? 0;
        const progress = item.progressPct ?? 0;
        return (
          <Card key={item.id}>
            <View className="flex-row justify-between items-start mb-1">
              <View className="flex-1 mr-2">
                <Text className="text-xs font-mono text-muted">{item.itemCode}</Text>
                <Text className="text-sm text-text" numberOfLines={2}>
                  {item.description}
                </Text>
              </View>
              <Text className="text-sm font-bold text-text">
                {formatINR(parseFloat(item.amount))}
              </Text>
            </View>
            <View className="flex-row flex-wrap gap-x-3 gap-y-1 mt-1">
              <Text className="text-xs text-muted">
                Sanctioned: {sanctioned} {item.unit}
              </Text>
              <Text className="text-xs text-muted">
                Executed: {executed} {item.unit}
              </Text>
              <Text className="text-xs text-muted">
                Billed: {billed} {item.unit}
              </Text>
              {(item.billableQty ?? 0) > 0 && (
                <Text className="text-xs text-accent font-semibold">
                  Billable: {item.billableQty} {item.unit}
                </Text>
              )}
            </View>
            <View className="mt-2 mb-2">
              <ProgressBar value={progress} color="#1E3A5F" />
              <Text className="text-xs text-muted mt-1">{progress}% executed</Text>
            </View>
            {canMeasure && (
              <Button
                label="Record measurement"
                variant="secondary"
                onPress={() => {
                  setMeasureItem(item);
                  setQty('');
                  setNotes('');
                }}
              />
            )}
          </Card>
        );
      })}

      {vsActual && vsActual.lines.some((l: BoqVsActualLine) => l.variance !== 0) && (
        <>
          <Text className="text-sm font-bold text-text mt-2">Cost variance (by category allocation)</Text>
          {vsActual.lines
            .filter((l: BoqVsActualLine) => Math.abs(l.variance) > 0.01)
            .slice(0, 8)
            .map((line: BoqVsActualLine) => (
              <Card key={`var-${line.id}`}>
                <Text className="text-xs font-mono text-muted">{line.itemCode}</Text>
                <Text className="text-sm text-text" numberOfLines={1}>
                  {line.description}
                </Text>
                <View className="flex-row justify-between mt-1">
                  <Text className="text-xs text-muted">BOQ {formatINR(line.boqAmount)}</Text>
                  <Text className="text-xs text-muted">Actual {formatINR(line.actualSpend)}</Text>
                  <Text
                    className={`text-xs font-semibold ${
                      line.variance > 0 ? 'text-danger' : 'text-success'
                    }`}
                  >
                    {line.variance > 0 ? '+' : ''}
                    {formatINR(line.variance)}
                  </Text>
                </View>
              </Card>
            ))}
        </>
      )}

      <AdaptiveSheet
        visible={!!measureItem}
        onClose={() => setMeasureItem(null)}
        title="Record BOQ measurement"
        subtitle={measureItem?.description}
        footer={
          <View className="flex-row gap-3">
            <Button label="Cancel" variant="secondary" onPress={() => setMeasureItem(null)} />
            <Button
              label={recordMeasurement.isPending ? 'Saving...' : 'Save'}
              onPress={onRecord}
              disabled={recordMeasurement.isPending}
            />
          </View>
        }
      >
        <Input
          label={`Quantity (${measureItem?.unit ?? 'unit'})`}
          value={qty}
          onChangeText={setQty}
          keyboardType="numeric"
          placeholder="0"
        />
        <Input
          label="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="e.g. Block A footing"
        />
      </AdaptiveSheet>
    </View>
  );
}
