/**
 * BuildFlow - Company Profile settings screen.
 */
import React, { useState, useEffect } from 'react';
import { View, KeyboardAvoidingView, Platform, Text } from 'react-native';
import { Card, Input, Button, LoadingSkeleton, CompanyLogo } from '@/components/ui';
import { SettingsPageLayout } from '@/components/layout/SettingsPageLayout';
import { useViewport } from '@/hooks/useViewport';
import { goBackToSettings } from '@/utils/navigation';
import { useCompany, useUpdateCompany, useCompanyLogoUpload } from '@/services/settings.queries';
import { useAuthStore } from '@/stores/auth.store';
import { alertAsync } from '@/utils/confirm';
import { pickImage } from '@/utils/pick-image';

export default function CompanyProfileScreen() {
  const { isDesktop } = useViewport();
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const { data: company, isLoading } = useCompany();
  const update = useUpdateCompany();
  const uploadLogo = useCompanyLogoUpload();

  const [form, setForm] = useState({
    name: '',
    gstin: '',
    pan: '',
    address: '',
    state: '',
    logoUrl: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

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
      setPreviewUri(null);
    }
  }, [company]);

  const onSave = () => {
    setFormError(null);
    update.mutate(
      {
        name: form.name,
        gstin: form.gstin,
        pan: form.pan,
        address: form.address,
        state: form.state,
        logoUrl: form.logoUrl.trim() || undefined,
      },
      {
        onSuccess: async () => {
          await refreshUser();
          await alertAsync('Saved', 'Company profile updated.');
          goBackToSettings();
        },
        onError: async (e: Error) => {
          setFormError(e.message);
          await alertAsync('Error', e.message);
        },
      },
    );
  };

  const pickAndUploadLogo = async () => {
    setFormError(null);
    try {
      const result = await pickImage({ allowsEditing: true, aspect: [1, 1] });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const filename = asset.fileName ?? `company-logo-${Date.now()}.jpg`;
      const contentType = asset.mimeType ?? 'image/jpeg';
      const logoUrl = await uploadLogo.mutateAsync({
        uri: asset.uri,
        filename,
        contentType,
      });
      setForm((f) => ({ ...f, logoUrl }));
      setPreviewUri(asset.uri);
      await update.mutateAsync({ logoUrl });
      await refreshUser();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not upload logo');
    }
  };

  const clearLogo = async () => {
    setFormError(null);
    try {
      setForm((f) => ({ ...f, logoUrl: '' }));
      setPreviewUri(null);
      await update.mutateAsync({ logoUrl: null });
      await refreshUser();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not remove logo');
    }
  };

  const displayLogo =
    previewUri ??
    company?.logoDisplayUrl ??
    (form.logoUrl.startsWith('http') ? form.logoUrl : null);

  const formContent = isLoading ? (
    <View className="gap-3">
      <LoadingSkeleton className="h-12" />
      <LoadingSkeleton className="h-48" />
    </View>
  ) : (
    <>
      <Card className="mb-4">
        <Text className="text-sm font-semibold text-text mb-3">Company logo</Text>
        <View className="flex-row items-center gap-4 mb-3">
          <CompanyLogo name={form.name || 'Company'} logoUrl={displayLogo} size={80} />
          <View className="flex-1">
            <Text className="text-xs text-muted mb-2">
              Upload a square logo for invoices and reports (top-right on Tax Invoice PDFs).
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <Button
                label={displayLogo ? 'Change logo' : 'Upload logo'}
                variant="secondary"
                size="sm"
                loading={uploadLogo.isPending || update.isPending}
                onPress={() => void pickAndUploadLogo()}
              />
              {displayLogo ? (
                <Button
                  label="Remove"
                  variant="ghost"
                  size="sm"
                  loading={update.isPending}
                  onPress={() => void clearLogo()}
                />
              ) : null}
            </View>
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

      {formError ? (
        <View className="mb-3 px-3 py-2 rounded-lg bg-danger/10 border border-danger/30">
          <Text className="text-sm text-danger">{formError}</Text>
        </View>
      ) : null}

      <View className={isDesktop ? 'max-w-xs' : ''}>
        <Button
          label={update.isPending ? 'Saving...' : 'Save Changes'}
          onPress={onSave}
          disabled={update.isPending}
          loading={update.isPending}
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
        subtitle="Legal name, tax IDs, logo, and registered address"
        maxWidth="narrow"
      >
        {formContent}
      </SettingsPageLayout>
    </KeyboardAvoidingView>
  );
}
