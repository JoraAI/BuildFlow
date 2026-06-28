/**
 * BuildFlow — Submit support request.
 */
import React, { useState } from 'react';
import { View, Text, Alert, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Card, Input, Button } from '@/components/ui';
import { SettingsPageLayout } from '@/components/layout/SettingsPageLayout';
import { useCreateTicket } from '@/services/settings.queries';
import { useAuthStore } from '@/stores/auth.store';
import { goBackToSettings } from '@/utils/navigation';

const CATEGORIES = [
  { id: 'PROFILE_CHANGE', label: 'Profile / role change' },
  { id: 'COMPANY_CHANGE', label: 'Company info change' },
  { id: 'INTEGRATION_SETUP', label: 'Integration setup' },
  { id: 'BILLING', label: 'Billing & subscription' },
  { id: 'BUG', label: 'Bug report' },
  { id: 'DATA_FIX', label: 'Data correction' },
  { id: 'OTHER', label: 'Other' },
] as const;

export default function CreateTicketScreen() {
  const router = useRouter();
  const { category: catParam, subject: subjectParam, scope: scopeParam } = useLocalSearchParams<{
    category?: string;
    subject?: string;
    scope?: string;
  }>();
  const user = useAuthStore((s) => s.user);
  const create = useCreateTicket();
  const [category, setCategory] = useState<string>(catParam ?? 'PROFILE_CHANGE');
  const [subject, setSubject] = useState(subjectParam ?? '');
  const [description, setDescription] = useState('');
  const [requestedRole, setRequestedRole] = useState('PM');
  const isOwner = user?.role === 'OWNER';

  const ticketScope =
    scopeParam === 'platform' || scopeParam === 'PLATFORM'
      ? 'PLATFORM'
      : category === 'BILLING' && isOwner
        ? 'PLATFORM'
        : category === 'INTEGRATION_SETUP' && isOwner
          ? 'PLATFORM'
          : 'COMPANY';

  const onSubmit = () => {
    if (!subject.trim() || description.trim().length < 10) {
      Alert.alert('Missing details', 'Subject and description (min 10 chars) are required.');
      return;
    }
    const payload =
      category === 'PROFILE_CHANGE'
        ? { requestedRole, requesterEmail: user?.email }
        : undefined;

    create.mutate(
      {
        category,
        subject: subject.trim(),
        description: description.trim(),
        payload,
        scope: ticketScope,
      },
      {
        onSuccess: () => {
          Alert.alert('Submitted', 'Your request was sent.', [
            { text: 'OK', onPress: () => router.replace('/(app)/settings/tickets' as never) },
          ]);
        },
        onError: (e: Error) => Alert.alert('Error', e.message),
      },
    );
  };

  return (
    <SettingsPageLayout title="Submit a request" subtitle="Sent to your company owner for review">
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
        <View className="h-4" />
        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="Describe what you need changed and why..."
        />
        {category === 'PROFILE_CHANGE' && (
          <>
            <View className="h-4" />
            <Input
              label="Requested role (optional)"
              value={requestedRole}
              onChangeText={setRequestedRole}
              placeholder="PM, SUPERVISOR, ACCOUNTANT"
            />
          </>
        )}
      </Card>
      <Button label={create.isPending ? 'Submitting...' : 'Submit request'} onPress={onSubmit} fullWidth />
      <Button label="Cancel" variant="ghost" onPress={goBackToSettings} fullWidth />
    </SettingsPageLayout>
  );
}
