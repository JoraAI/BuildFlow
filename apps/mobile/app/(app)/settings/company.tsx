/**
 * BuildFlow — Company Profile settings screen.
 */
import React, { useState, useEffect } from 'react';
import { View, KeyboardAvoidingView, Platform, Alert, Text } from 'react-native';
import { Card, Input, Button, LoadingSkeleton, CompanyLogo } from '@/components/ui';
import { SettingsPageLayout } from '@/components/layout/SettingsPageLayout';
import { useViewport } from '@/hooks/useViewport';
import { goBackToSettings } from '@/utils/navigation';
import { useCompany, useUpdateCompany } from '@/services/settings.queries';
import { useAuthStore } from '@/stores/auth.store';

export default function CompanyProfileScreen() {
  const { isDesktop } = useViewport();
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const { data: company, isLoading } = useCompany();
  const update = useUpdateCompany();

  const [form, setForm] = useState({
    name: '',
    gstin: '',
    pan: '',
    address: '',
    state: '',
    logoUrl: '',
  });

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name ?? '',
        gstin: company.gstin ?? '',
        pan: company.pan ?? '',
        address: company.address ?? '',
        state: company.state ?? '',
        logoUrl: company.logoUrl ?? '',
      });
    }
  }, [company]);

  const onSave = () => {
    update.mutate(
      {
        ...form,
        logoUrl: form.logoUrl.trim() || undefined,
      },
      {
        onSuccess: async () => {
          await refreshUser();
          Alert.alert('Saved', 'Company profile updated.');
          goBackToSettings();
        },
        onError: (e: Error) => Alert.alert('Error', e.message),
      },
    );
  };

  const formContent = isLoading ? (
    <View className="gap-3">
      <LoadingSkeleton className="h-12" />
      <LoadingSkeleton className="h-48" />
    </View>
  ) : (
    <>
      <Card className="mb-4">
        <Text className="text-sm font-semibold text-text mb-3">Company logo</Text>
        <View className="flex-row items-center gap-4 mb-4">
          <CompanyLogo
            name={form.name || 'Company'}
            logoUrl={company?.logoDisplayUrl ?? (form.logoUrl.startsWith('http') ? form.logoUrl : null)}
            size={72}
          />
          <View className="flex-1">
            <Input
              label="Logo URL"
              value={form.logoUrl}
              onChangeText={(v) => setForm((f) => ({ ...f, logoUrl: v }))}
              placeholder="https://..."
              helper="Paste a public image URL (HTTPS)"
            />
          </View>
        </View>
        <Input
          label="Company Name"
          value={form.name}
          onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
        />
        <View className={isDesktop ? 'flex-row gap-4 mt-4' : 'mt-4'}>
          <View className={isDesktop ? 'flex-1' : ''}>
            <Input
              label="GSTIN"
              value={form.gstin}
              onChangeText={(v) => setForm((f) => ({ ...f, gstin: v.toUpperCase() }))}
              autoCapitalize="characters"
              helper="15-character GST identification number"
            />
          </View>
          <View className={isDesktop ? 'flex-1' : 'mt-4'}>
            <Input
              label="PAN"
              value={form.pan}
              onChangeText={(v) => setForm((f) => ({ ...f, pan: v.toUpperCase() }))}
              autoCapitalize="characters"
            />
          </View>
        </View>
        <View className="mt-4">
          <Input
            label="State"
            value={form.state}
            onChangeText={(v) => setForm((f) => ({ ...f, state: v }))}
            helper="Used for GST intra/inter-state calculation"
          />
        </View>
        <View className="mt-4">
          <Input
            label="Registered Address"
            value={form.address}
            onChangeText={(v) => setForm((f) => ({ ...f, address: v }))}
            multiline
          />
        </View>
      </Card>

      <View className={isDesktop ? 'max-w-xs' : ''}>
        <Button
          label={update.isPending ? 'Saving...' : 'Save Changes'}
          onPress={onSave}
          disabled={update.isPending}
          fullWidth
        />
      </View>
    </>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1"
    >
      <SettingsPageLayout
        title="Company Profile"
        subtitle="Legal name, tax IDs, and registered address"
        maxWidth="narrow"
      >
        {formContent}
      </SettingsPageLayout>
    </KeyboardAvoidingView>
  );
}
