import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { AdaptiveSheet } from '@/components/layout/AdaptiveSheet';
import {
  Card,
  Badge,
  Button,
  EmptyState,
  LoadingSkeleton,
  Input,
} from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';
import { useViewport } from '@/hooks/useViewport';
import { usePermission } from '@/hooks/usePermission';
import { formatDate } from '@/utils/format';
import { projectTabHref } from '@/utils/navigation';
import {
  useRequisitions,
  useCreateRequisition,
  useDeleteRequisition,
  useSubmitRequisition,
  useApproveRequisition,
  useCreatePurchaseOrder,
  useCreateGRN,
  useStockSummary,
  useStockMovements,
  useBoqShortfalls,
  useGenerateIndentsFromBoq,
  type Requisition,
  type BoqShortfall,
  type StockSummaryRow,
  type StockMovementRow,
  type PurchaseOrderSummary,
} from '@/services/expansion.queries';
import { useMaterials, type Resource } from '@/services/estimate.queries';
import { useBoq } from '@/services/boq.queries';
import {
  IndentDraftLineCard,
  emptyIndentLine,
  indentLineTotal,
  type IndentDraftLine,
} from '@/components/projects/IndentDraftLineCard';
import { alertAsync, confirmAsync } from '@/utils/confirm';
import type { MaterialRateSource } from '@buildflow/shared';
import { poAvailableForNewGrn, poRemainingByResource } from '@buildflow/shared';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const STATUS_COLOR: Record<string, 'neutral' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

const RATE_SOURCE_LABEL: Record<string, string> = {
  PROJECT: 'Project override',
  BOQ: 'BOQ',
  ESTIMATE: 'Estimate',
  REGION: 'Regional',
  LAST_PO: 'Last PO',
  CATALOG: 'Catalog',
  MANUAL: 'Manual',
};

function sourceBadge(req: Requisition): string | null {
  if (!req.sourceType) return null;
  const labels: Record<string, string> = {
    ESTIMATE_CONVERT: 'From estimate',
    VARIATION: 'From variation',
    BOQ_UPDATE: 'From BOQ',
    MANUAL: 'Manual',
  };
  const label = labels[req.sourceType] ?? req.sourceType;
  return req.sourceRef ? `${label}: ${req.sourceRef}` : label;
}

