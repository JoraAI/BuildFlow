/**
 * BuildFlow - Data Export screen.
 */
import React from 'react';
import { View, Text, Alert } from 'react-native';
import { Card, Button, LoadingSkeleton } from '@/components/ui';
import { SettingsPageLayout } from '@/components/layout/SettingsPageLayout';
import { ResponsiveGrid } from '@/components/layout/ResponsiveGrid';
import { useViewport } from '@/hooks/useViewport';
import { useExportData, useExportZip } from '@/services/settings.queries';

export default function DataExportScreen() {
  const { isDesktop } = useViewport();
  const exportJson = useExportData();
  const exportZip = useExportZip();
  const isBusy = exportJson.isPending || exportZip.isPending;

  const onExportZip = () => {
    exportZip.mutate(undefined, {
      onSuccess: (filename) => Alert.alert('Exported', `${filename} downloaded.`),
      onError: (e: Error) => Alert.alert('Error', e.message),
    });
  };

  const onExportJson = () => {
    exportJson.mutate(undefined, {
      onSuccess: (filename) => Alert.alert('Exported', `${filename} downloaded.`),
      onError: (e: Error) => Alert.alert('Error', e.message),
    });
  };

  return (
    <SettingsPageLayout
      title="Data Export"
      subtitle="Download company data as ZIP or JSON"
    >
      {isBusy && (
        <View className="mb-4">
          <LoadingSkeleton className="h-24" />
        </View>
      )}

      <ResponsiveGrid gap={16} columns={isDesktop ? 2 : 1}>
        <Card className="h-full">
          <View className="flex-row items-center mb-2">
            <Text className="text-base font-bold text-text flex-1">Full ZIP Archive</Text>
            <View className="bg-accent/20 px-2 py-0.5 rounded-full">
              <Text className="text-xs font-bold text-accent">Recommended</Text>
            </View>
          </View>
          <Text className="text-sm text-text-muted mb-4">
            Compressed ZIP with separate JSON files per entity, manifest, and CSV project summary.
            Best for backup, analysis, or migration.
          </Text>
          <Button
            label={exportZip.isPending ? 'Preparing ZIP...' : 'Download ZIP Archive'}
            onPress={onExportZip}
            disabled={isBusy}
            fullWidth
          />
        </Card>

        <Card className="h-full">
          <Text className="text-base font-bold text-text mb-2">JSON Snapshot</Text>
          <Text className="text-sm text-text-muted mb-4">
            Single-file JSON dump of all company data. Useful for scripting; harder to browse than ZIP.
          </Text>
          <Button
            label={exportJson.isPending ? 'Preparing JSON...' : 'Download JSON Snapshot'}
            onPress={onExportJson}
            disabled={isBusy}
            variant="secondary"
            fullWidth
          />
        </Card>
      </ResponsiveGrid>

      <Card>
        <Text className="text-sm font-bold text-text mb-2">What&apos;s included</Text>
        <View className={isDesktop ? 'flex-row flex-wrap' : ''}>
          {[
            'Company profile',
            'All users & roles (passwords redacted)',
            'All projects, WBS, tasks, predecessors',
            'All estimates + sections + items (all versions)',
            'All BOQ items',
            'All rate analyses + components',
            'All resources & price history',
            'All invoices & line items',
            'All bills & journal entries',
            'All daily reports & material usages',
            'All notifications & chat messages',
            'Complete audit log',
          ].map((item) => (
            <Text
              key={item}
              className={`text-sm text-text-muted py-0.5 ${isDesktop ? 'w-1/2 pr-4' : ''}`}
            >
              ✓ {item}
            </Text>
          ))}
        </View>
        <Text className="text-xs text-text-muted mt-3">
          Exports contain sensitive financial information. Store securely.
        </Text>
      </Card>
    </SettingsPageLayout>
  );
}
