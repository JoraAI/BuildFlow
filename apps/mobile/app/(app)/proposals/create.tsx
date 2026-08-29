import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Input, Button, Card, DateField, Badge } from '@/components/ui';
import { FormScreenHeader } from '@/components/layout/ScreenHeader';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { navigateAppBack, DISMISS } from '@/utils/navigation';
import { alertAsync } from '@/utils/confirm';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { useCreateProposal } from '@/services/proposal.queries';
import { useViewport } from '@/hooks/useViewport';
import { ApiError } from '@/lib/api-client';

const PROJECT_TYPES = [
  { label: 'Heavy Civil', value: 'HEAVY', icon: 'construct', desc: 'Dams, bridges, metro' },
  { label: 'Large', value: 'LARGE', icon: 'business', desc: 'Big buildings, factories' },
  { label: 'Mid', value: 'MID', icon: 'home', desc: 'Mid-size projects' },
  { label: 'Mini', value: 'MINI', icon: 'cube', desc: 'Small works, renovations' },
] as const;

export default function CreateProposalScreen() {
  const router = useRouter();
  const { isDesktop } = useViewport();
  const createProposal = useCreateProposal();

  const [form, setForm] = useState({
    title: '',
    clientName: '',
    clientContact: '',
    projectType: 'MID' as 'HEAVY' | 'LARGE' | 'MID' | 'MINI',
    validUntil: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((p) => ({ ...p, [key]: value }));
    if (errors[key]) setErrors((p) => ({ ...p, [key]: '' }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'Title is required';
    if (!form.clientName.trim()) e.clientName = 'Client name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    setSubmitError(null);
    if (!validate()) return;
    try {
      const created = await createProposal.mutateAsync({
        title: form.title.trim(),
        clientName: form.clientName.trim(),
        clientContact: form.clientContact.trim() || undefined,
        projectType: form.projectType,
        validUntil: form.validUntil || undefined,
        notes: form.notes.trim() || undefined,
      });
      router.replace(`/(app)/proposals/${created.id}` as never);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to create proposal';
      setSubmitError(msg);
      await alertAsync('Error', msg);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={isDesktop ? [] : ['bottom']}>
      <OfflineBanner />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {isDesktop ? (
          <ScreenContainer scrollable constrained>
            <PageHeader
              title="New Proposal"
              subtitle="Create a quote for your client before starting a full project"
              onBack={() => navigateAppBack(DISMISS.proposals)}
            />
            <ScrollView contentContainerClassName="gap-4 pb-8 max-w-5xl">
              <ProposalForm
                form={form}
                setField={setField}
                errors={errors}
                submitError={submitError}
                isCreating={createProposal.isPending}
                onSubmit={handleSubmit}
                onCancel={() => navigateAppBack(DISMISS.proposals)}
                isDesktop
              />
            </ScrollView>
          </ScreenContainer>
        ) : (
          <>
            <FormScreenHeader
              title="New Proposal"
              subtitle="Create a client quote"
              cancelLabel="Cancel"
              cancelIcon="close"
              onCancel={() => navigateAppBack(DISMISS.proposals)}
            />
            <ScrollView contentContainerClassName="p-4 gap-4 pb-8">
              <ProposalForm
                form={form}
                setField={setField}
                errors={errors}
                submitError={submitError}
                isCreating={createProposal.isPending}
                onSubmit={handleSubmit}
                onCancel={() => navigateAppBack(DISMISS.proposals)}
                isDesktop={false}
              />
            </ScrollView>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ProposalForm({
  form,
  setField,
  errors,
  submitError,
  isCreating,
  onSubmit,
  onCancel,
  isDesktop,
}: {
  form: {
    title: string;
    clientName: string;
    clientContact: string;
    projectType: 'HEAVY' | 'LARGE' | 'MID' | 'MINI';
    validUntil: string;
    notes: string;
  };
  setField: <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => void;
  errors: Record<string, string>;
  submitError: string | null;
  isCreating: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  isDesktop: boolean;
}) {
  // Desktop: 2-column layout (left: details + type, right: additional info)
  // Mobile: vertical stack
  const cardsContent = (
    <>
      {/* === LEFT COLUMN (desktop) / TOP (mobile) === */}
      <View className={isDesktop ? 'flex-1 gap-4' : 'gap-4'}>
        {/* Proposal Details */}
        <Card>
          <View className="flex-row items-center gap-2 mb-3">
            <View className="w-8 h-8 rounded-lg bg-primary/10 items-center justify-center">
              <Ionicons name="document-text" size={18} color="#1E3A5F" />
            </View>
            <Text className="text-base font-bold text-text">Proposal Details</Text>
          </View>

          <Input
            label="Proposal title"
            value={form.title}
            onChangeText={(v) => setField('title', v)}
            error={errors.title}
            placeholder="e.g. Metro Station Phase 2 - Civil Works"
          />
          <Input
            label="Client name"
            value={form.clientName}
            onChangeText={(v) => setField('clientName', v)}
            error={errors.clientName}
            placeholder="e.g. Delhi Metro Rail Corporation"
          />
          <Input
            label="Client contact (optional)"
            value={form.clientContact}
            onChangeText={(v) => setField('clientContact', v)}
            placeholder="Phone or email"
          />
        </Card>

        {/* Project Type */}
        <Card>
          <View className="flex-row items-center gap-2 mb-3">
            <View className="w-8 h-8 rounded-lg bg-accent/10 items-center justify-center">
              <Ionicons name="layers" size={18} color="#8B5CF6" />
            </View>
            <Text className="text-base font-bold text-text">Project Type</Text>
          </View>
          <Text className="text-xs text-muted mb-3">
            Select the category that best describes this project
          </Text>
          <View className={isDesktop ? 'flex-row flex-wrap gap-3' : 'gap-2'}>
            {PROJECT_TYPES.map((t) => (
              <Pressable
                key={t.value}
                onPress={() => setField('projectType', t.value)}
                className={`${isDesktop ? 'flex-1 min-w-[140px]' : 'flex-row items-center gap-3'} px-4 py-3 rounded-lg border ${
                  form.projectType === t.value
                    ? 'bg-primary/5 border-primary'
                    : 'bg-card border-border'
                }`}
              >
                {isDesktop ? (
                  <View className="items-center gap-2 py-2">
                    <View className={`w-12 h-12 rounded-xl items-center justify-center ${form.projectType === t.value ? 'bg-primary' : 'bg-border'}`}>
                      <Ionicons name={t.icon as never} size={24} color={form.projectType === t.value ? '#fff' : '#94A3B8'} />
                    </View>
                    <Text className={`text-sm font-semibold ${form.projectType === t.value ? 'text-primary' : 'text-text'}`}>{t.label}</Text>
                    <Text className="text-xs text-muted text-center">{t.desc}</Text>
                    {form.projectType === t.value ? <Ionicons name="checkmark-circle" size={20} color="#1E3A5F" /> : null}
                  </View>
                ) : (
                  <>
                    <View className={`w-10 h-10 rounded-lg items-center justify-center ${form.projectType === t.value ? 'bg-primary' : 'bg-border'}`}>
                      <Ionicons name={t.icon as never} size={20} color={form.projectType === t.value ? '#fff' : '#94A3B8'} />
                    </View>
                    <View className="flex-1">
                      <Text className={`text-sm font-semibold ${form.projectType === t.value ? 'text-primary' : 'text-text'}`}>{t.label}</Text>
                      <Text className="text-xs text-muted">{t.desc}</Text>
                    </View>
                    {form.projectType === t.value ? <Ionicons name="checkmark-circle" size={22} color="#1E3A5F" /> : null}
                  </>
                )}
              </Pressable>
            ))}
          </View>
        </Card>
      </View>

      {/* === RIGHT COLUMN (desktop) / BOTTOM (mobile) === */}
      <View className={isDesktop ? 'flex-1' : ''}>
        {/* Additional Info */}
        <Card>
          <View className="flex-row items-center gap-2 mb-3">
            <View className="w-8 h-8 rounded-lg bg-warning/10 items-center justify-center">
              <Ionicons name="calendar" size={18} color="#F59E0B" />
            </View>
            <Text className="text-base font-bold text-text">Additional Info</Text>
          </View>

          <DateField
            label="Quote valid until (optional)"
            value={form.validUntil}
            onChange={(v) => setField('validUntil', v)}
          />
          <Input
            label="Notes / Scope summary"
            value={form.notes}
            onChangeText={(v) => setField('notes', v)}
            multiline
            placeholder="What's included..."
          />
        </Card>
      </View>
    </>
  );

  return (
    <>
      {/* Error banner */}
      {submitError ? (
        <Card className="border-danger bg-danger/5">
          <View className="flex-row items-center gap-2">
            <Ionicons name="alert-circle" size={20} color="#EF4444" />
            <Text className="text-sm text-danger flex-1">{submitError}</Text>
          </View>
        </Card>
      ) : null}

      {/* Cards layout: side-by-side on desktop, stacked on mobile */}
      <View className={isDesktop ? 'flex-row gap-6 items-start' : ''}>
        {cardsContent}
      </View>

      {/* Action button */}
      <Button
        label={isCreating ? 'Creating…' : 'Create Proposal'}
        onPress={onSubmit}
        disabled={isCreating}
        loading={isCreating}
        icon={<Ionicons name="add-circle" size={20} color="#fff" />}
        fullWidth={!isDesktop}
      />
    </>
  );
}