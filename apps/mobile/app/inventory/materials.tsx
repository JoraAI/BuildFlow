/**
 * Inventory shell - Materials catalog.
 *
 * Create, edit, and delete materials (resources) for indents, POs, GRNs, and stock.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, Modal, ScrollView, RefreshControl, Pressable } from 'react-native';
import { Card, Button, Input, EmptyState, LoadingSkeleton, Select, toast, BusyOverlay, useBusy } from '@/components/ui';
import {
  useResources,
  useCreateResource,
  useUpdateResource,
  useDeleteResource,
  type Resource,
} from '@/services/estimate.queries';
import {
  useQuickVendorReceipt,
  useStockSummary,
  type StockSummaryRow,
} from '@/services/expansion.queries';
import { formatINR } from '@/utils/format';
import { confirmAsync } from '@/utils/confirm';
import { useViewport } from '@/hooks/useViewport';
import { useAuthStore } from '@/stores/auth.store';
import { getInventoryLabel, getInventoryLabelMode } from '@buildflow/shared';
import { useVendors, type PartyRow } from '@/services/party.queries';
import { ImportMappingModal } from '@/components/inventory/ImportMappingModal';
import { KiranaSkuPicker } from '@/components/inventory/KiranaSkuPicker';
import { useRouter } from 'expo-router';
import { useInventoryLanguage } from '@/components/inventory/InventoryLanguageProvider';

/**
 * One saved item-master row with its current aggregate stock summary.
 */
type MaterialRow = {
  key: string;
  name: string;
  unit: string;
  category: string | null;
  resource: Resource;
  stock: StockSummaryRow | null;
};

function translatedItemsTitle(
  itemPluralLabel: string,
  translate: (key: string, fallback?: string) => string,
): string {
  if (itemPluralLabel === 'Materials') return translate('inventory.materials', 'Materials');
  if (itemPluralLabel === 'Items') return translate('inventory.items', 'Items');
  return itemPluralLabel;
}

