/**
 * Inventory shell - Materials catalog.
 *
 * Create, edit, and delete materials (resources) for indents, POs, GRNs, and stock.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Modal, ScrollView, RefreshControl, Pressable } from 'react-native';
import { Card, Button, Input, EmptyState, LoadingSkeleton, Select, toast, BusyOverlay, useBusy } from '@/components/ui';
import {
  useResources,
  useCreateResource,
  useUpdateResource,
  useDeleteResource,
  type Resource,
} from '@/services/estimate.queries';
import { formatINR } from '@/utils/format';
import { confirmAsync } from '@/utils/confirm';
import { useViewport } from '@/hooks/useViewport';
import { useAuthStore } from '@/stores/auth.store';
import { getInventoryLabel, getInventoryLabelMode } from '@buildflow/shared';
import { useVendors, type PartyRow } from '@/services/party.queries';
import { ImportMappingModal } from '@/components/inventory/ImportMappingModal';

export default function InventoryMaterialsScreen() {
  const { busy, run } = useBusy();
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, isFetching, refetch } = useResources();
  const { isPhone } = useViewport();
  const labelMode = getInventoryLabelMode(user?.inventoryProfile ?? null);
  const itemLabel = getInventoryLabel('item', labelMode);
  const itemPluralLabel = getInventoryLabel('item_plural', labelMode);
  const indentLabel = getInventoryLabel('indent', labelMode);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const createResource = useCreateResource();
  // id is captured per-render so `mutateAsync(input)` targets the material being edited.
  const updateResource = useUpdateResource(editing?.id ?? '');
  const deleteResource = useDeleteResource();

  const materials = (data?.data ?? []).filter((r: Resource) => r.type === 'MATERIAL' || !r.type);

  const onDelete = async (item: Resource) => {
    const ok = await confirmAsync(
      `Delete ${itemLabel.toLowerCase()}?`,
      `Delete "${item.name}"? Existing POs, GRNs and stock movements keep their values.`,
    );
    if (!ok) return;
    await run(async () => {
      try {
        await deleteResource.mutateAsync(item.id);
        toast.success(`${itemLabel} deleted`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not delete material');
      }
    });
  };

  return (
    <View className="flex-1 bg-surface">
      <BusyOverlay visible={busy} title={`Updating ${itemPluralLabel.toLowerCase()}…`} />
      <View className="px-4 pt-4 pb-2 flex-row flex-wrap items-center justify-between">
        <View className="flex-1 mr-2 min-w-[160px]">
          <Text className="text-2xl font-bold text-text">{itemPluralLabel}</Text>
          <Text className="text-sm text-muted mt-0.5">Catalog for procurement & stock</Text>
        </View>
        <View className={`flex-row gap-2 ${isPhone ? 'mt-2 w-full' : ''}`}>
          <Button
            label="Import CSV"
            variant="secondary"
            size="sm"
            onPress={() => setImportOpen(true)}
          />
          <Button
            label={`Add ${itemLabel.toLowerCase()}`}
            variant="accent"
            size="sm"
            onPress={() => setCreateOpen(true)}
          />
        </View>
      </View>

      {isLoading ? (
        <View className="px-4 gap-3">
          {[1, 2, 3].map((i) => (
            <LoadingSkeleton key={i} className="rounded-xl h-16" />
          ))}
        </View>
      ) : (
        <FlatList
          className="flex-1"
          data={materials}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} tintColor="#1E3A5F" />
          }
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ListEmptyComponent={
            <EmptyState
              title={`No ${itemPluralLabel.toLowerCase()} yet`}
              description={`Add ${itemPluralLabel.toLowerCase()} to your catalog, then create a ${indentLabel.toLowerCase()} and receive stock via GRN.`}
            />
          }
          renderItem={({ item }) => (
            <Card className="mb-2 p-4">
              <View className="flex-row items-start justify-between">
                <View className="flex-1 mr-2">
                  <Text className="text-sm font-semibold text-text">{item.name}</Text>
                  <Text className="text-xs text-muted mt-0.5">
                    {item.unit}
                    {item.brandOrSpec ? ` · ${item.brandOrSpec}` : ''}
                    {item.category ? ` · ${item.category}` : ''}
                  </Text>
                </View>
                <Text className="text-sm font-bold text-primary">{formatINR(Number(item.rate))}</Text>
              </View>
              <View className="flex-row gap-2 mt-3">
                <Button
                  label="Edit"
                  size="sm"
                  variant="secondary"
                  onPress={() => setEditing(item)}
                />
                <Button
                  label="Delete"
                  size="sm"
                  variant="ghost"
                  onPress={() => void onDelete(item)}
                />
              </View>
            </Card>
          )}
        />
      )}

      <MaterialFormModal
        mode="create"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        itemLabel={itemLabel}
        submitting={createResource.isPending}
        onSubmit={async (input) => {
          await run(async () => {
            await createResource.mutateAsync(input);
            toast.success(`${itemLabel} added`);
            setCreateOpen(false);
            void refetch();
          });
        }}
      />

      <MaterialFormModal
        mode="edit"
        open={editing !== null}
        initial={editing ?? undefined}
        onClose={() => setEditing(null)}
        itemLabel={itemLabel}
        submitting={editing !== null && updateResource.isPending}
        onSubmit={async (input) => {
          if (!editing) return;
          await run(async () => {
            try {
              await updateResource.mutateAsync(input);
              toast.success(`${itemLabel} updated`);
              setEditing(null);
              void refetch();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Could not update material');
            }
          });
        }}
      />

      <ImportMappingModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        defaultPurpose="CATALOG"
      />
    </View>
  );
}

function MaterialFormModal({
  mode,
  open,
  onClose,
  initial,
  itemLabel,
  onSubmit,
  submitting,
}: {
  mode: 'create' | 'edit';
  open: boolean;
  onClose: () => void;
  initial?: Resource;
  itemLabel: string;
  onSubmit: (input: {
    name: string;
    type: 'MATERIAL';
    unit: string;
    rate: number;
    gstRate?: number;
    brandOrSpec?: string;
    category?: string;
    // INVENTORY_HORIZONTAL_PLATFORM (Phase 1.2): optional item master fields.
    sku?: string;
    itemCode?: string;
    barcode?: string;
    secondaryUnit?: string;
    conversionFactor?: number;
    reorderPoint?: number;
    // INVENTORY_HORIZONTAL_PLATFORM (Phase 4.1): procurement automation fields.
    preferredVendorId?: string;
    reorderQty?: number;
    leadTimeDays?: number;
  }) => Promise<void>;
  submitting: boolean;
}) {
  const { isPhone } = useViewport();
  const { data: vendors } = useVendors();
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('nos');
  const [rate, setRate] = useState('');
  const [gstRate, setGstRate] = useState('18');
  const [brandOrSpec, setBrandOrSpec] = useState('');
  const [category, setCategory] = useState('');
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 1.2): optional item master fields.
  const [itemCode, setItemCode] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [secondaryUnit, setSecondaryUnit] = useState('');
  const [conversionFactor, setConversionFactor] = useState('1');
  const [reorderPoint, setReorderPoint] = useState('');
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 4.1): procurement automation fields.
  const [preferredVendorId, setPreferredVendorId] = useState('');
  const [reorderQty, setReorderQty] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Prefill when opening in edit mode; reset when opening in create mode.
  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && initial) {
      setName(initial.name);
      setUnit(initial.unit || 'nos');
      setRate(String(initial.rate ?? 0));
      setGstRate(initial.gstRate !== undefined ? String(initial.gstRate) : '18');
      setBrandOrSpec(initial.brandOrSpec ?? '');
      setCategory(initial.category ?? '');
      setItemCode(initial.itemCode ?? '');
      setSku(initial.sku ?? '');
      setBarcode(initial.barcode ?? '');
      setSecondaryUnit(initial.secondaryUnit ?? '');
      setConversionFactor(initial.conversionFactor != null ? String(Number(initial.conversionFactor)) : '1');
      setReorderPoint(initial.reorderPoint != null ? String(Number(initial.reorderPoint)) : '');
      setPreferredVendorId(initial.preferredVendorId ?? '');
      setReorderQty(initial.reorderQty != null ? String(Number(initial.reorderQty)) : '');
      setLeadTimeDays(initial.leadTimeDays != null ? String(initial.leadTimeDays) : '');
    } else {
      reset();
    }
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, initial?.id]);

  const reset = () => {
    setName('');
    setUnit('nos');
    setRate('');
    setGstRate('18');
    setBrandOrSpec('');
    setCategory('');
    setItemCode('');
    setSku('');
    setBarcode('');
    setSecondaryUnit('');
    setConversionFactor('1');
    setReorderPoint('');
    setPreferredVendorId('');
    setReorderQty('');
    setLeadTimeDays('');
  };

  return (
    <Modal
      visible={open}
      animationType={isPhone ? 'slide' : 'fade'}
      transparent
      onRequestClose={onClose}
    >
      <Pressable
        className={`flex-1 bg-black/40 ${isPhone ? 'justify-end' : 'items-center justify-center p-4'}`}
        onPress={onClose}
      >
        <Pressable
          className={`bg-card w-full ${
            isPhone ? 'rounded-t-2xl max-h-[90%] p-4' : 'rounded-2xl max-w-lg max-h-[85%] p-4'
          }`}
          onPress={(e) => e.stopPropagation()}
        >
          <Text className="text-lg font-bold text-text mb-3">
            {mode === 'edit' ? `Edit ${itemLabel.toLowerCase()}` : `Add ${itemLabel.toLowerCase()}`}
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Input label="Name" value={name} onChangeText={setName} placeholder="e.g. OPC 53 Cement" />
            <Select
              label="Unit"
              value={unit}
              onChange={(v) => v && setUnit(v)}
              options={[
                { title: 'Nos', value: 'nos' },
                { title: 'Bag', value: 'bag' },
                { title: 'Kg', value: 'kg' },
                { title: 'MT', value: 'mt' },
                { title: 'Cum', value: 'cum' },
                { title: 'Sqm', value: 'sqm' },
                { title: 'Litre', value: 'ltr' },
                { title: 'Box', value: 'box' },
              ]}
            />
            <Input
              label="Rate (₹)"
              value={rate}
              onChangeText={setRate}
              keyboardType="decimal-pad"
              placeholder="0"
            />
            {mode === 'edit' ? (
              <Text className="text-[11px] text-muted -mt-3 mb-2">
                Catalog rate for new purchase requests/POs; existing documents keep their rates.
              </Text>
            ) : null}
            <Input
              label="GST %"
              value={gstRate}
              onChangeText={setGstRate}
              keyboardType="decimal-pad"
              placeholder="18"
            />
            <Input
              label="Brand / spec (optional)"
              value={brandOrSpec}
              onChangeText={setBrandOrSpec}
            />
            <Input label="Category (optional)" value={category} onChangeText={setCategory} />
            {/* INVENTORY_HORIZONTAL_PLATFORM (Phase 1.2): item master fields */}
            <Input
              label="Item code (optional)"
              value={itemCode}
              onChangeText={setItemCode}
              autoCapitalize="characters"
              placeholder="e.g. CEM-53"
            />
            <Input label="SKU (optional)" value={sku} onChangeText={setSku} autoCapitalize="characters" placeholder="e.g. CEM-53-SKU" />
            <Input label="Barcode (optional)" value={barcode} onChangeText={setBarcode} autoCapitalize="characters" placeholder="Scan or type" />
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Input label="Secondary unit (optional)" value={secondaryUnit} onChangeText={setSecondaryUnit} placeholder="e.g. bag" />
              </View>
              <View className="flex-1">
                <Input
                  label="Conversion factor"
                  value={conversionFactor}
                  onChangeText={setConversionFactor}
                  keyboardType="decimal-pad"
                  placeholder="1"
                />
              </View>
            </View>
            <Text className="text-[11px] text-muted -mt-3 mb-2">
              1 secondary unit = {conversionFactor || '1'} base units (e.g. 1 bag = 50 kg).
            </Text>
            <Input
              label="Reorder point (optional)"
              value={reorderPoint}
              onChangeText={setReorderPoint}
              keyboardType="decimal-pad"
              placeholder="0 - low-stock alert threshold"
            />
            {/* INVENTORY_HORIZONTAL_PLATFORM (Phase 4.1): procurement automation */}
            <Select
              label="Preferred vendor (optional)"
              value={preferredVendorId || undefined}
              onChange={(v) => setPreferredVendorId(v ?? '')}
              options={(vendors ?? []).map((v: PartyRow) => ({ title: v.name, value: v.id }))}
              placeholder="Pick a vendor for reorder"
            />
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Input
                  label="Reorder qty (optional)"
                  value={reorderQty}
                  onChangeText={setReorderQty}
                  keyboardType="decimal-pad"
                  placeholder="Qty for one-click PO"
                />
              </View>
              <View className="flex-1">
                <Input
                  label="Lead time (days)"
                  value={leadTimeDays}
                  onChangeText={setLeadTimeDays}
                  keyboardType="numeric"
                  placeholder="e.g. 7"
                />
              </View>
            </View>
            {error ? <Text className="text-sm text-danger mt-2">{error}</Text> : null}
            <View className="flex-row gap-2 mt-4 mb-6">
              <Button
                label="Cancel"
                variant="secondary"
                className="flex-1"
                onPress={() => {
                  reset();
                  onClose();
                }}
              />
              <Button
                label={submitting ? 'Saving…' : 'Save'}
                variant="accent"
                className="flex-1"
                disabled={submitting}
                onPress={() => {
                  if (!name.trim()) {
                    setError('Name is required');
                    return;
                  }
                  const rateNum = Number(rate);
                  if (!Number.isFinite(rateNum) || rateNum < 0) {
                    setError('Enter a valid rate');
                    return;
                  }
                  setError(null);
                  void onSubmit({
                    name: name.trim(),
                    type: 'MATERIAL',
                    unit,
                    rate: rateNum,
                    gstRate: Number(gstRate) || 0,
                    brandOrSpec: brandOrSpec.trim() || undefined,
                    category: category.trim() || undefined,
                    // INVENTORY_HORIZONTAL_PLATFORM (Phase 8.6): item code field.
                    itemCode: itemCode.trim() || undefined,
                    sku: sku.trim() || undefined,
                    barcode: barcode.trim() || undefined,
                    secondaryUnit: secondaryUnit.trim() || undefined,
                    conversionFactor: Number(conversionFactor) > 0 ? Number(conversionFactor) : undefined,
                    reorderPoint: reorderPoint === '' ? undefined : Number(reorderPoint),
                    preferredVendorId: preferredVendorId || undefined,
                    reorderQty: reorderQty === '' ? undefined : Number(reorderQty),
                    leadTimeDays: leadTimeDays === '' ? undefined : Number(leadTimeDays),
                  }).then(reset);
                }}
              />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
