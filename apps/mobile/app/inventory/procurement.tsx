/**
 * Inventory shell - Procurement hub.
 *
 * Indent (requisition) → Purchase Order → GRN lifecycle scoped to the tenant's
 * default STORE project. Reuses the same backend endpoints as the construction
 * ProcurementTab, without the project picker.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Badge, Button, Input, EmptyState, LoadingSkeleton, Select, toast, BusyOverlay } from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';
import { useViewport } from '@/hooks/useViewport';
import {
  indentAvailableForNewPo,
  poAvailableForNewGrn,
  poRemainingByResource,
  getInventoryLabel,
  getInventoryLabelMode,
  getIndentPlural,
} from '@buildflow/shared';
import {
  useRequisitions,
  useCreateRequisition,
  useCreatePurchaseOrder,
  useApprovePurchaseOrder,
  useCreateGRN,
  useNextProcurementNumbers,
  type Requisition,
} from '@/services/expansion.queries';
import { useResources } from '@/services/estimate.queries';
import { useWarehouses, type Warehouse } from '@/services/warehouse.queries';
import { downloadReportPdf } from '@/services/report-download';
import { useReorderSuggestions, useOrderReorderItems, type ReorderSuggestion } from '@/services/reorder.queries';
import { confirmAsync } from '@/utils/confirm';

const APPROVAL_COLOR: Record<string, 'warning' | 'success' | 'danger' | 'neutral'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

type Section = 'indents' | 'orders' | 'grns' | 'reorder';

/** Poll refetch until the list shows the expected change (or timeout). */
async function bufferUntilVisible(
  refetch: () => Promise<{ data?: Requisition[] | undefined }>,
  predicate: (list: Requisition[]) => boolean,
  timeoutMs = 12000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await refetch();
    const list = result.data ?? [];
    if (predicate(list)) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  // One last attempt so the UI is at least as fresh as possible.
  const last = await refetch();
  return predicate(last.data ?? []);
}

