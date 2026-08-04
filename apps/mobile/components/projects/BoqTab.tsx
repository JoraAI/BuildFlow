/**
 * BuildFlow - BOQ Tab
 * Shows BOQ items grouped by section (from estimate), with category badges.
 */
import React, { useState } from 'react';
import { View, Text, Alert, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AdaptiveSheet } from '@/components/layout/AdaptiveSheet';
import {
  Card,
  Button,
  EmptyState,
  LoadingSkeleton,
  Input,
  ProgressBar,
  Badge,
} from '@/components/ui';
import { TermHint } from '@/components/ui/TermHint';
import { useAuthStore } from '@/stores/auth.store';
import { formatINR } from '@/utils/format';
import {
  useBoq,
  useRecordBoqMeasurement,
  useBoqVsActual,
  type BoqItem,
  type BoqSectionGroup,
  type BoqVsActualLine,
} from '@/services/boq.queries';
import {
  useSubcontractors,
  useCreateWorkOrderFromBoq,
  type Subcontractor,
} from "@/services/expansion.queries";
import { alertAsync } from '@/utils/confirm';

interface BoqTabProps {
  projectId: string;
}

const CATEGORY_BADGE: Record<string, 'primary' | 'success' | 'warning' | 'neutral' | 'accent'> = {
  MATERIAL: 'primary',
  LABOUR: 'warning',
  EQUIPMENT: 'accent',
  SUBCONTRACTOR: 'success',
  MISC: 'neutral',
  VARIATION: 'primary',
  EARTHWORK: 'neutral',
  CONCRETE: 'primary',
  OTHER: 'neutral',
};

function categoryBadgeColor(category: string | null): 'primary' | 'success' | 'warning' | 'neutral' | 'accent' {
  if (!category) return 'neutral';
  return CATEGORY_BADGE[category] ?? 'neutral';
}

function formatCategoryLabel(category: string | null): string {
  if (!category) return 'OTHER';
  // VO-B5: Friendlier label for variation-created BOQ rows.
  if (category === 'VARIATION') return 'New scope (variation)';
  return category.replace(/_/g, ' ');
}

