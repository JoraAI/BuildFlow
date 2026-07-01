import React, { useEffect } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Badge, Input, Button } from '@/components/ui';
import { MaterialPicker } from '@/components/materials/MaterialPicker';
import { useMaterialRate } from '@/services/project.queries';
import type { Resource } from '@/services/estimate.queries';
import type { BoqItem } from '@/services/boq.queries';
import type { BoqShortfall } from '@/services/expansion.queries';
import type { MaterialRateSource } from '@buildflow/shared';

export interface IndentDraftLine {
  id: string;
  resourceId: string;
  boqItemId: string;
  qty: string;
  expectedRate: string;
  rateSource?: string;
  rateManual: boolean;
}

export function emptyIndentLine(): IndentDraftLine {
  return {
    id: Math.random().toString(36).slice(2),
    resourceId: '',
    boqItemId: '',
    qty: '1',
    expectedRate: '',
    rateManual: false,
  };
}

const RATE_SOURCE_LABEL: Record<string, string> = {
  PROJECT: 'Project override',
  BOQ: 'BOQ',
  ESTIMATE: 'Estimate',
  REGION: 'Regional',
  LAST_PO: 'Last PO',
  CATALOG: 'Catalog',
  MANUAL: 'Manual',
};

function categoryBadgeColor(category: string | null): 'primary' | 'success' | 'warning' | 'neutral' | 'accent' {
  const map: Record<string, 'primary' | 'success' | 'warning' | 'neutral' | 'accent'> = {
    MATERIAL: 'primary',
    LABOUR: 'warning',
    EQUIPMENT: 'accent',
    CONCRETE: 'primary',
    EARTHWORK: 'neutral',
  };
  if (!category) return 'neutral';
  return map[category] ?? 'neutral';
}

function formatCategoryLabel(category: string | null): string {
  if (!category) return 'OTHER';
  return category.replace(/_/g, ' ');
}

function lineTotal(qty: string, rate: string): number {
  return (parseFloat(qty) || 0) * (parseFloat(rate) || 0);
}

function applyBoqToLine(
  line: IndentDraftLine,
  boq: BoqItem | null,
  shortfalls: BoqShortfall[],
): IndentDraftLine {
  if (!boq) {
    return { ...line, boqItemId: '', rateManual: false };
  }
  const preview = shortfalls.find((s) => s.boqItemId === boq.id);
  const remaining =
    boq.balanceQty ?? Math.max(0, parseFloat(boq.quantity) - (boq.executedQty ?? 0));
  const suggested = preview?.shortfall ?? remaining;
  return {
    ...line,
    boqItemId: boq.id,
    resourceId: boq.resourceId ?? line.resourceId,
    qty: suggested > 0 ? String(suggested) : line.qty,
    rateManual: false,
  };
}

export function IndentDraftLineCard({
  projectId,
  index,
  line,
  materials,
  boqItems,
  shortfalls,
  canRemove,
  onChange,
  onRemove,
}: {
  projectId: string;
  index: number;
  line: IndentDraftLine;
  materials: Resource[];
  boqItems: BoqItem[];
  shortfalls: BoqShortfall[];
  canRemove: boolean;
  onChange: (line: IndentDraftLine) => void;
  onRemove: () => void;
}) {
  const selectedMaterial = materials.find((r) => r.id === line.resourceId);
  const selectedBoq = boqItems.find((b) => b.id === line.boqItemId);

  const rateQ = useMaterialRate(projectId, line.resourceId, {
    boqItemId: line.boqItemId || undefined,
    enabled: !!line.resourceId,
  });

  useEffect(() => {
    if (!rateQ.data || line.rateManual) return;
    const nextRate = String(rateQ.data.rate);
    if (line.expectedRate === nextRate && line.rateSource === rateQ.data.source) return;
    onChange({
      ...line,
      expectedRate: nextRate,
      rateSource: rateQ.data.source,
    });
  }, [
    rateQ.data,
    line.rateManual,
    line.expectedRate,
    line.rateSource,
    line.resourceId,
    line.boqItemId,
    line.id,
    line.qty,
    onChange,
  ]);

  const total = lineTotal(line.qty, line.expectedRate);

  return (
    <View className="border border-border rounded-lg p-3 gap-2">
      <View className="flex-row justify-between items-center">
        <Text className="text-xs font-semibold text-muted">Line {index + 1}</Text>
        {canRemove ? (
          <Button label="Remove" size="sm" variant="secondary" onPress={onRemove} />
        ) : null}
      </View>

      {boqItems.length > 0 ? (
        <View className="gap-1">
          <Text className="text-xs text-muted">Link to BOQ (optional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1">
            <Pressable
              onPress={() => onChange(applyBoqToLine(line, null, shortfalls))}
              className={`px-2 py-1 rounded border ${!line.boqItemId ? 'bg-primary border-primary' : 'border-border'}`}
            >
              <Text className={`text-[10px] ${!line.boqItemId ? 'text-white' : 'text-muted'}`}>None</Text>
            </Pressable>
            {boqItems.map((b) => (
              <Pressable
                key={b.id}
                onPress={() => onChange(applyBoqToLine(line, b, shortfalls))}
                className={`px-2 py-1 rounded border max-w-[160px] ${line.boqItemId === b.id ? 'bg-primary border-primary' : 'border-border'}`}
              >
                <Text
                  className={`text-[10px] font-semibold ${line.boqItemId === b.id ? 'text-white' : 'text-text'}`}
                  numberOfLines={1}
                >
                  {b.itemCode}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {selectedBoq ? (
            <View className="flex-row items-center gap-1 flex-wrap">
              <Badge
                label={formatCategoryLabel(selectedBoq.category)}
                color={categoryBadgeColor(selectedBoq.category)}
              />
              <Text className="text-[10px] text-muted flex-1" numberOfLines={1}>
                {selectedBoq.description}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <Text className="text-xs font-semibold text-text">Material</Text>
      {selectedMaterial ? (
        <Text className="text-xs text-primary font-semibold">
          Selected: {selectedMaterial.name} ({selectedMaterial.unit})
        </Text>
      ) : null}
      <MaterialPicker
        selectedId={line.resourceId}
        onSelect={(r) =>
          onChange({ ...line, resourceId: r.id, rateManual: false })
        }
        maxHeight={140}
      />

      <View className="gap-2">
        <Input
          label="Quantity"
          value={line.qty}
          onChangeText={(qty) => onChange({ ...line, qty })}
          keyboardType="numeric"
        />
        <Input
          label="Expected rate (₹)"
          value={line.expectedRate}
          onChangeText={(expectedRate) =>
            onChange({
              ...line,
              expectedRate,
              rateSource: 'MANUAL',
              rateManual: true,
            })
          }
          keyboardType="numeric"
        />
      </View>

      {rateQ.data && !line.rateManual ? (
        <Text className="text-[10px] text-primary">
          Suggested: Rs {rateQ.data.rate} ({RATE_SOURCE_LABEL[rateQ.data.source] ?? rateQ.data.source})
        </Text>
      ) : null}
      {total > 0 ? (
        <Text className="text-xs text-muted text-right">Line est. Rs {total.toFixed(0)}</Text>
      ) : null}
    </View>
  );
}

export function indentLineTotal(line: IndentDraftLine): number {
  return lineTotal(line.qty, line.expectedRate);
}