export default function InventoryProcurementScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const projectId = user?.defaultProjectId ?? '';
  const [section, setSection] = useState<Section>('indents');
  const [createIndentOpen, setCreateIndentOpen] = useState(false);
  const [createPoOpen, setCreatePoOpen] = useState(false);
  const [recordGrnOpen, setRecordGrnOpen] = useState(false);
  /** Preselects for the Create PO / Record GRN modals opened from row CTAs. */
  const [prefillRequisitionId, setPrefillRequisitionId] = useState<string | null>(null);
  const [prefillPurchaseOrderId, setPrefillPurchaseOrderId] = useState<string | null>(null);
  /** True while waiting for list refetch to show the new/updated row. */
  const [buffering, setBuffering] = useState(false);

  const { data: requisitions, isLoading: reqLoading, refetch } = useRequisitions(projectId);
  const { data: resources } = useResources();
  const createRequisition = useCreateRequisition(projectId);
  const createPo = useCreatePurchaseOrder(projectId);
  const approvePo = useApprovePurchaseOrder(projectId);
  const createGrn = useCreateGRN(projectId);
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 4.2/4.3): low-stock reorder queue.
  const { data: suggestions, isLoading: reorderLoading, refetch: refetchReorder } = useReorderSuggestions();
  const orderReorder = useOrderReorderItems();

  const resourceList = resources?.data ?? [];

  // INVENTORY_HORIZONTAL_PLATFORM (Phase 0): profile-based wording.
  // Generic tenants see "Purchase request(s)"; MATERIAL_SUPPLIER keeps "Indent(s)".
  const labelMode = getInventoryLabelMode(user?.inventoryProfile ?? null);
  const indentLabel = getInventoryLabel('indent', labelMode);
  const indentLabelPlural = getIndentPlural(labelMode);

  // Locked picker rules (PROCUREMENT_PICKER_PERF + INVENTORY_UX_POLISH D3/D4):
  // New PO lists APPROVED indents with zero POs; Record GRN lists POs with qty left.
  const eligiblePoIndents = (requisitions ?? []).filter(indentAvailableForNewPo);
  const eligibleGrnPos = allPurchaseOrders(requisitions ?? []).filter(poAvailableForNewGrn);

  /** D3: jump to Purchase orders tab + open Create PO prefilled for this indent. */
  const openCreatePoForIndent = (requisitionId: string) => {
    setPrefillRequisitionId(requisitionId);
    setSection('orders');
    setCreatePoOpen(true);
  };

  /** D4: jump to Goods receipts tab + open Record GRN prefilled for this PO. */
  const openRecordGrnForPo = (purchaseOrderId: string) => {
    setPrefillPurchaseOrderId(purchaseOrderId);
    setSection('grns');
    setRecordGrnOpen(true);
  };

  const closeCreatePo = () => {
    if (buffering) return;
    setCreatePoOpen(false);
    setPrefillRequisitionId(null);
  };

  const closeRecordGrn = () => {
    if (buffering) return;
    setRecordGrnOpen(false);
    setPrefillPurchaseOrderId(null);
  };

  return (
    <View className="flex-1 bg-surface">
      <View className="px-4 pt-4 pb-2">
        <Text className="text-2xl font-bold text-text">Procurement</Text>
        <Text className="text-sm text-muted mt-0.5">{indentLabel} → Create PO → Record GRN</Text>
      </View>

      <View className="flex-row flex-wrap px-4 pb-2 gap-2 items-center">
        {(['indents', 'orders', 'grns', 'reorder'] as Section[]).map((s) => (
          <Pressable
            key={s}
            disabled={buffering}
            onPress={() => setSection(s)}
            className={`px-3 py-1.5 rounded-lg border ${
              section === s ? 'bg-primary border-primary' : 'bg-card border-border'
            } ${buffering ? 'opacity-50' : ''}`}
          >
            <Text className={`text-xs font-medium ${section === s ? 'text-white' : 'text-muted'}`}>
              {s === 'indents'
                ? indentLabelPlural
                : s === 'orders'
                  ? 'Purchase orders'
                  : s === 'grns'
                    ? 'Goods receipts'
                    : 'Reorder'}
            </Text>
          </Pressable>
        ))}
        <View className="flex-1" />
        {section === 'indents' && (
          <Button
            label={`New ${indentLabel}`}
            variant="accent"
            size="sm"
            disabled={buffering}
            onPress={() => setCreateIndentOpen(true)}
          />
        )}
        {section === 'orders' && (
          <Button
            label="New PO"
            variant="accent"
            size="sm"
            disabled={buffering || eligiblePoIndents.length === 0}
            onPress={() => {
              setPrefillRequisitionId(null);
              setCreatePoOpen(true);
            }}
          />
        )}
        {section === 'grns' && (
          <Button
            label="Record GRN"
            variant="accent"
            size="sm"
            disabled={buffering || eligibleGrnPos.length === 0}
            onPress={() => {
              setPrefillPurchaseOrderId(null);
              setRecordGrnOpen(true);
            }}
          />
        )}
      </View>

      <BusyOverlay
        visible={buffering}
        title="Updating procurement…"
        subtitle="Please wait until the list refreshes. Do not tap again."
      />

      {section === 'indents' && (
        <IndentsSection
          isLoading={reqLoading}
          requisitions={requisitions ?? []}
          indentLabel={indentLabel}
          indentLabelPlural={indentLabelPlural}
          onCreatePo={openCreatePoForIndent}
        />
      )}

      {section === 'orders' && (
        <OrdersSection
          requisitions={requisitions ?? []}
          isLoading={reqLoading}
          onRecordGrn={openRecordGrnForPo}
          onApprovePo={async (poId) => {
            setBuffering(true);
            try {
              await approvePo.mutateAsync(poId);
              await bufferUntilVisible(refetch, (list) =>
                allPurchaseOrders(list).some((p) => p.id === poId && p.status === 'APPROVED'),
              );
              toast.success('Purchase order approved');
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Could not approve purchase order');
            } finally {
              setBuffering(false);
            }
          }}
          onGoToIndents={() => setSection('indents')}
          indentLabel={indentLabel}
          indentLabelPlural={indentLabelPlural}
          itemLabel={getInventoryLabel('item', labelMode)}
        />
      )}

      {section === 'grns' && (
        <GrnsSection
          requisitions={requisitions ?? []}
          isLoading={reqLoading}
          onGoToOrders={() => setSection('orders')}
        />
      )}

      {section === 'reorder' && (
        <ReorderSection
          suggestions={suggestions ?? []}
          isLoading={reorderLoading}
          ordering={orderReorder.isPending}
          itemLabel={getInventoryLabel('item', labelMode)}
          onOrder={async (resourceIds) => {
            const ok = await confirmAsync(
              'Create purchase order?',
              'An auto-approved purchase request plus a PO (preferred vendor + reorder qty) will be created for the selected low-stock items.',
            );
            if (!ok) return;
            setBuffering(true);
            try {
              const result = await orderReorder.mutateAsync(resourceIds);
              toast.success(
                result.purchaseOrder.status === 'APPROVED'
                  ? `${result.suggestionCount} item(s) ordered - ${result.purchaseOrder.poNumber} approved`
                  : `${result.suggestionCount} item(s) ordered - ${result.purchaseOrder.poNumber} pending approval`,
              );
              setSection('orders');
              void refetch();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Could not create purchase order');
            } finally {
              setBuffering(false);
            }
          }}
        />
      )}

      <CreateIndentModal
        open={createIndentOpen}
        onClose={() => {
          if (!buffering) setCreateIndentOpen(false);
        }}
        resources={resourceList}
        indentLabel={indentLabel}
        itemLabel={getInventoryLabel('item', labelMode)}
        onSubmit={async (lines, notes) => {
          setBuffering(true);
          try {
            const created = await createRequisition.mutateAsync({ lines, notes });
            await bufferUntilVisible(refetch, (list) => list.some((r) => r.id === created.id));
            toast.success(`${indentLabel} created & approved`);
            setCreateIndentOpen(false);
            setSection('indents');
          } finally {
            setBuffering(false);
          }
        }}
      />

      <CreatePOModal
        open={createPoOpen}
        onClose={closeCreatePo}
        projectId={projectId}
        requisitions={requisitions ?? []}
        initialRequisitionId={prefillRequisitionId}
        indentLabel={indentLabel}
        indentLabelPlural={indentLabelPlural}
        itemLabel={getInventoryLabel('item', labelMode)}
        onSubmit={async (input) => {
          setBuffering(true);
          try {
            const po = (await createPo.mutateAsync(input)) as { id?: string; poNumber?: string };
            const poId = po?.id;
            const poNumber = po?.poNumber ?? input.poNumber;
            await bufferUntilVisible(refetch, (list) =>
              allPurchaseOrders(list).some(
                (p) => (poId && p.id === poId) || p.poNumber === poNumber,
              ),
            );
            toast.success('Purchase order created');
            setCreatePoOpen(false);
            setPrefillRequisitionId(null);
            setSection('orders');
          } finally {
            setBuffering(false);
          }
        }}
      />

      <RecordGrnModal
        open={recordGrnOpen}
        onClose={closeRecordGrn}
        projectId={projectId}
        requisitions={requisitions ?? []}
        initialPurchaseOrderId={prefillPurchaseOrderId}
        onSubmit={async (input) => {
          setBuffering(true);
          try {
            const grn = (await createGrn.mutateAsync(input)) as { id?: string; grnNumber?: string };
            const grnId = grn?.id;
            const grnNumber = grn?.grnNumber ?? input.grnNumber;
            await bufferUntilVisible(refetch, (list) =>
              allPurchaseOrders(list).some((p) =>
                (p.goodsReceipts ?? []).some(
                  (g) => (grnId && g.id === grnId) || g.grnNumber === grnNumber,
                ),
              ),
            );
            toast.success('GRN recorded · draft vendor bill created');
            setRecordGrnOpen(false);
            setPrefillPurchaseOrderId(null);
            router.push('/inventory/bills' as never);
          } finally {
            setBuffering(false);
          }
        }}
      />
    </View>
  );
}

