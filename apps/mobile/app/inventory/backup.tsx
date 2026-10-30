/**
 * Full shop backup — one ZIP or JSON snapshot.
 */
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { toast } from '@/components/ui';
import { InventoryHubCard } from '@/components/inventory/InventoryHubCard';
import { inventoryPageListPadding } from '@/components/inventory/InventoryScreenList';
import { useInventoryBackupJson, useInventoryBackupZip } from '@/services/settings.queries';
import { useViewport } from '@/hooks/useViewport';

export default function InventoryBackupScreen() {
  const { isPhone, isDesktop } = useViewport();
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

  const col = isDesktop ? 'w-[48%]' : 'w-full';

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerStyle={{
        padding: isDesktop ? 24 : 16,
        paddingBottom: isPhone ? inventoryPageListPadding() + 24 : 48,
        maxWidth: isDesktop ? 960 : undefined,
        width: '100%',
        alignSelf: 'center',
        gap: 12,
      }}
    >
      <Text className="text-2xl font-bold text-text">Backup</Text>
      <Text className="text-sm text-muted">
        Download everything for this shop as one file. Passwords are left out. Keep it somewhere safe.
      </Text>

      <View className={`flex-row flex-wrap ${isDesktop ? 'gap-3' : 'gap-2'}`}>
        <View className={col}>
          <InventoryHubCard
            icon="archive-outline"
            title="Full ZIP backup"
            subtitle="One archive with items, parties, invoices, bills, cash book, and orders"
            meta={backupZip.isPending ? 'Preparing…' : 'Recommended'}
            disabled={backingUp}
            onPress={() => runBackup('zip')}
          />
        </View>
        <View className={col}>
          <InventoryHubCard
            icon="code-slash-outline"
            title="JSON snapshot"
            subtitle="Single file with the same shop data"
            meta={backupJson.isPending ? 'Preparing…' : 'Download'}
            disabled={backingUp}
            onPress={() => runBackup('json')}
          />
        </View>
      </View>

      <View className="rounded-2xl border border-border bg-card p-4">
        <Text className="text-sm font-semibold text-text mb-2">Included in this backup</Text>
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
    </ScrollView>
  );
}