export function BoqTab({ projectId }: BoqTabProps) {
  const user = useAuthStore((s) => s.user);
  const canMeasure =
    user?.role === 'OWNER' || user?.role === 'PM' || user?.role === 'SUPERVISOR';

  const { data: boq, isLoading } = useBoq(projectId);
  const { data: vsActual } = useBoqVsActual(projectId);
  const { data: subcontractors } = useSubcontractors();
  const recordMeasurement = useRecordBoqMeasurement(projectId);
  const createWOBoq = useCreateWorkOrderFromBoq(projectId);

  const [measureItem, setMeasureItem] = useState<BoqItem | null>(null);
  const [woItem, setWoItem] = useState<BoqItem | null>(null);
  const [woNumber, setWoNumber] = useState('');
  const [selectedSub, setSelectedSub] = useState('');
  const [qty, setQty] = useState('');
  const [notes, setNotes] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'section' | 'category'>('section');

  const canManageSub = user?.role === 'OWNER' || user?.role === 'PM';

  const onCreateWoFromBoq = () => {
    if (!woItem || !woNumber.trim() || !selectedSub) {
      void alertAsync('Required', 'WO number and subcontractor are required.');
      return;
    }
    createWOBoq.mutate(
      {
        subcontractorId: selectedSub,
        woNumber: woNumber.trim(),
        boqItemIds: [woItem.id],
        retentionPct: 5,
        advanceAmount: 0,
      },
      {
        onSuccess: async () => {
          setWoItem(null);
          setWoNumber('');
          await alertAsync('Created', 'Work order created from BOQ line.');
        },
        onError: (e: Error) => Alert.alert('Error', e.message),
      },
    );
  };

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

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
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

  // Use sectionGrouped if available, otherwise fall back to grouping manually
  const sections: BoqSectionGroup[] = boq.sectionGrouped ?? groupBySectionFallback(boq.items);

  // For category view, group items by category
  const categoryGroups: BoqSectionGroup[] = (boq.grouped ?? []).map((g: { category: string; amount: number }) => ({
    section: g.category,
    items: boq.items.filter((i: BoqItem) => (i.category ?? 'OTHER') === g.category),
    amount: g.amount,
  }));

  const displayGroups = viewMode === 'section' ? sections : categoryGroups;

  return (
    <View className="gap-3">
      <Card>
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-sm font-bold text-text">BOQ Summary</Text>
          <Text className="text-lg font-bold text-primary">{formatINR(boq.total)}</Text>
        </View>
        <Text className="text-xs text-muted">
          BOQ lines are billable scope. Link estimate MATERIAL lines to catalog resources or rate
          analyses so procurement and procured qty roll up correctly.
        </Text>
        {/* R14-VO1: Helper clarifying variation provenance */}
        <Text className="text-xs text-muted mt-1">
          Sanctioned qty includes approved variations. Lines touched by a variation show a Via chip.
        </Text>
        <View className="mt-2 pt-2 border-t border-border/60 gap-1">
          <Text className="text-[10px] font-semibold text-muted uppercase">Line metrics</Text>
          <Text className="text-[10px] text-muted">
            Sanctioned = approved qty · Executed = work measured on site · Procured = materials received (GRN) · Billed = on client invoice
          </Text>
          <View className="flex-row flex-wrap gap-3 mt-1">
            <TermHint term="EXECUTED" label="Executed" />
            <TermHint term="PROCURED" label="Procured" />
          </View>
        </View>
      </Card>

      {/* View toggle: By Section | By Category */}
      <View className="flex-row gap-2 px-1">
        <Pressable
          onPress={() => setViewMode('section')}
          className={`flex-row items-center gap-1.5 px-3 py-2 rounded-lg border ${viewMode === 'section' ? 'bg-primary border-primary' : 'bg-card border-border'}`}
        >
          <Ionicons name="folder-outline" size={14} color={viewMode === 'section' ? '#fff' : '#64748B'} />
          <Text className={`text-xs font-semibold ${viewMode === 'section' ? 'text-white' : 'text-muted'}`}>
            By Section
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setViewMode('category')}
          className={`flex-row items-center gap-1.5 px-3 py-2 rounded-lg border ${viewMode === 'category' ? 'bg-primary border-primary' : 'bg-card border-border'}`}
        >
          <Ionicons name="pricetag-outline" size={14} color={viewMode === 'category' ? '#fff' : '#64748B'} />
          <Text className={`text-xs font-semibold ${viewMode === 'category' ? 'text-white' : 'text-muted'}`}>
            By Category
          </Text>
        </Pressable>
      </View>

      {/* Items grouped by section or category */}
      {displayGroups.map((grp: BoqSectionGroup) => {
        const isCollapsed = collapsedSections.has(grp.section);
        return (
          <View key={grp.section}>
            <Pressable
              onPress={() => toggleSection(grp.section)}
              className="flex-row items-center justify-between px-1 py-2"
            >
              <View className="flex-row items-center gap-2">
                <Ionicons
                  name={isCollapsed ? 'chevron-down' : 'chevron-up'}
                  size={16}
                  color="#1E3A5F"
                />
                <Text className="text-sm font-bold text-text">{grp.section}</Text>
                <Badge color="neutral" label={`${grp.items.length} items`} />
              </View>
              <Text className="text-sm font-bold text-primary">{formatINR(grp.amount)}</Text>
            </Pressable>

            {!isCollapsed &&
              grp.items.map((item: BoqItem) => {
                const sanctioned = parseFloat(item.quantity);
                const executed = item.executedQty ?? 0;
                const billed = item.billedCumulativeQty ?? 0;
                const progress = item.progressPct ?? 0;
                return (
                  <Card key={item.id}>
                    <View className="flex-row justify-between items-start mb-1">
                      <View className="flex-1 mr-2">
                        <View className="flex-row items-center gap-2 flex-wrap mb-0.5">
                          <Text className="text-xs font-mono text-muted">{item.itemCode}</Text>
                          <Badge
                            label={formatCategoryLabel(item.category)}
                            color={categoryBadgeColor(item.category)}
                          />
                          {/* R14-VO1: Via CO-xxx provenance chip */}
                          {item.variationNumbers?.map((voNum) => (
                            <Badge key={voNum} label={`Via ${voNum}`} color="accent" />
                          ))}
                        </View>
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
                      {(item.procuredQty ?? 0) > 0 && (
                        <Text className="text-xs text-success font-semibold">
                          Procured: {item.procuredQty} {item.unit}
                        </Text>
                      )}
                      <Text className="text-xs text-muted">
                        Billed: {billed} {item.unit}
                      </Text>
                      {item.category === 'MATERIAL' && (item.stockQty ?? 0) > 0 && (
                        <Text className="text-xs text-success font-semibold">
                          Site stock: {item.stockQty} {item.unit}
                        </Text>
                      )}
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
                    {canManageSub && item.category === 'SUBCONTRACTOR' && (
                      <View className="mt-2">
                        <Button
                          label="Create work order"
                          variant="secondary"
                          onPress={() => {
                            setWoItem(item);
                            setWoNumber('');
                            setSelectedSub(subcontractors?.[0]?.id ?? '');
                          }}
                        />
                      </View>
                    )}
                  </Card>
                );
              })}
          </View>
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

      <AdaptiveSheet
        visible={!!woItem}
        onClose={() => setWoItem(null)}
        title="Create work order from BOQ"
        subtitle={woItem?.description}
        footer={
          <Button
            label={createWOBoq.isPending ? 'Creating...' : 'Create WO'}
            onPress={onCreateWoFromBoq}
            disabled={createWOBoq.isPending}
          />
        }
      >
        <Input label="WO Number" value={woNumber} onChangeText={setWoNumber} placeholder="WO-001" />
        <Text className="text-sm font-semibold text-text">Subcontractor</Text>
        {(subcontractors ?? []).map((s: Subcontractor) => (
          <Pressable
            key={s.id}
            onPress={() => setSelectedSub(s.id)}
            className={`p-2 rounded-lg border mb-1 ${
              selectedSub === s.id ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          >
            <Text className="text-sm text-text">{s.name}</Text>
          </Pressable>
        ))}
      </AdaptiveSheet>
    </View>
  );
}

/** Fallback section grouping if backend doesn't return sectionGrouped yet. */
function groupBySectionFallback(items: BoqItem[]): BoqSectionGroup[] {
  const map = new Map<string, BoqItem[]>();
  for (const item of items) {
    const sec = item.section ?? 'Ungrouped';
    const existing = map.get(sec);
    if (existing) existing.push(item);
    else map.set(sec, [item]);
  }
  return Array.from(map.entries()).map(([section, sectionItems]) => ({
    section,
    items: sectionItems,
    amount: sectionItems.reduce((sum, i) => sum + parseFloat(i.amount), 0),
  }));
}