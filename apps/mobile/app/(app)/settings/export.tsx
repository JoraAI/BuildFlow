/**
 * BuildFlow — Data Export screen.
 *
 * Owner-only. Offers two export formats:
 *  - ZIP archive (multi-file JSON + CSV summary, recommended)
 *  - Single JSON snapshot (quick, legacy)
 */
import React from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Button, LoadingSkeleton } from '@/components/ui';
import { useExportData, useExportZip } from '@/services/settings.queries';
import * as Sharing from 'expo-sharing';

export default function DataExportScreen() {
  const exportJson = useExportData();
  const exportZip = useExportZip();
  const isBusy = exportJson.isPending || exportZip.isPending;

  const onExportZip = () => {
    exportZip.mutate(undefined, {
      onSuccess: async (path: string) => {
        try {
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(path, { mimeType: 'application/zip', dialogTitle: 'BuildFlow Data Export' });
          } else {
            Alert.alert('Exported', `ZIP saved to: ${path}`);
          }
        } catch (e) {
          Alert.alert('Error', (e as Error).message);
        }
      },
      onError: (e: Error) => Alert.alert('Error', e.message),
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-6">
        <Text className="text-2xl font-bold text-text pt-4 pb-4">Data Export</Text>

        {isBusy && (
          <View className="mb-4">
            <LoadingSkeleton className="h-24" />
          </View>
        )}

        {/* ZIP — recommended */}
        <Card className="mb-4">
          <View className="flex-row items-center mb-2">
            <Text className="text-base font-bold text-text flex-1">Full ZIP Archive</Text>
            <View className="bg-accent/20 px-2 py-0.5 rounded-full">
              <Text className="text-xs font-bold text-accent">Recommended</Text>
            </View>
          </View>
          <Text className="text-sm text-text-muted mb-4">
            Downloads a compressed ZIP with separate JSON files for each entity (projects,
            estimates, BOQ, invoices, bills, reports, users, audit logs, etc.) plus a
            manifest and CSV project summary. Best for backup, external analysis, or migration.
          </Text>
          <Button
            label={exportZip.isPending ? 'Preparing ZIP...' : '⬇ Download ZIP Archive'}
            onPress={onExportZip}
            disabled={isBusy}
            fullWidth
          />
        </Card>

        {/* JSON snapshot — legacy */}
        <Card className="mb-4">
          <Text className="text-base font-bold text-text mb-2">JSON Snapshot (single file)</Text>
          <Text className="text-sm text-text-muted mb-4">
            Quick single-file JSON dump of all company data. Useful for ad-hoc scripting,
            but harder to read than the ZIP for humans.
          </Text>
          <Button
            label={exportJson.isPending ? 'Preparing JSON...' : 'Download JSON Snapshot'}
            onPress={() =>
              exportJson.mutate(undefined, {
                onError: (e: Error) => Alert.alert('Error', e.message),
                onSuccess: () => Alert.alert('Exported', 'JSON snapshot ready (see downloads).'),
              })
            }
            disabled={isBusy}
            variant="secondary"
            fullWidth
          />
        </Card>

        <Card>
          <Text className="text-sm font-bold text-text mb-2">What's included</Text>
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
            <Text key={item} className="text-sm text-text-muted py-0.5">
              ✓ {item}
            </Text>
          ))}
          <Text className="text-xs text-text-muted mt-3">
            ⚠️ Exports contain sensitive financial information. Store securely and share only with authorized personnel.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}