function IndentsSection({
  isLoading,
  requisitions,
  indentLabel,
  indentLabelPlural,
  onCreatePo,
}: {
  isLoading: boolean;
  requisitions: Requisition[];
  indentLabel: string;
  indentLabelPlural: string;
  onCreatePo: (requisitionId: string) => void;
}) {
  return (
    <FlatList
      className="flex-1 px-4"
      data={requisitions}
      keyExtractor={(r) => r.id}
      renderItem={({ item }) => {
        const canCreatePo = indentAvailableForNewPo(item);
        return (
          <Card className="mb-3 p-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-bold text-text">{item.reqNumber}</Text>
              <Badge color={APPROVAL_COLOR[item.status] ?? 'neutral'} label={item.status} />
            </View>
            {item.notes ? <Text className="text-xs text-muted mt-1">{item.notes}</Text> : null}
            <Text className="text-xs text-muted mt-1">
              {item.lines.length} line{item.lines.length === 1 ? '' : 's'} ·{' '}
              {new Date(item.createdAt).toLocaleDateString('en-IN')}
            </Text>
            {canCreatePo ? (
              <View className="mt-3">
                <Button
                  label="Create PO"
                  size="sm"
                  onPress={() => onCreatePo(item.id)}
                />
              </View>
            ) : item.status === 'APPROVED' ? (
              <Text className="text-xs text-muted mt-3">
                Purchase order already created for this {indentLabel.toLowerCase()}.
              </Text>
            ) : null}
          </Card>
        );
      }}
      ListEmptyComponent={
        isLoading ? (
          <View className="gap-3">
            {[1, 2].map((i) => <LoadingSkeleton key={i} className="rounded-xl h-20" />)}
          </View>
        ) : (
          <EmptyState
            title={`No ${indentLabelPlural.toLowerCase()} yet`}
            description={`Create a ${indentLabel.toLowerCase()} and it is approved instantly - then raise a purchase order against it.`}
          />
        )
      }
      contentContainerStyle={{ paddingBottom: 24 }}
    />
  );
}

