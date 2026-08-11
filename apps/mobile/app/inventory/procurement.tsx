/**
 * Inventory shell - Procurement hub.
 *
 * Indent (requisition) → Purchase Order → GRN lifecycle scoped to the tenant's
 * default STORE project. Reuses the same backend endpoints as the construction
 * ProcurementTab, without the project picker.
 */
import React, { useState } from 'react';
import { View, Text, FlatList, Pressable, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Badge, Button, Input, EmptyState, LoadingSkeleton, Select, toast } from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';
import { indentAvailableForNewPo, poAvailableForNewGrn, poRemainingByResource } from '@buildflow/shared';
import {
  useRequisitions,
  useCreateRequisition,
  useSubmitRequisition,
  useApproveRequisition,
  useCreatePurchaseOrder,
  useCreateGRN,
  type Requisition,
} from '@/services/expansion.queries';
import { useResources } from '@/services/estimate.queries';

const APPROVAL_COLOR: Record<string, 'warning' | 'success' | 'danger' | 'neutral'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

type Section = 'indents' | 'orders' | 'grns';

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
  const user = useAuthStore((s) => s.user);
  const projectId = user?.defaultProjectId ?? '';
  const [section, setSection] = useState<Section>('indents');
  const [createIndentOpen, setCreateIndentOpen] = useState(false);
  const [createPoOpen, setCreatePoOpen] = useState(false);
  const [recordGrnOpen, setRecordGrnOpen] = useState(false);
  /** id of the indent whose Submit/Approve is in flight (prevents double-click). */
  const [actionId, setActionId] = useState<string | null>(null);
  /** True while waiting for list refetch to show the new/updated row. */
  const [buffering, setBuffering] = useState(false);

  const { data: requisitions, isLoading: reqLoading, refetch } = useRequisitions(projectId);
  const { data: resources } = useResources();
  const createRequisition = useCreateRequisition(projectId);
  const submitRequisition = useSubmitRequisition(projectId);
  const approveRequisition = useApproveRequisition(projectId);
  const createPo = useCreatePurchaseOrder(projectId);
  const createGrn = useCreateGRN(projectId);

  const resourceList = resources?.data ?? [];

  // Locked picker rules (PROCUREMENT_PICKER_PERF): New PO lists only APPROVED
  // indents with zero POs; New GRN lists POs that still have qty to receive.
  const eligiblePoIndents = (requisitions ?? []).filter(indentAvailableForNewPo);
  const eligibleGrnPos = allPurchaseOrders(requisitions ?? []).filter(poAvailableForNewGrn);

  return (
    <View className="flex-1 bg-surface">
      <View className="px-4 pt-4 pb-2">
        <Text className="text-2xl font-bold text-text">Procurement</Text>
        <Text className="text-sm text-muted mt-0.5">Indent → PO → GRN</Text>
      </View>

      <View className="flex-row px-4 pb-2 gap-2">
        {(['indents', 'orders', 'grns'] as Section[]).map((s) => (
          <Pressable
            key={s}
            disabled={buffering}
            onPress={() => setSection(s)}
            className={`px-3 py-1.5 rounded-lg border ${
              section === s ? 'bg-primary border-primary' : 'bg-card border-border'
            } ${buffering ? 'opacity-50' : ''}`}
          >
            <Text className={`text-xs font-medium ${section === s ? 'text-white' : 'text-muted'}`}>
              {s === 'indents' ? 'Indents' : s === 'orders' ? 'Purchase orders' : 'Goods receipts'}
            </Text>
          </Pressable>
        ))}
        <View className="flex-1" />
        <Button
          label={
            section === 'indents' ? 'New indent' : section === 'orders' ? 'New PO' : 'Record GRN'
          }
          variant="accent"
          size="sm"
          disabled={
            buffering ||
            (section === 'orders'
              ? eligiblePoIndents.length === 0
              : section === 'grns'
                ? eligibleGrnPos.length === 0
                : false)
          }
          onPress={() => {
            if (section === 'indents') setCreateIndentOpen(true);
            else if (section === 'orders') setCreatePoOpen(true);
            else setRecordGrnOpen(true);
          }}
        />
      </View>

      {buffering ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
          <View className="flex-1 bg-black/50 items-center justify-center px-8">
            <View className="bg-card rounded-2xl px-6 py-5 items-center max-w-sm w-full border border-border">
              <ActivityIndicator size="large" />
              <Text className="text-base font-bold text-text mt-4 text-center">Updating procurement…</Text>
              <Text className="text-xs text-muted mt-2 text-center">
                Please wait until the list refreshes. Don’t change anything while this is in progress.
              </Text>
            </View>
          </View>
        </Modal>
      ) : null}

      {section === 'indents' && (
        <IndentsSection
          isLoading={reqLoading}
          requisitions={requisitions ?? []}
          actionId={actionId}
          onSubmit={(id) => {
            setActionId(id);
            setBuffering(true);
            void (async () => {
              try {
                await submitRequisition.mutateAsync(id);
                await bufferUntilVisible(refetch, (list) =>
                  list.some((r) => r.id === id && r.status === 'SUBMITTED'),
                );
                toast.success('Indent submitted for approval');
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Submit failed');
              } finally {
                setActionId(null);
                setBuffering(false);
              }
            })();
          }}
          onApprove={(id) => {
            setActionId(id);
            setBuffering(true);
            void (async () => {
              try {
                await approveRequisition.mutateAsync(id);
                await bufferUntilVisible(refetch, (list) =>
                  list.some((r) => r.id === id && r.status === 'APPROVED'),
                );
                toast.success('Indent approved');
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Approve failed');
              } finally {
                setActionId(null);
                setBuffering(false);
              }
            })();
          }}
        />
      )}

      {section === 'orders' && (
        <OrdersSection
          requisitions={requisitions ?? []}
          isLoading={reqLoading}
          onOpenCreate={() => setCreatePoOpen(true)}
        />
      )}

      {section === 'grns' && (
        <GrnsSection
          requisitions={requisitions ?? []}
          isLoading={reqLoading}
          onOpenCreate={() => setRecordGrnOpen(true)}
        />
      )}

      <CreateIndentModal
        open={createIndentOpen}
        onClose={() => {
          if (!buffering) setCreateIndentOpen(false);
        }}
        resources={resourceList}
        onSubmit={async (lines, notes) => {
          setBuffering(true);
          try {
            const created = await createRequisition.mutateAsync({ lines, notes });
            await bufferUntilVisible(refetch, (list) => list.some((r) => r.id === created.id));
            toast.success('Indent created');
            setCreateIndentOpen(false);
            setSection('indents');
          } finally {
            setBuffering(false);
          }
        }}
      />

      <CreatePOModal
        open={createPoOpen}
        onClose={() => {
          if (!buffering) setCreatePoOpen(false);
        }}
        requisitions={requisitions ?? []}
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
            setSection('orders');
          } finally {
            setBuffering(false);
          }
        }}
      />

      <RecordGrnModal
        open={recordGrnOpen}
        onClose={() => {
          if (!buffering) setRecordGrnOpen(false);
        }}
        requisitions={requisitions ?? []}
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
            setSection('grns');
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
  actionId,
  onSubmit,
  onApprove,
}: {
  isLoading: boolean;
  requisitions: Requisition[];
  actionId: string | null;
  onSubmit: (id: string) => void;
  onApprove: (id: string) => void;
}) {
  return (
    <FlatList
      className="flex-1 px-4"
      data={requisitions}
      keyExtractor={(r) => r.id}
      renderItem={({ item }) => (
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
          <View className="flex-row gap-2 mt-3">
            {item.status === 'DRAFT' && (
              <Button
                size="sm"
                label="Submit"
                loading={actionId === item.id}
                disabled={actionId !== null && actionId !== item.id}
                onPress={() => onSubmit(item.id)}
              />
            )}
            {item.status === 'SUBMITTED' && (
              <Button
                size="sm"
                variant="accent"
                label="Approve"
                loading={actionId === item.id}
                disabled={actionId !== null && actionId !== item.id}
                onPress={() => onApprove(item.id)}
              />
            )}
          </View>
        </Card>
      )}
      ListEmptyComponent={
        isLoading ? (
          <View className="gap-3">
            {[1, 2].map((i) => <LoadingSkeleton key={i} className="rounded-xl h-20" />)}
          </View>
        ) : (
          <EmptyState
            title="No indents yet"
            description="Create an indent (material requisition), then approve it and raise a purchase order."
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
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  resources: Array<{ id: string; name: string; unit: string }>;
  onSubmit: (lines: Array<{ resourceId: string; quantity: number; unit: string }>, notes?: string) => Promise<void>;
}) {
  const [resourceId, setResourceId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!resourceId || !Number(quantity)) {
      setError('Choose a resource and enter a quantity.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit(
        [{ resourceId, quantity: Number(quantity), unit: resources.find((r) => r.id === resourceId)?.unit ?? 'no' }],
        notes || undefined,
      );
      setResourceId('');
      setQuantity('1');
      setNotes('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create indent');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} title="New indent" closeDisabled={saving}>
      <Text className="text-xs text-muted mb-3">
        Create a material requisition. After approval you can raise a purchase order against it.
      </Text>
      <Select
        label="Resource"
        value={resourceId}
        onChange={(v) => v && setResourceId(v)}
        options={resources.map((r) => ({ title: `${r.name} (${r.unit})`, value: r.id }))}
      />
      <View className="h-3" />
      <Input
        label="Quantity"
        value={quantity}
        onChangeText={setQuantity}
        keyboardType="numeric"
      />
      <View className="h-3" />
      <Input label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
      {error ? <Text className="text-danger text-sm mt-2">{error}</Text> : null}
      <View className="h-4" />
      <Button label="Create indent" onPress={submit} loading={saving} fullWidth />
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
  const dismiss = () => {
    if (!closeDisabled) onClose();
  };
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={dismiss}>
      <Pressable className="flex-1 bg-black/40 items-center justify-center p-4" onPress={dismiss}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="bg-card rounded-2xl w-full max-w-lg max-h-[85%]"
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
  onOpenCreate,
}: {
  requisitions: Requisition[];
  isLoading?: boolean;
  onOpenCreate: () => void;
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
        return (
          <Card className="mb-3 p-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-bold text-text">{item.poNumber}</Text>
              <Badge label={item.status ?? 'DRAFT'} />
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
            description="Approve an indent, then create a PO against it to order materials."
          />
        )
      }
      ListFooterComponent={
        <View className="pb-24">
          <Button
            label="New purchase order"
            variant="accent"
            onPress={onOpenCreate}
            disabled={!!isLoading}
            fullWidth
          />
        </View>
      }
      contentContainerStyle={{ paddingBottom: 8 }}
    />
  );
}