function suggestPoNumber(req: Requisition, allReqs: Requisition[]): string {
  const used = new Set(allReqs.flatMap((r) => r.purchaseOrders?.map((po) => po.poNumber) ?? []));
  const base = `PO-${req.reqNumber.replace(/^IND-/, '')}`;
  if (!used.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
  return `PO-${Date.now()}`;
}

function suggestGrnNumber(poNumber: string): string {
  if (poNumber.startsWith('PO-')) return `GRN-${poNumber.slice(3)}`;
  return `GRN-${poNumber.replace(/^PO/, '')}`;
}

type SubTab = 'indents' | 'pos' | 'stock' | 'shortfalls';

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

export function ProcurementTab({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { isDesktop } = useViewport();
  const user = useAuthStore((s) => s.user);
  const canCreate = user?.role === 'OWNER' || user?.role === 'PM' || user?.role === 'SUPERVISOR';
  const canApprove = user?.role === 'OWNER' || user?.role === 'PM';
  const canCreatePO = user?.role === 'OWNER' || user?.role === 'PM' || user?.role === 'ACCOUNTANT';
  // R9-B1: Use granular permission instead of role check
  const canCreateBill = usePermission('bill.create' as never);

  const [subTab, setSubTab] = useState<SubTab>('indents');

  const reqQ = useRequisitions(projectId);
  const requisitions = reqQ.data ?? [];

  return (
    <View className="gap-3">
      {/* Sub-tab bar */}
      <SubTabBar active={subTab} onChange={setSubTab} counts={{
        indents: requisitions.length,
        pos: requisitions.filter((r: Requisition) => r.purchaseOrders?.length).length,
      }} />

      {subTab === 'indents' && (
        <IndentsSection
          projectId={projectId}
          canCreate={canCreate}
          canApprove={canApprove}
          canCreatePO={canCreatePO}
          canCreateBill={canCreateBill}
          requisitions={requisitions}
          isLoading={reqQ.isLoading}
          allReqs={requisitions}
          router={router}
        />
      )}

      {subTab === 'stock' && <StockSection projectId={projectId} />}

      {subTab === 'shortfalls' && (
        <ShortfallsSection projectId={projectId} canCreate={canCreate} />
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-Tab Bar                                                         */
/* ------------------------------------------------------------------ */

function SubTabBar({
  active,
  onChange,
  counts,
}: {
  active: SubTab;
  onChange: (tab: SubTab) => void;
  counts: { indents: number; pos: number };
}) {
  const tabs: { key: SubTab; label: string; count?: number }[] = [
    { key: 'indents', label: 'Indents', count: counts.indents },
    { key: 'stock', label: 'Stock' },
    { key: 'shortfalls', label: 'Shortfalls' },
  ];

  return (
    <View className="flex-row gap-2 flex-wrap">
      {tabs.map((t) => (
        <Pressable
          key={t.key}
          onPress={() => onChange(t.key)}
          className={`px-3 py-1.5 rounded-full flex-row items-center gap-1.5 ${
            active === t.key ? 'bg-primary' : 'bg-card border border-border'
          }`}
        >
          <Text className={`text-xs font-semibold ${active === t.key ? 'text-white' : 'text-muted'}`}>
            {t.label}
          </Text>
          {t.count !== undefined && t.count > 0 && (
            <View className={`px-1.5 py-0.5 rounded-full ${active === t.key ? 'bg-white/20' : 'bg-border'}`}>
              <Text className={`text-[10px] font-bold ${active === t.key ? 'text-white' : 'text-muted'}`}>
                {t.count}
              </Text>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Indents Section                                                     */
/* ------------------------------------------------------------------ */

function IndentsSection({
  projectId,
  canCreate,
  canApprove,
  canCreatePO,
  canCreateBill,
  requisitions,
  isLoading,
  allReqs,
  router,
}: {
  projectId: string;
  canCreate: boolean;
  canApprove: boolean;
  canCreatePO: boolean;
  canCreateBill: boolean;
  requisitions: Requisition[];
  isLoading: boolean;
  allReqs: Requisition[];
  router: ReturnType<typeof useRouter>;
}) {
  const createReq = useCreateRequisition(projectId);
  const deleteReq = useDeleteRequisition(projectId);
  const submitReq = useSubmitRequisition(projectId);
  const approveReq = useApproveRequisition(projectId);
  const createPO = useCreatePurchaseOrder(projectId);
  const createGRN = useCreateGRN(projectId);
  const { data: materialsData } = useMaterials({ limit: 200 });
  const materials: Resource[] = materialsData?.data ?? [];
  const { data: boq } = useBoq(projectId);
  const boqItems = boq?.items ?? [];

  const [reqModal, setReqModal] = useState(false);
  const [poModal, setPoModal] = useState<Requisition | null>(null);
  const [grnModal, setGrnModal] = useState<{
    poId: string;
    poNumber: string;
    lines: Array<{
      lineId: string;
      resourceId: string;
      resourceName: string;
      unit: string;
      poQty: number;
      remainingQty: number;
      boqItem?: { itemCode: string; description: string } | null;
    }>;
  } | null>(null);

  const [reqNotes, setReqNotes] = useState('');
  const [draftLines, setDraftLines] = useState<IndentDraftLine[]>([emptyIndentLine()]);
  const [poNumber, setPoNumber] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [poLineRates, setPoLineRates] = useState<Record<string, string>>({});
  const [grnNumber, setGrnNumber] = useState('');
  const [grnNotes, setGrnNotes] = useState('');
  const [grnLineQtys, setGrnLineQtys] = useState<Record<string, string>>({});
  /** In-flight submit/approve/delete on an indent — prevents double-click. */
  const [pendingAction, setPendingAction] = useState<{ id: string; kind: 'submit' | 'approve' | 'delete' } | null>(null);

  // Shortfalls loaded only when modal opens
  const shortfallsQ = useBoqShortfalls(projectId, reqModal);
  const shortfalls = shortfallsQ.data ?? [];

  // Stock summary — build a map of resourceId → on-hand balance for
  // showing per-material stock info on exploded lines.
  const stockSummaryQ = useStockSummary(projectId);
  const stockByResource = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of stockSummaryQ.data ?? []) {
      map.set(row.resourceId, row.balance);
    }
    return map;
  }, [stockSummaryQ.data]);

  const draftTotal = useMemo(
    () => draftLines.reduce((sum, l) => sum + indentLineTotal(l), 0),
    [draftLines],
  );
  const draftLineCount = draftLines.filter((l) => l.resourceId || l.boqItemId).length;

  const resetReqForm = () => {
    setReqNotes('');
    setDraftLines([emptyIndentLine()]);
  };

  const openReqModal = () => {
    resetReqForm();
    setReqModal(true);
  };

  const updateDraftLine = useCallback((id: string, line: IndentDraftLine) => {
    setDraftLines((prev) => prev.map((l) => (l.id === id ? line : l)));
  }, []);

  const removeDraftLine = (id: string) => {
    setDraftLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== id)));
  };

  const onCreateReq = () => {
    // FIX (MOB-H11): Include BOQ-only lines (no resourceId but has boqItemId)
    // so they aren't silently dropped. The user sees N lines but only N-1 save.
    const validLines = draftLines.filter((l) => l.resourceId || l.boqItemId);
    if (validLines.length === 0) {
      void alertAsync('Required', 'Add at least one line with a material selected.');
      return;
    }
    // Validation: exploded lines (from BOQ) always have resourceId set;
    // they don't need to be in the loaded materials list (only 200 loaded).
    const missingMaterial = validLines.find(
      (l) => !l.resourceId && !l.boqItemId,
    );
    if (missingMaterial) {
      void alertAsync('Required', 'One or more lines is missing a material.');
      return;
    }
    createReq.mutate(
      {
        notes: reqNotes.trim() || undefined,
        lines: validLines.map((l) => {
          // For exploded lines (from BOQ explode), the resourceId is already
          // a valid catalog resource ID but may not be in the loaded `materials`
          // list (only loads 200). Use l.resourceId directly, with resourceUnit
          // fallback for the unit.
          const res = materials.find((r: Resource) => r.id === l.resourceId);
          // FIX (NR-51): For BOQ-only lines (no catalog resource), send
          // resourceId: undefined (not empty string) so Zod's optional().uuid()
          // accepts it. Empty string fails UUID validation → 422 rejection.
          return {
            resourceId: l.resourceId || undefined,
            quantity: parseFloat(l.qty) || 1,
            unit: res?.unit || l.resourceUnit || 'unit',
            boqItemId: l.boqItemId || undefined,
            expectedRate: parseFloat(l.expectedRate) || undefined,
            rateSource: l.rateSource as MaterialRateSource | undefined,
          };
        }),
      },
      {
        onSuccess: () => {
          setReqModal(false);
          resetReqForm();
        },
        onError: (e: Error) => void alertAsync('Error', e.message),
      },
    );
  };

  const onCreatePO = () => {
    if (!poModal || !poNumber.trim() || !vendorName.trim() || poModal.lines.length === 0) {
      void alertAsync('Required', 'Fill PO number, vendor, and requisition lines.');
      return;
    }
    const lines = poModal.lines.map((l: Requisition['lines'][number]) => {
      const res = materials.find((r: Resource) => r.id === l.resourceId);
      const rateStr = poLineRates[l.id] ?? (l.expectedRate ? String(parseFloat(l.expectedRate)) : '');
      return {
        resourceId: l.resourceId,
        quantity: parseFloat(l.quantity) || 1,
        unit: l.unit || res?.unit || 'unit',
        rate: parseFloat(rateStr) || 0,
        lineId: l.id,
        materialName: l.resource?.name ?? 'Material',
      };
    });
    const zeroRate = lines.find((l) => l.rate <= 0);
    if (zeroRate) {
      void alertAsync('Required', `Enter a PO rate greater than 0 for ${zeroRate.materialName}.`);
      return;
    }
    createPO.mutate(
      {
        poNumber: poNumber.trim(),
        vendorName: vendorName.trim(),
        requisitionId: poModal.id,
        lines: lines.map(({ lineId: _id, materialName: _n, ...line }) => line),
      },
      {
        onSuccess: () => {
          const num = poNumber.trim();
          setPoModal(null);
          setPoNumber('');
          setVendorName('');
          setPoLineRates({});
          void alertAsync('PO created', `Purchase order ${num} created. Record GRN when goods arrive.`);
        },
        onError: (e: Error) => void alertAsync('Error', e.message),
      },
    );
  };

  const onCreateGRN = () => {
    if (!grnModal || !grnNumber.trim()) {
      void alertAsync('Required', 'Enter a GRN number.');
      return;
    }
    const lines = grnModal.lines
      .map((line) => ({
        resourceId: line.resourceId,
        quantity: parseFloat(grnLineQtys[line.lineId] ?? '0') || 0,
        unit: line.unit,
      }))
      .filter((l) => l.quantity > 0);
    if (lines.length === 0) {
      void alertAsync('Required', 'Enter received quantity greater than 0 for at least one line.');
      return;
    }
    createGRN.mutate(
      {
        grnNumber: grnNumber.trim(),
        purchaseOrderId: grnModal.poId,
        receivedDate: new Date(),
        notes: grnNotes.trim() || undefined,
        lines,
      },
      {
        onSuccess: () => {
          const num = grnNumber.trim();
          setGrnModal(null);
          setGrnNumber('');
          setGrnNotes('');
          setGrnLineQtys({});
          void alertAsync('GRN recorded', `${num} saved. Site stock updated.`);
        },
        onError: (e: Error) => void alertAsync('Error', e.message),
      },
    );
  };

  if (isLoading) return <LoadingSkeleton className="h-48 rounded-xl" />;

  return (
    <View className="gap-3">
      {/* Header */}
      <View className="flex-row justify-between items-center">
        <Text className="text-sm font-bold text-text">Requisitions ({requisitions.length})</Text>
        {canCreate && (
          <Button label="+ New Indent" size="sm" onPress={openReqModal} />
        )}
      </View>

      {/* List */}
      {requisitions.length === 0 ? (
        <EmptyState
          title="No requisitions"
          description={canCreate ? 'Tap "+ New Indent" to create a material indent.' : 'No requisitions yet.'}
        />
      ) : (
        requisitions.map((req: Requisition) => (
          <IndentCard
            key={req.id}
            req={req}
            canCreate={canCreate}
            canApprove={canApprove}
            canCreatePO={canCreatePO}
            canCreateBill={canCreateBill}
            materials={materials}
            allReqs={allReqs}
            projectId={projectId}
            router={router}
            pendingAction={pendingAction}
            onSubmit={() => {
              setPendingAction({ id: req.id, kind: 'submit' });
              submitReq.mutate(req.id, {
                onSettled: () => setPendingAction(null),
                onError: (e: Error) => void alertAsync('Error', e.message),
              });
            }}
            onDelete={async () => {
              const ok = await confirmAsync('Delete indent?', `Delete ${req.reqNumber}? This cannot be undone.`);
              if (!ok) return;
              setPendingAction({ id: req.id, kind: 'delete' });
              deleteReq.mutate(req.id, {
                onSettled: () => setPendingAction(null),
                onError: (e: Error) => void alertAsync('Error', e.message),
              });
            }}
            onApprove={() => {
              setPendingAction({ id: req.id, kind: 'approve' });
              approveReq.mutate(req.id, {
                onSettled: () => setPendingAction(null),
                onError: (e: Error) => void alertAsync('Error', e.message),
              });
            }}
            onCreatePO={() => {
              const rates: Record<string, string> = {};
              req.lines.forEach((line: Requisition['lines'][number]) => {
                rates[line.id] = line.expectedRate ? String(parseFloat(line.expectedRate)) : '';
              });
              setPoNumber(suggestPoNumber(req, allReqs));
              setVendorName('');
              setPoLineRates(rates);
              setPoModal(req);
            }}
            onRecordGRN={(po) => {
              const boqByResource = new Map(
                req.lines.filter((l) => l.boqItem).map((l) => [l.resourceId, l.boqItem]),
              );
              const remaining = poRemainingByResource(po);
              const modalLines = po.lines.map((line) => ({
                lineId: line.id,
                resourceId: line.resourceId,
                resourceName: line.resource.name,
                unit: line.unit || line.resource.unit,
                poQty: parseFloat(line.quantity) || 0,
                remainingQty: remaining.get(line.resourceId) ?? (parseFloat(line.quantity) || 0),
                boqItem: boqByResource.get(line.resourceId) ?? null,
              }));
              const qtys: Record<string, string> = {};
              modalLines.forEach((l) => {
                if (l.remainingQty > 0) qtys[l.lineId] = String(l.remainingQty);
              });
              setGrnNumber(suggestGrnNumber(po.poNumber));
              setGrnNotes('');
              setGrnLineQtys(qtys);
              setGrnModal({ poId: po.id, poNumber: po.poNumber, lines: modalLines });
            }}
          />
        ))
      )}

      {/* New Indent Modal */}
      <AdaptiveSheet
        visible={reqModal}
        onClose={() => { setReqModal(false); resetReqForm(); }}
        title="New Indent"
        size="lg"
        footer={<Button label="Create" loading={createReq.isPending} onPress={onCreateReq} />}
      >
        <Text className="text-xs text-muted">
          Req Number will be auto-generated (e.g. IND-2026-0001) on save.
        </Text>
        <Input label="Notes" value={reqNotes} onChangeText={setReqNotes} multiline />
        <Text className="text-sm font-bold text-text">Line items</Text>
        {draftLines.map((line, idx) => (
          <IndentDraftLineCard
            key={line.id}
            projectId={projectId}
            index={idx}
            line={line}
            materials={materials}
            boqItems={boqItems}
            shortfalls={shortfalls}
            canRemove={draftLines.length > 1}
            onChange={(updated) => updateDraftLine(line.id, updated)}
            onRemove={() => removeDraftLine(line.id)}
            stockByResource={stockByResource}
            // Auto-explode composite BOQ items (with rate analysis) into
            // separate material lines. Each material gets its own line card
            // with editable quantity and rate.
            onExplode={(explodedLines) => {
              setDraftLines((prev) => {
                // Replace the current line with the exploded lines,
                // keeping a fresh empty line at the end for adding more.
                const filtered = prev.filter((l) => l.id !== line.id);
                return [...filtered, ...explodedLines, emptyIndentLine()];
              });
            }}
          />
        ))}
        <Pressable onPress={() => setDraftLines((prev) => [...prev, emptyIndentLine()])}>
          <Text className="text-primary text-sm font-semibold">+ Add line</Text>
        </Pressable>
        <View className="rounded-lg bg-primary/10 p-3 flex-row justify-between items-center">
          <Text className="text-sm font-semibold text-text">
            {draftLineCount} item{draftLineCount === 1 ? '' : 's'} · est. total
          </Text>
          <Text className="text-base font-bold text-primary">Rs {draftTotal.toFixed(0)}</Text>
        </View>
      </AdaptiveSheet>

      {/* PO Modal */}
      <AdaptiveSheet
        visible={!!poModal}
        onClose={() => { setPoModal(null); setPoNumber(''); setVendorName(''); setPoLineRates({}); }}
        title="Create Purchase Order"
        size="lg"
        footer={<Button label="Create PO" loading={createPO.isPending} onPress={onCreatePO} />}
      >
        <Input label="PO Number" value={poNumber} onChangeText={setPoNumber} placeholder="PO-002" />
        <Input label="Vendor" value={vendorName} onChangeText={setVendorName} placeholder="Supplier name" />
        {poModal?.lines.map((l: Requisition['lines'][number]) => (
          <View key={l.id} className="py-2 border-b border-border/60">
            <Text className="text-sm font-medium text-text">{l.resource?.name ?? 'Material'}</Text>
            {l.boqItem ? (
              <Text className="text-[10px] text-muted mb-1">BOQ {l.boqItem.itemCode} · {l.boqItem.description}</Text>
            ) : null}
            <Text className="text-xs text-muted mb-1">
              Qty {parseFloat(l.quantity)} {l.unit}
              {l.rateSource ? ` · rate from ${RATE_SOURCE_LABEL[l.rateSource] ?? l.rateSource}` : ''}
            </Text>
            <Input
              label="PO unit rate (₹)"
              value={poLineRates[l.id] ?? ''}
              onChangeText={(v) => setPoLineRates((prev) => ({ ...prev, [l.id]: v }))}
              keyboardType="numeric"
              placeholder={l.expectedRate ? String(parseFloat(l.expectedRate)) : '0'}
            />
          </View>
        ))}
      </AdaptiveSheet>

      {/* GRN Modal */}
      <AdaptiveSheet
        visible={!!grnModal}
        onClose={() => { setGrnModal(null); setGrnNumber(''); setGrnNotes(''); setGrnLineQtys({}); }}
        title={grnModal ? `Record GRN for ${grnModal.poNumber}` : 'Record GRN'}
        size="lg"
        footer={<Button label="Record GRN" loading={createGRN.isPending} onPress={onCreateGRN} />}
      >
        <Input label="GRN Number" value={grnNumber} onChangeText={setGrnNumber} placeholder="GRN-002" />
        <Input label="Notes (optional)" value={grnNotes} onChangeText={setGrnNotes} multiline />
        <Text className="text-sm font-bold text-text mt-2">PO line items</Text>
        {grnModal?.lines.map((line) => (
          <View key={line.lineId} className="py-2 border-b border-border/60">
            <Text className="text-sm font-medium text-text">{line.resourceName}</Text>
            {line.boqItem ? (
              <Text className="text-[10px] text-muted mb-1">BOQ {line.boqItem.itemCode} · {line.boqItem.description}</Text>
            ) : null}
            <Text className="text-xs text-muted mb-1">
              Ordered {line.poQty} {line.unit}
              {line.remainingQty < line.poQty ? ` · remaining ${line.remainingQty}` : ''}
            </Text>
            <Input
              label={`Qty received (${line.unit})`}
              value={grnLineQtys[line.lineId] ?? ''}
              onChangeText={(v) => setGrnLineQtys((prev) => ({ ...prev, [line.lineId]: v }))}
              keyboardType="numeric"
              placeholder={String(line.remainingQty)}
            />
          </View>
        ))}
      </AdaptiveSheet>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Indent Card                                                         */
/* ------------------------------------------------------------------ */

function IndentCard({
  req,
  canCreate,
  canApprove,
  canCreatePO,
  canCreateBill,
  materials,
  allReqs,
  projectId,
  router,
  pendingAction,
  onSubmit,
  onDelete,
  onApprove,
  onCreatePO,
  onRecordGRN,
}: {
  req: Requisition;
  canCreate: boolean;
  canApprove: boolean;
  canCreatePO: boolean;
  canCreateBill: boolean;
  materials: Resource[];
  allReqs: Requisition[];
  projectId: string;
  router: ReturnType<typeof useRouter>;
  pendingAction: { id: string; kind: 'submit' | 'approve' | 'delete' } | null;
  onSubmit: () => void;
  onDelete: () => void;
  onApprove: () => void;
  onCreatePO: () => void;
  onRecordGRN: (po: PurchaseOrderSummary) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const hasPOs = (req.purchaseOrders?.length ?? 0) > 0;
  const hasGRNs = req.purchaseOrders?.some((po) => (po.goodsReceipts?.length ?? 0) > 0) ?? false;
  const busy = pendingAction !== null && pendingAction.id === req.id;
  const otherBusy = pendingAction !== null && pendingAction.id !== req.id;

  return (
    <Card>
      {/* Header row */}
      <Pressable onPress={() => setExpanded(!expanded)} className="active:opacity-80">
        <View className="flex-row justify-between items-start mb-1">
          <View className="flex-1 pr-2">
            <Text className="text-sm font-semibold text-text">{req.reqNumber}</Text>
            {sourceBadge(req) ? (
              <Text className="text-[10px] text-primary font-semibold">{sourceBadge(req)}</Text>
            ) : null}
            <Text className="text-xs text-muted">
              {req.lines.length} items · {formatDate(req.createdAt)}
            </Text>
          </View>
          <View className="items-end gap-1">
            <Badge color={STATUS_COLOR[req.status] ?? 'neutral'} label={req.status} />
            <Text className="text-[10px] text-muted">{expanded ? '▲' : '▼'}</Text>
          </View>
        </View>
      </Pressable>

      {/* Expanded content */}
      {expanded && (
        <View className="mt-2 pt-2 border-t border-border gap-1">
          {req.lines.map((l: Requisition['lines'][number]) => {
            const qty = parseFloat(l.quantity);
            const rate = l.expectedRate ? parseFloat(l.expectedRate) : null;
            const lineTotal = rate != null ? qty * rate : null;
            return (
              <View key={l.id}>
                <Text className="text-xs text-text">
                  · {l.resource?.name ?? 'Material'} — {qty} {l.unit}
                  {lineTotal != null ? ` · Rs ${lineTotal.toFixed(0)}` : ''}
                </Text>
                {l.boqItem ? (
                  <Text className="text-[10px] text-muted ml-2">
                    BOQ {l.boqItem.itemCode} · {l.boqItem.description}
                  </Text>
                ) : null}
              </View>
            );
          })}

          {/* POs */}
          {req.purchaseOrders?.map((po: PurchaseOrderSummary) => (
            <View key={po.id} className="mt-2 p-2 rounded-lg bg-surface border border-border/50">
              <View className="flex-row justify-between items-center mb-1">
                <Text className="text-xs font-semibold text-text">PO {po.poNumber}</Text>
                <Badge label={po.status} color="neutral" />
              </View>
              <Text className="text-[10px] text-muted">
                {po.lines.length} item{po.lines.length === 1 ? '' : 's'}
              </Text>

              {/* GRNs */}
              {po.goodsReceipts?.map((grn) => (
                <View key={grn.id} className="mt-1 rounded-md bg-success/10 px-2 py-1">
                  <Text className="text-xs font-semibold text-success">
                    ✓ {grn.grnNumber} · {formatDate(grn.receivedDate)}
                  </Text>
                  {grn.lines.map((line, idx) => (
                    <Text key={`${grn.id}-${idx}`} className="text-[10px] text-muted ml-1">
                      {parseFloat(line.quantity)} {line.unit} received
                    </Text>
                  ))}
                </View>
              ))}

              {/* Actions per PO */}
              <View className="flex-row gap-2 mt-1.5 flex-wrap">
                {/* PROC-B6: Show vendor bill status badge */}
                {(po.bills?.length ?? 0) > 0 ? (
                  <Badge
                    label={`Vendor bill: ${po.bills![0]!.status}`}
                    color="success"
                  />
                ) : (po.goodsReceipts?.length ?? 0) > 0 ? (
                  <Badge label="Vendor bill pending" color="warning" />
                ) : null}
                {canCreate && poAvailableForNewGrn(po) && (
                  <Button
                    label="Record GRN"
                    size="sm"
                    variant="secondary"
                    disabled={otherBusy}
                    onPress={() => onRecordGRN(po)}
                  />
                )}
                {/* PROC-B1: "Record vendor bill" (was "Create Bill") — only show if no bill yet */}
                {canCreateBill && (po.goodsReceipts?.length ?? 0) > 0 && !(po.bills?.length) && (
                  <Button
                    label="Record vendor bill"
                    size="sm"
                    variant="secondary"
                    onPress={() => {
                      const returnTo = encodeURIComponent(projectTabHref(projectId, 'procurement'));
                      const vendor = po.vendorName || 'Vendor';
                      const vendorGstin = po.vendorGstin || '';
                      router.push(
                        `/accounting/create-bill?projectId=${projectId}&purchaseOrderId=${po.id}&vendorName=${encodeURIComponent(vendor)}&vendorGstin=${encodeURIComponent(vendorGstin)}&category=MATERIAL&poNumber=${encodeURIComponent(po.poNumber)}&returnTo=${returnTo}` as never,
                      );
                    }}
                  />
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Action buttons */}
      <View className="flex-row gap-2 mt-2 flex-wrap">
        {canCreate && (req.status === 'DRAFT' || req.status === 'REJECTED') && (
          <Button
            label="Submit"
            size="sm"
            variant="secondary"
            loading={busy && pendingAction.kind === 'submit'}
            disabled={otherBusy}
            onPress={onSubmit}
          />
        )}
        {canCreate && req.status === 'DRAFT' && !hasPOs && (
          <Button
            label="Delete"
            size="sm"
            variant="ghost"
            loading={busy && pendingAction.kind === 'delete'}
            disabled={otherBusy}
            onPress={onDelete}
          />
        )}
        {canApprove && req.status === 'SUBMITTED' && (
          <Button
            label="Approve"
            size="sm"
            loading={busy && pendingAction.kind === 'approve'}
            disabled={otherBusy}
            onPress={onApprove}
          />
        )}
        {canCreatePO && req.status === 'APPROVED' && !hasPOs && (
          <Button label="Create PO" size="sm" disabled={otherBusy} onPress={onCreatePO} />
        )}
      </View>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Stock Section                                                       */
/* ------------------------------------------------------------------ */

function StockSection({ projectId }: { projectId: string }) {
  const { isDesktop } = useViewport();
  const stockSummaryQ = useStockSummary(projectId);
  const [stockHistoryResource, setStockHistoryResource] = useState<StockSummaryRow | null>(null);
  const movementsQ = useStockMovements(projectId, stockHistoryResource?.resourceId);

  const stockSummary = stockSummaryQ.data ?? [];

  if (stockSummaryQ.isLoading) return <LoadingSkeleton className="h-24 rounded-xl" />;

  return (
    <View className="gap-3">
      <Text className="text-sm font-bold text-text">Site Stock</Text>
      <Text className="text-xs text-muted">
        On hand = received (GRN) minus issued (daily reports). Tap a material for history.
      </Text>

      {stockSummary.length === 0 ? (
        <EmptyState
          title="No stock"
          description="Stock appears after GRN receipts."
        />
      ) : (
        <Card>
          {stockSummary.map((row: StockSummaryRow) => (
            <Pressable
              key={row.resourceId}
              onPress={() => setStockHistoryResource(row)}
              className="py-2 border-b border-border/50 active:bg-surface"
            >
              <View className="flex-row justify-between items-center mb-0.5">
                <Text className="text-sm font-semibold text-text">{row.name}</Text>
                <Text className="text-sm font-bold text-primary">
                  {row.balance} {row.unit}
                </Text>
              </View>
              <View className="flex-row gap-3">
                <Text className="text-xs text-muted">Rcvd {row.received} {row.unit}</Text>
                <Text className="text-xs text-muted">Issued {row.issued} {row.unit}</Text>
              </View>
            </Pressable>
          ))}
        </Card>
      )}

      {/* Movement history sheet */}
      <AdaptiveSheet
        visible={!!stockHistoryResource}
        onClose={() => setStockHistoryResource(null)}
        title={stockHistoryResource ? `${stockHistoryResource.name} — movements` : 'Movements'}
        size="md"
      >
        {stockHistoryResource ? (
          <View className="gap-2 pb-4">
            <View className="flex-row flex-wrap gap-3 mb-2">
              <Text className="text-xs text-muted">Received: {stockHistoryResource.received} {stockHistoryResource.unit}</Text>
              <Text className="text-xs text-muted">Issued: {stockHistoryResource.issued} {stockHistoryResource.unit}</Text>
              <Text className="text-xs font-semibold text-text">On hand: {stockHistoryResource.balance} {stockHistoryResource.unit}</Text>
            </View>
            {movementsQ.isLoading ? (
              <LoadingSkeleton className="h-32 rounded-xl" />
            ) : (movementsQ.data ?? []).length === 0 ? (
              <Text className="text-sm text-muted">No movements recorded yet.</Text>
            ) : (
              (movementsQ.data ?? []).map((m: StockMovementRow) => (
                <View key={m.id} className="py-2 border-b border-border/50">
                  <View className="flex-row items-center gap-2">
                    <Badge label={m.type} color={m.type === 'IN' ? 'success' : m.type === 'OUT' ? 'warning' : 'neutral'} />
                    <Text className="text-sm font-semibold text-text">{m.quantity} {m.unit}</Text>
                  </View>
                  {m.referenceLabel ? <Text className="text-xs text-primary mt-0.5">{m.referenceLabel}</Text> : null}
                  <Text className="text-[10px] text-muted mt-0.5">
                    {formatDate(m.createdAt)}{m.locationName ? ` · ${m.locationName}` : ''}
                  </Text>
                </View>
              ))
            )}
          </View>
        ) : null}
      </AdaptiveSheet>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Shortfalls Section                                                  */
/* ------------------------------------------------------------------ */

function ShortfallsSection({ projectId, canCreate }: { projectId: string; canCreate: boolean }) {
  const shortfallsQ = useBoqShortfalls(projectId, true);
  const generateFromBoq = useGenerateIndentsFromBoq(projectId);
  const shortfalls = shortfallsQ.data ?? [];

  const onGenerate = async () => {
    if (shortfalls.length === 0) {
      void alertAsync('No shortfalls', 'All MATERIAL BOQ lines are covered by stock and open indents.');
      return;
    }
    const ok = await confirmAsync(
      'Generate indents from BOQ',
      `Create ${shortfalls.length} draft indent(s) for BOQ material shortfalls?`,
    );
    if (!ok) return;
    generateFromBoq.mutate(undefined, {
      onSuccess: (result) => {
        void alertAsync(
          'Indents created',
          result.created > 0
            ? `Created ${result.created} draft indent(s): ${result.reqNumbers.join(', ')}`
            : 'No new indents needed.',
        );
      },
      onError: (e: Error) => void alertAsync('Error', e.message),
    });
  };

  if (shortfallsQ.isLoading) return <LoadingSkeleton className="h-32 rounded-xl" />;

  return (
    <View className="gap-3">
      <View>
        <View className="flex-row justify-between items-center mb-1">
          <Text className="text-sm font-bold text-text">BOQ Material Shortfalls</Text>
          {canCreate && shortfalls.length > 0 && (
            <Button
              label="Generate Indents"
              size="sm"
              loading={generateFromBoq.isPending}
              onPress={() => void onGenerate()}
            />
          )}
        </View>
        {/* R13-VO3: Clarify that shortfalls include approved variation quantities. */}
        <Text className="text-xs text-muted mb-2">
          Uses current BOQ qty (includes converted variations). Generate indents here after converting a variation to BOQ.
        </Text>
      </View>

      <Text className="text-xs text-muted">
        Materials needed for BOQ execution that aren't covered by stock or open indents.
      </Text>

      {shortfalls.length === 0 ? (
        <EmptyState
          title="No shortfalls"
          description="All BOQ materials are covered by stock and open indents."
        />
      ) : (
        shortfalls.map((s: BoqShortfall, idx: number) => (
          <Card key={idx}>
            <View className="flex-row justify-between items-start">
              <View className="flex-1 pr-2">
                <Text className="text-sm font-semibold text-text">{s.itemCode}</Text>
                <Text className="text-xs text-muted" numberOfLines={1}>{s.description}</Text>
              </View>
              <Badge label={`Shortfall: ${s.shortfall} ${s.unit ?? ''}`} color="warning" />
            </View>
          </Card>
        ))
      )}
    </View>
  );
}