/**
 * Inventory shell - Vendor bills (AP).
 *
 * Lists vendor bills for the default STORE project, creates new bills,
 * records payments, and exports the ledger to Tally.
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, Modal, Pressable } from 'react-native';
import { Button, Input, Select } from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';
import { useViewport } from '@/hooks/useViewport';
import { ProjectBillsList } from '@/components/accounting/InvoiceBillLists';
import { downloadTallyXml } from '@/services/report-download';
import { useCreateBill, type Bill } from '@/services/accounting.queries';
import { useVendors, type PartyRow } from '@/services/party.queries';
import { toast } from '@/components/ui';
import { inventoryBillDetailHref } from '@/utils/navigation';
import { ScanInvoiceModal } from '@/components/inventory/ScanInvoiceModal';

const BILL_CATEGORIES = [
  { title: 'Material', value: 'MATERIAL' },
  { title: 'Labour', value: 'LABOUR' },
  { title: 'Equipment', value: 'EQUIPMENT' },
  { title: 'Subcontractor', value: 'SUBCONTRACTOR' },
  { title: 'Other', value: 'OTHER' },
];

export default function InventoryBillsScreen() {
  const user = useAuthStore((s) => s.user);
  const { isPhone } = useViewport();
  const projectId = user?.defaultProjectId ?? '';
  const [createOpen, setCreateOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const createBill = useCreateBill();

  return (
    <View className="flex-1 bg-surface">
      <View className="px-4 pt-4 pb-2 flex-row flex-wrap items-center justify-between">
        <View className="flex-1 mr-2 min-w-[160px]">
          <Text className="text-2xl font-bold text-text">Vendor bills</Text>
          <Text className="text-sm text-muted mt-0.5">Supplier bills (AP) · {user?.companyName}</Text>
          <Text className="text-xs text-muted mt-1">
            Draft bills are created automatically when you record a GRN. Confirm them here before payment.
          </Text>
        </View>
        <View className={`flex-row gap-2 ${isPhone ? 'mt-2 w-full' : ''}`}>
          <Button
            label="Export to Tally"
            variant="secondary"
            size="sm"
            onPress={() => {
              if (projectId) void downloadTallyXml(projectId);
            }}
          />
          <Button
            label="Scan invoice"
            variant="secondary"
            size="sm"
            onPress={() => setScanOpen(true)}
          />
          <Button label="New bill" variant="accent" size="sm" onPress={() => setCreateOpen(true)} />
        </View>
      </View>

      <ProjectBillsList
        projectId={projectId}
        embedded
        returnTo="/inventory/bills"
        buildDetailHref={inventoryBillDetailHref}
      />

      <NewBillModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={async (input) => {
          await createBill.mutateAsync({
            ...input,
            projectId,
            category: input.category as Bill['category'],
          });
          toast.success('Vendor bill created');
          setCreateOpen(false);
        }}
      />
      <ScanInvoiceModal open={scanOpen} onClose={() => setScanOpen(false)} />
    </View>
  );
}

function NewBillModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    vendorId?: string;
    vendorName: string;
    billNumber: string;
    billDate: string;
    dueDate?: string;
    category: string;
    subtotal: number;
    gstAmount?: number;
  }) => Promise<void>;
}) {
  const { isPhone } = useViewport();
  const { data: vendors } = useVendors();
  const [vendorId, setVendorId] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState('MATERIAL');
  const [subtotal, setSubtotal] = useState('');
  const [gstRate, setGstRate] = useState('18');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!vendorName || !billNumber || !Number(subtotal)) {
      setError('Fill vendor, bill number and subtotal.');
      return;
    }
    setSaving(true);
    try {
      const gstAmount = (Number(subtotal) * Number(gstRate || 0)) / 100;
      await onSubmit({
        // INVENTORY_HORIZONTAL_PLATFORM (Phase 1.1): optional party-master link.
        ...(vendorId ? { vendorId } : {}),
        vendorName,
        billNumber,
        billDate,
        dueDate,
        category,
        subtotal: Number(subtotal),
        gstAmount: gstAmount > 0 ? gstAmount : undefined,
      });
      setVendorId('');
      setVendorName('');
      setBillNumber('');
      setSubtotal('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create bill');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType={isPhone ? 'slide' : 'fade'}
      onRequestClose={onClose}
    >
      <Pressable
        className={`flex-1 bg-black/40 ${isPhone ? 'justify-end' : 'items-center justify-center p-4'}`}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className={`bg-card w-full ${
            isPhone ? 'rounded-t-2xl max-h-[90%]' : 'rounded-2xl max-w-lg max-h-[85%]'
          }`}
        >
          <View className="px-5 pt-4 pb-3 border-b border-border flex-row items-center justify-between">
            <Text className="text-base font-bold text-text">New vendor bill</Text>
            <Pressable onPress={onClose} className="p-1">
              <Text className="text-muted text-xl">×</Text>
            </Pressable>
          </View>
          <ScrollView className="p-5">
            <Select
              label="Vendor (optional — from Parties)"
              value={vendorId || undefined}
              onChange={(v) => {
                setVendorId(v ?? '');
                const vd = (vendors ?? []).find((x: PartyRow) => x.id === v);
                if (vd) setVendorName(vd.name);
              }}
              options={(vendors ?? [])
                .filter((x: PartyRow) => x.isActive)
                .map((x: PartyRow) => ({ title: x.name, subtitle: [x.phone, x.gstin].filter(Boolean).join(' · '), value: x.id }))}
              placeholder="Pick a saved vendor"
            />
            <Input label="Vendor name" value={vendorName} onChangeText={setVendorName} />
            <Input
              label="Bill number"
              value={billNumber}
              onChangeText={setBillNumber}
              autoCapitalize="characters"
            />
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Input label="Bill date" value={billDate} onChangeText={setBillDate} />
              </View>
              <View className="flex-1">
                <Input label="Due date" value={dueDate} onChangeText={setDueDate} />
              </View>
            </View>
            <Select
              label="Category"
              value={category}
              onChange={(v) => v && setCategory(v)}
              options={BILL_CATEGORIES}
            />
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Input
                  label="Subtotal (₹)"
                  value={subtotal}
                  onChangeText={setSubtotal}
                  keyboardType="numeric"
                />
              </View>
              <View className="flex-1">
                <Input label="GST %" value={gstRate} onChangeText={setGstRate} keyboardType="numeric" />
              </View>
            </View>
            {error ? <Text className="text-danger text-sm mt-2">{error}</Text> : null}
            <View className="h-4" />
            <Button label="Create bill" onPress={submit} loading={saving} fullWidth />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
