/**
 * BuildFlow - Rate Analysis create/edit screen.
 * Component builder with live total box.
 */
import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card } from '@/components/ui';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { FormScreenHeader } from '@/components/layout/ScreenHeader';
import { dismissTo, DISMISS } from '@/utils/navigation';
import { alertAsync } from '@/utils/confirm';
import {
  useResources,
  useRateAnalysis,
  useCreateRateAnalysis,
  useUpdateRateAnalysis,
  type Resource,
  type RateAnalysisComponent,
} from '@/services/estimate.queries';
import { formatINR } from '@/utils/format';

type CType = 'MATERIAL' | 'LABOUR' | 'EQUIPMENT' | 'MISC';
interface DraftComp {
  id: string;
  resourceId?: string;
  resourceName?: string;
  miscName?: string;
  quantityPerUnit: string;
  unit: string;
  rate: string;
  type: CType;
}
const uid = () => Math.random().toString(36).slice(2);

const SECTIONS: { label: string; type: CType }[] = [
  { label: 'Materials', type: 'MATERIAL' },
  { label: 'Labour', type: 'LABOUR' },
  { label: 'Equipment', type: 'EQUIPMENT' },
  { label: 'Miscellaneous', type: 'MISC' },
];

export default function RateAnalysisEditorScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id && id !== 'new';

  const { data: resourcesData } = useResources();
  const { data: existing } = useRateAnalysis(isEdit ? id! : '');
  const createMut = useCreateRateAnalysis();
  const updateMut = useUpdateRateAnalysis(isEdit ? id! : '');

  const resources = resourcesData?.data ?? [];

  const [name, setName] = useState('');
  const [unit, setUnit] = useState('cum');
  const [description, setDescription] = useState('');
  const [components, setComponents] = useState<DraftComp[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Hydrate from existing (edit mode)
  React.useEffect(() => {
    if (isEdit && existing && !hydrated) {
      setName(existing.name);
      setUnit(existing.unit);
      setDescription(existing.description ?? '');
      setComponents(
        existing.components.map((c: RateAnalysisComponent) => ({
          id: c.id,
          resourceId: c.resourceId ?? undefined,
          resourceName: c.resource?.name ?? undefined,
          miscName: c.miscName ?? undefined,
          quantityPerUnit: String(c.quantityPerUnit),
          unit: c.unit,
          rate: String(c.rate),
          type: c.type,
        })),
      );
      setHydrated(true);
    }
  }, [isEdit, existing, hydrated]);

  const totals = useMemo(() => {
    const t = { material: 0, labour: 0, equipment: 0, misc: 0 };
    for (const c of components) {
      const amt = (parseFloat(c.quantityPerUnit) || 0) * (parseFloat(c.rate) || 0);
      if (c.type === 'MATERIAL') t.material += amt;
      else if (c.type === 'LABOUR') t.labour += amt;
      else if (c.type === 'EQUIPMENT') t.equipment += amt;
      else t.misc += amt;
    }
    return { ...t, total: t.material + t.labour + t.equipment + t.misc };
  }, [components]);

  function addComponent(type: CType) {
    setComponents((prev) => [
      ...prev,
      { id: uid(), quantityPerUnit: '1', unit: '', rate: '0', type, miscName: type === 'MISC' ? '' : undefined },
    ]);
  }
  function updateComp(cid: string, patch: Partial<DraftComp>) {
    setComponents((prev) => prev.map((c) => (c.id === cid ? { ...c, ...patch } : c)));
  }
  function removeComp(cid: string) {
    setComponents((prev) => prev.filter((c) => c.id !== cid));
  }

  async function handleSave() {
    if (!name.trim()) {
      setFormError('Name required');
      await alertAsync('Required', 'Name required');
      return;
    }
    if (components.length === 0) {
      setFormError('Add at least one component');
      await alertAsync('Required', 'Add at least one component');
      return;
    }
    setFormError(null);
    const payload = {
      name: name.trim(),
      unit: unit.trim() || 'unit',
      description: description.trim() || undefined,
      components: components.map((c) => ({
        resourceId: c.type !== 'MISC' ? c.resourceId : undefined,
        miscName: c.type === 'MISC' ? c.miscName : undefined,
        quantityPerUnit: parseFloat(c.quantityPerUnit) || 0,
        unit: c.unit.trim() || 'unit',
        rate: parseFloat(c.rate) || 0,
        type: c.type,
      })),
    };
    try {
      if (isEdit) await updateMut.mutateAsync(payload);
      else await createMut.mutateAsync(payload);
      dismissTo(DISMISS.rateAnalysis);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setFormError(msg);
      await alertAsync('Save failed', msg);
    }
  }

  const saving = createMut.isPending || updateMut.isPending;

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['bottom']}>
      <OfflineBanner />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <FormScreenHeader
          title={isEdit ? 'Edit Rate Analysis' : 'New Rate Analysis'}
          cancelLabel="Back"
          onCancel={() => dismissTo(DISMISS.rateAnalysis)}
        />

        <ScrollView className="flex-1" contentContainerClassName="p-4 gap-4 pb-32">
          {formError ? (
            <View className="px-3 py-2 rounded-lg bg-danger/10 border border-danger/30">
              <Text className="text-sm text-danger">{formError}</Text>
            </View>
          ) : null}
          {/* Header fields */}
          <Card>
            <Text className="text-sm font-semibold text-text mb-1">Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. RCC M25 (1:1:2) with Fe500 TMT"
              placeholderTextColor="#94A3B8"
              className="border border-border rounded-lg px-3 py-2.5 text-text mb-3"
            />
            <Text className="text-sm font-semibold text-text mb-1">Unit</Text>
            <TextInput
              value={unit}
              onChangeText={setUnit}
              placeholder="cum, sqm, kg..."
              placeholderTextColor="#94A3B8"
              className="border border-border rounded-lg px-3 py-2.5 text-text mb-3"
            />
            <Text className="text-sm font-semibold text-text mb-1">Description (optional)</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Notes about this analysis..."
              placeholderTextColor="#94A3B8"
              multiline
              className="border border-border rounded-lg px-3 py-2.5 text-text min-h-[60px]"
            />
          </Card>

          {/* Component sections */}
          {SECTIONS.map((sec) => {
            const rows = components.filter((c) => c.type === sec.type);
            const secTotal = rows.reduce((s, c) => s + (parseFloat(c.quantityPerUnit) || 0) * (parseFloat(c.rate) || 0), 0);
            return (
              <Card key={sec.type}>
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-base font-semibold text-text">{sec.label}</Text>
                  <Text className="text-sm font-semibold text-primary">{formatINR(secTotal)}</Text>
                </View>
                {rows.map((c) => (
                  <View key={c.id} className="border border-border rounded-lg p-2 mb-2 gap-1.5">
                    {sec.type === 'MISC' ? (
                      <TextInput
                        value={c.miscName ?? ''}
                        onChangeText={(v) => updateComp(c.id, { miscName: v })}
                        placeholder="Description (e.g. Shuttering)"
                        placeholderTextColor="#94A3B8"
                        className="border border-border rounded px-2 py-1.5 text-sm text-text"
                      />
                    ) : (
                      <Pressable
                        onPress={() => setPickerFor(pickerFor === c.id ? null : c.id)}
                        className="border border-border rounded px-2 py-1.5"
                      >
                        <Text className={`text-sm ${c.resourceId ? 'text-text' : 'text-text-muted'}`}>
                          {c.resourceId
                            ? (resources.find((r: Resource) => r.id === c.resourceId)?.name ?? c.resourceName ?? 'Select resource...')
                            : 'Select resource...'}
                        </Text>
                      </Pressable>
                    )}
                    {pickerFor === c.id && (
                      <View className="border border-border rounded max-h-[160px] overflow-hidden">
                        <ScrollView nestedScrollEnabled className="max-h-[160px]">
                          {resources
                            .filter((r: Resource) => (sec.type === 'MATERIAL' ? r.type === 'MATERIAL' : r.type === sec.type))
                            .map((r: Resource) => (
                              <Pressable
                                key={r.id}
                                onPress={() => {
                                  updateComp(c.id, { resourceId: r.id, resourceName: r.name, unit: r.unit, rate: String(r.rate) });
                                  setPickerFor(null);
                                }}
                                className="px-2 py-2 border-b border-border"
                              >
                                <Text className="text-sm text-text">{r.name}</Text>
                                <Text className="text-xs text-text-muted">
                                  {formatINR(r.rate)}/{r.unit}
                                </Text>
                              </Pressable>
                            ))}
                        </ScrollView>
                      </View>
                    )}
                    <View className="flex-row gap-2">
                      <View className="flex-1">
                        <Text className="text-xs text-text-muted">Qty/unit</Text>
                        <TextInput
                          value={c.quantityPerUnit}
                          onChangeText={(v) => updateComp(c.id, { quantityPerUnit: v })}
                          keyboardType="decimal-pad"
                          className="border border-border rounded px-2 py-1.5 text-sm text-text"
                        />
                      </View>
                      <View style={{ width: 70 }}>
                        <Text className="text-xs text-text-muted">Unit</Text>
                        <TextInput
                          value={c.unit}
                          onChangeText={(v) => updateComp(c.id, { unit: v })}
                          className="border border-border rounded px-2 py-1.5 text-sm text-text"
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs text-text-muted">Rate ₹</Text>
                        <TextInput
                          value={c.rate}
                          onChangeText={(v) => updateComp(c.id, { rate: v })}
                          keyboardType="decimal-pad"
                          className="border border-border rounded px-2 py-1.5 text-sm text-text"
                        />
                      </View>
                      <View style={{ width: 80 }}>
                        <Text className="text-xs text-text-muted">Amount</Text>
                        <Text className="text-sm font-semibold text-text py-1.5">
                          {formatINR((parseFloat(c.quantityPerUnit) || 0) * (parseFloat(c.rate) || 0))}
                        </Text>
                      </View>
                    </View>
                    <Pressable onPress={() => removeComp(c.id)}>
                      <Text className="text-danger text-xs text-right">Remove</Text>
                    </Pressable>
                  </View>
                ))}
                <Pressable onPress={() => addComponent(sec.type)} className="py-1.5">
                  <Text className="text-primary text-sm font-semibold">+ Add {sec.label.slice(0, -1)}</Text>
                </Pressable>
              </Card>
            );
          })}
        </ScrollView>

        {/* Live total box */}
        <View className="absolute bottom-0 left-0 right-0 bg-card border-t border-border p-4">
          <View className="flex-row justify-between mb-0.5">
            <Text className="text-xs text-text-muted">Materials</Text>
            <Text className="text-xs text-text">{formatINR(totals.material)}</Text>
          </View>
          <View className="flex-row justify-between mb-0.5">
            <Text className="text-xs text-text-muted">Labour</Text>
            <Text className="text-xs text-text">{formatINR(totals.labour)}</Text>
          </View>
          <View className="flex-row justify-between mb-0.5">
            <Text className="text-xs text-text-muted">Equipment</Text>
            <Text className="text-xs text-text">{formatINR(totals.equipment)}</Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text className="text-xs text-text-muted">Miscellaneous</Text>
            <Text className="text-xs text-text">{formatINR(totals.misc)}</Text>
          </View>
          <View className="flex-row justify-between items-center pt-2 border-t border-border mb-3">
            <Text className="text-base font-bold text-text">TOTAL RATE</Text>
            <Text className="text-lg font-bold text-primary">
              {formatINR(totals.total)}/{unit || 'unit'}
            </Text>
          </View>
          <Button label={isEdit ? 'Update' : 'Save'} onPress={handleSave} loading={saving} fullWidth />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}