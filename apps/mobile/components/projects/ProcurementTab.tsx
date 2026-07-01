import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
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
import { formatDate } from '@/utils/format';
import { projectTabHref } from '@/utils/navigation';
import {
  useRequisitions,
  useCreateRequisition,
  useSubmitRequisition,
  useApproveRequisition,
  useCreatePurchaseOrder,
  useCreateGRN,
  useStockSummary,
  useStockMovements,
  useBoqShortfalls,
  useGenerateIndentsFromBoq,
  type Requisition,
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

const STEPS = [
  { key: 'indent', label: 'Indent', sub: 'Material requisition' },
  { key: 'po', label: 'PO', sub: 'Purchase order' },
  { key: 'grn', label: 'GRN', sub: 'Goods receipt' },
] as const;

function suggestPoNumber(req: Requisition, allReqs: Requisition[]): string {
  const used = new Set(
    allReqs.flatMap((r) => r.purchaseOrders?.map((po) => po.poNumber) ?? []),
  );
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

type GrnModalLine = {
  lineId: string;
  resourceId: string;
  resourceName: string;
  unit: string;
  poQty: number;
  boqItem?: { itemCode: string; description: string } | null;
};

type GrnModalState = {
  poId: string;
  poNumber: string;
  lines: GrnModalLine[];
};

function buildGrnModalLines(
  po: PurchaseOrderSummary,
  reqLines: Requisition['lines'],
): GrnModalLine[] {
  const boqByResource = new Map(
    reqLines.filter((l) => l.boqItem).map((l) => [l.resourceId, l.boqItem]),
  );
  return po.lines.map((line) => ({
    lineId: line.id,
    resourceId: line.resourceId,
    resourceName: line.resource.name,
    unit: line.unit || line.resource.unit,
    poQty: parseFloat(line.quantity) || 0,
    boqItem: boqByResource.get(line.resourceId) ?? null,
  }));
}

/** Extract vendor name from a requisition's first PO (fallback to "Vendor"). */
function vendorNameForPo(req: Requisition): string {
  return req.purchaseOrders?.[0]?.poNumber
    ? `Vendor (${req.purchaseOrders[0].poNumber})`
    : 'Vendor';
}

function requisitionWorkflowHint(
  req: Requisition,
  opts: { canCreate: boolean; canApprove: boolean; canCreatePO: boolean },
): string | null {
  if (req.status === 'DRAFT' || req.status === 'REJECTED') {
    return opts.canCreate ? 'Next: Submit indent' : 'Waiting for site team to submit';
  }
  if (req.status === 'SUBMITTED') {
    return opts.canApprove ? 'Next: Approve indent' : 'Waiting for PM/Owner approval';
  }
  if (req.status === 'APPROVED' && !req.purchaseOrders?.length) {
    return opts.canCreatePO
      ? 'Next: Create purchase order'
      : 'Approved - waiting for PM/Accounts to create PO';
  }
  if (req.purchaseOrders?.length) {
    const hasGrn = req.purchaseOrders.some((po) => (po.goodsReceipts?.length ?? 0) > 0);
    if (hasGrn) {
      return 'Goods received - see Site stock below; BOQ executed qty updates via measurements or daily reports';
    }
    return 'Next: Record GRN when goods arrive (updates site stock, not BOQ executed qty)';
  }
  return null;
}

export function ProcurementTab({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { isDesktop } = useViewport();
  const user = useAuthStore((s) => s.user);
  const canCreate = user?.role === 'OWNER' || user?.role === 'PM' || user?.role === 'SUPERVISOR';
  const canApprove = user?.role === 'OWNER' || user?.role === 'PM';
  const canCreatePO =
    user?.role === 'OWNER' || user?.role === 'PM' || user?.role === 'ACCOUNTANT';
  const canCreateBill =
    user?.role === 'OWNER' || user?.role === 'PM' || user?.role === 'ACCOUNTANT';

  const reqQ = useRequisitions(projectId);
  const stockSummaryQ = useStockSummary(projectId);
  const { data: boq } = useBoq(projectId);
  const { data: materialsData } = useMaterials({ limit: 200 });
  const materials: Resource[] = materialsData?.data ?? [];
  const boqItems = boq?.items ?? [];

  const createReq = useCreateRequisition(projectId);
  const submitReq = useSubmitRequisition(projectId);
  const approveReq = useApproveRequisition(projectId);
  const createPO = useCreatePurchaseOrder(projectId);
  const createGRN = useCreateGRN(projectId);
  const generateFromBoq = useGenerateIndentsFromBoq(projectId);

  const [reqModal, setReqModal] = useState(false);
  const [poModal, setPoModal] = useState<Requisition | null>(null);
  const [grnModal, setGrnModal] = useState<GrnModalState | null>(null);

  const [reqNumber, setReqNumber] = useState('');
  const [reqNotes, setReqNotes] = useState('');
  const [draftLines, setDraftLines] = useState<IndentDraftLine[]>([emptyIndentLine()]);

  const [poNumber, setPoNumber] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [poLineRates, setPoLineRates] = useState<Record<string, string>>({});

  const shortfallsQ = useBoqShortfalls(projectId, reqModal || canCreate);
  const shortfalls = shortfallsQ.data ?? [];
  const linkableBoqItems = boqItems;

  const draftTotal = useMemo(
    () => draftLines.reduce((sum, l) => sum + indentLineTotal(l), 0),
    [draftLines],
  );
  const draftLineCount = draftLines.filter((l) => l.resourceId).length;

  const resetReqForm = () => {
    setReqNumber('');
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

  const onGenerateFromBoq = async () => {
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
            : 'No new indents needed - stock and open requisitions cover BOQ demand.',
        );
      },
      onError: (e: Error) => void alertAsync('Error', e.message),
    });
  };

  const [grnNumber, setGrnNumber] = useState('');
  const [grnNotes, setGrnNotes] = useState('');
  const [grnLineQtys, setGrnLineQtys] = useState<Record<string, string>>({});
  const [stockHistoryResource, setStockHistoryResource] = useState<StockSummaryRow | null>(null);

  const movementsQ = useStockMovements(projectId, stockHistoryResource?.resourceId);

  const requisitions = reqQ.data ?? [];
  const stockSummary = stockSummaryQ.data ?? [];

  const activeStep = requisitions.some((r: Requisition) => r.purchaseOrders?.length)
    ? requisitions.some((r: Requisition) => r.status === 'APPROVED')
      ? 2
      : 1
    : 0;

  const onCreateReq = () => {
    if (!reqNumber.trim()) {
      void alertAsync('Required', 'Enter requisition number.');
      return;
    }
    const validLines = draftLines.filter((l) => l.resourceId);
    if (validLines.length === 0) {
      void alertAsync('Required', 'Add at least one line with a material selected.');
      return;
    }
    const missingMaterial = validLines.find((l) => !materials.some((m) => m.id === l.resourceId));
    if (missingMaterial) {
      void alertAsync('Required', 'One or more selected materials could not be resolved.');
      return;
    }
    createReq.mutate(
      {
        reqNumber: reqNumber.trim(),
        notes: reqNotes.trim() || undefined,
        lines: validLines.map((l) => {
          const res = materials.find((r: Resource) => r.id === l.resourceId)!;
          return {
            resourceId: res.id,
            quantity: parseFloat(l.qty) || 1,
            unit: res.unit,
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
        materialName: line.resourceName,
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
        lines: lines.map(({ materialName: _n, ...line }) => line),
      },
      {
        onSuccess: () => {
          const num = grnNumber.trim();
          setGrnModal(null);
          setGrnNumber('');
          setGrnNotes('');
          setGrnLineQtys({});
          void alertAsync(
            'GRN recorded',
            `${num} saved. Site stock updated - scroll to Site stock below. BOQ executed qty is updated separately via measurements or daily reports.`,
          );
        },
        onError: (e: Error) => void alertAsync('Error', e.message),
      },
    );
  };

  if (reqQ.isLoading) return <LoadingSkeleton className="h-48 rounded-xl" />;

  return (
    <View className="gap-4">
      {/* Step cards */}
      <View className={`gap-2 ${isDesktop ? 'flex-row' : ''}`}>
        {STEPS.map((step, idx) => (
          <Card key={step.key} className={isDesktop ? 'flex-1' : undefined}>
            <View className="flex-row items-center gap-2">
              <View
                className={`w-8 h-8 rounded-full items-center justify-center ${
                  idx <= activeStep ? 'bg-primary' : 'bg-border'
                }`}
              >
                <Text className={`text-sm font-bold ${idx <= activeStep ? 'text-white' : 'text-muted'}`}>
                  {idx + 1}
                </Text>
              </View>
              <View>
                <Text className="text-sm font-semibold text-text">{step.label}</Text>
                <Text className="text-xs text-muted">{step.sub}</Text>
              </View>
            </View>
          </Card>
        ))}
      </View>

      <View className="flex-row justify-between items-center flex-wrap gap-2">
        <Text className="text-sm font-bold text-text">Requisitions</Text>
        {canCreate && (
          <View className="flex-row gap-2">
            {shortfalls.length > 0 && (
              <Button
                label="Generate from BOQ"
                size="sm"
                variant="secondary"
                loading={generateFromBoq.isPending}
                onPress={() => void onGenerateFromBoq()}
              />
            )}
            <Button label="New Indent" size="sm" onPress={openReqModal} />
          </View>
        )}
      </View>

      {requisitions.length === 0 ? (
        <EmptyState
          title="No requisitions"
          description="Start the procurement flow with a material indent."
          action={
            canCreate ? (
              <Button label="Create Indent" onPress={openReqModal} />
            ) : undefined
          }
        />
      ) : (
        requisitions.map((req: Requisition) => {
          const workflowHint = requisitionWorkflowHint(req, { canCreate, canApprove, canCreatePO });
          return (
          <Card key={req.id}>
            <View className="flex-row justify-between items-start mb-1">
              <Text className="text-sm font-semibold text-text">{req.reqNumber}</Text>
              <Badge color={STATUS_COLOR[req.status] ?? 'neutral'} label={req.status} />
            </View>
            {sourceBadge(req) ? (
              <Text className="text-[10px] text-primary font-semibold mb-1">{sourceBadge(req)}</Text>
            ) : null}
            <Text className="text-xs text-muted mb-2">
              {req.lines.length} items • {formatDate(req.createdAt)}
            </Text>
            {workflowHint ? (
              <Text className="text-[10px] text-muted mb-2">{workflowHint}</Text>
            ) : null}
            {req.lines.map((l: Requisition['lines'][number]) => {
              const qty = parseFloat(l.quantity);
              const rate = l.expectedRate ? parseFloat(l.expectedRate) : null;
              const lineTotal = rate != null ? qty * rate : null;
              return (
                <View key={l.id} className="mb-1">
                  <Text className="text-xs text-text">
                    • {l.resource?.name ?? 'Material'} - {qty} {l.unit}
                    {lineTotal != null ? ` · est. Rs ${lineTotal.toFixed(0)}` : ''}
                  </Text>
                  {l.boqItem ? (
                    <Text className="text-[10px] text-muted ml-2">
                      BOQ {l.boqItem.itemCode} - {l.boqItem.description}
                    </Text>
                  ) : null}
                  {l.rateSource ? (
                    <Text className="text-[10px] text-primary ml-2">
                      Rate Rs {rate ?? '-'} ({RATE_SOURCE_LABEL[l.rateSource] ?? l.rateSource})
                    </Text>
                  ) : null}
                </View>
              );
            })}
            {req.purchaseOrders?.map((po: PurchaseOrderSummary) => (
              <View key={po.id} className="mt-2 pt-2 border-t border-border">
                <Text className="text-xs text-muted">
                  PO {po.poNumber} ({po.status}) · {po.lines.length} item{po.lines.length === 1 ? '' : 's'}
                </Text>
                {po.goodsReceipts?.map((grn) => (
                  <View key={grn.id} className="mt-1 rounded-md bg-success/10 px-2 py-1">
                    <Text className="text-xs font-semibold text-success">
                      ✓ {grn.grnNumber} · received {formatDate(grn.receivedDate)}
                    </Text>
                    {grn.lines.map((line, idx) => (
                      <Text key={`${grn.id}-${idx}`} className="text-[10px] text-muted ml-1">
                        {parseFloat(line.quantity)} {line.unit} received
                      </Text>
                    ))}
                  </View>
                ))}
                {canCreate && po.status !== 'CANCELLED' && !(po.goodsReceipts?.length ?? 0) && (
                  <View className="mt-1">
                    <Button
                      label="Record GRN"
                      size="sm"
                      variant="secondary"
                      onPress={() => {
                        const modalLines = buildGrnModalLines(po, req.lines);
                        const qtys: Record<string, string> = {};
                        modalLines.forEach((l) => {
                          qtys[l.lineId] = String(l.poQty);
                        });
                        setGrnNumber(suggestGrnNumber(po.poNumber));
                        setGrnNotes('');
                        setGrnLineQtys(qtys);
                        setGrnModal({
                          poId: po.id,
                          poNumber: po.poNumber,
                          lines: modalLines,
                        });
                      }}
                    />
                  </View>
                )}
                {canCreateBill && (po.goodsReceipts?.length ?? 0) > 0 && (
                  <View className="mt-1">
                    <Button
                      label="Create Bill"
                      size="sm"
                      variant="secondary"
                      onPress={() => {
                        const returnTo = encodeURIComponent(projectTabHref(projectId, 'procurement'));
                        const vendor = encodeURIComponent(vendorNameForPo(req) || 'Vendor');
                        const billNum = encodeURIComponent(`BILL-${po.poNumber.replace(/^PO-/, '')}`);
                        router.push(
                          `/accounting/create-bill?projectId=${projectId}&vendorName=${vendor}&category=MATERIAL&suggestedBillNumber=${billNum}&returnTo=${returnTo}` as never,
                        );
                      }}
                    />
                  </View>
                )}
              </View>
            ))}
            <View className={`mt-2 gap-2 ${isDesktop ? 'flex-row' : ''}`}>
              {canCreate && (req.status === 'DRAFT' || req.status === 'REJECTED') && (
                <Button
                  label="Submit"
                  size="sm"
                  variant="secondary"
                  onPress={() =>
                    submitReq.mutate(req.id, {
                      onError: (e: Error) => void alertAsync('Error', e.message),
                    })
                  }
                />
              )}
              {canApprove && req.status === 'SUBMITTED' && (
                <Button
                  label="Approve"
                  size="sm"
                  onPress={() =>
                    approveReq.mutate(req.id, {
                      onError: (e: Error) => void alertAsync('Error', e.message),
                    })
                  }
                />
              )}
              {canCreatePO && req.status === 'APPROVED' && !req.purchaseOrders?.length && (
                <Button
                  label="Create PO"
                  size="sm"
                  onPress={() => {
                    const rates: Record<string, string> = {};
                    req.lines.forEach((line: Requisition['lines'][number]) => {
                      rates[line.id] = line.expectedRate
                        ? String(parseFloat(line.expectedRate))
                        : '';
                    });
                    setPoNumber(suggestPoNumber(req, requisitions));
                    setVendorName('');
                    setPoLineRates(rates);
                    setPoModal(req);
                  }}
                />
              )}
            </View>
          </Card>
          );
        })
      )}

      {/* Site stock summary */}
      <Text className="text-sm font-bold text-text mt-2">Site stock</Text>
      <Text className="text-xs text-muted mb-1">
        On hand = received (GRN) minus issued (daily reports with &quot;Deduct from site stock&quot;).
      </Text>
      {stockSummaryQ.isLoading ? (
        <LoadingSkeleton className="h-24 rounded-xl" />
      ) : stockSummary.length === 0 ? (
        <EmptyState
          title="No stock"
          description="Stock appears after GRN receipts. Issued increases when daily reports deduct site stock."
        />
      ) : (
        <Card>
          {isDesktop ? (
            <View className="flex-row border-b border-border pb-2 mb-2">
              <Text className="text-xs font-semibold text-muted flex-[2]">Material</Text>
              <Text className="text-xs font-semibold text-muted flex-1 text-right">Received</Text>
              <Text className="text-xs font-semibold text-muted flex-1 text-right">Issued</Text>
              <Text className="text-xs font-semibold text-muted flex-1 text-right">On hand</Text>
            </View>
          ) : null}
          {stockSummary.map((row: StockSummaryRow) => (
            <Pressable
              key={row.resourceId}
              onPress={() => setStockHistoryResource(row)}
              className="py-2 border-b border-border/50 active:bg-surface"
            >
              {isDesktop ? (
                <View className="flex-row items-center">
                  <Text className="text-sm text-text flex-[2]" numberOfLines={1}>
                    {row.name}
                  </Text>
                  <Text className="text-sm text-muted flex-1 text-right">
                    {row.received} {row.unit}
                  </Text>
                  <Text className="text-sm text-muted flex-1 text-right">
                    {row.issued} {row.unit}
                  </Text>
                  <Text className="text-sm font-semibold text-text flex-1 text-right">
                    {row.balance} {row.unit}
                  </Text>
                </View>
              ) : (
                <View>
                  <Text className="text-sm font-semibold text-text">{row.name}</Text>
                  <View className="flex-row flex-wrap gap-x-3 mt-0.5">
                    <Text className="text-xs text-muted">Rcvd {row.received} {row.unit}</Text>
                    <Text className="text-xs text-muted">Issued {row.issued} {row.unit}</Text>
                    <Text className="text-xs font-semibold text-primary">
                      On hand {row.balance} {row.unit}
                    </Text>
                  </View>
                </View>
              )}
              <Text className="text-[10px] text-primary mt-0.5">Tap for movement history</Text>
            </Pressable>
          ))}
        </Card>
      )}

      <AdaptiveSheet
        visible={!!stockHistoryResource}
        onClose={() => setStockHistoryResource(null)}
        title={stockHistoryResource ? `${stockHistoryResource.name} - movements` : 'Movements'}
        size="md"
      >
        {stockHistoryResource ? (
          <View className="gap-2 pb-4">
            <View className="flex-row flex-wrap gap-3 mb-2">
              <Text className="text-xs text-muted">
                Received: {stockHistoryResource.received} {stockHistoryResource.unit}
              </Text>
              <Text className="text-xs text-muted">
                Issued: {stockHistoryResource.issued} {stockHistoryResource.unit}
              </Text>
              <Text className="text-xs font-semibold text-text">
                On hand: {stockHistoryResource.balance} {stockHistoryResource.unit}
              </Text>
            </View>
            {movementsQ.isLoading ? (
              <LoadingSkeleton className="h-32 rounded-xl" />
            ) : (movementsQ.data ?? []).length === 0 ? (
              <Text className="text-sm text-muted">No movements recorded yet.</Text>
            ) : (
              (movementsQ.data ?? []).map((m: StockMovementRow) => (
                <View
                  key={m.id}
                  className="flex-row items-center justify-between py-2 border-b border-border/50"
                >
                  <View className="flex-1 mr-2">
                    <View className="flex-row items-center gap-2">
                      <Badge
                        label={m.type}
                        color={m.type === 'IN' ? 'success' : m.type === 'OUT' ? 'warning' : 'neutral'}
                      />
                      <Text className="text-sm font-semibold text-text">
                        {m.quantity} {m.unit}
                      </Text>
                    </View>
                    {m.referenceLabel ? (
                      <Text className="text-xs text-primary mt-0.5">{m.referenceLabel}</Text>
                    ) : null}
                    <Text className="text-[10px] text-muted mt-0.5">
                      {formatDate(m.createdAt)}
                      {m.locationName ? ` · ${m.locationName}` : ''}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}
      </AdaptiveSheet>

      <AdaptiveSheet
        visible={reqModal}
        onClose={() => {
          setReqModal(false);
          resetReqForm();
        }}
        title="New Indent"
        size="lg"
        footer={<Button label="Create" loading={createReq.isPending} onPress={onCreateReq} />}
      >
        <Input label="Req Number" value={reqNumber} onChangeText={setReqNumber} placeholder="IND-001" />
        <Input label="Notes" value={reqNotes} onChangeText={setReqNotes} multiline />
        <Text className="text-sm font-bold text-text">Line items</Text>
        <Text className="text-xs text-muted -mt-2">
          Add one or more materials. Each line can optionally link to a BOQ row for traceability.
        </Text>
        {linkableBoqItems.length === 0 ? (
          <Text className="text-xs text-muted">
            No BOQ on this project yet - you can still add materials, or convert an estimate to BOQ
            first.
          </Text>
        ) : null}
        {draftLines.map((line, idx) => (
          <IndentDraftLineCard
            key={line.id}
            projectId={projectId}
            index={idx}
            line={line}
            materials={materials}
            boqItems={linkableBoqItems}
            shortfalls={shortfalls}
            canRemove={draftLines.length > 1}
            onChange={(updated) => updateDraftLine(line.id, updated)}
            onRemove={() => removeDraftLine(line.id)}
          />
        ))}
        <Pressable onPress={() => setDraftLines((prev) => [...prev, emptyIndentLine()])}>
          <Text className="text-primary text-sm font-semibold">+ Add line</Text>
        </Pressable>
        <View className="rounded-lg bg-primary/10 p-3 flex-row justify-between items-center">
          <Text className="text-sm font-semibold text-text">
            {draftLineCount} material{draftLineCount === 1 ? '' : 's'} · est. total
          </Text>
          <Text className="text-base font-bold text-primary">Rs {draftTotal.toFixed(0)}</Text>
        </View>
      </AdaptiveSheet>

      <AdaptiveSheet
        visible={!!poModal}
        onClose={() => {
          setPoModal(null);
          setPoNumber('');
          setVendorName('');
          setPoLineRates({});
        }}
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
              <Text className="text-[10px] text-muted mb-1">
                BOQ {l.boqItem.itemCode} - {l.boqItem.description}
              </Text>
            ) : null}
            <Text className="text-xs text-muted mb-1">
              Qty {parseFloat(l.quantity)} {l.unit}
              {l.rateSource
                ? ` · indent rate from ${RATE_SOURCE_LABEL[l.rateSource] ?? l.rateSource}`
                : ''}
            </Text>
            <Input
              label="PO rate (₹)"
              value={poLineRates[l.id] ?? ''}
              onChangeText={(v) => setPoLineRates((prev) => ({ ...prev, [l.id]: v }))}
              keyboardType="numeric"
              placeholder={l.expectedRate ? String(parseFloat(l.expectedRate)) : '0'}
            />
          </View>
        ))}
      </AdaptiveSheet>

      <AdaptiveSheet
        visible={!!grnModal}
        onClose={() => {
          setGrnModal(null);
          setGrnNumber('');
          setGrnNotes('');
          setGrnLineQtys({});
        }}
        title={grnModal ? `Record GRN for ${grnModal.poNumber}` : 'Record GRN'}
        size="lg"
        footer={<Button label="Record GRN" loading={createGRN.isPending} onPress={onCreateGRN} />}
      >
        <Text className="text-xs text-muted -mt-1 mb-2">
          Enter quantities received against this PO. Stock updates on save; BOQ executed qty is updated
          separately via measurements or DPR.
        </Text>
        <Input label="GRN Number" value={grnNumber} onChangeText={setGrnNumber} placeholder="GRN-002" />
        <Input label="Notes (optional)" value={grnNotes} onChangeText={setGrnNotes} multiline />
        <Text className="text-sm font-bold text-text mt-2">PO line items</Text>
        {grnModal?.lines.map((line) => (
          <View key={line.lineId} className="py-2 border-b border-border/60">
            <Text className="text-sm font-medium text-text">{line.resourceName}</Text>
            {line.boqItem ? (
              <Text className="text-[10px] text-muted mb-1">
                BOQ {line.boqItem.itemCode} - {line.boqItem.description}
              </Text>
            ) : null}
            <Text className="text-xs text-muted mb-1">
              Ordered {line.poQty} {line.unit}
            </Text>
            <Input
              label={`Qty received (${line.unit})`}
              value={grnLineQtys[line.lineId] ?? ''}
              onChangeText={(v) => setGrnLineQtys((prev) => ({ ...prev, [line.lineId]: v }))}
              keyboardType="numeric"
              placeholder={String(line.poQty)}
            />
          </View>
        ))}
      </AdaptiveSheet>
    </View>
  );
}
