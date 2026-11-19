/**
 * Inventory shell - Sales invoices (AR).
 *
 * Lists client/sales invoices for the default STORE project, creates new
 * invoices, records payments, and exports the ledger to Tally.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Modal, Pressable } from 'react-native';
import { Button, Input, Select } from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';
import { useViewport } from '@/hooks/useViewport';
import { ProjectInvoicesList } from '@/components/accounting/InvoiceBillLists';
import { downloadTallyXml } from '@/services/report-download';
import { useCreateInvoice } from '@/services/accounting.queries';
import { useCustomers, type PartyRow } from '@/services/party.queries';
import { useResources } from '@/services/estimate.queries';
import { useEffectiveRates } from '@/services/inventory-gtm.queries';
import { toast, BusyOverlay, useBusy } from '@/components/ui';
import { inventoryInvoiceDetailHref } from '@/utils/navigation';
import { useInventoryLanguage } from '@/components/inventory/InventoryLanguageProvider';
import { InventoryFilterBar } from '@/components/inventory/InventoryFilterBar';
import { useInventoryListFilters } from '@/hooks/useInventoryListFilters';
import { InventoryScrollChrome } from '@/components/inventory/InventoryScreenList';
import {
  LineEditor,
  emptyDraftLine,
  type InvoiceDraftLine,
} from '@/components/inventory/TransactionModals';

const INVOICE_STATUS_TABS = [
  { value: 'ALL' as const, label: 'All' },
  { value: 'DRAFT' as const, label: 'Draft' },
  { value: 'SENT' as const, label: 'Sent' },
  { value: 'PAID' as const, label: 'Paid' },
  { value: 'OVERDUE' as const, label: 'Overdue' },
];

export default function InventoryInvoicesScreen() {
  const { translate } = useInventoryLanguage();
  const user = useAuthStore((s) => s.user);
  const { isPhone } = useViewport();
  const { busy, run } = useBusy();
  const projectId = user?.defaultProjectId ?? '';
  const [createOpen, setCreateOpen] = useState(false);
  const createInvoice = useCreateInvoice();
  const filters = useInventoryListFilters({ defaultStatus: 'ALL' });

  const pageChrome = (
    <>
      <View className="px-4 pt-4 pb-2 flex-row flex-wrap items-center justify-between">
        <View className="flex-1 mr-2 min-w-[160px]">
          <Text className={`font-bold text-text ${isPhone ? 'text-xl' : 'text-2xl'}`}>
            {translate('inventory.page.invoices', 'Sales invoices')}
          </Text>
          <Text className="text-sm text-muted mt-0.5">Client invoices (AR) · {user?.companyName}</Text>
          <Text className="text-xs text-muted mt-1">
            Checkout opens its invoice directly so you can mark it as sent and record payment.
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

      <InventoryFilterBar
        query={filters.query}
        onQueryChange={filters.setQuery}
        placeholder="Search invoice #, client, phone…"
        statusTabs={INVOICE_STATUS_TABS}
        status={filters.status as (typeof INVOICE_STATUS_TABS)[number]['value']}
        onStatusChange={filters.setStatus}
        isFiltered={filters.isFiltered}
        onClear={filters.clearAll}
      />
    </>
  );

  return (
    <View className="flex-1 min-h-0 bg-surface">
      <BusyOverlay visible={busy} title={translate('inventory.page.invoices', 'Sales invoices')} />
      <InventoryScrollChrome slot="sticky">{pageChrome}</InventoryScrollChrome>
      <ProjectInvoicesList
        projectId={projectId}
        embedded
        returnTo="/inventory/invoices"
        buildDetailHref={inventoryInvoiceDetailHref}
        status={filters.status}
        onStatusChange={filters.setStatus}
        query={filters.debouncedQuery}
        focusId={filters.focusId}
        stickyFilters
        listChrome={<InventoryScrollChrome slot="scroll">{pageChrome}</InventoryScrollChrome>}
      />

      <NewInvoiceModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={async (input) => {
          await run(async () => {
            const inv = (await createInvoice.mutateAsync({ ...input, projectId })) as
              | { creditLimitWarning?: string }
              | undefined;
            if (inv?.creditLimitWarning) toast.warning(inv.creditLimitWarning);
            toast.success('Invoice created');
            setCreateOpen(false);
          });
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
    customerId?: string;
    clientName: string;
    clientPhone?: string;
    clientAddress?: string;
    invoiceDate: string;
    dueDate: string;
    discountPct?: number;
    lineItems: Array<{
      resourceId?: string;
      description: string;
      quantity: number;
      unit: string;
      rate: number;
      gstRate: number;
      hsnSacCode?: string;
    }>;
  }) => Promise<void>;
}) {
  const { isPhone } = useViewport();
  const { data: customers } = useCustomers();
  const { data: resourceData } = useResources();
  const resources: Array<{
    id: string;
    name: string;
    unit: string;
    hsnSacCode?: string | null;
  }> = Array.isArray(resourceData) ? resourceData : (resourceData?.data ?? []);

  const [customerId, setCustomerId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [discountPct, setDiscountPct] = useState('');
  const [lines, setLines] = useState<InvoiceDraftLine[]>([emptyDraftLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { data: effectiveRates } = useEffectiveRates(customerId || undefined);
  const selectedParty = (customers ?? []).find((c: PartyRow) => c.id === customerId);
  const buyerRole =
    selectedParty?.buyerRole === 'DISTRIBUTOR'
      ? ('DISTRIBUTOR' as const)
      : customerId
        ? ('CUSTOMER' as const)
        : null;

  useEffect(() => {
    if (open) {
      setCustomerId('');
      setClientName('');
      setClientPhone('');
      setClientAddress('');
      setInvoiceDate(new Date().toISOString().slice(0, 10));
      setDueDate(new Date().toISOString().slice(0, 10));
      setDiscountPct('');
      setLines([emptyDraftLine()]);
      setError('');
    }
  }, [open]);

  const submit = async () => {
    setError('');
    const goodLines = lines.filter((l) => l.resourceId && Number(l.quantity) > 0 && Number(l.rate) >= 0);
    if (!clientName.trim()) {
      setError('Enter client name.');
      return;
    }
    if (goodLines.length === 0) {
      setError('Add at least one catalog item with quantity.');
      return;
    }
    setSaving(true);
    try {
      const disc = discountPct.trim() === '' ? undefined : Number(discountPct);
      await onSubmit({
        ...(customerId ? { customerId } : {}),
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim() || undefined,
        clientAddress: clientAddress.trim() || undefined,
        invoiceDate,
        dueDate,
        ...(disc != null && Number.isFinite(disc) && disc > 0 ? { discountPct: disc } : {}),
        lineItems: goodLines.map((l) => {
          const r = resources.find((x) => x.id === l.resourceId);
          return {
            resourceId: l.resourceId,
            description: r?.name ?? 'Item',
            quantity: Number(l.quantity),
            unit: l.unit || r?.unit || 'no',
            rate: Number(l.rate) || 0,
            gstRate: Number(l.gstRate) || 0,
            ...(r?.hsnSacCode?.trim() ? { hsnSacCode: r.hsnSacCode.trim() } : {}),
          };
        }),
      });
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
          className={`bg-card w-full overflow-hidden ${
            isPhone ? 'rounded-t-2xl h-[96%]' : 'rounded-2xl max-w-2xl max-h-[85%]'
          }`}
        >
          <View className="px-5 pt-4 pb-3 border-b border-border flex-row items-center justify-between shrink-0">
            <Text className="text-base font-bold text-text">New sales invoice</Text>
            <Pressable onPress={onClose} className="p-1">
              <Text className="text-muted text-xl">×</Text>
            </Pressable>
          </View>
          <ScrollView className="flex-1 p-5" keyboardShouldPersistTaps="handled">
            <Select
              label="Customer (optional - from Parties)"
              value={customerId || undefined}
              onChange={(v) => {
                setCustomerId(v ?? '');
                const c = (customers ?? []).find((x: PartyRow) => x.id === v);
                if (c) {
                  setClientName(c.name);
                  setClientPhone(c.phone ?? '');
                  setClientAddress(c.billingAddress ?? '');
                }
              }}
              options={(customers ?? [])
                .filter((c: PartyRow) => c.isActive)
                .map((c: PartyRow) => ({
                  title: c.name,
                  subtitle: [c.phone, c.gstin].filter(Boolean).join(' · '),
                  value: c.id,
                }))}
              placeholder="Pick a saved customer"
            />
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

            <LineEditor
              lines={lines}
              setLines={setLines}
              rateOverrides={effectiveRates}
              buyerRole={buyerRole}
              priceHint={
                buyerRole === 'DISTRIBUTOR'
                  ? `Selling ₹ is the distributor price for ${selectedParty?.name ?? 'this party'}.`
                  : 'Add catalog items — HSN/SAC and GST come from the item master. Multi-unit items show a unit picker when enabled.'
              }
            />

            <Input
              label="Sheet discount % (optional)"
              value={discountPct}
              onChangeText={setDiscountPct}
              keyboardType="decimal-pad"
              placeholder="Applied after lines, before GST"
            />
            {error ? <Text className="text-danger text-sm mt-2">{error}</Text> : null}
            <View className="h-4" />
            <Button label="Create invoice" onPress={submit} loading={saving} fullWidth />
            {isPhone ? <View className="h-6" /> : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