export default function InventoryMaterialsScreen() {
  const { busy, run } = useBusy();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, isFetching, refetch } = useResources();
  const { isPhone, isTablet, isDesktop } = useViewport();
  const tableMode = isTablet || isDesktop;
  const labelMode = getInventoryLabelMode(user?.inventoryProfile ?? null);
  const itemLabel = getInventoryLabel('item', labelMode);
  const itemPluralLabel = getInventoryLabel('item_plural', labelMode);
  const indentLabel = getInventoryLabel('indent', labelMode);
  const { translate } = useInventoryLanguage();
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [skuLibraryOpen, setSkuLibraryOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Resource | null>(null);
  const [receiving, setReceiving] = useState<Resource | null>(null);
  const createResource = useCreateResource();
  // id is captured per-render so `mutateAsync(input)` targets the material being edited.
  const updateResource = useUpdateResource(editing?.id ?? '');
  const deleteResource = useDeleteResource();

  const isKirana = user?.inventoryVertical === 'KIRANA';
  const { data: stock } = useStockSummary(user?.defaultProjectId ?? '');

  const materials = (data?.data ?? []).filter((r: Resource) => r.type === 'MATERIAL' || !r.type);

  const rows = useMemo<MaterialRow[]>(() => {
    const stockByResource = new Map(
      (stock ?? []).map((s: StockSummaryRow) => [s.resourceId, s]),
    );
    const owned: MaterialRow[] = materials.map((item: Resource) => ({
      key: item.id,
      name: item.name,
      unit: item.unit,
      category: item.category ?? null,
      resource: item,
      stock: stockByResource.get(item.id) ?? null,
    }));
    const q = search.trim().toLowerCase();
    const matches = (row: MaterialRow) =>
      !q || [row.name, row.category ?? '', row.key].some((v) => v.toLowerCase().includes(q));
    return owned.filter(matches);
  }, [materials, stock, search]);

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
          <Text className="text-2xl font-bold text-text">
            {translatedItemsTitle(itemPluralLabel, translate)}
          </Text>
          <Text className="text-sm text-muted mt-0.5">
            {translate('inventory.materials.masterSubtitle', 'Your item master - prices, tax and tracking')}
          </Text>
        </View>
        <View className={`flex-row gap-2 ${isPhone ? 'mt-2 w-full' : ''}`}>
          <Button
            label={translate('inventory.materials.importCsv', 'Import CSV')}
            variant="secondary"
            size="sm"
            onPress={() => setImportOpen(true)}
          />
          <Button
            label={translate('inventory.materials.addItem', `Add ${itemLabel.toLowerCase()}`)}
            variant="accent"
            size="sm"
            onPress={() => isKirana ? setSkuLibraryOpen(true) : setCreateOpen(true)}
          />
        </View>
      </View>

      <View className="px-4">
        <Input
          label={translate('inventory.materials.searchLabel', `Search ${itemPluralLabel.toLowerCase()}`)}
          value={search}
          onChangeText={setSearch}
          placeholder="e.g. atta, biscuit, KIR-058"
        />
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
          data={rows}
          keyExtractor={(row: MaterialRow) => row.key}
          refreshControl={
            <RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} tintColor="#1E3A5F" />
          }
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ListHeaderComponent={
            tableMode && rows.length > 0 ? (
              <View className="flex-row items-center px-4 py-2 bg-surface border-b border-border">
                <Text className="flex-[2.2] text-[11px] font-bold text-muted uppercase">Item</Text>
                <Text className="flex-1 text-[11px] font-bold text-muted uppercase">Category</Text>
                <Text className="flex-1 text-[11px] font-bold text-muted uppercase">HSN</Text>
                <Text className="flex-1 text-[11px] font-bold text-muted uppercase text-right">Stock</Text>
                <Text className="flex-1 text-[11px] font-bold text-muted uppercase text-right">MRP</Text>
                <Text className="flex-1 text-[11px] font-bold text-muted uppercase text-right">Cost</Text>
                <Text className="flex-1 text-[11px] font-bold text-muted uppercase text-right">Sell</Text>
                <Text className="flex-[1.6] text-[11px] font-bold text-muted uppercase text-right">Actions</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              title={`No ${itemPluralLabel.toLowerCase()} yet`}
              description={`Add ${itemPluralLabel.toLowerCase()} to your catalog, then create a ${indentLabel.toLowerCase()} and receive stock via GRN.`}
            />
          }
          renderItem={({ item: row }: { item: MaterialRow }) => {
            // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.6.6): desktop materials
            // table row (phones keep the card below).
            if (tableMode) {
              return (
                <View className="flex-row items-center px-4 py-3 bg-card border-b border-border/60">
                  <View className="flex-[2.2] min-w-0 mr-2">
                    <Text className="text-sm font-semibold text-text" numberOfLines={1}>{row.name}</Text>
                    <Text className="text-[11px] text-muted">
                      {row.unit}
                      {row.resource.brandOrSpec ? ` · ${row.resource.brandOrSpec}` : ''}
                      {row.resource.trackingMode === 'BATCH_EXPIRY' ? ' · batch tracked' : ''}
                    </Text>
                  </View>
                  <Text className="flex-1 text-xs text-muted" numberOfLines={1}>{row.category ?? '-'}</Text>
                  <Text className="flex-1 text-xs text-muted" numberOfLines={1}>{row.resource.hsnSacCode ?? '-'}</Text>
                  <Text className="flex-1 text-xs text-text text-right">
                    {Number(row.stock?.balance ?? 0) > 0 ? `${row.stock?.balance} ${row.unit}` : 'Out of stock'}
                  </Text>
                  <Text className="flex-1 text-xs text-muted text-right">
                    {row.resource.mrp != null ? `₹${Number(row.resource.mrp).toFixed(2)}` : '-'}
                  </Text>
                  <Text className="flex-1 text-xs text-muted text-right">
                    {row.resource.costPrice != null ? `₹${Number(row.resource.costPrice).toFixed(2)}` : '-'}
                  </Text>
                  <Text className="flex-1 text-sm font-bold text-primary text-right">{formatINR(Number(row.resource.rate))}</Text>
                  <View className="flex-[1.6] flex-row flex-wrap justify-end gap-1">
                    {isKirana ? (
                      <Button
                        label="Receive stock"
                        size="sm"
                        variant="accent"
                        onPress={() => setReceiving(row.resource)}
                      />
                    ) : null}
                    <Button label="Edit" size="sm" variant="secondary" onPress={() => setEditing(row.resource)} />
                    <Button label="Delete" size="sm" variant="ghost" onPress={() => void onDelete(row.resource)} />
                  </View>
                </View>
              );
            }
            return (
              <Card className="mb-2 p-4">
              <View className="flex-row items-start justify-between">
                <View className="flex-1 mr-2">
                  <Text className="text-sm font-semibold text-text">{row.name}</Text>
                  <Text className="text-xs text-muted mt-0.5">
                    {row.unit}
                    {row.resource.brandOrSpec ? ` · ${row.resource.brandOrSpec}` : ''}
                    {row.category ? ` · ${row.category}` : ''}
                    {row.resource.hsnSacCode ? ` · HSN ${row.resource.hsnSacCode}` : ''}
                  </Text>
                  <Text className="text-xs text-muted mt-0.5">
                    {Number(row.stock?.balance ?? 0) > 0
                      ? `${row.stock?.balance} ${row.unit} ${translate('inventory.materials.inStock', 'in stock')}`
                      : translate('inventory.materials.outOfStock', 'Out of stock')}
                    {row.resource.trackingMode === 'BATCH_EXPIRY'
                      ? ` · ${translate('inventory.materials.batchTracked', 'batch expiry tracked')}`
                      : ''}
                  </Text>
                  {row.stock?.nextExpiryAt ? (
                    <Text className="text-[11px] text-muted mt-0.5">
                      {translate('inventory.materials.earliestExpiry', 'Earliest expiry')}{' '}
                      {new Date(row.stock.nextExpiryAt).toLocaleDateString('en-IN')}
                      {row.stock.activeBatchCount
                        ? ` · ${row.stock.activeBatchCount} ${translate('inventory.materials.activeBatches', 'active batches')}`
                        : ''}
                    </Text>
                  ) : null}
                </View>
                <View className="items-end">
                  <Text className="text-sm font-bold text-primary">
                    {formatINR(Number(row.resource.rate))}
                  </Text>
                  {row.resource.costPrice != null ? (
                    <Text className="text-[11px] text-muted">
                      Cost ₹{Number(row.resource.costPrice).toFixed(2)} · Sell ₹{Number(row.resource.rate).toFixed(2)}
                    </Text>
                  ) : null}
                  {row.resource.mrp != null ? (
                    <Text className="text-[11px] text-muted">
                      MRP {formatINR(Number(row.resource.mrp))}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View className="flex-row gap-2 mt-3">
                {isKirana ? (
                  <Button
                    label={translate('inventory.materials.receiveStock', 'Receive stock')}
                    size="sm"
                    variant="accent"
                    onPress={() => setReceiving(row.resource)}
                  />
                ) : null}
                <Button label="Edit" size="sm" variant="secondary" onPress={() => setEditing(row.resource)} />
                <Button label="Delete" size="sm" variant="ghost" onPress={() => void onDelete(row.resource)} />
              </View>
            </Card>
          );
          }}
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
      <KiranaSkuPicker
        open={skuLibraryOpen}
        onClose={() => setSkuLibraryOpen(false)}
        onImported={() => {
          toast.success('Items added to your master');
          void refetch();
        }}
      />
      <QuickVendorReceiptModal
        item={receiving}
        onClose={() => setReceiving(null)}
        onUseFormalProcurement={() => {
          setReceiving(null);
          router.push('/inventory/procurement' as never);
        }}
        onReceived={() => {
          setReceiving(null);
          void refetch();
        }}
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
    mrp?: number | null;
    // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.7): vendor unit cost.
    costPrice?: number | null;
    gstRate?: number;
    hsnSacCode?: string;
    brandOrSpec?: string;
    category?: string;
    // INVENTORY_HORIZONTAL_PLATFORM (Phase 1.2): optional item master fields.
    sku?: string;
    itemCode?: string;
    barcode?: string;
    secondaryUnit?: string;
    conversionFactor?: number;
    reorderPoint?: number;
    trackingMode?: 'NONE' | 'BATCH_EXPIRY';
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
  const [mrp, setMrp] = useState('');
  // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.7): vendor unit cost.
  const [costPrice, setCostPrice] = useState('');
  const [gstRate, setGstRate] = useState('18');
  const [hsnSacCode, setHsnSacCode] = useState('');
  const [brandOrSpec, setBrandOrSpec] = useState('');
  const [category, setCategory] = useState('');
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 1.2): optional item master fields.
  const [itemCode, setItemCode] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [secondaryUnit, setSecondaryUnit] = useState('');
  const [conversionFactor, setConversionFactor] = useState('1');
  const [reorderPoint, setReorderPoint] = useState('');
  const [trackingMode, setTrackingMode] = useState<'NONE' | 'BATCH_EXPIRY'>('NONE');
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
      setMrp(initial.mrp == null ? '' : String(initial.mrp));
      setCostPrice(initial.costPrice == null ? '' : String(Number(initial.costPrice) || ''));
      setGstRate(initial.gstRate !== undefined ? String(initial.gstRate) : '18');
      setHsnSacCode(initial.hsnSacCode ?? '');
      setBrandOrSpec(initial.brandOrSpec ?? '');
      setCategory(initial.category ?? '');
      setItemCode(initial.itemCode ?? '');
      setSku(initial.sku ?? '');
      setBarcode(initial.barcode ?? '');
      setSecondaryUnit(initial.secondaryUnit ?? '');
      setConversionFactor(initial.conversionFactor != null ? String(Number(initial.conversionFactor)) : '1');
      setReorderPoint(initial.reorderPoint != null ? String(Number(initial.reorderPoint)) : '');
      setTrackingMode(initial.trackingMode ?? 'NONE');
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
    setMrp('');
    setCostPrice('');
    setGstRate('18');
    setHsnSacCode('');
    setBrandOrSpec('');
    setCategory('');
    setItemCode('');
    setSku('');
    setBarcode('');
    setSecondaryUnit('');
    setConversionFactor('1');
    setReorderPoint('');
    setTrackingMode('NONE');
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
            {/* INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.7): cost (vendor) vs
                sell (customer) captured separately on the SKU. */}
            <Input
              label="Cost price (₹)"
              value={costPrice}
              onChangeText={setCostPrice}
              keyboardType="decimal-pad"
              placeholder="0"
              helper="What you pay the vendor - new POs, receipts and reorder use this."
            />
            <Input
              label="Selling price (₹)"
              value={rate}
              onChangeText={setRate}
              keyboardType="decimal-pad"
              placeholder="0"
              helper="What you charge customers - checkout, sales orders and invoices use this."
            />
            <Input
              label="MRP (₹, optional)"
              value={mrp}
              onChangeText={setMrp}
              keyboardType="decimal-pad"
              placeholder="Printed maximum retail price"
            />
            <Input
              label="GST %"
              value={gstRate}
              onChangeText={setGstRate}
              keyboardType="decimal-pad"
              placeholder="18"
            />
            <Input
              label="HSN code (optional)"
              value={hsnSacCode}
              onChangeText={setHsnSacCode}
              keyboardType="numeric"
              placeholder="e.g. 1905"
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
            <Select
              label="Expiry tracking"
              value={trackingMode}
              onChange={(v) => v && setTrackingMode(v as 'NONE' | 'BATCH_EXPIRY')}
              options={[
                { title: 'No batch expiry tracking', value: 'NONE' },
                { title: 'Track batches and expiry', value: 'BATCH_EXPIRY' },
              ]}
            />
            <Text className="text-[11px] text-muted -mt-3 mb-2">
              Actual manufacture and expiry dates are recorded for each vendor receipt batch.
            </Text>
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
                  // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.7): cost has no
                  // MRP cap (cost is what you pay the vendor).
                  const costNum = costPrice === '' ? null : Number(costPrice);
                  if (costNum !== null && (!Number.isFinite(costNum) || costNum < 0)) {
                    setError('Enter a valid cost price');
                    return;
                  }
                  const mrpNum = mrp === '' ? null : Number(mrp);
                  if (mrpNum !== null && (!Number.isFinite(mrpNum) || mrpNum < 0)) {
                    setError('Enter a valid MRP');
                    return;
                  }
                  if (mrpNum !== null && mrpNum > 0 && rateNum > mrpNum) {
                    setError('Selling price cannot exceed MRP');
                    return;
                  }
                  setError(null);
                  void onSubmit({
                    name: name.trim(),
                    type: 'MATERIAL',
                    unit,
                    rate: rateNum,
                    mrp: mrpNum,
                    costPrice: costNum,
                    gstRate: Number(gstRate) || 0,
                    hsnSacCode: hsnSacCode.trim() || undefined,
                    brandOrSpec: brandOrSpec.trim() || undefined,
                    category: category.trim() || undefined,
                    // INVENTORY_HORIZONTAL_PLATFORM (Phase 8.6): item code field.
                    itemCode: itemCode.trim() || undefined,
                    sku: sku.trim() || undefined,
                    barcode: barcode.trim() || undefined,
                    secondaryUnit: secondaryUnit.trim() || undefined,
                    conversionFactor: Number(conversionFactor) > 0 ? Number(conversionFactor) : undefined,
                    reorderPoint: reorderPoint === '' ? undefined : Number(reorderPoint),
                    trackingMode,
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

function QuickVendorReceiptModal({
  item,
  onClose,
  onReceived,
  onUseFormalProcurement,
}: {
  item: Resource | null;
  onClose: () => void;
  onReceived: () => void;
  onUseFormalProcurement: () => void;
}) {
  const { isPhone } = useViewport();
  const { data: vendors } = useVendors();
  const receipt = useQuickVendorReceipt();
  const [vendorId, setVendorId] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [manufacturedAt, setManufacturedAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    setVendorId(item.preferredVendorId ?? '');
    setVendorName('');
    setInvoiceNumber('');
    setReceivedDate(new Date().toISOString().slice(0, 10));
    setQuantity('');
    // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.7): prefill from the vendor
    // cost (costPrice, else WAC), never the selling rate.
    const cost = Number(item.costPrice ?? item.avgCost ?? 0);
    setUnitCost(cost > 0 ? String(cost) : '');
    setBatchCode('');
    setManufacturedAt('');
    setExpiresAt('');
    setNotes('');
    setError(null);
  }, [item?.id]);

  const submit = async () => {
    if (!item) return;
    const qty = Number(quantity);
    const cost = Number(unitCost);
    if (!vendorId && !vendorName.trim()) return setError('Select or enter a vendor.');
    if (!Number.isFinite(qty) || qty <= 0) return setError('Enter a valid quantity.');
    if (!Number.isFinite(cost) || cost < 0) return setError('Enter a valid purchase cost.');
    if (!receivedDate) return setError('Received date is required.');
    if (manufacturedAt && expiresAt && expiresAt < manufacturedAt) {
      return setError('Expiry date must be after manufacture date.');
    }
    setError(null);
    try {
      await receipt.mutateAsync({
        vendorId: vendorId || undefined,
        vendorName: vendorId ? undefined : vendorName.trim(),
        invoiceNumber: invoiceNumber.trim() || undefined,
        receivedDate,
        notes: notes.trim() || undefined,
        lines: [{
          resourceId: item.id,
          quantity: qty,
          unitCost: cost,
          batchCode: batchCode.trim() || undefined,
          manufacturedAt: manufacturedAt || undefined,
          expiresAt: expiresAt || undefined,
        }],
      });
      toast.success(`Received ${qty} ${item.unit} of ${item.name}`);
      onReceived();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not receive stock.');
    }
  };

  return (
    <Modal visible={item !== null} transparent animationType={isPhone ? 'slide' : 'fade'} onRequestClose={onClose}>
      <Pressable
        className={`flex-1 bg-black/40 ${isPhone ? 'justify-end' : ''}`}
        onPress={onClose}
      >
        <Pressable
          className={`bg-card w-full p-4 ${isPhone ? 'rounded-t-2xl h-[96%]' : 'h-full'}`}
          onPress={(e) => e.stopPropagation()}
        >
          <Text className="text-lg font-bold text-text">Receive stock</Text>
          <Text className="text-xs text-muted mb-3">
            {item?.name} · quick receipt without a purchase order
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Select
              label="Existing vendor (optional)"
              value={vendorId || undefined}
              onChange={(value) => setVendorId(value ?? '')}
              options={(vendors ?? []).map((vendor: PartyRow) => ({
                title: vendor.name,
                value: vendor.id,
              }))}
              placeholder="Select vendor"
            />
            {!vendorId ? (
              <Input label="Vendor name" value={vendorName} onChangeText={setVendorName} />
            ) : null}
            <View className={`${isPhone ? '' : 'flex-row'} gap-2`}>
              <View className="flex-1">
                <Input label="Vendor invoice (optional)" value={invoiceNumber} onChangeText={setInvoiceNumber} />
              </View>
              <View className="flex-1">
                <Input label="Received date" value={receivedDate} onChangeText={setReceivedDate} placeholder="YYYY-MM-DD" />
              </View>
            </View>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Input label={`Quantity (${item?.unit ?? ''})`} value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" />
              </View>
              <View className="flex-1">
                <Input label="Cost ₹ / unit (what you pay)" value={unitCost} onChangeText={setUnitCost} keyboardType="decimal-pad" />
              </View>
            </View>
            {item?.trackingMode === 'BATCH_EXPIRY' ? (
              <>
                <Input label="Batch code (optional)" value={batchCode} onChangeText={setBatchCode} />
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <Input label="Manufactured (optional)" value={manufacturedAt} onChangeText={setManufacturedAt} placeholder="YYYY-MM-DD" />
                  </View>
                  <View className="flex-1">
                    <Input label="Expiry (optional)" value={expiresAt} onChangeText={setExpiresAt} placeholder="YYYY-MM-DD" />
                  </View>
                </View>
              </>
            ) : null}
            <Input label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
            {error ? <Text className="text-sm text-danger mb-2">{error}</Text> : null}
            <Button
              label="Use purchase order / GRN instead"
              variant="ghost"
              onPress={onUseFormalProcurement}
            />
            <View className="flex-row gap-2 mt-3 mb-4">
              <Button label="Cancel" variant="secondary" className="flex-1" onPress={onClose} />
              <Button
                label="Receive"
                variant="accent"
                className="flex-1"
                loading={receipt.isPending}
                onPress={() => void submit()}
              />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
