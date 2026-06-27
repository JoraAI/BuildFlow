/**
 * BuildFlow — Company Profile settings screen.
 *
 * Owner-only. Edit company name, GSTIN, PAN, address, state.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Card, Input, Button, LoadingSkeleton } from '@/components/ui';
import { useCompany, useUpdateCompany } from '@/services/settings.queries';

export default function CompanyProfileScreen() {
  const router = useRouter();
  const { data: company, isLoading } = useCompany();
  const update = useUpdateCompany();

  const [form, setForm] = useState({
    name: '',
    gstin: '',
    pan: '',
    address: '',
    state: '',
  });

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name ?? '',
        gstin: company.gstin ?? '',
        pan: company.pan ?? '',
        address: company.address ?? '',
        state: company.state ?? '',
      });
    }
  }, [company]);

  const onSave = () => {
    update.mutate(form, {
      onSuccess: () => {
        Alert.alert('Saved', 'Company profile updated.');
        router.back();
      },
      onError: (e: Error) => Alert.alert('Error', e.message),
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <View className="p-4">
          <LoadingSkeleton className="h-12 mb-4" />
          <LoadingSkeleton className="h-48" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView className="flex-1" contentContainerClassName="px-4 pb-6">
          <Text className="text-2xl font-bold text-text pt-4 pb-4">Company Profile</Text>

          <Card className="mb-4">
            <Input
              label="Company Name"
              value={form.name}
              onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
            />
            <View className="h-4" />
            <Input
              label="GSTIN"
              value={form.gstin}
              onChangeText={(v) => setForm((f) => ({ ...f, gstin: v.toUpperCase() }))}
              autoCapitalize="characters"
              helper="15-character GST identification number"
            />
            <View className="h-4" />
            <Input
              label="PAN"
              value={form.pan}
              onChangeText={(v) => setForm((f) => ({ ...f, pan: v.toUpperCase() }))}
              autoCapitalize="characters"
            />
            <View className="h-4" />
            <Input
              label="State"
              value={form.state}
              onChangeText={(v) => setForm((f) => ({ ...f, state: v }))}
              helper="Used for GST intra/inter-state calculation"
            />
            <View className="h-4" />
            <Input
              label="Registered Address"
              value={form.address}
              onChangeText={(v) => setForm((f) => ({ ...f, address: v }))}
              multiline
            />
          </Card>

          <Button
            label={update.isPending ? 'Saving...' : 'Save Changes'}
            onPress={onSave}
            disabled={update.isPending}
            fullWidth
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}