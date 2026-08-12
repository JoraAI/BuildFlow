/**
 * BuildFlow Inventory shell - Warehouse hub (INVENTORY_HORIZONTAL_PLATFORM Phase 3).
 *
 * Three sub-tabs:
 *   Locations - warehouse CRUD (create / edit / deactivate / set default).
 *   Transfers - stock transfer orders (dispatch = stock OUT, receive = stock IN).
 *   Counts    - stock counts / stocktake (approve writes STOCKTAKE adjustments).
 * Responsive: useViewport modals (phone bottom sheet, desktop max-w-lg).
 */
import React, { useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { Card, Badge, Button, EmptyState, LoadingSkeleton, toast } from '@/components/ui';
import { confirmAsync } from '@/utils/confirm';
import {
  useWarehouses,
  useCreateWarehouse,
  useUpdateWarehouse,
  useTransfers,
  useCreateTransfer,
  useTransferAction,
  useStockCounts,
  useCreateStockCount,
  useStockCountAction,
  type Warehouse,
  type TransferOrder,
  type StockCount,
} from '@/services/warehouse.queries';
import { WarehouseModal, TransferModal, CountModal } from '@/components/inventory/WarehouseModals';

type Tab = 'locations' | 'transfers' | 'counts';

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'neutral' | 'danger'> = {
  DRAFT: 'neutral',
  IN_TRANSIT: 'warning',
  RECEIVED: 'success',
  APPROVED: 'success',
  CANCELLED: 'danger',
};

export default function InventoryWarehouseScreen() {
  const [tab, setTab] = useState<Tab>('locations');
  const [whOpen, setWhOpen] = useState(false);
  const [editingWh, setEditingWh] = useState<Warehouse | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [countOpen, setCountOpen] = useState(false);

  const warehouses = useWarehouses();
  const createWh = useCreateWarehouse();
  const updateWh = useUpdateWarehouse();
  const transfers = useTransfers();
  const createTransfer = useCreateTransfer();
  const transferAction = useTransferAction();
  const counts = useStockCounts();
  const createCount = useCreateStockCount();
  const countAction = useStockCountAction();

  const headerLabel =
    tab === 'locations' ? 'New location'
    : tab === 'transfers' ? 'New transfer'
    : 'New count';
  const headerAction = () => {
    if (tab === 'locations') {
      setEditingWh(null);
      setWhOpen(true);
    } else if (tab === 'transfers') setTransferOpen(true);
    else setCountOpen(true);
  };

  const renderLocation = ({ item }: { item: Warehouse }) => {
    const skus = item.balances.filter((b) => Number(b.quantity) !== 0).length;
    return (
      <Card className="mb-2 p-4">
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1 min-w-0">
            <View className="flex-row items-center gap-2 flex-wrap">
              <Text className="text-sm font-bold text-text">{item.name}</Text>
              {item.isDefault ? <Badge color="accent" label="Default" /> : null}
              {!item.isActive ? <Badge color="danger" label="Inactive" /> : null}
            </View>
            <Text className="text-xs text-muted mt-0.5">
              {[item.code, item.address].filter(Boolean).join(' · ') || 'No code / address'}
            </Text>
            <Text className="text-[11px] text-muted mt-0.5">{skus} item(s) with stock</Text>
          </View>
        </View>
        <View className="flex-row flex-wrap gap-2 mt-3">
          <Button
            label="Edit"
            size="sm"
            variant="secondary"
            onPress={() => {
              setEditingWh(item);
              setWhOpen(true);
            }}
          />
          {!item.isDefault ? (
            <Button
              label="Set default"
              size="sm"
              variant="secondary"
              onPress={() => void updateWh.mutateAsync({ id: item.id, isDefault: true }).then(() => toast.success('Default warehouse updated'))}
            />
          ) : null}
          {item.isActive && !item.isDefault ? (
            <Button
              label="Deactivate"
              size="sm"
              variant="secondary"
              onPress={() => void confirmAsync('Deactivate this warehouse?', 'It stays in history but can no longer receive stock.').then((ok) => {
                if (ok) void updateWh.mutateAsync({ id: item.id, isActive: false }).then(() => toast.info('Warehouse deactivated'));
              })}
            />
          ) : null}
        </View>
      </Card>
    );
  };
  const renderTransfer = ({ item }: { item: TransferOrder }) => (
    <Card className="mb-2 p-4">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1 min-w-0">
          <Text className="text-sm font-bold text-text">{item.transferNumber}</Text>
          <Text className="text-xs text-muted">
            {item.fromLocation.name} → {item.toLocation.name}
          </Text>
          <Text className="text-[11px] text-muted mt-0.5">
            {item.lines.length} line(s) · {item.lines.map((l) => `${l.itemName} ×${l.quantity}${l.unit}`).join(', ')}
          </Text>
        </View>
        <Badge color={STATUS_COLOR[item.status] ?? 'neutral'} label={item.status} />
      </View>
      <View className="flex-row flex-wrap gap-2 mt-3">
        {item.status === 'DRAFT' ? (
          <>
            <Button
              label="Dispatch (stock OUT)"
              size="sm"
              variant="accent"
              onPress={() => void confirmAsync('Dispatch this transfer?', 'Stock will leave the source warehouse.').then((ok) => {
                if (ok) void transferAction.mutateAsync({ id: item.id, action: 'dispatch' }).then(() => toast.success('Dispatched - stock moved OUT'));
              })}
            />
            <Button
              label="Cancel"
              size="sm"
              variant="secondary"
              onPress={() => void transferAction.mutateAsync({ id: item.id, action: 'cancel' }).then(() => toast.info('Transfer cancelled'))}
            />
          </>
        ) : null}
        {item.status === 'IN_TRANSIT' ? (
          <Button
            label="Receive (stock IN)"
            size="sm"
            variant="accent"
            onPress={() => void confirmAsync('Receive this transfer?', 'Stock will land in the destination warehouse.').then((ok) => {
              if (ok) void transferAction.mutateAsync({ id: item.id, action: 'receive' }).then(() => toast.success('Received - stock landed at destination'));
            })}
          />
        ) : null}
      </View>
    </Card>
  );

  const renderCount = ({ item }: { item: StockCount }) => {
    const variance = item.lines.reduce((s, l) => s + Math.abs(Number(l.variance)), 0);
    return (
      <Card className="mb-2 p-4">
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1 min-w-0">
            <Text className="text-sm font-bold text-text">{item.countNumber}</Text>
            <Text className="text-xs text-muted">{item.location.name} · {item.countDate}</Text>
            <Text className="text-[11px] text-muted mt-0.5">
              {item.lines.length} line(s) · {variance > 0 ? `variance ${variance.toFixed(2)}` : 'no variance'}
            </Text>
          </View>
          <Badge color={STATUS_COLOR[item.status] ?? 'neutral'} label={item.status} />
        </View>
        {item.status === 'DRAFT' ? (
          <View className="flex-row flex-wrap gap-2 mt-3">
            <Button
              label="Approve (write adjustments)"
              size="sm"
              variant="accent"
              onPress={() => void confirmAsync('Approve this stock count?', 'The counted quantities will be written as STOCKTAKE adjustments.').then((ok) => {
                if (ok) void countAction.mutateAsync({ id: item.id, action: 'approve' }).then(() => toast.success('Stock count approved'));
              })}
            />
            <Button
              label="Cancel"
              size="sm"
              variant="secondary"
              onPress={() => void countAction.mutateAsync({ id: item.id, action: 'cancel' }).then(() => toast.info('Count cancelled'))}
            />
          </View>
        ) : null}
      </Card>
    );
  };

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'locations', label: 'Locations' },
    { key: 'transfers', label: 'Transfers' },
    { key: 'counts', label: 'Stock counts' },
  ];

  const dataForTab: any[] =
    tab === 'locations' ? (warehouses.data ?? [])
    : tab === 'transfers' ? (transfers.data ?? [])
    : (counts.data ?? []);

  const loading =
    (tab === 'locations' && warehouses.isLoading) ||
    (tab === 'transfers' && transfers.isLoading) ||
    (tab === 'counts' && counts.isLoading);

  const renderRow = ({ item }: { item: any }) => {
    if (tab === 'locations') return renderLocation({ item: item as Warehouse });
    if (tab === 'transfers') return renderTransfer({ item: item as TransferOrder });
    return renderCount({ item: item as StockCount });
  };

  return (
    <View className="flex-1 bg-surface">
      <View className="px-4 pt-4 pb-2 flex-row flex-wrap items-center justify-between gap-2">
        <View className="flex-1 min-w-[180px] mr-2">
          <Text className="text-2xl font-bold text-text">Warehouse</Text>
          <Text className="text-sm text-muted mt-0.5">
            Multi-location stock, transfers and stock counts.
          </Text>
        </View>
        <Button label={headerLabel} variant="accent" size="sm" onPress={headerAction} />
      </View>

      <View className="flex-row flex-wrap px-4 pb-2 gap-2">
        {tabs.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg border ${tab === t.key ? 'bg-primary border-primary' : 'bg-card border-border'}`}
          >
            <Text className={`text-xs font-medium ${tab === t.key ? 'text-white' : 'text-muted'}`}>{t.label}</Text>
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
          data={dataForTab}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
          ListEmptyComponent={
            <EmptyState
              title={
                tab === 'locations' ? 'No warehouses yet'
                : tab === 'transfers' ? 'No stock transfers yet'
                : 'No stock counts yet'
              }
              description={
                tab === 'locations' ? 'Create a second warehouse to split stock across locations.'
                : tab === 'transfers' ? 'Move stock between warehouses - dispatch then receive.'
                : 'Count a warehouse and approve to write stock adjustments.'
              }
            />
          }
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}

      {whOpen || editingWh ? (
        <WarehouseModal
          open
          initial={editingWh}
          onClose={() => {
            setWhOpen(false);
            setEditingWh(null);
          }}
          onSubmit={async (input) => {
            if (editingWh) {
              await updateWh.mutateAsync({ id: editingWh.id, ...input });
              toast.success('Warehouse updated');
            } else {
              await createWh.mutateAsync(input);
              toast.success('Warehouse created');
            }
            setWhOpen(false);
            setEditingWh(null);
          }}
        />
      ) : null}
      {transferOpen ? (
        <TransferModal
          open
          warehouses={warehouses.data ?? []}
          onClose={() => setTransferOpen(false)}
          onSubmit={async (input) => {
            await createTransfer.mutateAsync(input);
            toast.success('Transfer created - dispatch to move stock');
            setTransferOpen(false);
          }}
        />
      ) : null}
      {countOpen ? (
        <CountModal
          open
          warehouses={warehouses.data ?? []}
          onClose={() => setCountOpen(false)}
          onSubmit={async (input) => {
            await createCount.mutateAsync(input);
            toast.success('Stock count created - approve to write adjustments');
            setCountOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}

