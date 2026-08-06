/**
 * RPT-C2b (UI): Reports & branding settings.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Switch } from 'react-native';
import { Card, Button, Input, LoadingSkeleton } from '@/components/ui';
import { SettingsPageLayout } from '@/components/layout/SettingsPageLayout';
import { useReportSettings, useUpdateReportSettings } from '@/services/settings.queries';
import { useAuthStore } from '@/stores/auth.store';
import { alertAsync } from '@/utils/confirm';

const ACCENT_PRESETS = [
  { label: 'Amber', color: '#F59E0B' },
  { label: 'Navy', color: '#1E3A5F' },
  { label: 'Teal', color: '#0D9488' },
  { label: 'Purple', color: '#7C3AED' },
  { label: 'Red', color: '#DC2626' },
];

export default function ReportBrandingScreen() {
  const user = useAuthStore((s) => s.user);
  const canEdit = user?.role === 'OWNER' || user?.role === 'PM';

  const { data: settings, isLoading } = useReportSettings();
  const updateSettings = useUpdateReportSettings();

  const [accentColor, setAccentColor] = useState('#F59E0B');
  const [showLogo, setShowLogo] = useState(true);
  const [showWatermark, setShowWatermark] = useState(false);
  const [footerText, setFooterText] = useState('');

  useEffect(() => {
    if (!settings) return;
    setAccentColor(settings.accentColor ?? '#F59E0B');
    setShowLogo(settings.showLogo ?? true);
    setShowWatermark(settings.showWatermark ?? false);
    setFooterText(settings.footerText ?? '');
  }, [settings]);

  const onSave = () => {
    updateSettings.mutate(
      { accentColor, showLogo, showWatermark, footerText: footerText.trim() || undefined },
      {
        onSuccess: () => void alertAsync('Saved', 'Report branding settings updated.'),
        onError: (e: Error) => void alertAsync('Error', e.message),
      },
    );
  };

  const body = isLoading ? (
    <LoadingSkeleton className="h-48 rounded-xl" />
  ) : (
    <View className="gap-4">
      <Card>
        <Text className="text-sm font-bold text-text mb-2">Accent Color</Text>
        <Text className="text-xs text-muted mb-2">Used for the top accent bar on PDF reports.</Text>
        <View className="flex-row flex-wrap gap-2">
          {ACCENT_PRESETS.map((preset) => (
            <Pressable
              key={preset.color}
              onPress={() => canEdit && setAccentColor(preset.color)}
              className={`px-3 py-2 rounded-lg border flex-row items-center gap-2 ${
                accentColor === preset.color ? 'border-primary bg-primary/5' : 'border-border'
              }`}
            >
              <View className="w-4 h-4 rounded-full" style={{ backgroundColor: preset.color }} />
              <Text className="text-xs font-semibold text-text">{preset.label}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <View className="flex-row justify-between items-center">
          <View className="flex-1">
            <Text className="text-sm font-bold text-text">Show company logo</Text>
            <Text className="text-xs text-muted mt-0.5">
              Display your company logo in the top-right corner of PDF reports.
            </Text>
          </View>
          <Switch
            value={showLogo}
            onValueChange={canEdit ? setShowLogo : undefined}
            trackColor={{ false: '#CBD5E1', true: '#1E3A5F' }}
          />
        </View>
      </Card>

      <Card>
        <View className="flex-row justify-between items-center">
          <View className="flex-1">
            <Text className="text-sm font-bold text-text">Watermark (beta)</Text>
            <Text className="text-xs text-muted mt-0.5">
              Faint logo watermark centered on each page. Uses the logo from Company Profile.
            </Text>
          </View>
          <Switch
            value={showWatermark}
            onValueChange={canEdit ? setShowWatermark : undefined}
            trackColor={{ false: '#CBD5E1', true: '#1E3A5F' }}
          />
        </View>
      </Card>

      <Card>
        <Input
          label="Custom footer text (optional)"
          value={footerText}
          onChangeText={setFooterText}
          placeholder="e.g. Confidential — For internal use"
          multiline
        />
        <Text className="text-[10px] text-muted mt-1">
          Overrides the default footer text on PDF reports. Leave blank for default.
        </Text>
      </Card>

      {canEdit && (
        <Button label="Save settings" loading={updateSettings.isPending} onPress={onSave} />
      )}
    </View>
  );

  return (
    <SettingsPageLayout
      title="Reports & Branding"
      subtitle="PDF accent color, logo, watermark, and footer"
    >
      {body}
    </SettingsPageLayout>
  );
}
