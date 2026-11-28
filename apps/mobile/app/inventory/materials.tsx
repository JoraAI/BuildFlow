/**
 * Inventory shell - Materials catalog.
 *
 * Create, edit, and delete materials (resources) for indents, POs, GRNs, and stock.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Modal, ScrollView, RefreshControl, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button, Input, EmptyState, LoadingSkeleton, Select, toast, BusyOverlay, useBusy } from '@/components/ui';
import { pickImage } from '@/utils/pick-image';
import { ApiError } from '@/lib/api-client';
import {
  useResources,
  useCreateResource,
  useUpdateResource,
  useDeleteResource,
  useUploadMaterialImage,
  type Resource,
} from '@/services/estimate.queries';
import { useSetB2bPublished } from '@/services/ice-cream.queries';
import {
  useQuickVendorReceipt,
  useStockSummary,
  useImportOpeningStock,
  type StockSummaryRow,
} from '@/services/expansion.queries';
import { formatINR } from '@/utils/format';
import { confirmAsync } from '@/utils/confirm';
import { useViewport } from '@/hooks/useViewport';
import { useAuthStore } from '@/stores/auth.store';
import {
  getGstTaxCodeLabels,
  getInventoryLabel,
  getInventoryLabelMode,
  hasInventoryFeature,
  mrpCapForUnit,
  resolveBuyCost,
  type SubscriptionPlanKey,
} from '@buildflow/shared';
import { useVendors, type PartyRow } from '@/services/party.queries';
import { useCompany } from '@/services/settings.queries';
import { useCompanyUnits } from '@/services/unit.queries';
import { ImportMappingModal } from '@/components/inventory/ImportMappingModal';
import { KiranaSkuPicker } from '@/components/inventory/KiranaSkuPicker';
import { useRouter } from 'expo-router';
import { useInventoryLanguage } from '@/components/inventory/InventoryLanguageProvider';
import { InventoryFilterBar } from '@/components/inventory/InventoryFilterBar';
import { useInventoryListFilters } from '@/hooks/useInventoryListFilters';
import { matchesStatus, matchesText } from '@/utils/inventory-filters';
import { inventoryProcurementHref } from '@/utils/navigation-paths';
import { useIceCreamVertical, useRoleBasedPricing } from '@/hooks/useIceCreamVertical';
import { MaterialThumbnail } from '@/components/materials/MaterialThumbnail';
import { INVENTORY_ACCENT } from '@/components/navigation/InventoryTabBar';
import { InventoryScreenList, inventoryPageListPadding } from '@/components/inventory/InventoryScreenList';
import { mobileListBottomPadding } from '@/components/layout/fab-layout';

const MATERIAL_STATUS_TABS = [
  { value: 'ALL' as const, label: 'All' },
  { value: 'LOW' as const, label: 'Low stock' },
  { value: 'OUT' as const, label: 'Out of stock' },
];
type MaterialStatus = (typeof MATERIAL_STATUS_TABS)[number]['value'];

/** Keep header + row columns in lockstep (thumbnail sits ahead of the Item flex). */
const MAT_THUMB = 44;
const MAT_THUMB_GAP = 12;
const MAT_COL = {
  item: { flexGrow: 2.2, flexShrink: 1, flexBasis: 0, minWidth: 120, marginRight: 8 } as const,
  cat: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 72 } as const,
  hsn: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 64 } as const,
  num: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 72 } as const,
  actions: { flexGrow: 1.6, flexShrink: 0, flexBasis: 0, minWidth: 140 } as const,
};

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
  /** Derived from balance vs reorder point - drives the stock status chips. */
  stockState: 'OK' | 'LOW' | 'OUT';
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
  const { busy, run, clearBusy } = useBusy();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const taxCode = getGstTaxCodeLabels(user?.inventoryVertical, user?.inventoryProfile);
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
  const filters = useInventoryListFilters();
  const [editing, setEditing] = useState<Resource | null>(null);
  const [receiving, setReceiving] = useState<Resource | null>(null);
  const createResource = useCreateResource();
  // id is captured per-render so `mutateAsync(input)` targets the material being edited.
  const updateResource = useUpdateResource(editing?.id ?? '');
  const deleteResource = useDeleteResource();
  const importOpening = useImportOpeningStock();
  const stockAdjustEnabled = hasInventoryFeature(
    (user?.subscriptionPlan ?? 'INVENTORY') as SubscriptionPlanKey,
    'stock_adjustments',
  );

  const isKirana = user?.inventoryVertical === 'RETAILER';
  const isIceCream = useIceCreamVertical();
  const rolePricing = useRoleBasedPricing();
  const setB2bPublished = useSetB2bPublished();
  /** Survives stale React Query / Redis list cache after Publish B2B. */
  const [b2bLocal, setB2bLocal] = useState<Record<string, boolean>>({});
  const isB2bPublished = (r: Resource) =>
    b2bLocal[r.id] !== undefined ? b2bLocal[r.id]! : Boolean(r.b2bPublished);
  const { data: stock } = useStockSummary(user?.defaultProjectId ?? '');

  const stockByResourceId = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of stock ?? []) map.set(s.resourceId, Number(s.balance) || 0);
    return map;
  }, [stock]);

  const applyOpeningIfNeeded = async (
    resourceId: string,
    unitLabel: string,
    openingQty: number | null | undefined,
    currentOnHand: number,
    unitCost?: number | null,
  ) => {
    if (openingQty == null || !Number.isFinite(openingQty) || openingQty <= 0) return;
    if (Math.abs(openingQty - currentOnHand) < 1e-9) return;
    const ok = await confirmAsync(
      'Reset on-hand stock?',
      `This sets on-hand for this item to ${openingQty} ${unitLabel} (current balance is ${currentOnHand}). ` +
        'It is not added on top. Past movements stay in history; a new Opening stock adjustment is logged.',
    );
    if (!ok) return;
    await importOpening.mutateAsync({
      lines: [
        {
          resourceId,
          quantity: openingQty,
          ...(unitCost != null && Number.isFinite(unitCost) && unitCost >= 0
            ? { rate: unitCost }
            : {}),
        },
      ],
    });
  };

  const materials = (data?.data ?? []).filter((r: Resource) => r.type === 'MATERIAL' || !r.type);

  const allRows = useMemo<MaterialRow[]>(() => {
    const stockByResource = new Map<string, StockSummaryRow>(
      (stock ?? []).map((s: StockSummaryRow) => [s.resourceId, s]),
    );
    return materials.map((item: Resource) => {
      const rowStock = stockByResource.get(item.id) ?? null;
      const balance = Number(rowStock?.balance ?? 0);
      const reorderPoint = Number(rowStock?.reorderPoint ?? item.reorderPoint ?? 0);
      const stockState: MaterialRow['stockState'] =
        balance <= 0 ? 'OUT' : reorderPoint > 0 && balance <= reorderPoint ? 'LOW' : 'OK';
      return {
        key: item.id,
        name: item.name,
        unit: item.unit,
        category: item.category ?? null,
        resource: item,
        stock: rowStock,
        stockState,
      };
    });
  }, [materials, stock]);

  const rows = useMemo<MaterialRow[]>(
    () =>
      allRows.filter(
        (row) =>
          matchesText(
            [
              row.name,
              row.category,
              row.resource.sku,
              row.resource.itemCode,
              row.resource.barcode,
              row.resource.brandOrSpec,
              row.resource.hsnSacCode,
              row.key,
            ],
            filters.debouncedQuery,
          ) && matchesStatus(row.stockState, filters.status),
      ),
    [allRows, filters.debouncedQuery, filters.status],
  );

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

  const pageChrome = (
    <>
      <View className="px-4 pt-4 pb-2 flex-row flex-wrap items-center justify-between">
        <View className="flex-1 mr-2 min-w-[160px]">
          <Text className={`font-bold text-text ${isPhone ? 'text-xl' : 'text-2xl'}`}>
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

      <InventoryFilterBar
        query={filters.query}
        onQueryChange={filters.setQuery}
        placeholder={translate(
          'inventory.materials.searchLabel',
          `Search ${itemPluralLabel.toLowerCase()} - name, SKU, barcode, ${taxCode.short}`,
        )}
        statusTabs={MATERIAL_STATUS_TABS}
        status={filters.status as MaterialStatus}
        onStatusChange={filters.setStatus}
        resultCount={{ shown: rows.length, total: allRows.length }}
        isFiltered={filters.isFiltered}
        onClear={filters.clearAll}
      />
    </>
  );

  return (
    <View className="flex-1 min-h-0 bg-surface">
      <BusyOverlay
        visible={busy}
        title={`Updating ${itemPluralLabel.toLowerCase()}…`}
        onDismiss={clearBusy}
      />
      <InventoryScreenList
        className="flex-1"
        hasScreenFab={isPhone}
        chrome={pageChrome}
        data={isLoading ? [] : rows}
        keyExtractor={(row: MaterialRow) => row.key}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} tintColor="#1E3A5F" />
        }
        contentContainerStyle={{
          paddingHorizontal: tableMode ? 24 : 16,
          paddingBottom: isPhone
            ? inventoryPageListPadding(true) + 72
            : mobileListBottomPadding(true) + (tableMode ? 48 : 72),
          paddingTop: tableMode ? 8 : 0,
        }}
        stickySubheader={
          tableMode && rows.length > 0 ? (
            <View style={{ paddingHorizontal: tableMode ? 24 : 16 }}>
              {/* px-4 matches row card padding so columns line up with cells */}
              <View className="flex-row items-center px-4 py-2.5">
                <View style={{ width: MAT_THUMB + MAT_THUMB_GAP }} />
                <Text style={MAT_COL.item} className="text-[11px] font-bold text-muted uppercase">
                  Item
                </Text>
                <Text style={MAT_COL.cat} className="text-[11px] font-bold text-muted uppercase">
                  Category
                </Text>
                <Text style={MAT_COL.hsn} className="text-[11px] font-bold text-muted uppercase">
                  {taxCode.short}
                </Text>
                <Text
                  style={MAT_COL.num}
                  className="text-[11px] font-bold text-muted uppercase text-right"
                >
                  Stock
                </Text>
                <Text
                  style={MAT_COL.num}
                  className="text-[11px] font-bold text-muted uppercase text-right"
                >
                  MRP
                </Text>
                <Text
                  style={MAT_COL.num}
                  className="text-[11px] font-bold text-muted uppercase text-right"
                >
                  Cost
                </Text>
                {rolePricing ? (
                  <>
                    <Text
                      style={MAT_COL.num}
                      className="text-[11px] font-bold text-muted uppercase text-right"
                    >
                      Dist
                    </Text>
                    <Text
                      style={MAT_COL.num}
                      className="text-[11px] font-bold text-muted uppercase text-right"
                    >
                      Cust
                    </Text>
                  </>
                ) : (
                  <Text
                    style={MAT_COL.num}
                    className="text-[11px] font-bold text-muted uppercase text-right"
                  >
                    Sell
                  </Text>
                )}
                <Text
                  style={MAT_COL.actions}
                  className="text-[11px] font-bold text-muted uppercase text-right"
                >
                  Actions
                </Text>
              </View>
            </View>
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            <View className="gap-3">
              {[1, 2, 3].map((i) => (
                <LoadingSkeleton key={i} className="rounded-xl h-16" />
              ))}
            </View>
          ) : filters.isFiltered ? (
            <EmptyState
              title={`No matching ${itemPluralLabel.toLowerCase()}`}
              description="Try a different search term or clear the filters."
            />
          ) : (
            <EmptyState
              title={`No ${itemPluralLabel.toLowerCase()} yet`}
              description={`Add ${itemPluralLabel.toLowerCase()} to your catalog, then create a ${indentLabel.toLowerCase()} and receive stock via GRN.`}
            />
          )
        }
          renderItem={({ item: row }: { item: MaterialRow }) => {
            // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.6.6): desktop materials
            // table row (phones keep the card below).
            if (tableMode) {
              return (
                <View className="mb-2 flex-row items-center rounded-xl border border-border bg-card px-4 py-4">
                  <View style={{ width: MAT_THUMB, marginRight: MAT_THUMB_GAP }}>
                    <MaterialThumbnail
                      material={row.resource}
                      size={MAT_THUMB}
                      iceCream={isIceCream}
                    />
                  </View>
                  <View style={MAT_COL.item} className="min-w-0">
                    <Text className="text-sm font-semibold text-text" numberOfLines={1}>
                      {row.name}
                    </Text>
                    <Text className="text-[11px] text-muted mt-1">
                      {row.unit}
                      {row.resource.brandOrSpec ? ` · ${row.resource.brandOrSpec}` : ''}
                      {row.resource.trackingMode === 'BATCH_EXPIRY' ? ' · batch tracked' : ''}
                    </Text>
                  </View>
                  <Text style={MAT_COL.cat} className="text-xs text-muted" numberOfLines={1}>
                    {row.category ?? '-'}
                  </Text>
                  <Text style={MAT_COL.hsn} className="text-xs text-muted" numberOfLines={1}>
                    {row.resource.hsnSacCode ?? '-'}
                  </Text>
                  <Text style={MAT_COL.num} className="text-xs text-text text-right">
                    {Number(row.stock?.balance ?? 0) > 0
                      ? `${row.stock?.balance} ${row.unit}`
                      : 'Out of stock'}
                  </Text>
                  <Text style={MAT_COL.num} className="text-xs text-muted text-right">
                    {row.resource.mrp != null ? `₹${Number(row.resource.mrp).toFixed(2)}` : '-'}
                  </Text>
                  <Text style={MAT_COL.num} className="text-xs text-muted text-right">
                    {row.resource.costPrice != null
                      ? `₹${Number(row.resource.costPrice).toFixed(2)}`
                      : '-'}
                  </Text>
                  {rolePricing ? (
                    <>
                      <Text style={MAT_COL.num} className="text-sm font-bold text-primary text-right">
                        {row.resource.distributorRate != null &&
                        Number(row.resource.distributorRate) >= 0
                          ? `₹${Number(row.resource.distributorRate).toFixed(2)}`
                          : '-'}
                      </Text>
                      <Text style={MAT_COL.num} className="text-sm font-bold text-primary text-right">
                        {row.resource.customerRate != null && Number(row.resource.customerRate) >= 0
                          ? `₹${Number(row.resource.customerRate).toFixed(2)}`
                          : '-'}
                      </Text>
                    </>
                  ) : (
                    <Text style={MAT_COL.num} className="text-sm font-bold text-primary text-right">
                      {formatINR(Number(row.resource.rate))}
                    </Text>
                  )}
                  <View style={MAT_COL.actions} className="flex-row flex-wrap justify-end gap-2 pl-2">
                    {isKirana ? (
                      <Button
                        label="Receive stock"
                        size="sm"
                        variant="accent"
                        onPress={() => setReceiving(row.resource)}
                      />
                    ) : null}
                    {isIceCream ? (
                      <Button
                        label={isB2bPublished(row.resource) ? 'Unpublish' : 'Publish B2B'}
                        size="sm"
                        variant={isB2bPublished(row.resource) ? 'secondary' : 'accent'}
                        onPress={() =>
                          void run(async () => {
                            const next = !isB2bPublished(row.resource);
                            try {
                              await setB2bPublished.mutateAsync({
                                resourceId: row.resource.id,
                                published: next,
                              });
                              setB2bLocal((prev) => ({ ...prev, [row.resource.id]: next }));
                              toast.success(
                                next
                                  ? 'Published to buyer catalog'
                                  : 'Removed from buyer catalog',
                              );
                              void refetch();
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : 'Failed');
                            }
                          })
                        }
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
                <View className="mr-3 mt-0.5">
                  <MaterialThumbnail material={row.resource} size={56} iceCream={isIceCream} />
                </View>
                <View className="flex-1 mr-2">
                  <Text className="text-sm font-semibold text-text">{row.name}</Text>
                  <Text className="text-xs text-muted mt-0.5">
                    {row.unit}
                    {row.resource.brandOrSpec ? ` · ${row.resource.brandOrSpec}` : ''}
                    {row.category ? ` · ${row.category}` : ''}
                    {row.resource.hsnSacCode ? ` · ${taxCode.short} ${row.resource.hsnSacCode}` : ''}
                    {isIceCream && isB2bPublished(row.resource) ? ' · On B2B catalog' : ''}
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
                  {rolePricing ? (
                    <>
                      <Text className="text-sm font-bold text-primary">
                        Dist{' '}
                        {row.resource.distributorRate != null &&
                        Number(row.resource.distributorRate) >= 0
                          ? `₹${Number(row.resource.distributorRate).toFixed(2)}`
                          : '—'}
                      </Text>
                      <Text className="text-sm font-bold text-primary mt-0.5">
                        Cust{' '}
                        {row.resource.customerRate != null && Number(row.resource.customerRate) >= 0
                          ? `₹${Number(row.resource.customerRate).toFixed(2)}`
                          : '—'}
                      </Text>
                    </>
                  ) : (
                    <Text className="text-sm font-bold text-primary">
                      {formatINR(Number(row.resource.rate))}
                    </Text>
                  )}
                  {row.resource.costPrice != null ? (
                    <Text className="text-[11px] text-muted">
                      Cost ₹{Number(row.resource.costPrice).toFixed(2)}
                      {!rolePricing ? ` · Sell ₹${Number(row.resource.rate).toFixed(2)}` : ''}
                    </Text>
                  ) : null}
                  {row.resource.mrp != null ? (
                    <Text className="text-[11px] text-muted">
                      MRP {formatINR(Number(row.resource.mrp))}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View className="flex-row flex-wrap gap-2 mt-3">
                {isKirana ? (
                  <Button
                    label={translate('inventory.materials.receiveStock', 'Receive stock')}
                    size="sm"
                    variant="accent"
                    onPress={() => setReceiving(row.resource)}
                  />
                ) : null}
                {isIceCream ? (
                  <Button
                    label={isB2bPublished(row.resource) ? 'Unpublish' : 'Publish B2B'}
                    size="sm"
                    variant={isB2bPublished(row.resource) ? 'secondary' : 'accent'}
                    onPress={() =>
                      void run(async () => {
                        const next = !isB2bPublished(row.resource);
                        try {
                          await setB2bPublished.mutateAsync({
                            resourceId: row.resource.id,
                            published: next,
                          });
                          setB2bLocal((prev) => ({ ...prev, [row.resource.id]: next }));
                          toast.success(
                            next
                              ? 'Published to buyer catalog'
                              : 'Removed from buyer catalog',
                          );
                          void refetch();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : 'Failed');
                        }
                      })
                    }
                  />
                ) : null}
                <Button label="Edit" size="sm" variant="secondary" onPress={() => setEditing(row.resource)} />
                <Button label="Delete" size="sm" variant="ghost" onPress={() => void onDelete(row.resource)} />
              </View>
            </Card>
          );
          }}
        />

      {isPhone ? (
        <Pressable
          onPress={() => (isKirana ? setSkuLibraryOpen(true) : setCreateOpen(true))}
          className="absolute right-4 w-14 h-14 rounded-full items-center justify-center shadow-lg"
          style={{
            bottom: inventoryPageListPadding(true) + 8,
            backgroundColor: INVENTORY_ACCENT,
          }}
          accessibilityLabel={`Add ${itemLabel.toLowerCase()}`}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      ) : null}

      <MaterialFormModal
        mode="create"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        itemLabel={itemLabel}
        taxCodeField={taxCode.field}
        taxCodeShort={taxCode.short}
        taxCodeMissing={taxCode.missing}
        showRoleRates={rolePricing}
        showOpeningStock={stockAdjustEnabled}
        submitting={createResource.isPending || importOpening.isPending}
        onSubmit={async (input) => {
          await run(async () => {
            try {
              const { imageUrl, openingQty, ...rest } = input;
              const created = await createResource.mutateAsync({
                ...rest,
                ...(typeof imageUrl === 'string' ? { imageUrl } : {}),
              });
              await applyOpeningIfNeeded(
                created.id,
                created.unit || rest.unit,
                openingQty,
                0,
                rest.costPrice ?? null,
              );
              toast.success(`${itemLabel} added`);
              setCreateOpen(false);
              void refetch();
            } catch (e) {
              // Global apiFetch already redirects on PAYMENT_REQUIRED; still show feedback.
              if (e instanceof ApiError && e.code === 'PAYMENT_REQUIRED') {
                setCreateOpen(false);
                return;
              }
              toast.error(e instanceof Error ? e.message : `Could not add ${itemLabel.toLowerCase()}`);
            }
          });
        }}
      />

      <MaterialFormModal
        mode="edit"
        open={editing !== null}
        initial={editing ?? undefined}
        initialOpeningQty={editing ? stockByResourceId.get(editing.id) ?? 0 : null}
        onClose={() => setEditing(null)}
        itemLabel={itemLabel}
        taxCodeField={taxCode.field}
        taxCodeShort={taxCode.short}
        taxCodeMissing={taxCode.missing}
        showRoleRates={rolePricing}
        showOpeningStock={stockAdjustEnabled}
        submitting={
          (editing !== null && updateResource.isPending) || importOpening.isPending
        }
        onSubmit={async (input) => {
          if (!editing) return;
          await run(async () => {
            try {
              const { openingQty, ...rest } = input;
              const currentOnHand = stockByResourceId.get(editing.id) ?? 0;
              await updateResource.mutateAsync(rest);
              await applyOpeningIfNeeded(
                editing.id,
                rest.unit || editing.unit,
                openingQty,
                currentOnHand,
                rest.costPrice ?? editing.costPrice ?? null,
              );
              toast.success(`${itemLabel} updated`);
              setEditing(null);
              void refetch();
            } catch (e) {
              if (e instanceof ApiError && e.code === 'PAYMENT_REQUIRED') {
                setEditing(null);
                return;
              }
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
          const itemName = receiving?.name;
          setReceiving(null);
          router.push(inventoryProcurementHref({ tab: 'indents', q: itemName }) as never);
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
  initialOpeningQty = null,
  itemLabel,
  taxCodeField = 'HSN/SAC code',
  taxCodeShort = 'HSN/SAC',
  taxCodeMissing = 'Missing HSN/SAC',
  showRoleRates = false,
  showOpeningStock = false,
  onSubmit,
  submitting,
}: {
  mode: 'create' | 'edit';
  open: boolean;
  onClose: () => void;
  initial?: Resource;
  /** Current on-hand used to prefill Opening qty in edit mode. */
  initialOpeningQty?: number | null;
  itemLabel: string;
  taxCodeField?: string;
  taxCodeShort?: string;
  taxCodeMissing?: string;
  /** ICE_CREAM: show distributor / customer B2B sell prices. */
  showRoleRates?: boolean;
  /** When stock_adjustments is enabled — show Opening qty field. */
  showOpeningStock?: boolean;
  onSubmit: (input: {
    name: string;
    type: 'MATERIAL';
    unit: string;
    rate: number;
    mrp?: number | null;
    // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.7): vendor unit cost.
    costPrice?: number | null;
    distributorRate?: number | null;
    customerRate?: number | null;
    gstRate?: number;
    hsnSacCode?: string;
    brandOrSpec?: string;
    category?: string;
    imageUrl?: string | null;
    // INVENTORY_HORIZONTAL_PLATFORM (Phase 1.2): optional item master fields.
    sku?: string;
    itemCode?: string;
    barcode?: string;
    secondaryUnit?: string;
    conversionFactor?: number;
    units?: Array<{
      unitName: string;
      isBase: boolean;
      conversionToBase: number;
      rate?: number | null;
      distributorRate?: number | null;
      customerRate?: number | null;
      costPrice?: number | null;
    }>;
    reorderPoint?: number;
    trackingMode?: 'NONE' | 'BATCH_EXPIRY';
    // INVENTORY_HORIZONTAL_PLATFORM (Phase 4.1): procurement automation fields.
    preferredVendorId?: string;
    reorderQty?: number;
    leadTimeDays?: number;
    /** Absolute opening/on-hand qty; omitted/blank skips stock update. */
    openingQty?: number | null;
  }) => Promise<void>;
  submitting: boolean;
}) {
  const { isPhone } = useViewport();
  const { data: vendors } = useVendors();
  const uploadImage = useUploadMaterialImage();
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('nos');
  const [rate, setRate] = useState('');
  const [mrp, setMrp] = useState('');
  // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.7): vendor unit cost.
  const [costPrice, setCostPrice] = useState('');
  const [distributorRate, setDistributorRate] = useState('');
  const [customerRate, setCustomerRate] = useState('');
  const [gstRate, setGstRate] = useState('18');
  const [hsnSacCode, setHsnSacCode] = useState('');
  const [brandOrSpec, setBrandOrSpec] = useState('');
  const [category, setCategory] = useState('');
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 1.2): optional item master fields.
  const [itemCode, setItemCode] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [secondaryUnit, setSecondaryUnit] = useState('');
  const [conversionFactor, setConversionFactor] = useState('1');
  const [altUnits, setAltUnits] = useState<
    Array<{
      key: string;
      unitName: string;
      conversionToBase: string;
      rate: string;
      distributorRate: string;
      customerRate: string;
      costPrice: string;
    }>
  >([]);
  const [reorderPoint, setReorderPoint] = useState('');
  const [openingQty, setOpeningQty] = useState('');
  const [trackingMode, setTrackingMode] = useState<'NONE' | 'BATCH_EXPIRY'>('NONE');
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 4.1): procurement automation fields.
  const [preferredVendorId, setPreferredVendorId] = useState('');
  const [reorderQty, setReorderQty] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { data: company } = useCompany();
  const { data: shopUnits } = useCompanyUnits();
  const multiUnitOn = Boolean(company?.multiUnitEnabled);
  const unitOptions = (shopUnits ?? []).map((u: { name: string }) => ({
    title: u.name,
    value: u.name,
  }));
  const unitSelectOptions =
    unitOptions.length > 0
      ? unitOptions
      : [
          { title: 'Nos', value: 'nos' },
          { title: 'Bag', value: 'bag' },
          { title: 'Kg', value: 'kg' },
          { title: 'MT', value: 'mt' },
          { title: 'Cum', value: 'cum' },
          { title: 'Sqm', value: 'sqm' },
          { title: 'Litre', value: 'ltr' },
          { title: 'Box', value: 'box' },
        ];

  // Prefill when opening in edit mode; reset when opening in create mode.
  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && initial) {
      setName(initial.name);
      setUnit(initial.unit || 'nos');
      setRate(String(initial.rate ?? 0));
      setMrp(initial.mrp == null ? '' : String(initial.mrp));
      setCostPrice(initial.costPrice == null ? '' : String(Number(initial.costPrice) || ''));
      setDistributorRate(
        initial.distributorRate == null ? '' : String(Number(initial.distributorRate) || ''),
      );
      setCustomerRate(
        initial.customerRate == null ? '' : String(Number(initial.customerRate) || ''),
      );
      setGstRate(initial.gstRate !== undefined ? String(initial.gstRate) : '18');
      setHsnSacCode(initial.hsnSacCode ?? '');
      setBrandOrSpec(initial.brandOrSpec ?? '');
      setCategory(initial.category ?? '');
      setItemCode(initial.itemCode ?? '');
      setSku(initial.sku ?? '');
      setBarcode(initial.barcode ?? '');
      setSecondaryUnit(initial.secondaryUnit ?? '');
      setConversionFactor(initial.conversionFactor != null ? String(Number(initial.conversionFactor)) : '1');
      const alts = (initial.units ?? []).filter(
        (u: { isBase: boolean }) => !u.isBase,
      );
      setAltUnits(
        alts.length > 0
          ? alts.map(
              (
                u: {
                  unitName: string;
                  conversionToBase: number;
                  rate?: number | null;
                  distributorRate?: number | null;
                  customerRate?: number | null;
                  costPrice?: number | null;
                },
                i: number,
              ) => ({
              key: `u-${i}-${u.unitName}`,
              unitName: u.unitName,
              conversionToBase: String(u.conversionToBase || 1),
              rate: u.rate != null ? String(u.rate) : '',
              distributorRate: u.distributorRate != null ? String(u.distributorRate) : '',
              customerRate: u.customerRate != null ? String(u.customerRate) : '',
              costPrice: u.costPrice != null ? String(u.costPrice) : '',
            }),
            )
          : initial.secondaryUnit
            ? [
                {
                  key: 'legacy-sec',
                  unitName: initial.secondaryUnit,
                  conversionToBase:
                    initial.conversionFactor != null
                      ? String(Number(initial.conversionFactor))
                      : '1',
                  rate: '',
                  distributorRate: '',
                  customerRate: '',
                  costPrice: '',
                },
              ]
            : [],
      );
      setReorderPoint(initial.reorderPoint != null ? String(Number(initial.reorderPoint)) : '');
      setOpeningQty(
        initialOpeningQty != null && Number(initialOpeningQty) > 0
          ? String(Number(initialOpeningQty))
          : '',
      );
      setTrackingMode(initial.trackingMode ?? 'NONE');
      setPreferredVendorId(initial.preferredVendorId ?? '');
      setReorderQty(initial.reorderQty != null ? String(Number(initial.reorderQty)) : '');
      setLeadTimeDays(initial.leadTimeDays != null ? String(initial.leadTimeDays) : '');
      setLocalImageUri(null);
      setRemoveImage(false);
    } else {
      reset();
    }
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, initial?.id, initialOpeningQty]);

  const reset = () => {
    setName('');
    setUnit('nos');
    setRate('');
    setMrp('');
    setCostPrice('');
    setDistributorRate('');
    setCustomerRate('');
    setGstRate('18');
    setHsnSacCode('');
    setBrandOrSpec('');
    setCategory('');
    setLocalImageUri(null);
    setRemoveImage(false);
    setItemCode('');
    setSku('');
    setBarcode('');
    setSecondaryUnit('');
    setConversionFactor('1');
    setAltUnits([]);
    setReorderPoint('');
    setOpeningQty('');
    setTrackingMode('NONE');
    setPreferredVendorId('');
    setReorderQty('');
    setLeadTimeDays('');
  };

  const pickPhoto = async (fromCamera: boolean) => {
    setError(null);
    try {
      const result = await pickImage({ fromCamera });
      if (result.canceled || !result.assets?.[0]) return;
      setLocalImageUri(result.assets[0].uri);
      setRemoveImage(false);
    } catch {
      setError(fromCamera ? 'Camera permission is required' : 'Photo library permission is required');
    }
  };

  const existingImageUrl = removeImage ? null : initial?.imageUrl ?? null;
  const previewMaterial: Pick<Resource, 'category' | 'imageUrl'> = {
    category: category || initial?.category || null,
    imageUrl: existingImageUrl,
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
            <View className="items-center gap-2 mb-3">
              <MaterialThumbnail
                material={previewMaterial}
                localUri={localImageUri}
                size={88}
                iceCream={showRoleRates}
              />
              <View className="flex-row flex-wrap gap-2 justify-center">
                <Button
                  label="Gallery"
                  size="sm"
                  variant="secondary"
                  disabled={submitting || uploadingPhoto}
                  onPress={() => void pickPhoto(false)}
                />
                <Button
                  label="Camera"
                  size="sm"
                  variant="secondary"
                  disabled={submitting || uploadingPhoto}
                  onPress={() => void pickPhoto(true)}
                />
                {(localImageUri || existingImageUrl) && !removeImage ? (
                  <Button
                    label="Remove"
                    size="sm"
                    variant="ghost"
                    disabled={submitting || uploadingPhoto}
                    onPress={() => {
                      setLocalImageUri(null);
                      setRemoveImage(true);
                    }}
                  />
                ) : null}
              </View>
              <Text className="text-[10px] text-muted text-center">
                Optional product photo — shown in the items list and buyer catalog.
              </Text>
            </View>
            <Input label="Name" value={name} onChangeText={setName} placeholder="e.g. OPC 53 Cement" />
            <Select
              label={multiUnitOn ? 'Base unit' : 'Unit'}
              value={unit}
              onChange={(v) => v && setUnit(v)}
              options={unitSelectOptions}
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
            {!showRoleRates ? (
              <Input
                label="Selling price (₹)"
                value={rate}
                onChangeText={setRate}
                keyboardType="decimal-pad"
                placeholder="0"
                helper="What you charge customers - checkout, sales orders and invoices use this."
              />
            ) : null}
            <Input
              label="MRP (₹, optional)"
              value={mrp}
              onChangeText={setMrp}
              keyboardType="decimal-pad"
              placeholder="Printed maximum retail price"
            />
            {showRoleRates ? (
              <>
                <Input
                  label="Distributor sell price (₹)"
                  value={distributorRate}
                  onChangeText={setDistributorRate}
                  keyboardType="decimal-pad"
                  placeholder="Required"
                  helper="Auto-applied on SO / invoice / buyer app when the party role is Distributor. Price lists override this."
                />
                <Input
                  label="Customer sell price (₹)"
                  value={customerRate}
                  onChangeText={setCustomerRate}
                  keyboardType="decimal-pad"
                  placeholder="Required"
                  helper="Auto-applied when the party role is Customer. Also used as the catalog sell price. Price lists override this."
                />
              </>
            ) : null}
            <Input
              label="GST %"
              value={gstRate}
              onChangeText={setGstRate}
              keyboardType="decimal-pad"
              placeholder="18"
            />
            <Input
              label={`${taxCodeField} (optional)`}
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
            {multiUnitOn ? (
              <View className="gap-2 mb-2">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-bold text-text">Additional units</Text>
                  <Button
                    label="Add unit"
                    size="sm"
                    variant="secondary"
                    onPress={() =>
                      setAltUnits((prev) => [
                        ...prev,
                        {
                          key: `new-${Date.now()}`,
                          unitName: '',
                          conversionToBase: '1',
                          rate: '',
                          distributorRate: '',
                          customerRate: '',
                          costPrice: '',
                        },
                      ])
                    }
                  />
                </View>
                <Text className="text-[11px] text-muted">
                  1 alternate = N base ({unit || 'base'}). Blank sell/buy ₹ = base × conversion.
                </Text>
                {altUnits.map((row) => (
                  <View key={row.key} className="border border-border rounded-xl p-3 gap-2 bg-surface">
                    <Select
                      label="Unit"
                      value={row.unitName || undefined}
                      onChange={(v) =>
                        setAltUnits((prev) =>
                          prev.map((x) => (x.key === row.key ? { ...x, unitName: v ?? '' } : x)),
                        )
                      }
                      options={unitSelectOptions.filter(
                        (o: { title: string; value: string }) => o.value !== unit,
                      )}
                      placeholder="Select unit"
                    />
                    <Input
                      label={`1 ${row.unitName || 'unit'} = ? ${unit || 'base'}`}
                      value={row.conversionToBase}
                      onChangeText={(v) =>
                        setAltUnits((prev) =>
                          prev.map((x) => (x.key === row.key ? { ...x, conversionToBase: v } : x)),
                        )
                      }
                      keyboardType="decimal-pad"
                      placeholder="e.g. 50"
                    />
                    {!showRoleRates ? (
                      <Input
                        label="Sell ₹ (optional)"
                        value={row.rate}
                        onChangeText={(v) =>
                          setAltUnits((prev) =>
                            prev.map((x) => (x.key === row.key ? { ...x, rate: v } : x)),
                          )
                        }
                        keyboardType="decimal-pad"
                        placeholder="Blank = base sell × conversion"
                      />
                    ) : (
                      <>
                        <Input
                          label="Distributor ₹ (optional)"
                          value={row.distributorRate}
                          onChangeText={(v) =>
                            setAltUnits((prev) =>
                              prev.map((x) =>
                                x.key === row.key ? { ...x, distributorRate: v } : x,
                              ),
                            )
                          }
                          keyboardType="decimal-pad"
                          placeholder="Blank = base × conversion"
                        />
                        <Input
                          label="Customer ₹ (optional)"
                          value={row.customerRate}
                          onChangeText={(v) =>
                            setAltUnits((prev) =>
                              prev.map((x) => (x.key === row.key ? { ...x, customerRate: v } : x)),
                            )
                          }
                          keyboardType="decimal-pad"
                          placeholder="Blank = base × conversion"
                        />
                      </>
                    )}
                    <Input
                      label="Cost ₹ (optional)"
                      value={row.costPrice}
                      onChangeText={(v) =>
                        setAltUnits((prev) =>
                          prev.map((x) => (x.key === row.key ? { ...x, costPrice: v } : x)),
                        )
                      }
                      keyboardType="decimal-pad"
                      placeholder="Blank = base cost × conversion"
                    />
                    <Pressable
                      onPress={() => setAltUnits((prev) => prev.filter((x) => x.key !== row.key))}
                    >
                      <Text className="text-xs font-semibold text-danger">Remove unit</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : (
              <>
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Input
                      label="Secondary unit (optional)"
                      value={secondaryUnit}
                      onChangeText={setSecondaryUnit}
                      placeholder="e.g. bag"
                    />
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
                  Enable Multi-unit in Settings to sell/buy in alternate units. Legacy secondary
                  fields are stored only.
                </Text>
              </>
            )}
            <Input
              label="Reorder point (optional)"
              value={reorderPoint}
              onChangeText={setReorderPoint}
              keyboardType="decimal-pad"
              placeholder="0 - low-stock alert threshold"
            />
            {showOpeningStock ? (
              <Input
                label={mode === 'edit' ? 'Opening / on-hand qty (optional)' : 'Opening qty (optional)'}
                value={openingQty}
                onChangeText={setOpeningQty}
                keyboardType="decimal-pad"
                placeholder="e.g. 100"
                helper={
                  mode === 'edit'
                    ? 'Sets on-hand to this amount (not added on top). Changing it resets this item’s quantity.'
                    : 'Sets on-hand to this amount after the item is created (not added on top).'
                }
              />
            ) : null}
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
                label={submitting || uploadingPhoto ? 'Saving…' : 'Save'}
                variant="accent"
                className="flex-1"
                disabled={submitting || uploadingPhoto}
                onPress={() => {
                  if (!name.trim()) {
                    setError('Name is required');
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
                  const distNum = distributorRate === '' ? null : Number(distributorRate);
                  const custNum = customerRate === '' ? null : Number(customerRate);
                  let rateNum = Number(rate);
                  if (showRoleRates) {
                    if (distNum === null || !Number.isFinite(distNum) || distNum < 0) {
                      setError('Distributor sell price is required');
                      return;
                    }
                    if (custNum === null || !Number.isFinite(custNum) || custNum < 0) {
                      setError('Customer sell price is required');
                      return;
                    }
                    if (mrpNum !== null && mrpNum > 0) {
                      if (distNum > mrpNum) {
                        setError('Distributor sell price cannot exceed MRP');
                        return;
                      }
                      if (custNum > mrpNum) {
                        setError('Customer sell price cannot exceed MRP');
                        return;
                      }
                    }
                    // Catalog rate stays in sync with customer sell price (ICE_CREAM only).
                    rateNum = custNum;
                  } else if (!Number.isFinite(rateNum) || rateNum < 0) {
                    setError('Enter a valid rate');
                    return;
                  }
                  if (!showRoleRates && mrpNum !== null && mrpNum > 0 && rateNum > mrpNum) {
                    setError('Selling price cannot exceed MRP');
                    return;
                  }
                  let openingNum: number | null = null;
                  if (showOpeningStock && openingQty.trim() !== '') {
                    openingNum = Number(openingQty);
                    if (!Number.isFinite(openingNum) || openingNum <= 0) {
                      setError('Opening qty must be a positive number (leave blank to skip)');
                      return;
                    }
                  }
                  // Alternate-unit sell ₹ are per txn unit; compare against scaled base MRP.
                  if (multiUnitOn && mrpNum != null && mrpNum > 0) {
                    for (const a of altUnits.filter((x) => x.unitName.trim())) {
                      const factor = Number(a.conversionToBase) || 1;
                      const cap = mrpCapForUnit(mrpNum, factor);
                      if (cap == null) continue;
                      const unitLabel = a.unitName.trim();
                      const over = (label: string, raw: string) => {
                        if (raw.trim() === '') return null;
                        const n = Number(raw);
                        if (!Number.isFinite(n) || n < 0) return `${unitLabel}: enter a valid ${label}`;
                        if (n > cap + 1e-9) {
                          return `${unitLabel} ${label} cannot exceed MRP ₹${cap.toFixed(2)} / ${unitLabel}`;
                        }
                        return null;
                      };
                      if (showRoleRates) {
                        const dErr = over('distributor ₹', a.distributorRate);
                        if (dErr) {
                          setError(dErr);
                          return;
                        }
                        const cErr = over('customer ₹', a.customerRate);
                        if (cErr) {
                          setError(cErr);
                          return;
                        }
                      } else {
                        const sErr = over('sell ₹', a.rate);
                        if (sErr) {
                          setError(sErr);
                          return;
                        }
                      }
                    }
                  }
                  setError(null);
                  void (async () => {
                    let imagePatch: { imageUrl?: string | null } = {};
                    if (removeImage) {
                      imagePatch = { imageUrl: null };
                    } else if (localImageUri) {
                      setUploadingPhoto(true);
                      try {
                        const ext = localImageUri.split('.').pop()?.toLowerCase() ?? 'jpg';
                        const contentType =
                          ext === 'png'
                            ? 'image/png'
                            : ext === 'webp'
                              ? 'image/webp'
                              : ext === 'heic'
                                ? 'image/heic'
                                : 'image/jpeg';
                        const imageUrl = await uploadImage.mutateAsync({
                          uri: localImageUri,
                          filename: `item.${ext}`,
                          contentType,
                        });
                        imagePatch = { imageUrl };
                      } catch (err) {
                        setError(
                          err instanceof ApiError && err.message
                            ? err.message
                            : 'Photo upload failed. Check S3 in Integrations or save without a photo.',
                        );
                        setUploadingPhoto(false);
                        return;
                      }
                      setUploadingPhoto(false);
                    }
                    if (!hsnSacCode.trim()) {
                      toast.info(
                        `No ${taxCodeShort} — auditors will flag ${taxCodeMissing.toLowerCase()} on GST packs.`,
                      );
                    }
                    await onSubmit({
                      name: name.trim(),
                      type: 'MATERIAL',
                      unit,
                      rate: rateNum,
                      mrp: mrpNum,
                      costPrice: costNum,
                      ...(showRoleRates
                        ? { distributorRate: distNum, customerRate: custNum }
                        : {}),
                      gstRate: Number(gstRate) || 0,
                      hsnSacCode: hsnSacCode.trim() || undefined,
                      brandOrSpec: brandOrSpec.trim() || undefined,
                      category: category.trim() || undefined,
                      ...imagePatch,
                      // INVENTORY_HORIZONTAL_PLATFORM (Phase 8.6): item code field.
                      itemCode: itemCode.trim() || undefined,
                      sku: sku.trim() || undefined,
                      barcode: barcode.trim() || undefined,
                      secondaryUnit: multiUnitOn
                        ? undefined
                        : secondaryUnit.trim() || undefined,
                      conversionFactor: multiUnitOn
                        ? undefined
                        : Number(conversionFactor) > 0
                          ? Number(conversionFactor)
                          : undefined,
                      ...(multiUnitOn
                        ? {
                            units: [
                              {
                                unitName: unit,
                                isBase: true,
                                conversionToBase: 1,
                              },
                              ...altUnits
                                .filter((a) => a.unitName.trim())
                                .map((a) => ({
                                  unitName: a.unitName.trim(),
                                  isBase: false,
                                  conversionToBase: Number(a.conversionToBase) || 1,
                                  rate: a.rate.trim() === '' ? null : Number(a.rate),
                                  distributorRate:
                                    a.distributorRate.trim() === ''
                                      ? null
                                      : Number(a.distributorRate),
                                  customerRate:
                                    a.customerRate.trim() === ''
                                      ? null
                                      : Number(a.customerRate),
                                  costPrice:
                                    a.costPrice.trim() === '' ? null : Number(a.costPrice),
                                })),
                            ],
                          }
                        : {}),
                      reorderPoint: reorderPoint === '' ? undefined : Number(reorderPoint),
                      trackingMode,
                      preferredVendorId: preferredVendorId || undefined,
                      reorderQty: reorderQty === '' ? undefined : Number(reorderQty),
                      leadTimeDays: leadTimeDays === '' ? undefined : Number(leadTimeDays),
                      openingQty: openingNum,
                    });
                    reset();
                  })();
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
  const { data: company } = useCompany();
  const multiUnitOn = Boolean(company?.multiUnitEnabled);
  const [vendorId, setVendorId] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [manufacturedAt, setManufacturedAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const unitOptions = (() => {
    if (!item) return [] as Array<{ title: string; value: string }>;
    const units = item.units ?? [];
    if (multiUnitOn && units.length > 0) {
      return units.map((u) => ({
        title:
          u.isBase || Number(u.conversionToBase) === 1
            ? `${u.unitName} (base)`
            : `${u.unitName} (= ${u.conversionToBase} ${item.unit})`,
        value: u.unitName,
      }));
    }
    return [{ title: item.unit, value: item.unit }];
  })();
  const showUnitPicker = multiUnitOn && unitOptions.length > 1;

  useEffect(() => {
    if (!item) return;
    setVendorId(item.preferredVendorId ?? '');
    setVendorName('');
    setInvoiceNumber('');
    setReceivedDate(new Date().toISOString().slice(0, 10));
    setQuantity('');
    setUnit(item.unit);
    // Prefill buy cost in the selected unit (blank unit cost → base × conversion).
    const baseCost = Number(item.costPrice ?? 0);
    const wac = Number(item.avgCost ?? 0);
    const buy = resolveBuyCost({
      resource: {
        unit: item.unit,
        costPrice: baseCost > 0 ? baseCost : wac > 0 ? wac : null,
        units: item.units ?? undefined,
      },
      unitName: item.unit,
    });
    setUnitCost(buy > 0 ? String(buy) : '');
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
    const txnUnit = unit || item.unit;
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
          unit: txnUnit,
          unitCost: cost,
          batchCode: batchCode.trim() || undefined,
          manufacturedAt: manufacturedAt || undefined,
          expiresAt: expiresAt || undefined,
        }],
      });
      toast.success(`Received ${qty} ${txnUnit} of ${item.name}`);
      onReceived();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not receive stock.');
    }
  };

  return (
    <Modal visible={item !== null} transparent animationType={isPhone ? 'slide' : 'fade'} onRequestClose={onClose}>
      <Pressable
        className={`flex-1 bg-black/40 ${isPhone ? 'justify-end' : 'items-center justify-center p-4'}`}
        onPress={onClose}
      >
        <Pressable
          className={`bg-card w-full overflow-hidden p-4 ${
            isPhone ? 'rounded-t-2xl h-[96%]' : 'rounded-2xl max-w-lg max-h-[85%]'
          }`}
          onPress={(e) => e.stopPropagation()}
        >
          <Text className="text-lg font-bold text-text">Receive stock</Text>
          <Text className="text-xs text-muted mb-3">
            {item?.name} · quick receipt without a purchase order
          </Text>
          <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
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
            {showUnitPicker ? (
              <Select
                label="Unit"
                value={unit || undefined}
                options={unitOptions}
                onChange={(v) => {
                  if (!v || !item) return;
                  setUnit(v);
                  const baseCost = Number(item.costPrice ?? 0);
                  const wac = Number(item.avgCost ?? 0);
                  const buy = resolveBuyCost({
                    resource: {
                      unit: item.unit,
                      costPrice: baseCost > 0 ? baseCost : wac > 0 ? wac : null,
                      units: item.units ?? undefined,
                    },
                    unitName: v,
                  });
                  setUnitCost(buy > 0 ? String(buy) : '');
                }}
                placeholder="Unit"
              />
            ) : null}
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Input
                  label={`Quantity (${unit || item?.unit || ''})`}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="decimal-pad"
                />
              </View>
              <View className="flex-1">
                <Input
                  label={`Cost ₹ / ${unit || item?.unit || 'unit'} (what you pay)`}
                  value={unitCost}
                  onChangeText={setUnitCost}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            {showUnitPicker && selectedFactor !== 1 && Number(quantity) > 0 ? (
              <Text className="text-[11px] text-muted mb-2">
                Stock will add {Math.round(Number(quantity) * selectedFactor * 1000) / 1000} {item?.unit}
              </Text>
            ) : null}
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
