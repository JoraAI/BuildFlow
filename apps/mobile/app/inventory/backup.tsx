/**
 * Backup & export hub — Phase C cloud restore is stubbed; Excel/PDF exports work.
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, toast } from '@/components/ui';
import { INVENTORY_ACCENT, INVENTORY_ACCENT_SOFT } from '@/components/navigation/InventoryTabBar';
import { mobileListBottomPadding } from '@/components/layout/fab-layout';
import { downloadInventoryExcel } from '@/services/inventory-analytics.queries';
import { useRouter } from 'expo-router';
import { useViewport } from '@/hooks/useViewport';

export default function InventoryBackupScreen() {
  const router = useRouter();
  const { isPhone, isDesktop } = useViewport();
  const [busy, setBusy] = useState<string | null>(null);

  const exportReport = async (report: 'pnl' | 'margin' | 'stock-health' | 'expenses') => {
    setBusy(report);
    try {
      await downloadInventoryExcel(report);
      toast.success('Excel downloaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerStyle={{
        padding: isDesktop ? 24 : 16,
        paddingBottom: isPhone ? mobileListBottomPadding() + 24 : 48,
        maxWidth: isDesktop ? 720 : undefined,
        width: '100%',
        alignSelf: 'center',
      }}
    >
      <Text className="text-2xl font-bold text-text mb-1">Backup & export</Text>
      <Text className="text-sm text-muted mb-4">
        Download Excel snapshots now. Full cloud backup/restore ships in a later release.
      </Text>

      <View className="rounded-2xl border border-border bg-card overflow-hidden mb-4">
        {(
          [
            { key: 'pnl' as const, title: 'Profit & loss', subtitle: 'Sales − COGS − expenses' },
            { key: 'margin' as const, title: 'Margins', subtitle: 'Per-item revenue and margin' },
            { key: 'stock-health' as const, title: 'Stock health', subtitle: 'Active / slow / dead stock' },
            { key: 'expenses' as const, title: 'Expenses', subtitle: 'Cash book expenses by category' },
          ] as const
        ).map((item, i) => (
          <Pressable
            key={item.key}
            onPress={() => void exportReport(item.key)}
            disabled={busy != null}
            className={`flex-row items-center gap-3 px-4 py-3.5 ${i > 0 ? 'border-t border-border/70' : ''}`}
          >
            <View
              className="w-10 h-10 rounded-xl items-center justify-center"
              style={{ backgroundColor: INVENTORY_ACCENT_SOFT }}
            >
              <Ionicons name="download-outline" size={20} color={INVENTORY_ACCENT} />
            </View>
            <View className="flex-1 min-w-0">
              <Text className="text-sm font-semibold text-text">{item.title}</Text>
              <Text className="text-xs text-muted">{item.subtitle}</Text>
            </View>
            <Text className="text-xs font-semibold" style={{ color: INVENTORY_ACCENT }}>
              {busy === item.key ? '…' : 'XLSX'}
            </Text>
          </Pressable>
        ))}
      </View>

      <View className="rounded-2xl border border-dashed border-border bg-card p-4 mb-4">
        <Text className="text-sm font-semibold text-text mb-1">Cloud backup</Text>
        <Text className="text-xs text-muted mb-3">
          Automatic company snapshots and one-tap restore are planned for Phase C. Your data already
          lives on BuildFlow servers with the rest of your inventory.
        </Text>
        <Button
          label="Open reports"
          variant="secondary"
          size="sm"
          onPress={() => router.push('/inventory/reports' as never)}
        />
      </View>
    </ScrollView>
  );
}
