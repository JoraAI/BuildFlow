import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Input, Button, Card } from '@/components/ui';
import { FormScreenHeader } from '@/components/layout/ScreenHeader';
import { dismissTo, DISMISS } from '@/utils/navigation';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { useCreateProject } from '@/services/project.queries';
import { ApiError } from '@/lib/api-client';

const PROJECT_TYPES = [
  { label: 'Heavy Civil', value: 'HEAVY' },
  { label: 'Large', value: 'LARGE' },
  { label: 'Mid', value: 'MID' },
  { label: 'Mini', value: 'MINI' },
];

export default function CreateProjectScreen() {
  const router = useRouter();
  const createProject = useCreateProject();

  const [form, setForm] = useState({
    name: '',
    code: '',
    clientName: '',
    clientContact: '',
    type: 'MID' as 'HEAVY' | 'LARGE' | 'MID' | 'MINI',
    locationAddress: '',
    startDate: '',
    endDate: '',
    budget: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Project name is required';
    if (!form.code.trim()) e.code = 'Project code is required';
    if (!form.clientName.trim()) e.clientName = 'Client name is required';
    if (form.budget && isNaN(parseFloat(form.budget))) e.budget = 'Budget must be a number';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    try {
      const created = await createProject.mutateAsync({
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        type: form.type,
        clientName: form.clientName.trim(),
        clientContact: form.clientContact.trim() || undefined,
        locationAddress: form.locationAddress.trim() || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        budget: form.budget ? parseFloat(form.budget) : undefined,
      });
      Alert.alert(
        'Project created',
        'Assign team members now or do it later from project Settings.',
        [
          {
            text: 'Assign members',
            onPress: () => router.replace(`/(app)/projects/${created.id}?tab=settings`),
          },
          { text: 'Later', onPress: () => router.replace('/projects'), style: 'cancel' },
        ],
      );
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to create project';
      Alert.alert('Error', msg);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <OfflineBanner />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <FormScreenHeader
          title="New Project"
          subtitle="Add a project to start planning and tracking"
          onCancel={() => dismissTo(DISMISS.projectsCreate)}
        />

        <ScrollView
          contentContainerClassName="px-4 py-4 pb-32"
          keyboardShouldPersistTaps="handled"
        >
          <Card className="mb-4">
            <Text className="text-base font-bold text-text mb-3">Basic Info</Text>
            <Input
              label="Project Name"
              value={form.name}
              onChangeText={(v) => set('name', v)}
              placeholder="e.g. NH-65 Road Widening"
              error={errors.name}
            />
            <Input
              label="Project Code"
              value={form.code}
              onChangeText={(v) => set('code', v)}
              placeholder="e.g. NH65-RW-2025"
              error={errors.code}
              helper="Unique code, used in BOQ and invoice references"
            />
            <Input
              label="Client Name"
              value={form.clientName}
              onChangeText={(v) => set('clientName', v)}
              placeholder="e.g. NHAI"
              error={errors.clientName}
            />
            <Input
              label="Client Contact"
              value={form.clientContact}
              onChangeText={(v) => set('clientContact', v)}
              placeholder="Phone or email"
              keyboardType="phone-pad"
            />
          </Card>

          <Card className="mb-4">
            <Text className="text-base font-bold text-text mb-3">Classification</Text>
            <Text className="text-sm font-semibold text-text mb-2">Project Type</Text>
            <View className="flex-row flex-wrap gap-2 mb-2">
              {PROJECT_TYPES.map((t) => (
                <Pressable
                  key={t.value}
                  onPress={() => set('type', t.value as typeof form.type)}
                  className={`px-4 py-2 rounded-lg border ${
                    form.type === t.value ? 'bg-primary border-primary' : 'bg-card border-border'
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      form.type === t.value ? 'text-white' : 'text-text'
                    }`}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card>

          <Card className="mb-4">
            <Text className="text-base font-bold text-text mb-3">Location & Schedule</Text>
            <Input
              label="Site Address"
              value={form.locationAddress}
              onChangeText={(v) => set('locationAddress', v)}
              placeholder="Site location"
              multiline
            />
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Input
                  label="Start Date"
                  value={form.startDate}
                  onChangeText={(v) => set('startDate', v)}
                  placeholder="YYYY-MM-DD"
                />
              </View>
              <View className="flex-1">
                <Input
                  label="End Date"
                  value={form.endDate}
                  onChangeText={(v) => set('endDate', v)}
                  placeholder="YYYY-MM-DD"
                />
              </View>
            </View>
            <Input
              label="Budget (₹)"
              value={form.budget}
              onChangeText={(v) => set('budget', v)}
              placeholder="0"
              keyboardType="numeric"
              error={errors.budget}
              helper="Can be left empty — set automatically when an estimate is approved"
            />
          </Card>

          <Button
            label="Create Project"
            onPress={handleSubmit}
            loading={createProject.isPending}
            fullWidth
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}