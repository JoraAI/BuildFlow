/**
 * Backup shop data + jump to report Excel downloads.
 */
import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Button, toast } from '@/components/ui';
import { InventoryHubCard } from '@/components/inventory/InventoryHubCard';
import { INVENTORY_REPORT_LINKS } from '@/components/inventory/inventory-report-links';
import { mobileListBottomPadding } from '@/components/layout/fab-layout';
import { downloadInventoryExcel } from '@/services/inventory-analytics.queries';
import { useInventoryBackupJson, useInventoryBackupZip } from '@/services/settings.queries';
import { useRouter } from 'expo-router';
import { useViewport } from '@/hooks/useViewport';

export default function InventoryBackupScreen() {
  const router = useRouter();
  const { isPhone, isDesktop } = useViewport();
  const [excelBusy, setExcelBusy] = useState<string | null>(null);
  const backupZip = useInventoryBackupZip();
  const backupJson = useInventoryBackupJson();
  const backingUp = backupZip.isPending || backupJson.isPending;

  const runBackup = (kind: 'zip' | 'json') => {
    const mut = kind === 'zip' ? backupZip : backupJson;
    mut.mutate(undefined, {
      onSuccess: (filename) => toast.success(`${filename} ready`),
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const exportReport = async (report: 'pnl' | 'margin' | 'stock-health' | 'expenses') => {
    setExcelBusy(report);
    try {
      await downloadInventoryExcel(report);
      toast.success('Excel downloaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExcelBusy(null);
    }
  };

  const col = isDesktop ? 'w-[48%]' : 'w-full';

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerStyle={{
        padding: isDesktop ? 24 : 16,
        paddingBottom: isPhone ? mobileListBottomPadding() + 24 : 48,
        maxWidth: isDesktop ? 960 : undefined,
        width: '100%',
        alignSelf: 'center',
        gap: 12,
      }}
    >
      <Text className="text-2xl font-bold text-text">Backup</Text>
      <Text className="text-sm text-muted">
        Download a snapshot of this shop. Passwords are left out. Keep the file somewhere safe.
      </Text>

      <View className={`flex-row flex-wrap ${isDesktop ? 'gap-3' : 'gap-2'}`}>
        <View className={col}>
          <InventoryHubCard
            icon="archive-outline"
            title="Full ZIP backup"
            subtitle="Separate files for items, parties, invoices, bills, cash book, and orders"
            meta={backupZip.isPending ? 'Preparing…' : 'Recommended'}
            disabled={backingUp}
            onPress={() => runBackup('zip')}
          />
        </View>
        <View className={col}>
          <InventoryHubCard
            icon="code-slash-outline"
            title="JSON snapshot"
            subtitle="Single file for scripts or a quick copy"
            meta={backupJson.isPending ? 'Preparing…' : 'Download'}
            disabled={backingUp}
            onPress={() => runBackup('json')}
          />
        </View>
      </View>

      <View className="rounded-2xl border border-border bg-card p-4">
        <Text className="text-sm font-semibold text-text mb-2">Included in the backup</Text>
        <View className={isDesktop ? 'flex-row flex-wrap' : ''}>
          {[
            'Company and team (passwords redacted)',
            'Items, warehouses, and parties',
            'Invoices, bills, and cash book',
            'Sales orders, POs, and GRNs',
          ].map((item) => (
            <Text
              key={item}
              className={`text-xs text-muted py-0.5 ${isDesktop ? 'w-1/2 pr-3' : ''}`}
            >
              • {item}
            </Text>
          ))}
        </View>
      </View>

      <Text className="text-sm font-semibold text-text mt-2">Report Excel</Text>
      <Text className="text-xs text-muted">
        Open the live report, or download a spreadsheet from here.
      </Text>
      <View className={`flex-row flex-wrap ${isDesktop ? 'gap-3' : 'gap-2'}`}>
        {INVENTORY_REPORT_LINKS.map((link) => (
          <View key={link.view} className={col}>
            <InventoryHubCard
              icon={link.icon}
              title={link.title}
              subtitle={link.subtitle}
              meta="Open report"
              onPress={() => router.push(`/inventory/reports?view=${link.view}` as never)}
            />
          </View>
        ))}
        <View className={col}>
          <InventoryHubCard
            icon="download-outline"
            title="Expenses Excel"
            subtitle="Cash book expenses by category"
            meta={excelBusy === 'expenses' ? '…' : 'XLSX'}
            disabled={excelBusy != null}
            onPress={() => void exportReport('expenses')}
          />
        </View>
      </View>

      <View className={`flex-row flex-wrap gap-2 ${isDesktop ? '' : ''}`}>
        {INVENTORY_REPORT_LINKS.filter((link) => link.excel).map((link) => (
          <Button
            key={link.excel}
            label={excelBusy === link.excel ? '…' : `${link.title} XLSX`}
            size="sm"
            variant="secondary"
            disabled={excelBusy != null}
            onPress={() => link.excel && void exportReport(link.excel)}
          />
        ))}
      </View>
    </ScrollView>
  );
}