function CreateIndentModal({
  open,
  onClose,
  resources,
  indentLabel,
  itemLabel,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  resources: Array<{ id: string; name: string; unit: string }>;
  /** INVENTORY_HORIZONTAL_PLATFORM (Phase 0): 'Indent' | 'Purchase request'. */
  indentLabel: string;
  /** INVENTORY_HORIZONTAL_PLATFORM (Phase 0): 'Material' | 'Item'. */
  itemLabel: string;
  onSubmit: (lines: Array<{ resourceId: string; quantity: number; unit: string }>, notes?: string) => Promise<void>;
}) {
  type DraftIndentLine = { key: string; resourceId: string; quantity: string };
  const newKey = () => `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const [lines, setLines] = useState<DraftIndentLine[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // INVENTORY_UX_POLISH (D9): multi-material draft editor. Reset each open.
  useEffect(() => {
    if (!open) return;
    setLines([{ key: newKey(), resourceId: '', quantity: '1' }]);
    setNotes('');
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const updateLine = (key: string, patch: Partial<DraftIndentLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const addLine = () => {
    setError('');
    setLines((prev) => [...prev, { key: newKey(), resourceId: '', quantity: '1' }]);
  };

  const removeLine = (key: string) =>
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));

  /** Options for one line exclude materials already picked on other lines. */
  const optionsFor = (line: DraftIndentLine) => {
    const taken = new Set(lines.filter((l) => l.key !== line.key).map((l) => l.resourceId));
    return resources
      .filter((r) => !taken.has(r.id))
      .map((r) => ({ title: `${r.name} (${r.unit})`, value: r.id }));
  };

  const submit = async () => {
    setError('');
    const itemLower = itemLabel.toLowerCase();
    const indentLower = indentLabel.toLowerCase();
    const used = new Set<string>();
    for (const l of lines) {
      if (!l.resourceId) {
        setError(`Choose a ${itemLower} for every line.`);
        return;
      }
      if (used.has(l.resourceId)) {
        setError(`Each ${itemLower} can appear only once per ${indentLower}.`);
        return;
      }
      used.add(l.resourceId);
      const qty = Number(l.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        setError('Enter a positive quantity for every line.');
        return;
      }
    }
    setSaving(true);
    try {
      await onSubmit(
        lines.map((l) => ({
          resourceId: l.resourceId,
          quantity: Number(l.quantity),
          unit: resources.find((r) => r.id === l.resourceId)?.unit ?? 'no',
        })),
        notes || undefined,
      );
      setLines([{ key: newKey(), resourceId: '', quantity: '1' }]);
      setNotes('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create indent');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} title={`New ${indentLabel}`} closeDisabled={saving}>
      <Text className="text-xs text-muted mb-3">
        Create a {indentLabel === 'Indent' ? 'material requisition' : 'purchase request'}. It is
        approved instantly - you can raise a purchase order against it right away. Add multiple{' '}
        {indentLabel === 'Indent' ? 'materials' : 'items'} to procure them in one go.
      </Text>
      {lines.map((line, idx) => {
        const unit = resources.find((r) => r.id === line.resourceId)?.unit;
        return (
          <View key={line.key} className="rounded-xl border border-border p-3 mb-2">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-xs font-bold text-text">{itemLabel} {idx + 1}</Text>
              {lines.length > 1 ? (
                <Pressable
                  disabled={saving}
                  onPress={() => removeLine(line.key)}
                  className="px-2 py-1"
                >
                  <Text className="text-xs font-semibold text-danger">Remove</Text>
                </Pressable>
              ) : null}
            </View>
            <Select
              label={itemLabel}
              value={line.resourceId || undefined}
              onChange={(v) => {
                if (!v) return;
                // Double-guard duplicates (options already exclude them).
                if (lines.some((l) => l.key !== line.key && l.resourceId === v)) {
                  setError(`Each ${itemLabel.toLowerCase()} can appear only once per ${indentLabel.toLowerCase()}.`);
                  return;
                }
                setError('');
                updateLine(line.key, { resourceId: v });
              }}
              options={optionsFor(line)}
              placeholder={`Choose ${itemLabel.toLowerCase()}`}
              disabled={saving}
            />
            <View className="mt-2">
              <Input
                label={unit ? `Quantity (${unit})` : 'Quantity'}
                value={line.quantity}
                onChangeText={(t) => updateLine(line.key, { quantity: t })}
                keyboardType="numeric"
              />
            </View>
          </View>
        );
      })}
      <Button
        label={`+ Add ${itemLabel.toLowerCase()}`}
        variant="secondary"
        size="sm"
        fullWidth
        disabled={saving || lines.some((l) => !l.resourceId)}
        onPress={addLine}
      />
      <View className="h-3" />
      <Input label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
      {error ? <Text className="text-danger text-sm mt-2">{error}</Text> : null}
      <View className="h-4" />
      <Button label={`Create ${indentLabel.toLowerCase()}`} onPress={submit} loading={saving} fullWidth />
    </ModalShell>
  );
}

function ModalShell({
  open,
  onClose,
  title,
  children,
  closeDisabled = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  closeDisabled?: boolean;
}) {
  const { isPhone } = useViewport();
  const dismiss = () => {
    if (!closeDisabled) onClose();
  };
  return (
    <Modal
      visible={open}
      transparent
      animationType={isPhone ? 'slide' : 'fade'}
      onRequestClose={dismiss}
    >
      <Pressable
        className={`flex-1 bg-black/40 ${isPhone ? 'justify-end' : 'items-center justify-center p-4'}`}
        onPress={dismiss}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className={`bg-card w-full ${
            isPhone ? 'rounded-t-2xl max-h-[90%]' : 'rounded-2xl max-w-lg max-h-[85%]'
          }`}
        >
          <View className="px-5 pt-4 pb-3 border-b border-border flex-row items-center justify-between">
            <Text className="text-base font-bold text-text">{title}</Text>
            {!closeDisabled ? (
              <Pressable onPress={dismiss} className="p-1">
                <Text className="text-muted text-xl">×</Text>
              </Pressable>
            ) : (
              <ActivityIndicator size="small" />
            )}
          </View>
          <ScrollView className="p-5">{children}</ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Flatten all POs across requisitions. */
function allPurchaseOrders(requisitions: Requisition[]) {
  return requisitions.flatMap((r) => (r.purchaseOrders ?? []));
}

function OrdersSection({
  requisitions,
  isLoading,
  onRecordGrn,
  onApprovePo,
  onGoToIndents,
  indentLabel,
  indentLabelPlural,
  itemLabel,
}: {
  requisitions: Requisition[];
  isLoading?: boolean;
  onRecordGrn: (purchaseOrderId: string) => void;
  onApprovePo: (purchaseOrderId: string) => Promise<void>;
  onGoToIndents: () => void;
  indentLabel: string;
  indentLabelPlural: string;
  itemLabel: string;
}) {
  const router = useRouter();
  const pos = allPurchaseOrders(requisitions);
  return (
    <FlatList
      className="flex-1 px-4"
      data={pos}
      keyExtractor={(po) => po.id}
      renderItem={({ item }) => {
        const draftBills = (item.bills ?? []).filter((b) => b.status === 'DRAFT');
        const canRecordGrn = poAvailableForNewGrn(item);
        return (
          <Card className="mb-3 p-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-bold text-text">{item.poNumber}</Text>
              <Badge label={item.status ?? 'DRAFT'} color={item.status === 'SUBMITTED' ? 'warning' : undefined} />
            </View>
            <Text className="text-xs text-muted mt-1">
              {item.vendorName ?? 'Vendor'} · ₹{Number(item.totalAmount ?? 0).toLocaleString('en-IN')}
            </Text>
            {item.goodsReceipts && item.goodsReceipts.length > 0 ? (
              <Text className="text-xs text-success mt-1">
                {item.goodsReceipts.length} GRN{item.goodsReceipts.length === 1 ? '' : 's'} received
              </Text>
            ) : null}
            {draftBills.length > 0 ? (
              <View className="mt-2 flex-row items-center gap-2 flex-wrap">
                <Badge color="warning" label={`Draft bill${draftBills.length > 1 ? `s (${draftBills.length})` : ''}`} />
                <Button
                  label="Open bills"
                  size="sm"
                  variant="secondary"
                  onPress={() => router.push('/inventory/bills' as never)}
                />
              </View>
            ) : null}
            {/* INVENTORY_HORIZONTAL_PLATFORM (Phase 4.4): approve a SUBMITTED PO. */}
            {item.status === 'SUBMITTED' ? (
              <View className="mt-3 flex-row flex-wrap gap-2">
                <Button
                  label="Approve PO"
                  size="sm"
                  variant="accent"
                  onPress={() => void onApprovePo(item.id)}
                />
                <Text className="text-[11px] text-muted w-full">
                  This order is above your auto-approve threshold and needs approval before a GRN can be recorded.
                </Text>
              </View>
            ) : null}
            {canRecordGrn ? (
              <View className="mt-3">
                <Button label="Record GRN" size="sm" onPress={() => onRecordGrn(item.id)} />
              </View>
            ) : null}
          </Card>
        );
      }}
      ListEmptyComponent={
        isLoading ? (
          <View className="gap-3">
            {[1, 2].map((i) => (
              <LoadingSkeleton key={i} className="rounded-xl h-20" />
            ))}
          </View>
        ) : (
          <EmptyState
            title="No purchase orders"
            description={`Create a PO from an approved ${indentLabel.toLowerCase()} to order ${itemLabel.toLowerCase()}s.`}
            action={
              <Button
                label={`Go to ${indentLabelPlural}`}
                variant="secondary"
                size="sm"
                onPress={onGoToIndents}
              />
            }
          />
        )
      }
      contentContainerStyle={{ paddingBottom: 24 }}
    />
  );
}

function GrnsSection({
  requisitions,
  isLoading,
  onGoToOrders,
}: {
  requisitions: Requisition[];
  isLoading?: boolean;
  onGoToOrders: () => void;
}) {
  const router = useRouter();
  const grns = allPurchaseOrders(requisitions).flatMap((po) =>
    (po.goodsReceipts ?? []).map((g) => ({ ...g, poNumber: po.poNumber })),
  );
  return (
    <FlatList
      className="flex-1 px-4"
      data={grns}
      keyExtractor={(g) => g.id}
      renderItem={({ item }) => (
        <Card className="mb-3 p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-bold text-text">{item.grnNumber}</Text>
            <Text className="text-xs text-muted">
              {new Date(item.receivedDate).toLocaleDateString('en-IN')}
            </Text>
          </View>
          <Text className="text-xs text-muted mt-1">
            {item.poNumber ? `PO ${item.poNumber} · ` : ''}
            {item.lines.length} line{item.lines.length === 1 ? '' : 's'}
          </Text>
          {/* INVENTORY_HORIZONTAL_PLATFORM (Phase 9.3): printable GRN PDF. */}
          <View className="flex-row flex-wrap gap-2 mt-3">
            <Button
              label="Go to vendor bills"
              size="sm"
              variant="secondary"
              onPress={() => router.push('/inventory/bills' as never)}
            />
            <Button
              label="PDF"
              size="sm"
              variant="ghost"
              onPress={() => void downloadReportPdf(`/inventory/pdf/grn/${item.id}`, `grn-${item.grnNumber}.pdf`)}
            />
          </View>
        </Card>
      )}
      ListEmptyComponent={
        isLoading ? (
          <View className="gap-3">
            {[1, 2].map((i) => (
              <LoadingSkeleton key={i} className="rounded-xl h-20" />
            ))}
          </View>
        ) : (
          <EmptyState
            title="No goods receipts"
            description="Record a GRN against a purchase order to bring stock in. Every PO is fully received or cancelled."
            action={
              <Button label="Go to Purchase orders" variant="secondary" size="sm" onPress={onGoToOrders} />
            }
          />
        )
      }
      contentContainerStyle={{ paddingBottom: 24 }}
    />
  );
}

/** INVENTORY_HORIZONTAL_PLATFORM (Phase 4.2/4.3): low-stock reorder queue. */
function ReorderSection({
  suggestions,
  isLoading,
  ordering,
  itemLabel,
  onOrder,
}: {
  suggestions: ReorderSuggestion[];
  isLoading?: boolean;
  ordering: boolean;
  itemLabel: string;
  onOrder: (resourceIds: string[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  return (
    <FlatList
      className="flex-1 px-4"
      data={suggestions}
      keyExtractor={(s) => s.resourceId}
      ListHeaderComponent={
        <View className="pb-2">
          <Text className="text-xs text-muted">
            Items below their reorder point. Tap items, then “Order selected” to create an
            auto-approved purchase request + PO (preferred vendor, reorder qty).
          </Text>
          {suggestions.length > 0 ? (
            <View className="flex-row flex-wrap gap-2 mt-3">
              <Button
                label={`Order all (${suggestions.length})`}
                variant="accent"
                size="sm"
                disabled={ordering}
                onPress={() => void onOrder(suggestions.map((s) => s.resourceId))}
              />
              {selected.size > 0 ? (
                <Button
                  label={`Order selected (${selected.size})`}
                  variant="secondary"
                  size="sm"
                  disabled={ordering}
                  onPress={() => void onOrder([...selected])}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      }
      renderItem={({ item }) => {
        const isSelected = selected.has(item.resourceId);
        return (
          <Pressable
            onPress={() =>
              setSelected((prev) => {
                const next = new Set(prev);
                if (next.has(item.resourceId)) next.delete(item.resourceId);
                else next.add(item.resourceId);
                return next;
              })
            }
            className={`mb-2 rounded-xl border ${isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}
          >
            <View className="p-4">
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1 min-w-0">
                  <Text className="text-sm font-bold text-text">{item.name}</Text>
                  <Text className="text-xs text-muted mt-0.5">
                    On hand {item.onHand} {item.unit} · reorder point {item.reorderPoint} · ₹{item.catalogRate}/unit
                  </Text>
                  <View className="flex-row flex-wrap gap-2 mt-2">
                    <Badge color="danger" label={`Suggested qty ${item.suggestedQty}`} />
                    {item.preferredVendor ? (
                      <Badge color="neutral" label={`Preferred: ${item.preferredVendor.name}`} />
                    ) : null}
                    {item.leadTimeDays ? <Badge color="neutral" label={`Lead ${item.leadTimeDays}d`} /> : null}
                  </View>
                </View>
                <View className={`w-5 h-5 rounded border items-center justify-center mt-1 ${isSelected ? 'bg-primary border-primary' : 'border-border'}`}>
                  {isSelected ? <Text className="text-white text-xs font-bold">✓</Text> : null}
                </View>
              </View>
            </View>
          </Pressable>
        );
      }}
      ListEmptyComponent={
        isLoading ? (
          <View className="gap-3">
            {[1, 2].map((i) => (
              <LoadingSkeleton key={i} className="rounded-xl h-20" />
            ))}
          </View>
        ) : (
          <EmptyState
            title="No reorder suggestions"
            description={`Every ${itemLabel.toLowerCase()} is above its reorder point. Set a reorder point on an item to get purchase suggestions here.`}
          />
        )
      }
      contentContainerStyle={{ paddingBottom: 24 }}
    />
  );
}

