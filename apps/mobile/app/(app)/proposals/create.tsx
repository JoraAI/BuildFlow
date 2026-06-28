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
import { Input, Button, Card, DateField } from '@/components/ui';
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
  { label: 'Heavy Civil', value: 'HEAVY' },
  { label: 'Large', value: 'LARGE' },
  { label: 'Mid', value: 'MID' },
  { label: 'Mini', value: 'MINI' },
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

  const formBody = (
    <CreateProposalForm
      form={form}
      setField={setField}
      errors={errors}
      submitError={submitError}
      createProposal={createProposal}
      onSubmit={handleSubmit}
    />
  );

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
              subtitle="Quote a client before creating a full project"
            />
            <ScrollView contentContainerClassName="gap-4 pb-8">
              {formBody}
            </ScrollView>
          </ScreenContainer>
        ) : (
          <>
            <FormScreenHeader
              title="New Proposal"
              subtitle="Quote a client before creating a full project"
              cancelLabel="Cancel"
              cancelIcon="close"
              onCancel={() => navigateAppBack(DISMISS.proposals)}
            />
            <ScrollView contentContainerClassName="p-4 gap-4 pb-8">
              {formBody}
            </ScrollView>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function CreateProposalForm({
  form,
  setField,
  errors,
  submitError,
  createProposal,
  onSubmit,
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
  createProposal: ReturnType<typeof useCreateProposal>;
  onSubmit: () => void;
}) {
  return (
    <>
      {submitError ? (
        <Card className="border-danger bg-danger/5">
          <Text className="text-sm text-danger">{submitError}</Text>
        </Card>
      ) : null}

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
      />
      <Input
        label="Client contact"
        value={form.clientContact}
        onChangeText={(v) => setField('clientContact', v)}
        placeholder="Phone or email"
      />

      <View>
        <Text className="text-sm font-medium text-text mb-2">Project type</Text>
        <View className="flex-row flex-wrap gap-2">
          {PROJECT_TYPES.map((t) => (
            <Pressable
              key={t.value}
              onPress={() => setField('projectType', t.value)}
              className={`px-4 py-2 rounded-lg border ${
                form.projectType === t.value ? 'bg-primary border-primary' : 'bg-card border-border'
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  form.projectType === t.value ? 'text-white' : 'text-muted'
                }`}
              >
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <DateField
        label="Quote valid until (optional)"
        value={form.validUntil}
        onChange={(v) => setField('validUntil', v)}
      />

      <Input
        label="Notes (optional)"
        value={form.notes}
        onChangeText={(v) => setField('notes', v)}
        multiline
      />

      <Button
        label={createProposal.isPending ? 'Creating…' : 'Create Proposal'}
        onPress={onSubmit}
        disabled={createProposal.isPending}
      />
    </>
  );
}
