/**
 * BuildFlow — Create Estimate wizard (3 steps).
 * Step 1: Setup (name, notes, overhead/contingency/profit %)
 * Step 2: Build (sections + line items)
 * Step 3: Review (summary + submit/save)
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Badge, ProgressBar } from '@/components/ui';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { SummaryBreakdownCard } from '@/components/ui';
import {
  useCreateEstimate,
  useEstimateMutations,
  useEstimate,
} from '@/services/estimate.queries';
import { formatINR } from '@/utils/format';

type Step = 1 | 2 | 3;

export default function CreateEstimateScreen() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const createMut = useCreateEstimate(projectId);

  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [overheadPct, setOverheadPct] = useState('8');
  const [contingencyPct, setContingencyPct] = useState('5');
  const [profitPct, setProfitPct] = useState('10');
  const [estimateId, setEstimateId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function ensureEstimate() {
    if (estimateId) return estimateId;
    setCreating(true);
    try {
      const est = await createMut.mutateAsync({
        name: name.trim() || 'Untitled Estimate',
        notes: notes.trim() || undefined,
        overheadPct: parseFloat(overheadPct) || 0,
        contingencyPct: parseFloat(contingencyPct) || 0,
        profitMarginPct: parseFloat(profitPct) || 0,
      });
      setEstimateId(est.id);
      return est.id;
    } catch (e) {
      Alert.alert('Failed to create estimate', e instanceof Error ? e.message : '');
      return null;
    } finally {
      setCreating(false);
    }
  }

  async function goStep2() {
    if (!name.trim()) return Alert.alert('Enter estimate name');
    const id = await ensureEstimate();
    if (id) setStep(2);
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['bottom']}>
      <OfflineBanner />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-4 py-3 border-b border-border">
          <Pressable onPress={() => router.back()} className="mr-3">
            <Text className="text-primary text-lg">‹ Cancel</Text>
          </Pressable>
          <Text className="text-lg font-bold text-text flex-1">New Estimate</Text>
          {/* Step indicator */}
          <Text className="text-sm text-text-muted">Step {step}/3</Text>
        </View>
        <ProgressBar value={(step / 3) * 100} />

        {step === 1 && (
          <Step1Setup
            name={name}
            setName={setName}
            notes={notes}
            setNotes={setNotes}
            overheadPct={overheadPct}
            setOverheadPct={setOverheadPct}
            contingencyPct={contingencyPct}
            setContingencyPct={setContingencyPct}
            profitPct={profitPct}
            setProfitPct={setProfitPct}
            onNext={goStep2}
            creating={creating}
          />
        )}

        {step === 2 && estimateId && (
          <Step2Build
            estimateId={estimateId}
            overheadPct={parseFloat(overheadPct) || 0}
            contingencyPct={parseFloat(contingencyPct) || 0}
            profitPct={parseFloat(profitPct) || 0}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}

        {step === 3 && estimateId && (
          <Step3Review
            estimateId={estimateId}
            onBack={() => setStep(2)}
            onDone={() => router.back()}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1: Setup                                                        */
/* ------------------------------------------------------------------ */
function Step1Setup({
  name,
  setName,
  notes,
  setNotes,
  overheadPct,
  setOverheadPct,
  contingencyPct,
  setContingencyPct,
  profitPct,
  setProfitPct,
  onNext,
  creating,
}: {
  name: string;
  setName: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  overheadPct: string;
  setOverheadPct: (v: string) => void;
  contingencyPct: string;
  setContingencyPct: (v: string) => void;
  profitPct: string;
  setProfitPct: (v: string) => void;
  onNext: () => void;
  creating: boolean;
}) {
  return (
    <ScrollView className="flex-1" contentContainerClassName="p-4 gap-4 pb-32">
      <Card>
        <Text className="text-sm font-semibold text-text mb-1">Estimate Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Initial Estimate"
          placeholderTextColor="#94A3B8"
          className="border border-border rounded-lg px-3 py-2.5 text-text mb-3"
        />
        <Text className="text-sm font-semibold text-text mb-1">Notes / Assumptions</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Assumptions, exclusions, validity..."
          placeholderTextColor="#94A3B8"
          multiline
          className="border border-border rounded-lg px-3 py-2.5 text-text min-h-[80px]"
        />
      </Card>

      <Card>
        <Text className="text-base font-semibold text-text mb-3">Add-ons</Text>
        <PercentRow label="Overhead & Admin" value={overheadPct} onChange={setOverheadPct} />
        <PercentRow label="Contingency" value={contingencyPct} onChange={setContingencyPct} />
        <PercentRow label="Profit Margin" value={profitPct} onChange={setProfitPct} />
      </Card>

      <View className="mt-auto" />
      <Button label="Next: Build Line Items" onPress={onNext} loading={creating} fullWidth />
    </ScrollView>
  );
}

function PercentRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View className="flex-row justify-between items-center py-2">
      <Text className="text-sm text-text">{label}</Text>
      <View className="flex-row items-center">
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          className="border border-border rounded px-3 py-1.5 text-sm text-text w-20 text-right"
        />
        <Text className="text-sm text-text-muted ml-1">%</Text>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2: Build                                                        */
/* ------------------------------------------------------------------ */
function Step2Build({
  estimateId,
  overheadPct,
  contingencyPct,
  profitPct,
  onBack,
  onNext,
}: {
  estimateId: string;
  overheadPct: number;
  contingencyPct: number;
  profitPct: number;
  onBack: () => void;
  onNext: () => void;
}) {
  const mut = useEstimateMutations(estimateId);
  const [newSectionName, setNewSectionName] = useState('');
  const [showAddSection, setShowAddSection] = useState(false);
  const { data: estimate, isLoading } = useEstimate(estimateId);

  const summary = estimate?.summary;

  if (isLoading) return <Text className="p-4 text-text-muted">Loading...</Text>;

  const sections = estimate?.sections ?? [];

  return (
    <View className="flex-1">
      <ScrollView className="flex-1" contentContainerClassName="p-4 gap-3 pb-40">
        {/* Add section toggle */}
        {showAddSection ? (
          <Card>
            <TextInput
              value={newSectionName}
              onChangeText={setNewSectionName}
              placeholder="Section name (e.g. Substructure)"
              placeholderTextColor="#94A3B8"
              className="border border-border rounded-lg px-3 py-2.5 text-text mb-2"
            />
            <View className="flex-row gap-2">
              <Button
                label="Add"
                size="sm"
                onPress={async () => {
                  if (!newSectionName.trim()) return;
                  await mut.addSection.mutateAsync({ name: newSectionName.trim() });
                  setNewSectionName('');
                  setShowAddSection(false);
                }}
              />
              <Button label="Cancel" size="sm" variant="ghost" onPress={() => setShowAddSection(false)} />
            </View>
          </Card>
        ) : (
          <Pressable onPress={() => setShowAddSection(true)} className="py-2">
            <Text className="text-primary text-sm font-semibold">+ Add Section</Text>
          </Pressable>
        )}

        {/* Sections */}
        {sections.map((sec: { id: string; name: string; items: Array<{ id: string; description: string; unit: string; quantity: string; rate: string; amount: string; type: string }> }) => {
          const secTotal = sec.items.reduce((s: number, it: { amount: string }) => s + parseFloat(it.amount), 0);
          return (
            <Card key={sec.id}>
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-base font-semibold text-text">{sec.name}</Text>
                <Text className="text-sm font-bold text-primary">{formatINR(secTotal)}</Text>
              </View>
              {sec.items.map((it) => (
                <View key={it.id} className="border-t border-border py-2">
                  <View className="flex-row justify-between">
                    <Text className="text-sm text-text flex-1 mr-2" numberOfLines={2}>{it.description}</Text>
                    <Text className="text-sm font-semibold text-text">{formatINR(parseFloat(it.amount))}</Text>
                  </View>
                  <View className="flex-row gap-3 mt-0.5">
                    <Text className="text-xs text-text-muted">{parseFloat(it.quantity)} {it.unit}</Text>
                    <Text className="text-xs text-text-muted">@ {formatINR(parseFloat(it.rate))}</Text>
                    <Badge label={it.type} color="neutral" />
                  </View>
                </View>
              ))}
              <AddItemRow sectionId={sec.id} mut={mut} />
            </Card>
          );
        })}

        {sections.length === 0 && (
          <Text className="text-sm text-text-muted text-center py-8">Add a section to start building your estimate.</Text>
        )}
      </ScrollView>

      {/* Live grand total bar */}
      {summary && (
        <View className="border-t border-border bg-card px-4 py-3">
          <View className="flex-row justify-between mb-1">
            <Text className="text-xs text-text-muted">Direct Cost</Text>
            <Text className="text-xs text-text">{formatINR(summary.subtotal)}</Text>
          </View>
          <View className="flex-row justify-between mb-1">
            <Text className="text-xs text-text-muted">+OH/Cont/Profit ({overheadPct + contingencyPct + profitPct}%)</Text>
            <Text className="text-xs text-text">
              {formatINR(summary.overheadAmount + summary.contingencyAmount + summary.profitMarginAmount)}
            </Text>
          </View>
          <View className="flex-row justify-between items-center pt-1 border-t border-border mt-1">
            <Text className="text-sm font-bold text-text">Grand Total</Text>
            <Text className="text-lg font-bold text-primary">{formatINR(summary.grandTotal)}</Text>
          </View>
          <View className="flex-row gap-2 mt-3">
            <Button label="‹ Back" variant="secondary" size="sm" onPress={onBack} />
            <View className="flex-1" />
            <Button label="Next: Review" size="sm" onPress={onNext} />
          </View>
        </View>
      )}
    </View>
  );
}

function AddItemRow({
  sectionId,
  mut,
}: {
  sectionId: string;
  mut: ReturnType<typeof useEstimateMutations>;
}) {
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState('');
  const [unit, setUnit] = useState('cum');
  const [qty, setQty] = useState('1');
  const [rate, setRate] = useState('0');
  const [type, setType] = useState<'MATERIAL' | 'LABOUR' | 'EQUIPMENT' | 'SUBCONTRACTOR' | 'MISC'>('MATERIAL');

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} className="pt-2">
        <Text className="text-primary text-xs font-semibold">+ Add Item</Text>
      </Pressable>
    );
  }

  return (
    <View className="mt-2 border border-border rounded-lg p-2 gap-1.5">
      <TextInput
        value={desc}
        onChangeText={setDesc}
        placeholder="Description"
        placeholderTextColor="#94A3B8"
        className="border border-border rounded px-2 py-1.5 text-sm text-text"
      />
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Text className="text-xs text-text-muted">Qty</Text>
          <TextInput
            value={qty}
            onChangeText={setQty}
            keyboardType="decimal-pad"
            className="border border-border rounded px-2 py-1.5 text-sm text-text"
          />
        </View>
        <View style={{ width: 70 }}>
          <Text className="text-xs text-text-muted">Unit</Text>
          <TextInput
            value={unit}
            onChangeText={setUnit}
            className="border border-border rounded px-2 py-1.5 text-sm text-text"
          />
        </View>
        <View className="flex-1">
          <Text className="text-xs text-text-muted">Rate ₹</Text>
          <TextInput
            value={rate}
            onChangeText={setRate}
            keyboardType="decimal-pad"
            className="border border-border rounded px-2 py-1.5 text-sm text-text"
          />
        </View>
      </View>
      <View className="flex-row items-center justify-between">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1">
          {(['MATERIAL', 'LABOUR', 'EQUIPMENT', 'SUBCONTRACTOR', 'MISC'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setType(t)}
              className={`px-2 py-1 rounded ${type === t ? 'bg-primary' : 'bg-border'}`}
            >
              <Text className={`text-[10px] ${type === t ? 'text-white' : 'text-text'}`}>{t}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text className="text-xs font-semibold text-text">
          = {formatINR((parseFloat(qty) || 0) * (parseFloat(rate) || 0))}
        </Text>
      </View>
      <View className="flex-row gap-2 mt-1">
        <Button
          label="Add"
          size="sm"
          onPress={async () => {
            if (!desc.trim()) return;
            await mut.addItem.mutateAsync({
              sectionId,
              description: desc.trim(),
              unit: unit.trim() || 'unit',
              quantity: parseFloat(qty) || 0,
              rate: parseFloat(rate) || 0,
              type,
            });
            setDesc('');
            setQty('1');
            setRate('0');
            setOpen(false);
          }}
        />
        <Button label="Cancel" size="sm" variant="ghost" onPress={() => setOpen(false)} />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Step 3: Review                                                       */
/* ------------------------------------------------------------------ */
function Step3Review({
  estimateId,
  onBack,
  onDone,
}: {
  estimateId: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const mut = useEstimateMutations(estimateId);
  const { data: estimate, isLoading } = useEstimate(estimateId);

  if (isLoading || !estimate) return <Text className="p-4 text-text-muted">Loading...</Text>;
  const s = estimate.summary;

  const breakdownRows = [
    { label: 'Materials', amount: s.materialCost, pct: s.materialPct, color: '#1E3A5F' },
    { label: 'Labour', amount: s.labourCost, pct: s.labourPct, color: '#F59E0B' },
    { label: 'Equipment', amount: s.equipmentCost, pct: s.equipmentPct, color: '#10B981' },
    { label: 'Subcontractor', amount: s.subcontractorCost, pct: s.subPct, color: '#8B5CF6' },
    { label: 'Misc', amount: s.miscCost, pct: s.miscPct, color: '#94A3B8' },
  ];

  return (
    <ScrollView className="flex-1" contentContainerClassName="p-4 gap-4 pb-32">
      <Text className="text-lg font-bold text-text">Review & Summary</Text>

      {/* Meta */}
      <Card>
        <Text className="text-sm text-text-muted">Project Estimate</Text>
        <Text className="text-base font-semibold text-text">{estimate.name}</Text>
        <Text className="text-xs text-text-muted mt-1">
          v{estimate.version}.0 • by {estimate.createdByUser?.name ?? 'Unknown'}
        </Text>
      </Card>

      {/* Direct costs by section */}
      <Card>
        <Text className="text-sm font-bold text-text mb-2">Direct Costs by Section</Text>
        {estimate.sections.map((sec: { id: string; name: string; items: Array<{ amount: string }> }) => {
          const total = sec.items.reduce((sum: number, it: { amount: string }) => sum + parseFloat(it.amount), 0);
          return (
            <View key={sec.id} className="flex-row justify-between py-1">
              <Text className="text-sm text-text">{sec.name}</Text>
              <Text className="text-sm font-semibold text-text">{formatINR(total)}</Text>
            </View>
          );
        })}
        <View className="flex-row justify-between pt-2 mt-1 border-t border-border">
          <Text className="text-sm font-bold text-text">Subtotal</Text>
          <Text className="text-sm font-bold text-primary">{formatINR(s.subtotal)}</Text>
        </View>
      </Card>

      {/* Breakdown by type */}
      <SummaryBreakdownCard rows={breakdownRows} totalLabel="Subtotal" total={s.subtotal} />

      {/* Add-ons */}
      <Card>
        <Text className="text-sm font-bold text-text mb-2">Add-ons</Text>
        <View className="flex-row justify-between py-1">
          <Text className="text-sm text-text-muted">Overhead ({s.overheadPct}%)</Text>
          <Text className="text-sm text-text">{formatINR(s.overheadAmount)}</Text>
        </View>
        <View className="flex-row justify-between py-1">
          <Text className="text-sm text-text-muted">Contingency ({s.contingencyPct}%)</Text>
          <Text className="text-sm text-text">{formatINR(s.contingencyAmount)}</Text>
        </View>
        <View className="flex-row justify-between py-1">
          <Text className="text-sm text-text-muted">Profit ({s.profitMarginPct}%)</Text>
          <Text className="text-sm text-text">{formatINR(s.profitMarginAmount)}</Text>
        </View>
        <View className="flex-row justify-between pt-2 mt-1 border-t border-border">
          <Text className="text-sm font-bold text-text">Total Before Tax</Text>
          <Text className="text-sm font-bold text-text">{formatINR(s.grandTotalBeforeGST)}</Text>
        </View>
        <View className="flex-row justify-between py-1">
          <Text className="text-sm text-text-muted">GST (weighted)</Text>
          <Text className="text-sm text-text">{formatINR(s.gstAmount)}</Text>
        </View>
        <View className="flex-row justify-between pt-2 mt-1 border-t border-border">
          <Text className="text-base font-bold text-text">Grand Total</Text>
          <Text className="text-lg font-bold text-primary">{formatINR(s.grandTotal)}</Text>
        </View>
      </Card>

      {/* Actions */}
      <View className="gap-2 mt-2">
        <Button label="‹ Back" variant="secondary" onPress={onBack} />
        <Button
          label="Save as Draft"
          variant="secondary"
          onPress={() => {
            onDone();
          }}
        />
        <Button
          label="Submit for Review"
          onPress={async () => {
            try {
              await mut.submit.mutateAsync();
              onDone();
            } catch (e) {
              Alert.alert('Submit failed', e instanceof Error ? e.message : '');
            }
          }}
          loading={mut.submit.isPending}
        />
      </View>
    </ScrollView>
  );
}