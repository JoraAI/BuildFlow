/**
 * Inventory shell - Sales invoices (AR).
 *
 * Lists client/sales invoices for the default STORE project, creates new
 * invoices, records payments, and exports the ledger to Tally.
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, Modal, Pressable } from 'react-native';
import { Button, Input } from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';
import { useViewport } from '@/hooks/useViewport';
import { ProjectInvoicesList } from '@/components/accounting/InvoiceBillLists';
import { downloadTallyXml } from '@/services/report-download';
import { useCreateInvoice } from '@/services/accounting.queries';
import { toast } from '@/components/ui';
import { inventoryInvoiceDetailHref } from '@/utils/navigation';

export default function InventoryInvoicesScreen() {
  const user = useAuthStore((s) => s.user);
  const { isPhone } = useViewport();
  const projectId = user?.defaultProjectId ?? '';
  const [createOpen, setCreateOpen] = useState(false);
  const createInvoice = useCreateInvoice();

  return (
    <View className="flex-1 bg-surface">
      <View className="px-4 pt-4 pb-2 flex-row flex-wrap items-center justify-between">
        <View className="flex-1 mr-2 min-w-[160px]">
          <Text className="text-2xl font-bold text-text">Sales invoices</Text>
          <Text className="text-sm text-muted mt-0.5">Client invoices (AR) · {user?.companyName}</Text>
          <Text className="text-xs text-muted mt-1">
            Draft invoices are created automatically when you issue stock. Confirm them here to mark as Sent.
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
          <Button label="New invoice" variant="accent" size="sm" onPress={() => setCreateOpen(true)} />
        </View>
      </View>

      <ProjectInvoicesList
        projectId={projectId}
        embedded
        returnTo="/inventory/invoices"
        buildDetailHref={inventoryInvoiceDetailHref}
      />

      <NewInvoiceModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={async (input) => {
          await createInvoice.mutateAsync({ ...input, projectId });
          toast.success('Invoice created');
          setCreateOpen(false);
        }}
      />
    </View>
  );
}

function NewInvoiceModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    clientName: string;
    clientPhone?: string;
    clientAddress?: string;
    invoiceDate: string;
    dueDate: string;
    lineItems: Array<{ description: string; quantity: number; unit: string; rate: number; gstRate: number }>;
  }) => Promise<void>;
}) {
  const { isPhone } = useViewport();
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('no');
  const [rate, setRate] = useState('');
  const [gstRate, setGstRate] = useState('18');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!clientName || !description || !Number(quantity) || !Number(rate)) {
      setError('Fill client, item description, quantity and rate.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        clientName,
        clientPhone: clientPhone.trim() || undefined,
        clientAddress: clientAddress.trim() || undefined,
        invoiceDate,
        dueDate,
        lineItems: [
          { description, quantity: Number(quantity), unit, rate: Number(rate), gstRate: Number(gstRate) || 0 },
        ],
      });
      setClientName('');
      setClientPhone('');
      setClientAddress('');
      setDescription('');
      setQuantity('1');
      setRate('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create invoice');
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
            <Text className="text-base font-bold text-text">New sales invoice</Text>
            <Pressable onPress={onClose} className="p-1">
              <Text className="text-muted text-xl">×</Text>
            </Pressable>
          </View>
          <ScrollView className="p-5">
            <Input label="Client name" value={clientName} onChangeText={setClientName} />
            <Input
              label="Phone (optional)"
              value={clientPhone}
              onChangeText={setClientPhone}
              keyboardType="phone-pad"
              placeholder="e.g. 98XXXXXXXX"
            />
            <Input
              label="Address (optional)"
              value={clientAddress}
              onChangeText={setClientAddress}
              multiline
              placeholder="Street, city, state"
            />
            <Input label="Invoice date" value={invoiceDate} onChangeText={setInvoiceDate} />
            <Input label="Due date" value={dueDate} onChangeText={setDueDate} />
            <Text className="text-sm font-bold text-text mb-1.5 mt-2">Line item</Text>
            <Input label="Description" value={description} onChangeText={setDescription} />
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Input label="Qty" value={quantity} onChangeText={setQuantity} keyboardType="numeric" />
              </View>
              <View className="flex-1">
                <Input label="Unit" value={unit} onChangeText={setUnit} />
              </View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Input label="Rate (₹)" value={rate} onChangeText={setRate} keyboardType="numeric" />
              </View>
              <View className="flex-1">
                <Input label="GST %" value={gstRate} onChangeText={setGstRate} keyboardType="numeric" />
              </View>
            </View>
            {error ? <Text className="text-danger text-sm mt-2">{error}</Text> : null}
            <View className="h-4" />
            <Button label="Create invoice" onPress={submit} loading={saving} fullWidth />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
