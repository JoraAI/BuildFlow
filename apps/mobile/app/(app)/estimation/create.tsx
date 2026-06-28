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
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, ProgressBar } from '@/components/ui';
import { ActionBar } from '@/components/layout/ActionBar';
import { FormScreenHeader } from '@/components/layout/ScreenHeader';
import { EstimateBuildStep } from '@/components/estimation/EstimateBuildStep';
import { useViewport } from '@/hooks/useViewport';
import { dismissTo, DISMISS } from '@/utils/navigation';
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

  const cancelTarget = projectId
    ? DISMISS.estimationForProject(projectId)
    : DISMISS.estimation;

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['bottom']}>
      <OfflineBanner />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <FormScreenHeader
          title="New Estimate"
          subtitle={`Step ${step} of 3`}
          onCancel={() => dismissTo(cancelTarget)}
        />
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
          <EstimateBuildStep
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
            onDone={() => dismissTo(cancelTarget)}
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
  const { isDesktop } = useViewport();
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
    <View className="flex-1">
    <ScrollView className="flex-1" contentContainerClassName={isDesktop ? 'px-8 py-4 gap-4 pb-8' : 'p-4 gap-4 pb-32'}>
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
    </ScrollView>
    <ActionBar>
      <Button label="Back" variant="secondary" size="sm" onPress={onBack} />
      <Button label="Save as Draft" variant="secondary" size="sm" onPress={onDone} />
      <Button
        label="Submit for Review"
        size="sm"
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
    </ActionBar>
    </View>
  );
}