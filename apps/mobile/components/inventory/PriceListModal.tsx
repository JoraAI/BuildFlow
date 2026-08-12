/**
 * BuildFlow - Customer price list modal (INVENTORY_HORIZONTAL_PLATFORM Phase 9.1).
 *
 * Per-customer (or company-default) rate overrides used on SO / Issue / Invoice
 * lines. Effective rate order: customer override > company default > catalog.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView } from 'react-native';
import { Button, Input, Select, Badge, toast } from '@/components/ui';
import { useViewport } from '@/hooks/useViewport';
import { useResources } from '@/services/estimate.queries';
import { useCustomers, type PartyRow } from '@/services/party.queries';
import { usePriceList, useUpsertPrice, useDeletePrice, type PriceRow } from '@/services/inventory-gtm.queries';

export function PriceListModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { isPhone } = useViewport();
  const { data: rows, isLoading } = usePriceList();
  const upsert = useUpsertPrice();
  const remove = useDeletePrice();
  const { data: resources } = useResources();
  const { data: customers } = useCustomers();

  const [resourceId, setResourceId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [rate, setRate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setResourceId('');
      setCustomerId('');
      setRate('');
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    setError(null);
    if (!resourceId) {
      setError('Choose an item.');
      return;
    }
    const rateNum = Number(rate);
    if (!Number.isFinite(rateNum) || rateNum < 0) {
      setError('Enter a valid rate.');
      return;
    }
    setSaving(true);
    try {
      await upsert.mutateAsync({ customerId: customerId || null, resourceId, rate: rateNum });
      toast.success('Price saved - overrides the catalog rate for this customer');
      setResourceId('');
      setCustomerId('');
      setRate('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save price');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType={isPhone ? 'slide' : 'fade'}
      onRequestClose={saving ? undefined : onClose}
    >
      <Pressable
        className={`flex-1 bg-black/40 ${isPhone ? 'justify-end' : 'items-center justify-center p-4'}`}
        onPress={saving ? undefined : onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className={`bg-card w-full ${
            isPhone ? 'rounded-t-2xl max-h-[92%] p-4' : 'rounded-2xl max-w-lg max-h-[85%] p-4'
          }`}
        >
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-lg font-bold text-text">Price lists</Text>
            <Pressable onPress={saving ? undefined : onClose} className="p-1">
              <Text className="text-muted text-xl">×</Text>
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text className="text-sm text-muted mb-3">
              A customer override beats the company default, which beats the catalog rate. Used when
              creating sales orders, issues and invoices.
            </Text>

            <View className="rounded-xl border border-border bg-surface p-3 gap-2 mb-3">
              <Text className="text-xs font-semibold text-muted uppercase">Add / update a price</Text>
              <Select
                label="Item"
                value={resourceId || undefined}
                onChange={(v) => setResourceId(v ?? '')}
                options={(resources?.data ?? [])
                  .filter((r: { type: string }) => r.type === 'MATERIAL' || !r.type)
                  .map((r: { id: string; name: string; unit: string }) => ({ title: `${r.name} (${r.unit})`, value: r.id }))}
                placeholder="Choose an item"
              />
              <Select
                label="Customer (blank = company default)"
                value={customerId || undefined}
                onChange={(v) => setCustomerId(v ?? '')}
                options={(customers ?? []).map((c: PartyRow) => ({ title: c.name, value: c.id }))}
                placeholder="Company default price"
              />
              <Input label="Rate (₹)" value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder="0" />
              {error ? <Text className="text-sm text-danger">{error}</Text> : null}
              <Button label={saving ? 'Saving…' : 'Save price'} variant="accent" loading={saving} onPress={() => void submit()} />
            </View>

            {isLoading ? (
              <Text className="text-sm text-muted">Loading prices…</Text>
            ) : (rows ?? []).length === 0 ? (
              <Text className="text-sm text-muted">No price overrides yet - add one above.</Text>
            ) : (
              (rows ?? []).map((r: PriceRow) => (
                <View key={r.id} className="flex-row items-center justify-between rounded-xl border border-border bg-surface p-3 mb-2">
                  <View className="flex-1 mr-2 min-w-0">
                    <Text className="text-sm text-text" numberOfLines={1}>{r.resourceName}</Text>
                    <Text className="text-xs text-muted">
                      ₹{r.rate} · {r.scope === 'DEFAULT' ? 'company default' : (r.customerName ?? 'customer')}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Badge color={r.scope === 'CUSTOMER' ? 'primary' : 'neutral'} label={r.scope} />
                    <Button label="Remove" size="sm" variant="ghost" onPress={() => void remove.mutate(r.id)} />
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
