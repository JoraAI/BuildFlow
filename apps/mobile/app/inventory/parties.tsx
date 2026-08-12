/**
 * Inventory shell - Parties (INVENTORY_HORIZONTAL_PLATFORM Phase 1.1).
 * Customer (AR) + Vendor (AP) master. Responsive: phone bottom sheets, desktop centered.
 */
import React, { useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { Card, Badge, Button, EmptyState, LoadingSkeleton, toast } from '@/components/ui';
import {
  useCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer,
  useVendors, useCreateVendor, useUpdateVendor, useDeleteVendor,
  useCustomerLedger, useVendorLedger,
  type PartyRow, type PartyInput, type PartyLedger, type LedgerEntry,
} from '@/services/party.queries';
import { confirmAsync } from '@/utils/confirm';
import { PartyModal } from '@/components/inventory/PartyModal';
import { PriceListModal } from '@/components/inventory/PriceListModal';
import { useViewport } from '@/hooks/useViewport';
import { Modal, ScrollView } from 'react-native';

type Kind = 'customer' | 'vendor';

export default function InventoryPartiesScreen() {
  const [kind, setKind] = useState<Kind>('customer');
  const [modal, setModal] = useState<{ kind: Kind; editing: PartyRow | null } | null>(null);
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 5.3): party ledger modal.
  const [ledgerParty, setLedgerParty] = useState<PartyRow | null>(null);
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 9.1): customer price overrides.
  const [priceOpen, setPriceOpen] = useState(false);

  const customers = useCustomers();
  const vendors = useVendors();
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer(modal?.editing?.id ?? '');
  const deleteCustomer = useDeleteCustomer();
  const createVendor = useCreateVendor();
  const updateVendor = useUpdateVendor(modal?.editing?.id ?? '');
  const deleteVendor = useDeleteVendor();

  const rows = kind === 'customer' ? (customers.data ?? []) : (vendors.data ?? []);
  const loading = kind === 'customer' ? customers.isLoading : vendors.isLoading;

  const onDelete = async (party: PartyRow) => {
    const ok = await confirmAsync(
      `Deactivate ${party.name}?`,
      'Existing invoices/bills keep their details. The party is hidden from new selections.',
    );
    if (!ok) return;
    try {
      if (kind === 'customer') await deleteCustomer.mutateAsync(party.id);
      else await deleteVendor.mutateAsync(party.id);
      toast.success(`${kind === 'customer' ? 'Customer' : 'Vendor'} deactivated`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not deactivate');
    }
  };

  const onSave = async (input: PartyInput) => {
    if (modal?.editing) {
      if (kind === 'customer') await updateCustomer.mutateAsync(input);
      else await updateVendor.mutateAsync(input);
      toast.success(`${kind === 'customer' ? 'Customer' : 'Vendor'} updated`);
    } else {
      if (kind === 'customer') await createCustomer.mutateAsync(input);
      else await createVendor.mutateAsync(input);
      toast.success(`${kind === 'customer' ? 'Customer' : 'Vendor'} created`);
    }
    setModal(null);
  };

  return (
    <View className="flex-1 bg-surface">
      <View className="px-4 pt-4 pb-2 flex-row flex-wrap items-center justify-between gap-2">
        <View className="flex-1 min-w-[160px]">
          <Text className="text-2xl font-bold text-text">Parties</Text>
          <Text className="text-sm text-muted mt-0.5">Customers & vendors for invoices and bills</Text>
        </View>
        <Button
          label={`Add ${kind === 'customer' ? 'customer' : 'vendor'}`}
          variant="accent"
          size="sm"
          onPress={() => setModal({ kind, editing: null })}
        />
        <Button label="Price lists" variant="secondary" size="sm" onPress={() => setPriceOpen(true)} />
      </View>

      <View className="flex-row px-4 pb-2 gap-2">
        {(['customer', 'vendor'] as Kind[]).map((k) => (
          <Pressable
            key={k}
            onPress={() => setKind(k)}
            className={`px-3 py-1.5 rounded-lg border ${kind === k ? 'bg-primary border-primary' : 'bg-card border-border'}`}
          >
            <Text className={`text-xs font-medium ${kind === k ? 'text-white' : 'text-muted'}`}>
              {k === 'customer' ? 'Customers' : 'Vendors'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View className="px-4 gap-3">
          {[1, 2, 3].map((i) => <LoadingSkeleton key={i} className="rounded-xl h-16" />)}
        </View>
      ) : (
        <FlatList
          className="flex-1 px-4"
          data={rows}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <Card className="mb-2 p-4">
              <View className="flex-row items-start justify-between">
                <View className="flex-1 min-w-0 mr-2">
                  <Text className="text-sm font-semibold text-text">{item.name}</Text>
                  {item.businessName ? <Text className="text-xs text-muted">{item.businessName}</Text> : null}
                  <Text className="text-[11px] text-muted mt-1">
                    {[item.phone, item.email, item.gstin].filter(Boolean).join(' · ') || 'No contact'}
                  </Text>
                  {item.creditLimit != null && kind === 'customer' ? (
                    <Text className="text-[11px] text-muted mt-0.5">Credit limit ₹{Number(item.creditLimit)}</Text>
                  ) : null}
                </View>
                <View className="items-end gap-1">
                  <Badge color={item.isActive ? 'success' : 'neutral'} label={item.isActive ? 'Active' : 'Inactive'} />
                  <View className="flex-row gap-2 mt-1">
                    <Button label="Ledger" size="sm" variant="secondary" onPress={() => setLedgerParty(item)} />
                    <Button label="Edit" size="sm" variant="secondary" onPress={() => setModal({ kind, editing: item })} />
                    {item.isActive ? (
                      <Button label="Remove" size="sm" variant="secondary" onPress={() => onDelete(item)} />
                    ) : null}
                  </View>
                </View>
              </View>
            </Card>
          )}
          ListEmptyComponent={
            <EmptyState
              title={`No ${kind}s yet`}
              description={`Add ${kind}s so invoices and bills can pick them instead of retyping names.`}
            />
          }
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}

      {modal ? (
        <PartyModal kind={modal.kind} editing={modal.editing} onClose={() => setModal(null)} onSave={onSave} />
      ) : null}

      {ledgerParty ? (
        <PartyLedgerModal
          kind={kind}
          party={ledgerParty}
          onClose={() => setLedgerParty(null)}
        />
      ) : null}

      {/* INVENTORY_HORIZONTAL_PLATFORM (Phase 9.1): customer price overrides. */}
      <PriceListModal open={priceOpen} onClose={() => setPriceOpen(false)} />
    </View>
  );
}

/** INVENTORY_HORIZONTAL_PLATFORM (Phase 5.3): responsive party ledger modal. */
function PartyLedgerModal({
  kind,
  party,
  onClose,
}: {
  kind: Kind;
  party: PartyRow;
  onClose: () => void;
}) {
  const { isPhone } = useViewport();
  const customerLedger = useCustomerLedger(kind === 'customer' ? party.id : '');
  const vendorLedger = useVendorLedger(kind === 'vendor' ? party.id : '');
  const ledger: PartyLedger | undefined = kind === 'customer' ? customerLedger.data : vendorLedger.data;
  const loading = kind === 'customer' ? customerLedger.isLoading : vendorLedger.isLoading;

  const typeLabel = (t: LedgerEntry['type']): string => {
    switch (t) {
      case 'INVOICE': return 'Invoice';
      case 'BILL': return 'Bill';
      case 'PAYMENT': return 'Payment';
      case 'CREDIT_NOTE': return 'Credit note';
      case 'DEBIT_NOTE': return 'Debit note';
    }
  };

  return (
    <Modal visible transparent animationType={isPhone ? 'slide' : 'fade'} onRequestClose={onClose}>
      <Pressable
        className={`flex-1 bg-black/40 ${isPhone ? 'justify-end' : 'items-center justify-center p-4'}`}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className={`bg-card w-full ${isPhone ? 'rounded-t-2xl max-h-[92%] p-4' : 'rounded-2xl max-w-lg max-h-[85%] p-4'}`}
        >
          <Text className="text-lg font-bold text-text mb-1">{party.name} · Ledger</Text>
          <Text className="text-sm text-muted mb-3">
            {kind === 'customer' ? 'Customer receivables (AR)' : 'Vendor payables (AP)'}
          </Text>
          <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 8 }}>
            {loading ? (
              <View className="gap-2">
                {[1, 2, 3].map((i) => <LoadingSkeleton key={i} className="rounded-xl h-14" />)}
              </View>
            ) : ledger && ledger.entries.length > 0 ? (
              <>
                <View className="flex-row flex-wrap items-center justify-between gap-2 mb-3 p-3 rounded-xl bg-surface border border-border">
                  <Text className="text-sm font-bold text-text">Outstanding</Text>
                  <Text className="text-lg font-bold text-primary">₹{ledger.outstanding.toFixed(2)}</Text>
                </View>
                {ledger.entries.map((e, i) => (
                  <View key={i} className="p-3 mb-2 rounded-xl bg-surface border border-border">
                    <View className="flex-row items-center justify-between gap-2">
                      <View className="flex-1 min-w-0">
                        <Text className="text-sm font-semibold text-text">{typeLabel(e.type)}</Text>
                        <Text className="text-xs text-muted">{e.refNumber} · {e.date}</Text>
                      </View>
                      <Text className={`text-sm font-bold ${e.amount < 0 ? 'text-success' : 'text-text'}`}>
                        {e.amount < 0 ? '−' : '+'}₹{Math.abs(e.amount).toFixed(2)}
                      </Text>
                    </View>
                    <Text className="text-[11px] text-muted mt-1">Balance ₹{e.balance.toFixed(2)}</Text>
                  </View>
                ))}
              </>
            ) : (
              <EmptyState
                title="No transactions yet"
                description="Invoices/bills, payments and issued credit/debit notes appear here."
              />
            )}
            <Button label="Close" variant="secondary" onPress={onClose} fullWidth />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