function GrnsSection({
  requisitions,
  isLoading,
  onOpenCreate,
}: {
  requisitions: Requisition[];
  isLoading?: boolean;
  onOpenCreate: () => void;
}) {
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
            description="When stock arrives, record a GRN against the purchase order to update on-hand stock."
          />
        )
      }
      ListFooterComponent={
        <View className="pb-24">
          <Button label="Record GRN" variant="accent" onPress={onOpenCreate} disabled={!!isLoading} fullWidth />
        </View>
      }
      contentContainerStyle={{ paddingBottom: 8 }}
    />
  );
}

function CreatePOModal({
  open,
  onClose,
  requisitions,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  requisitions: Requisition[];
  onSubmit: (input: {
    poNumber: string;
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

  const req = approved.find((r) => r.id === requisitionId);

  const submit = async () => {
    setError('');
    if (!requisitionId || !poNumber || !vendorName) {
      setError('Choose an approved indent, PO number and vendor.');
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
      await onSubmit({ poNumber, vendorName, requisitionId, lines });
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
        Raise a PO against an approved indent. Each indent can have only one PO.
      </Text>
      {approved.length === 0 ? (
        <EmptyState
          title="No indents available"
          description="Only approved indents without a purchase order can be ordered. Create and approve a new indent first."
        />
      ) : (
        <>
          <Select
            label="Approved indent"
            value={requisitionId}
            onChange={(v) => {
              setRequisitionId(v ?? '');
              setRates({});
            }}
            options={approved.map((r) => ({ title: `${r.reqNumber} (${r.lines.length} lines)`, value: r.id }))}
          />
          <View className="h-3" />
          <Input label="PO number" value={poNumber} onChangeText={setPoNumber} autoCapitalize="characters" />
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
  requisitions,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  requisitions: Requisition[];
  onSubmit: (input: {
    grnNumber: string;
    purchaseOrderId: string;
    receivedDate: Date;
    lines: Array<{ resourceId: string; quantity: number; unit: string }>;
  }) => Promise<void>;
}) {
  // Locked rule: list only non-cancelled POs that are NOT yet fully received.
  const eligiblePos = allPurchaseOrders(requisitions).filter(poAvailableForNewGrn);
  const [poId, setPoId] = useState('');
  const [grnNumber, setGrnNumber] = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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

  const submit = async () => {
    setError('');
    if (!poId || !grnNumber) {
      setError('Choose a purchase order and enter a GRN number.');
      return;
    }
    if (!selectedPo) return;
    const lines = selectedPo.lines
      .map((l) => {
        const qty = Number(quantities[l.resourceId] ?? 0) || 0;
        return { resourceId: l.resourceId, quantity: qty, unit: l.unit };
      })
      .filter((l) => l.quantity > 0);
    if (lines.length === 0) {
      setError('Enter a quantity to receive for at least one line.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ grnNumber, purchaseOrderId: poId, receivedDate: new Date(receivedDate), lines });
      setPoId('');
      setGrnNumber('');
      setQuantities({});
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
          <Input label="GRN number" value={grnNumber} onChangeText={setGrnNumber} autoCapitalize="characters" />
          <View className="h-3" />
          <Input label="Received date" value={receivedDate} onChangeText={setReceivedDate} />
          {selectedPo ? (
            <View className="mt-3">
              <Text className="text-sm font-bold text-text mb-2">Items to receive (remaining)</Text>
              {selectedPo.lines.map((l) => {
                const rem = remaining.get(l.resourceId) ?? 0;
                if (rem <= 0) return null;
                return (
                  <View key={l.id} className="flex-row items-center mb-2 gap-2">
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
                );
              })}
            </View>
          ) : null}
          {error ? <Text className="text-danger text-sm mt-2">{error}</Text> : null}
          <View className="h-4" />
          <Button label="Record GRN" onPress={submit} loading={saving} fullWidth />
        </>
      )}
    </ModalShell>
  );
}

