/**
 * BuildFlow - Submit support request.
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Card, Input, Button } from '@/components/ui';
import { SettingsPageLayout } from '@/components/layout/SettingsPageLayout';
import { useCreateTicket } from '@/services/settings.queries';
import { useAuthStore } from '@/stores/auth.store';
import { goBackToSettings } from '@/utils/navigation';
import { alertAsync } from '@/utils/confirm';

const CATEGORIES = [
  { id: 'PROFILE_CHANGE', label: 'Profile / role change' },
  { id: 'COMPANY_CHANGE', label: 'Company info change' },
  { id: 'INTEGRATION_SETUP', label: 'Integration setup' },
  { id: 'BILLING', label: 'Billing & subscription' },
  { id: 'BUG', label: 'Bug report' },
  { id: 'DATA_FIX', label: 'Data correction' },
  { id: 'OTHER', label: 'Other' },
] as const;

type CategoryId = (typeof CATEGORIES)[number]['id'];

function paramString(value: string | string[] | undefined): string | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function normalizeCategory(value: string | undefined): CategoryId {
  const match = CATEGORIES.find((c) => c.id === value);
  return match?.id ?? 'PROFILE_CHANGE';
}

export default function CreateTicketScreen() {
  const router = useRouter();
  const { category: catParam, subject: subjectParam, scope: scopeParam } = useLocalSearchParams<{
    category?: string | string[];
    subject?: string | string[];
    scope?: string | string[];
  }>();
  const user = useAuthStore((s) => s.user);
  const create = useCreateTicket();
  const [category, setCategory] = useState<CategoryId>(normalizeCategory(paramString(catParam)));
  const [subject, setSubject] = useState(paramString(subjectParam) ?? '');
  const [description, setDescription] = useState('');
  const [requestedRole, setRequestedRole] = useState('PM');
  const [formError, setFormError] = useState<string | null>(null);
  const isOwner = user?.role === 'OWNER';

  const scopeHint = paramString(scopeParam);
  const ticketScope =
    scopeHint === 'platform' || scopeHint === 'PLATFORM'
      ? 'PLATFORM'
      : category === 'BILLING' && isOwner
        ? 'PLATFORM'
        : category === 'INTEGRATION_SETUP' && isOwner
          ? 'PLATFORM'
          : 'COMPANY';

  const onSubmit = () => {
    setFormError(null);

    const trimmedSubject = subject.trim();
    const trimmedDescription = description.trim();

    if (!trimmedSubject) {
      setFormError('Subject is required.');
      return;
    }
    if (trimmedSubject.length < 3) {
      setFormError('Subject must be at least 3 characters.');
      return;
    }
    if (trimmedDescription.length < 10) {
      setFormError('Description must be at least 10 characters.');
      return;
    }

    const payload =
      category === 'PROFILE_CHANGE'
        ? { requestedRole, requesterEmail: user?.email }
        : undefined;

    create.mutate(
      {
        category,
        subject: trimmedSubject,
        description: trimmedDescription,
        payload,
        scope: ticketScope,
      },
      {
        onSuccess: async () => {
          await alertAsync('Submitted', 'Your request was sent.');
          router.replace('/(app)/settings/tickets' as never);
        },
        onError: async (e: Error) => {
          setFormError(e.message);
          await alertAsync('Error', e.message);
        },
      },
    );
  };

  return (
    <SettingsPageLayout
      title="Submit a request"
      subtitle={
        ticketScope === 'PLATFORM'
          ? 'Sent to BuildFlow support for review'
          : 'Sent to your company owner for review'
      }
    >
      <Card className="mb-4">
        <Text className="text-sm font-semibold text-text mb-2">Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
          <View className="flex-row gap-2">
            {CATEGORIES.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setCategory(c.id)}
                className={`px-3 py-2 rounded-lg border ${category === c.id ? 'bg-primary border-primary' : 'bg-card border-border'}`}
              >
                <Text className={`text-xs font-medium ${category === c.id ? 'text-white' : 'text-text'}`}>
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
        <Input label="Subject" value={subject} onChangeText={setSubject} />
        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="Describe what you need changed and why..."
          helper="Minimum 10 characters"
          error={formError && description.trim().length < 10 ? formError : undefined}
        />
        {category === 'PROFILE_CHANGE' && (
          <Input
            label="Requested role (optional)"
            value={requestedRole}
            onChangeText={setRequestedRole}
            placeholder="PM, SUPERVISOR, ACCOUNTANT"
          />
        )}
      </Card>
      {formError ? (
        <View className="mb-3 px-3 py-2 rounded-lg bg-danger/10 border border-danger/30">
          <Text className="text-sm text-danger">{formError}</Text>
        </View>
      ) : null}
      <Button
        label="Submit request"
        onPress={onSubmit}
        fullWidth
        loading={create.isPending}
        disabled={create.isPending}
      />
      <View className="h-2" />
      <Button label="Cancel" variant="ghost" onPress={goBackToSettings} fullWidth disabled={create.isPending} />
    </SettingsPageLayout>
  );
}