function CreatePOModal({
  open,
  onClose,
  projectId,
  requisitions,
  initialRequisitionId,
  indentLabel,
  indentLabelPlural,
  itemLabel,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  requisitions: Requisition[];
  initialRequisitionId?: string | null;
  indentLabel: string;
  indentLabelPlural: string;
  itemLabel: string;
  onSubmit: (input: {
    poNumber?: string;
    vendorName: string;
    requisitionId: string;
    lines: Array<{ resourceId: string; quantity: number; unit: string; rate: number }>;
  }) => Promise<void>;
}) {
  const approved = requisitions.filter(indentAvailableForNewPo);
  const [requisitionId, setRequisitionId] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [rates, setRates] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const nextNumbers = useNextProcurementNumbers(projectId, open);

  const req = approved.find((r) => r.id === requisitionId);

  // Prefill suggested PO number when the modal opens (user may still edit).
  useEffect(() => {
    if (open && nextNumbers.data?.po) {
      setPoNumber(nextNumbers.data.po);
    }
  }, [open, nextNumbers.data?.po]);

  // D3: when opened from an indent row CTA, preselect that indent (and prefill
  // its expected rates). Clear everything when the modal closes.
  useEffect(() => {
    if (open && initialRequisitionId) {
      setRequisitionId(initialRequisitionId);
      const target = approved.find((r) => r.id === initialRequisitionId);
      const next: Record<string, string> = {};
      target?.lines.forEach((l) => {
        if (l.resourceId) next[l.resourceId] = l.expectedRate ?? '';
      });
      setRates(next);
    }
  }, [open, initialRequisitionId]);
  useEffect(() => {
    if (!open) {
      setRequisitionId('');
      setPoNumber('');
      setVendorName('');
      setRates({});
      setError('');
    }
  }, [open]);

  const submit = async () => {
    setError('');
    if (!requisitionId || !vendorName) {
      setError(`Choose an approved ${indentLabel.toLowerCase()} and vendor.`);
      return;
    }
    if (!req) return;
    const lines = req.lines.map((l) => {
      if (!l.resourceId) throw new Error('Requisition line is missing a resource');
      return {
        resourceId: l.resourceId,
        quantity: Number(l.quantity),
        unit: l.unit,
        rate: Number(rates[l.resourceId] ?? 0) || 0,
      };
    });
    setSaving(true);
    try {
      await onSubmit({
        poNumber: poNumber.trim() || undefined,
        vendorName,
        requisitionId,
        lines,
      });
      setRequisitionId('');
      setPoNumber('');
      setVendorName('');
      setRates({});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create PO');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} title="New purchase order" closeDisabled={saving}>
      <Text className="text-xs text-muted mb-3">
        Raise a PO against an approved {indentLabel.toLowerCase()}. Each{' '}
        {indentLabel.toLowerCase()} can have only one PO.
      </Text>
      {approved.length === 0 ? (
        <EmptyState
          title={`No ${indentLabelPlural.toLowerCase()} available`}
          description={`Only approved ${indentLabelPlural.toLowerCase()} without a purchase order can be ordered. Create a new ${indentLabel.toLowerCase()} first - it is approved instantly.`}
        />
      ) : (
        <>
          <Select
            label={`Approved ${indentLabel.toLowerCase()}`}
            value={requisitionId}
            onChange={(v) => {
              setRequisitionId(v ?? '');
              setRates({});
            }}
            options={approved.map((r) => ({ title: `${r.reqNumber} (${r.lines.length} lines)`, value: r.id }))}
          />
          <View className="h-3" />
          <Input
            label="PO number"
            value={poNumber}
            onChangeText={setPoNumber}
            autoCapitalize="characters"
            placeholder={nextNumbers.data?.po ?? 'Auto'}
          />
          <Text className="text-[11px] text-muted mt-1 mb-1">
            Suggested automatically - edit if you need a custom number.
          </Text>
          <View className="h-3" />
          <Input label="Vendor name" value={vendorName} onChangeText={setVendorName} />
          {req ? (
            <View className="mt-3">
              <Text className="text-sm font-bold text-text mb-2">Rates</Text>
              {req.lines.map((l) => (
                <View key={l.id} className="flex-row items-center mb-2 gap-2">
                  <Text className="flex-1 text-xs text-text" numberOfLines={1}>
                    {l.resource?.name ?? l.resourceId} ({l.quantity} {l.unit})
                  </Text>
                  <View className="w-24">
                    <Input
                      label=""
                      placeholder="Rate"
                      value={rates[l.resourceId ?? ''] ?? ''}
                      onChangeText={(v) => {
                        if (l.resourceId) setRates((prev) => ({ ...prev, [l.resourceId]: v }));
                      }}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              ))}
            </View>
          ) : null}
          {error ? <Text className="text-danger text-sm mt-2">{error}</Text> : null}
          <View className="h-4" />
          <Button label="Create purchase order" onPress={submit} loading={saving} fullWidth />
        </>
      )}
    </ModalShell>
  );
}

function RecordGrnModal({
  open,
  onClose,
  projectId,
  requisitions,
  initialPurchaseOrderId,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  requisitions: Requisition[];
  initialPurchaseOrderId?: string | null;
  onSubmit: (input: {
    grnNumber?: string;
    purchaseOrderId: string;
    receivedDate: Date;
    lines: Array<{
      resourceId: string;
      quantity: number;
      unit: string;
      batchCode?: string;
      // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.2): receipt lot dates.
      manufacturedAt?: Date;
      expiresAt?: Date;
    }>;
    // INVENTORY_HORIZONTAL_PLATFORM (Phase 5.1): landed costs.
    freightCost?: number;
    insuranceCost?: number;
    handlingCost?: number;
    customsCost?: number;
    landedCostAllocation?: 'QUANTITY' | 'VALUE';
    // INVENTORY_HORIZONTAL_PLATFORM (Phase 8.6): receiving warehouse.
    locationId?: string;
  }) => Promise<void>;
}) {
  // Locked rule: list only non-cancelled POs that are NOT yet fully received.
  const eligiblePos = allPurchaseOrders(requisitions).filter(poAvailableForNewGrn);
  const [poId, setPoId] = useState('');
  const [grnNumber, setGrnNumber] = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 5.1): landed cost allocation.
  const [freight, setFreight] = useState('');
  const [insurance, setInsurance] = useState('');
  const [handling, setHandling] = useState('');
  const [customs, setCustoms] = useState('');
  const [allocation, setAllocation] = useState<'QUANTITY' | 'VALUE'>('QUANTITY');
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 8.6/9.6): receiving warehouse + per-line batch codes.
  const [batchCodes, setBatchCodes] = useState<Record<string, string>>({});
  // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.2): per-line mfg/expiry dates.
  const [batchMfg, setBatchMfg] = useState<Record<string, string>>({});
  const [batchExp, setBatchExp] = useState<Record<string, string>>({});
  const [locationId, setLocationId] = useState('');
  const { data: warehouses } = useWarehouses();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const nextNumbers = useNextProcurementNumbers(projectId, open);

  const selectedPo = eligiblePos.find((po) => po.id === poId) ?? null;

  // Remaining qty per resource (PO line qty minus cumulative GRN receipts).
  const remaining = selectedPo ? poRemainingByResource(selectedPo) : new Map<string, number>();

  const onSelectPo = (id: string) => {
    setPoId(id);
    const po = eligiblePos.find((p) => p.id === id);
    if (!po) return;
    const rem = poRemainingByResource(po);
    const next: Record<string, string> = {};
    for (const l of po.lines) {
      const qty = rem.get(l.resourceId) ?? 0;
      if (qty > 0) next[l.resourceId] = String(qty);
    }
    setQuantities(next);
  };

  // Prefill suggested GRN number when the modal opens (user may still edit).
  useEffect(() => {
    if (open && nextNumbers.data?.grn) {
      setGrnNumber(nextNumbers.data.grn);
    }
  }, [open, nextNumbers.data?.grn]);

  // D4: when opened from a PO row CTA, preselect that PO and prefill remaining
  // quantities. Clear everything when the modal closes.
  useEffect(() => {
    if (open && initialPurchaseOrderId) {
      onSelectPo(initialPurchaseOrderId);
    }
  }, [open, initialPurchaseOrderId]);
  useEffect(() => {
    if (!open) {
      setPoId('');
      setGrnNumber('');
      setQuantities({});
      setError('');
      setReceivedDate(new Date().toISOString().slice(0, 10));
      setBatchCodes({});
      setBatchMfg({});
      setBatchExp({});
      setLocationId('');
    }
  }, [open]);

  const submit = async () => {
    setError('');
    if (!poId) {
      setError('Choose a purchase order.');
      return;
    }
    if (!selectedPo) return;
    const lines = selectedPo.lines
      .map((l) => {
        const qty = Number(quantities[l.resourceId] ?? 0) || 0;
        return {
          resourceId: l.resourceId,
          quantity: qty,
          unit: l.unit,
          // INVENTORY_HORIZONTAL_PLATFORM (Phase 8.3/9.6): per-line batch code.
          batchCode: batchCodes[l.resourceId]?.trim() || undefined,
          // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.2): per-line lot dates.
          ...(batchMfg[l.resourceId]?.trim() ? { manufacturedAt: new Date(batchMfg[l.resourceId]) } : {}),
          ...(batchExp[l.resourceId]?.trim() ? { expiresAt: new Date(batchExp[l.resourceId]) } : {}),
        };
      })
      .filter((l) => l.quantity > 0);
    if (lines.length === 0) {
      setError('Enter a quantity to receive for at least one line.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        grnNumber: grnNumber.trim() || undefined,
        purchaseOrderId: poId,
        receivedDate: new Date(receivedDate),
        lines,
        freightCost: freight === '' ? undefined : Number(freight),
        insuranceCost: insurance === '' ? undefined : Number(insurance),
        handlingCost: handling === '' ? undefined : Number(handling),
        customsCost: customs === '' ? undefined : Number(customs),
        landedCostAllocation: allocation,
        // INVENTORY_HORIZONTAL_PLATFORM (Phase 8.6): receiving warehouse.
        locationId: locationId || undefined,
      });
      setPoId('');
      setGrnNumber('');
      setQuantities({});
      setFreight('');
      setInsurance('');
      setHandling('');
      setCustoms('');
      setBatchCodes({});
      setBatchMfg({});
      setBatchExp({});
      setLocationId('');
      setReceivedDate(new Date().toISOString().slice(0, 10));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to record GRN');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} title="Record goods receipt" closeDisabled={saving}>
      <Text className="text-xs text-muted mb-3">
        Receiving stock updates the on-hand balance and logs a stock movement. Partial receipts
        are allowed until the PO is fully received.
      </Text>
      {eligiblePos.length === 0 ? (
        <EmptyState
          title="No POs awaiting receipt"
          description="Every purchase order is fully received or cancelled. Create a new PO to receive more stock."
        />
      ) : (
        <>
          <Select
            label="Purchase order"
            value={poId}
            onChange={(v) => onSelectPo(v ?? '')}
            options={eligiblePos.map((po) => ({
              title: `${po.poNumber} · ${po.vendorName ?? 'Vendor'}`,
              value: po.id,
            }))}
          />
          <View className="h-3" />
          <Input
            label="GRN number"
            value={grnNumber}
            onChangeText={setGrnNumber}
            autoCapitalize="characters"
            placeholder={nextNumbers.data?.grn ?? 'Auto'}
          />
          <Text className="text-[11px] text-muted mt-1 mb-1">
            Suggested automatically - edit if you need a custom number.
          </Text>
          <View className="h-3" />
          <Input label="Received date" value={receivedDate} onChangeText={setReceivedDate} />
          {/* INVENTORY_HORIZONTAL_PLATFORM (Phase 8.6): receiving warehouse picker. */}
          <Select
            label="Receive into warehouse (optional)"
            value={locationId || undefined}
            onChange={(v) => setLocationId(v ?? '')}
            options={(warehouses ?? []).map((w: Warehouse) => ({ title: w.name, value: w.id }))}
            placeholder="Company default warehouse"
          />
          {/* INVENTORY_HORIZONTAL_PLATFORM (Phase 8.3/9.6): per-line batch codes. */}
          {selectedPo ? (
            <View className="mt-3">
              <Text className="text-sm font-bold text-text mb-2">Items to receive (remaining)</Text>
              {selectedPo.lines.map((l) => {
                const rem = remaining.get(l.resourceId) ?? 0;
                if (rem <= 0) return null;
                return (
                  <View key={l.id} className="mb-2">
                    <View className="flex-row items-center mb-1 gap-2">
                      <Text className="flex-1 text-xs text-text" numberOfLines={1}>
                        {l.resource?.name ?? l.resourceId} (remaining {rem} {l.unit})
                      </Text>
                      <View className="w-24">
                        <Input
                          label=""
                          placeholder="Qty"
                          value={quantities[l.resourceId] ?? String(rem)}
                          onChangeText={(v) => setQuantities((prev) => ({ ...prev, [l.resourceId]: v }))}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                    {/* INVENTORY_HORIZONTAL_PLATFORM (Phase 8.3/9.6): per-line batch. */}
                    <Input
                      label="Batch / lot code (optional)"
                      value={batchCodes[l.resourceId] ?? ''}
                      onChangeText={(v) => setBatchCodes((prev) => ({ ...prev, [l.resourceId]: v }))}
                      autoCapitalize="characters"
                      placeholder="e.g. LOT-2026-A"
                    />
                    {/* INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.2): lot dates
                        (batch-tracked Kirana items use these for FEFO + expiry). */}
                    <View className="flex-row gap-2 mt-1">
                      <View className="flex-1">
                        <Input
                          label="Mfg date (optional)"
                          value={batchMfg[l.resourceId] ?? ''}
                          onChangeText={(v) => setBatchMfg((prev) => ({ ...prev, [l.resourceId]: v }))}
                          placeholder="YYYY-MM-DD"
                        />
                      </View>
                      <View className="flex-1">
                        <Input
                          label="Expiry date (optional)"
                          value={batchExp[l.resourceId] ?? ''}
                          onChangeText={(v) => setBatchExp((prev) => ({ ...prev, [l.resourceId]: v }))}
                          placeholder="YYYY-MM-DD"
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}
          {/* INVENTORY_HORIZONTAL_PLATFORM (Phase 5.1): landed costs. */}
          <View className="mt-4 p-3 rounded-xl border border-border bg-surface">
            <Text className="text-sm font-bold text-text mb-1">Landed costs (optional)</Text>
            <Text className="text-[11px] text-muted mb-2">
              Extra acquisition costs are added to each item's unit cost (by quantity or by value)
              and update the weighted-average cost.
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <View className="flex-1 min-w-[130px]">
                <Input label="Freight (₹)" value={freight} onChangeText={setFreight} keyboardType="numeric" placeholder="0" />
              </View>
              <View className="flex-1 min-w-[130px]">
                <Input label="Insurance (₹)" value={insurance} onChangeText={setInsurance} keyboardType="numeric" placeholder="0" />
              </View>
              <View className="flex-1 min-w-[130px]">
                <Input label="Handling (₹)" value={handling} onChangeText={setHandling} keyboardType="numeric" placeholder="0" />
              </View>
              <View className="flex-1 min-w-[130px]">
                <Input label="Customs (₹)" value={customs} onChangeText={setCustoms} keyboardType="numeric" placeholder="0" />
              </View>
            </View>
            <Select
              label="Allocate by"
              value={allocation}
              onChange={(v) => v && setAllocation(v as 'QUANTITY' | 'VALUE')}
              options={[
                { title: 'Quantity (same per unit)', value: 'QUANTITY' },
                { title: 'Value (proportional to line value)', value: 'VALUE' },
              ]}
            />
          </View>
          {error ? <Text className="text-danger text-sm mt-2">{error}</Text> : null}
          <View className="h-4" />
          <Button label="Record GRN" onPress={submit} loading={saving} fullWidth />
        </>
      )}
    </ModalShell>
  );
}

