import React, { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
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
import {
  useRequisitions,
  useCreateRequisition,
  useSubmitRequisition,
  useApproveRequisition,
  useCreatePurchaseOrder,
  useCreateGRN,
  useStock,
  type Requisition,
  type StockLocation,
  type StockBalance,
} from '@/services/expansion.queries';
import { MaterialPicker } from '@/components/materials/MaterialPicker';
import { useMaterials, type Resource } from '@/services/estimate.queries';
import { useBoq, type BoqItem } from '@/services/boq.queries';
import { useMaterialRate } from '@/services/project.queries';
import { alertAsync } from '@/utils/confirm';
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

export function ProcurementTab({ projectId }: { projectId: string }) {
  const { isDesktop } = useViewport();
  const user = useAuthStore((s) => s.user);
  const canCreate = user?.role === 'OWNER' || user?.role === 'PM' || user?.role === 'SUPERVISOR';
  const canApprove = user?.role === 'OWNER' || user?.role === 'PM';

  const reqQ = useRequisitions(projectId);
  const stockQ = useStock(projectId);
  const { data: boq } = useBoq(projectId);
  const { data: materialsData } = useMaterials({ limit: 200 });
  const materials: Resource[] = materialsData?.data ?? [];
  const boqItems = boq?.items ?? [];

  const createReq = useCreateRequisition(projectId);
  const submitReq = useSubmitRequisition(projectId);
  const approveReq = useApproveRequisition(projectId);
  const createPO = useCreatePurchaseOrder(projectId);
  const createGRN = useCreateGRN(projectId);

  const [reqModal, setReqModal] = useState(false);
  const [poModal, setPoModal] = useState<Requisition | null>(null);
  const [grnModal, setGrnModal] = useState<{ poId: string; poNumber: string } | null>(null);

  const [reqNumber, setReqNumber] = useState('');
  const [reqNotes, setReqNotes] = useState('');
  const [selectedResource, setSelectedResource] = useState('');
  const [selectedBoqItemId, setSelectedBoqItemId] = useState('');
  const [reqQty, setReqQty] = useState('1');
  const [reqExpectedRate, setReqExpectedRate] = useState('');
  const [reqRateSource, setReqRateSource] = useState<string | undefined>();

  const [poNumber, setPoNumber] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [poLineRates, setPoLineRates] = useState<Record<string, string>>({});

  const indentRateQ = useMaterialRate(projectId, selectedResource, {
    boqItemId: selectedBoqItemId || undefined,
    enabled: reqModal && !!selectedResource,
  });

  useEffect(() => {
    if (indentRateQ.data) {
      setReqExpectedRate(String(indentRateQ.data.rate));
      setReqRateSource(indentRateQ.data.source);
    }
  }, [indentRateQ.data?.rate, indentRateQ.data?.source, selectedResource, selectedBoqItemId]);

  const [grnNumber, setGrnNumber] = useState('');
  const [grnQty, setGrnQty] = useState('1');

  const requisitions = reqQ.data ?? [];
  const stockLocations = stockQ.data ?? [];
  const allBalances = stockLocations.flatMap((loc: StockLocation) =>
    loc.balances.map((b: StockBalance) => ({ ...b, locationName: loc.name })),
  );

  const activeStep = requisitions.some((r: Requisition) => r.purchaseOrders?.length)
    ? requisitions.some((r: Requisition) => r.status === 'APPROVED')
      ? 2
      : 1
    : 0;

  const onCreateReq = () => {
    const res = materials.find((r: Resource) => r.id === selectedResource);
    if (!reqNumber.trim() || !res) {
      void alertAsync('Required', 'Enter requisition number and select a material.');
      return;
    }
    createReq.mutate(
      {
        reqNumber: reqNumber.trim(),
        notes: reqNotes.trim() || undefined,
        lines: [
          {
            resourceId: res.id,
            quantity: parseFloat(reqQty) || 1,
            unit: res.unit,
            boqItemId: selectedBoqItemId || undefined,
            expectedRate: parseFloat(reqExpectedRate) || undefined,
            rateSource: reqRateSource as MaterialRateSource | undefined,
          },
        ],
      },
      {
        onSuccess: () => {
          setReqModal(false);
          setReqNumber('');
          setReqNotes('');
          setSelectedBoqItemId('');
          setReqExpectedRate('');
          setReqRateSource(undefined);
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
      const rateStr = poLineRates[l.id] ?? l.expectedRate ?? '0';
      return {
        resourceId: l.resourceId,
        quantity: parseFloat(l.quantity) || 1,
        unit: l.unit || res?.unit || 'unit',
        rate: parseFloat(rateStr) || 0,
      };
    });
    createPO.mutate(
      {
        poNumber: poNumber.trim(),
        vendorName: vendorName.trim(),
        requisitionId: poModal.id,
        lines,
      },
      {
        onSuccess: () => {
          setPoModal(null);
          setPoNumber('');
          setVendorName('');
          setPoLineRates({});
        },
        onError: (e: Error) => void alertAsync('Error', e.message),
      },
    );
  };

  const onCreateGRN = () => {
    if (!grnModal || !grnNumber.trim() || !selectedResource) {
      void alertAsync('Required', 'Fill GRN number and material.');
      return;
    }
    const res = materials.find((r: Resource) => r.id === selectedResource);
    if (!res) return;
    createGRN.mutate(
      {
        grnNumber: grnNumber.trim(),
        purchaseOrderId: grnModal.poId,
        receivedDate: new Date(),
        lines: [
          {
            resourceId: res.id,
            quantity: parseFloat(grnQty) || 1,
            unit: res.unit,
          },
        ],
      },
      {
        onSuccess: () => {
          setGrnModal(null);
          setGrnNumber('');
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

      <View className="flex-row justify-between items-center">
        <Text className="text-sm font-bold text-text">Requisitions</Text>
        {canCreate && (
          <Button label="New Indent" size="sm" onPress={() => setReqModal(true)} />
        )}
      </View>

      {requisitions.length === 0 ? (
        <EmptyState
          title="No requisitions"
          description="Start the procurement flow with a material indent."
          action={
            canCreate ? (
              <Button label="Create Indent" onPress={() => setReqModal(true)} />
            ) : undefined
          }
        />
      ) : (
        requisitions.map((req: Requisition) => (
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
            {req.lines.map((l: Requisition['lines'][number]) => {
              const qty = parseFloat(l.quantity);
              const rate = l.expectedRate ? parseFloat(l.expectedRate) : null;
              const lineTotal = rate != null ? qty * rate : null;
              return (
                <View key={l.id} className="mb-1">
                  <Text className="text-xs text-text">
                    • {l.resource?.name ?? 'Material'} — {qty} {l.unit}
                    {lineTotal != null ? ` · est. Rs ${lineTotal.toFixed(0)}` : ''}
                  </Text>
                  {l.rateSource ? (
                    <Text className="text-[10px] text-primary ml-2">
                      Rate Rs {rate ?? '—'} ({RATE_SOURCE_LABEL[l.rateSource] ?? l.rateSource})
                    </Text>
                  ) : null}
                </View>
              );
            })}
            {req.purchaseOrders?.map((po: NonNullable<Requisition['purchaseOrders']>[number]) => (
              <View key={po.id} className="mt-2 pt-2 border-t border-border">
                <Text className="text-xs text-muted">
                  PO {po.poNumber} ({po.status})
                </Text>
                {canCreate && po.status !== 'CANCELLED' && (
                  <View className="mt-1">
                    <Button
                      label="Record GRN"
                      size="sm"
                      variant="secondary"
                      onPress={() => setGrnModal({ poId: po.id, poNumber: po.poNumber })}
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
              {canApprove && req.status === 'APPROVED' && !req.purchaseOrders?.length && (
                <Button
                  label="Create PO"
                  size="sm"
                  onPress={() => {
                    const rates: Record<string, string> = {};
                    req.lines.forEach((line: Requisition['lines'][number]) => {
                      rates[line.id] = line.expectedRate ? String(parseFloat(line.expectedRate)) : '0';
                    });
                    setPoLineRates(rates);
                    const firstLine = req.lines[0];
                    if (firstLine) {
                      setSelectedResource(firstLine.resourceId);
                      setReqQty(String(parseFloat(firstLine.quantity)));
                    }
                    setPoModal(req);
                  }}
                />
              )}
            </View>
          </Card>
        ))
      )}

      {/* Stock balances */}
      <Text className="text-sm font-bold text-text mt-2">Stock Balances</Text>
      {stockQ.isLoading ? (
        <LoadingSkeleton className="h-24 rounded-xl" />
      ) : allBalances.length === 0 ? (
        <EmptyState title="No stock" description="Stock appears after GRN receipts." />
      ) : (
        <Card>
          <View className="flex-row border-b border-border pb-2 mb-2">
            <Text className={`text-xs font-semibold text-muted ${isDesktop ? 'flex-[2]' : 'flex-1'}`}>
              Material
            </Text>
            <Text className="text-xs font-semibold text-muted flex-1 text-right">Qty</Text>
            {isDesktop && (
              <Text className="text-xs font-semibold text-muted flex-1 text-right">Location</Text>
            )}
          </View>
          {allBalances.map((b: StockBalance & { locationName: string }) => (
            <View key={b.id} className="flex-row py-1.5 border-b border-border/50">
              <Text className={`text-sm text-text ${isDesktop ? 'flex-[2]' : 'flex-1'}`} numberOfLines={1}>
                {b.resource.name}
              </Text>
              <Text className="text-sm text-text flex-1 text-right">
                {parseFloat(b.quantity)} {b.resource.unit}
              </Text>
              {isDesktop && (
                <Text className="text-xs text-muted flex-1 text-right">{b.locationName}</Text>
              )}
            </View>
          ))}
        </Card>
      )}

      <AdaptiveSheet
        visible={reqModal}
        onClose={() => setReqModal(false)}
        title="New Indent"
        size="md"
        footer={<Button label="Create" loading={createReq.isPending} onPress={onCreateReq} />}
      >
        <Input label="Req Number" value={reqNumber} onChangeText={setReqNumber} placeholder="IND-001" />
        <Input label="Notes" value={reqNotes} onChangeText={setReqNotes} multiline />
        <Text className="text-sm font-semibold text-text">Material</Text>
        <MaterialPicker
          selectedId={selectedResource}
          onSelect={(r) => setSelectedResource(r.id)}
          maxHeight={200}
        />
        {boqItems.length > 0 ? (
          <>
            <Text className="text-sm font-semibold text-text mt-2">Link to BOQ (optional)</Text>
            {boqItems.slice(0, 15).map((b: BoqItem) => (
              <Pressable
                key={b.id}
                onPress={() => setSelectedBoqItemId(selectedBoqItemId === b.id ? '' : b.id)}
                className={`p-2 rounded-lg border ${
                  selectedBoqItemId === b.id ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <Text className="text-xs text-text" numberOfLines={1}>
                  {b.itemCode} — {b.description}
                </Text>
              </Pressable>
            ))}
          </>
        ) : null}
        <Input label="Quantity" value={reqQty} onChangeText={setReqQty} keyboardType="numeric" />
        {indentRateQ.data ? (
          <Text className="text-xs text-primary font-semibold">
            Suggested: Rs {indentRateQ.data.rate} ({RATE_SOURCE_LABEL[indentRateQ.data.source] ?? indentRateQ.data.source})
          </Text>
        ) : null}
        <Input
          label="Expected rate (₹)"
          value={reqExpectedRate}
          onChangeText={(v) => {
            setReqExpectedRate(v);
            setReqRateSource('MANUAL');
          }}
          keyboardType="numeric"
        />
        {reqExpectedRate && reqQty ? (
          <Text className="text-xs text-muted">
            Line est. total: Rs {((parseFloat(reqQty) || 0) * (parseFloat(reqExpectedRate) || 0)).toFixed(0)}
          </Text>
        ) : null}
      </AdaptiveSheet>

      <AdaptiveSheet
        visible={!!poModal}
        onClose={() => {
          setPoModal(null);
          setPoLineRates({});
        }}
        title="Create Purchase Order"
        size="md"
        footer={<Button label="Create PO" loading={createPO.isPending} onPress={onCreatePO} />}
      >
        <Input label="PO Number" value={poNumber} onChangeText={setPoNumber} placeholder="PO-001" />
        <Input label="Vendor" value={vendorName} onChangeText={setVendorName} placeholder="Supplier name" />
        {poModal?.lines.map((l: Requisition['lines'][number]) => (
          <View key={l.id} className="py-2 border-b border-border/60">
            <Text className="text-sm font-medium text-text">{l.resource?.name ?? 'Material'}</Text>
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
            />
          </View>
        ))}
      </AdaptiveSheet>

      <AdaptiveSheet
        visible={!!grnModal}
        onClose={() => setGrnModal(null)}
        title={grnModal ? `Record GRN for ${grnModal.poNumber}` : 'Record GRN'}
        size="md"
        footer={<Button label="Record GRN" loading={createGRN.isPending} onPress={onCreateGRN} />}
      >
        <Input label="GRN Number" value={grnNumber} onChangeText={setGrnNumber} placeholder="GRN-001" />
        <Input label="Quantity received" value={grnQty} onChangeText={setGrnQty} keyboardType="numeric" />
      </AdaptiveSheet>
    </View>
  );
}
