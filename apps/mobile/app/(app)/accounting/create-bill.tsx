/**
 * BuildFlow — Create Bill
 * Route: /accounting/create-bill?projectId=<id>
 */
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Card, Button, Input } from '@/components/ui';
import { FormScreenHeader } from '@/components/layout/ScreenHeader';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ActionBar } from '@/components/layout/ActionBar';
import { useViewport } from '@/hooks/useViewport';
import { dismissTo, DISMISS } from '@/utils/navigation';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { useCreateBill } from '@/services/accounting.queries';
import { useProjects, type ProjectListItem } from '@/services/project.queries';
import { formatINR } from '@/utils/format';

const CATEGORIES = ['MATERIAL', 'LABOUR', 'EQUIPMENT', 'SUBCONTRACTOR', 'OTHER'] as const;
type Category = (typeof CATEGORIES)[number];

export default function CreateBillScreen() {
  const router = useRouter();
  const { isDesktop } = useViewport();
  const { projectId: preselected } = useLocalSearchParams<{ projectId?: string }>();
  const { data: projects } = useProjects();
  const createBill = useCreateBill();

  const [projectId, setProjectId] = useState(preselected ?? '');
  const [billNumber, setBillNumber] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [vendorGstin, setVendorGstin] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [subtotal, setSubtotal] = useState('0');
  const [gstAmount, setGstAmount] = useState('0');
  const [tdsEnabled, setTdsEnabled] = useState(false);
  const [category, setCategory] = useState<Category>('MATERIAL');

  // Live TDS + total preview
  const preview = useMemo(() => {
    const sub = parseFloat(subtotal) || 0;
    const gst = parseFloat(gstAmount) || 0;
    const tdsRate = tdsEnabled ? 2 : 0;
    const tdsAmount = tdsEnabled ? (sub * 2) / 100 : 0;
    const total = sub + gst - tdsAmount;
    return { sub, gst, tdsRate, tdsAmount, total };
  }, [subtotal, gstAmount, tdsEnabled]);

  const onSave = () => {
    if (!projectId) {
      Alert.alert('Select project', 'Please choose a project for this bill.');
      return;
    }
    if (!billNumber.trim()) {
      Alert.alert('Bill number required', 'Please enter the vendor bill number.');
      return;
    }
    if (!vendorName.trim()) {
      Alert.alert('Vendor name required', 'Please enter the vendor name.');
      return;
    }
    if (preview.sub <= 0) {
      Alert.alert('Invalid amount', 'Bill subtotal must be greater than zero.');
      return;
    }

    createBill.mutate(
      {
        projectId,
        billNumber: billNumber.trim(),
        vendorName: vendorName.trim(),
        vendorGstin: vendorGstin.trim() || undefined,
        billDate,
        dueDate: dueDate || undefined,
        subtotal: preview.sub,
        gstAmount: preview.gst,
        tdsRate: preview.tdsRate,
        tdsAmount: preview.tdsAmount,
        category,
      },
      {
        onSuccess: (bill) => {
          Alert.alert(
            'Success',
            `Bill ${bill.billNumber} created (status: ${bill.status}).`,
            [{ text: 'OK', onPress: () => dismissTo(DISMISS.accounting) }],
          );
        },
        onError: (e: unknown) => {
          const message = e instanceof Error ? e.message : 'Failed to create bill';
          Alert.alert('Error', message);
        },
      },
    );
  };

  const summaryCard = (
    <Card>
      <Text className="text-sm font-bold text-text mb-2">Summary</Text>
      <View className="gap-1.5">
        <PreviewRow label="Subtotal" value={formatINR(preview.sub)} />
        <PreviewRow label="GST" value={formatINR(preview.gst)} muted />
        {preview.tdsAmount > 0 && (
          <PreviewRow label={`TDS (${preview.tdsRate}%)`} value={`- ${formatINR(preview.tdsAmount)}`} danger />
        )}
        <View className="h-px bg-border my-1" />
        <View className="flex-row justify-between">
          <Text className="text-base font-bold text-text">Net Payable</Text>
          <Text className="text-base font-bold text-primary">{formatINR(preview.total)}</Text>
        </View>
      </View>
    </Card>
  );

  const formFields = (
    <>
      <Card>
        <Text className="text-sm font-bold text-text mb-2">Project</Text>
        {!preselected && projects ? (
          <View className={`gap-1 ${isDesktop ? 'flex-row flex-wrap' : ''}`}>
            {projects.map((p: ProjectListItem) => (
              <Pressable
                key={p.id}
                onPress={() => setProjectId(p.id)}
                className={`p-2 rounded-lg border ${isDesktop ? 'flex-1 min-w-[200px]' : ''} ${projectId === p.id ? 'bg-primary/10 border-primary' : 'border-border'}`}
              >
                <Text className="text-sm text-text">{p.name}</Text>
                <Text className="text-xs text-muted">{p.clientName}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text className="text-sm text-muted">
            {projects?.find((p: ProjectListItem) => p.id === projectId)?.name ?? projectId}
          </Text>
        )}
      </Card>

      <View className={isDesktop ? 'flex-row gap-4 items-start' : 'gap-4'}>
        <Card className={isDesktop ? 'flex-1' : undefined}>
          <Text className="text-sm font-bold text-text mb-2">Bill Details</Text>
          <Input
            label="Bill Number"
            value={billNumber}
            onChangeText={setBillNumber}
            placeholder="BILL-2025-001"
          />
          <Input
            label="Vendor Name"
            value={vendorName}
            onChangeText={setVendorName}
            placeholder="ABC Suppliers"
          />
          <Input
            label="Vendor GSTIN"
            value={vendorGstin}
            onChangeText={setVendorGstin}
            placeholder="36ABCDE1234F1Z5"
            autoCapitalize="characters"
          />
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Input
                label="Bill Date"
                value={billDate}
                onChangeText={setBillDate}
                placeholder="YYYY-MM-DD"
              />
            </View>
            <View className="flex-1">
              <Input
                label="Due Date (optional)"
                value={dueDate}
                onChangeText={setDueDate}
                placeholder="YYYY-MM-DD"
              />
            </View>
          </View>
        </Card>

        <Card className={isDesktop ? 'flex-1' : undefined}>
          <Text className="text-sm font-bold text-text mb-2">Category</Text>
          <View className="flex-row flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                className={`px-3 py-2 rounded-lg border ${category === c ? 'bg-primary border-primary' : 'border-border'}`}
              >
                <Text className={`text-xs font-medium ${category === c ? 'text-white' : 'text-muted'}`}>
                  {c}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>
      </View>

      <Card>
        <Text className="text-sm font-bold text-text mb-2">Amounts</Text>
        <View className={isDesktop ? 'flex-row gap-4' : ''}>
          <View className={isDesktop ? 'flex-1' : undefined}>
            <Input
              label="Subtotal (Rs)"
              value={subtotal}
              onChangeText={setSubtotal}
              keyboardType="numeric"
              placeholder="0"
            />
          </View>
          <View className={isDesktop ? 'flex-1' : undefined}>
            <Input
              label="GST Amount (Rs)"
              value={gstAmount}
              onChangeText={setGstAmount}
              keyboardType="numeric"
              placeholder="0"
            />
          </View>
        </View>
        <Pressable
          onPress={() => setTdsEnabled((v) => !v)}
          className={`flex-row items-center gap-2 p-3 rounded-lg border mt-2 ${tdsEnabled ? 'border-primary bg-primary/5' : 'border-border'}`}
        >
          <View
            className={`w-5 h-5 rounded border-2 items-center justify-center ${tdsEnabled ? 'bg-primary border-primary' : 'border-border'}`}
          >
            {tdsEnabled && <Text className="text-white text-xs">✓</Text>}
          </View>
          <Text className="text-sm text-text">Apply TDS 2% (Section 194C)</Text>
        </Pressable>
      </Card>

      {!isDesktop && summaryCard}
    </>
  );

  const saveBar = (
    <Button
      label={createBill.isPending ? 'Saving...' : 'Save Bill'}
      variant="primary"
      onPress={onSave}
      disabled={createBill.isPending}
    />
  );

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={isDesktop ? [] : ['bottom']}>
      <OfflineBanner />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {isDesktop ? (
          <ScreenContainer scrollable={false} constrained>
            <FormScreenHeader title="New Bill" onCancel={() => dismissTo(DISMISS.accounting)} />
            <View className="flex-1 flex-row gap-6 items-start">
              <ScrollView className="flex-[2]" contentContainerClassName="gap-4 pb-6" showsVerticalScrollIndicator={false}>
                {formFields}
              </ScrollView>
              <View className="flex-1 max-w-sm">{summaryCard}</View>
            </View>
            <ActionBar>{saveBar}</ActionBar>
          </ScreenContainer>
        ) : (
          <>
            <FormScreenHeader title="New Bill" onCancel={() => dismissTo(DISMISS.accounting)} />
            <ScrollView contentContainerClassName="px-4 pb-32 pt-2 gap-4">{formFields}</ScrollView>
            <View className="absolute bottom-0 left-0 right-0 bg-card border-t border-border p-4">
              {saveBar}
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PreviewRow({
  label,
  value,
  muted,
  danger,
}: {
  label: string;
  value: string;
  muted?: boolean;
  danger?: boolean;
}) {
  return (
    <View className="flex-row justify-between">
      <Text className={`text-sm ${muted ? 'text-muted' : 'text-text'}`}>{label}</Text>
      <Text className={`text-sm ${danger ? 'text-danger' : muted ? 'text-muted' : 'text-text'}`}>
        {value}
      </Text>
    </View>
  );
}