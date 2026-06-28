import React, { useState } from 'react';
import { View, Text, Modal, Alert, ScrollView, Pressable } from 'react-native';
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
import { useResources, type Resource } from '@/services/estimate.queries';

const STATUS_COLOR: Record<string, 'neutral' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
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
  const { data: resourcesRaw } = useResources();
  const resources: Resource[] = resourcesRaw?.data ?? [];

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
  const [reqQty, setReqQty] = useState('1');

  const [poNumber, setPoNumber] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [poRate, setPoRate] = useState('0');

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
    const res = resources.find((r) => r.id === selectedResource);
    if (!reqNumber.trim() || !res) {
      Alert.alert('Required', 'Enter requisition number and select a material.');
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
          },
        ],
      },
      {
        onSuccess: () => {
          setReqModal(false);
          setReqNumber('');
          setReqNotes('');
        },
        onError: (e: Error) => Alert.alert('Error', e.message),
      },
    );
  };

  const onCreatePO = () => {
    if (!poModal || !poNumber.trim() || !vendorName.trim() || !selectedResource) {
      Alert.alert('Required', 'Fill PO number, vendor, and material.');
      return;
    }
    const res = resources.find((r) => r.id === selectedResource);
    if (!res) return;
    createPO.mutate(
      {
        poNumber: poNumber.trim(),
        vendorName: vendorName.trim(),
        requisitionId: poModal.id,
        lines: [
          {
            resourceId: res.id,
            quantity: parseFloat(reqQty) || 1,
            unit: res.unit,
            rate: parseFloat(poRate) || 0,
          },
        ],
      },
      {
        onSuccess: () => {
          setPoModal(null);
          setPoNumber('');
          setVendorName('');
        },
        onError: (e: Error) => Alert.alert('Error', e.message),
      },
    );
  };

  const onCreateGRN = () => {
    if (!grnModal || !grnNumber.trim() || !selectedResource) {
      Alert.alert('Required', 'Fill GRN number and material.');
      return;
    }
    const res = resources.find((r) => r.id === selectedResource);
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
        onError: (e: Error) => Alert.alert('Error', e.message),
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
            <Text className="text-xs text-muted mb-2">
              {req.lines.length} items • {formatDate(req.createdAt)}
            </Text>
            {req.lines.map((l: Requisition['lines'][number]) => (
              <Text key={l.id} className="text-xs text-text">
                • {l.resource?.name ?? 'Material'} — {parseFloat(l.quantity)} {l.unit}
              </Text>
            ))}
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
                      onError: (e: Error) => Alert.alert('Error', e.message),
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
                      onError: (e: Error) => Alert.alert('Error', e.message),
                    })
                  }
                />
              )}
              {canApprove && req.status === 'APPROVED' && !req.purchaseOrders?.length && (
                <Button
                  label="Create PO"
                  size="sm"
                  onPress={() => {
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

      {/* Create requisition modal */}
      <Modal visible={reqModal} transparent animationType="slide" onRequestClose={() => setReqModal(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <ScrollView className="bg-card rounded-t-2xl max-h-[80%]" contentContainerClassName="p-4 gap-3">
            <Text className="text-lg font-bold text-text">New Indent</Text>
            <Input label="Req Number" value={reqNumber} onChangeText={setReqNumber} placeholder="IND-001" />
            <Input label="Notes" value={reqNotes} onChangeText={setReqNotes} multiline />
            <Text className="text-sm font-semibold text-text">Material</Text>
            {resources
              .filter((r) => r.type === 'MATERIAL')
              .slice(0, 20)
              .map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => setSelectedResource(r.id)}
                  className={`p-2 rounded-lg border ${
                    selectedResource === r.id ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <Text className="text-sm text-text">{r.name}</Text>
                </Pressable>
              ))}
            <Input label="Quantity" value={reqQty} onChangeText={setReqQty} keyboardType="numeric" />
            <Button label="Create" loading={createReq.isPending} onPress={onCreateReq} />
          </ScrollView>
        </View>
      </Modal>

      {/* Create PO modal */}
      <Modal visible={!!poModal} transparent animationType="slide" onRequestClose={() => setPoModal(null)}>
        <View className="flex-1 justify-end bg-black/40">
          <ScrollView className="bg-card rounded-t-2xl max-h-[80%]" contentContainerClassName="p-4 gap-3">
            <Text className="text-lg font-bold text-text">Create Purchase Order</Text>
            <Input label="PO Number" value={poNumber} onChangeText={setPoNumber} placeholder="PO-001" />
            <Input label="Vendor" value={vendorName} onChangeText={setVendorName} placeholder="Supplier name" />
            <Input label="Rate (₹)" value={poRate} onChangeText={setPoRate} keyboardType="numeric" />
            <Button label="Create PO" loading={createPO.isPending} onPress={onCreatePO} />
          </ScrollView>
        </View>
      </Modal>

      {/* Create GRN modal */}
      <Modal visible={!!grnModal} transparent animationType="slide" onRequestClose={() => setGrnModal(null)}>
        <View className="flex-1 justify-end bg-black/40">
          <ScrollView className="bg-card rounded-t-2xl max-h-[80%]" contentContainerClassName="p-4 gap-3">
            <Text className="text-lg font-bold text-text">
              Record GRN {grnModal ? `for ${grnModal.poNumber}` : ''}
            </Text>
            <Input label="GRN Number" value={grnNumber} onChangeText={setGrnNumber} placeholder="GRN-001" />
            <Input label="Quantity received" value={grnQty} onChangeText={setGrnQty} keyboardType="numeric" />
            <Button label="Record GRN" loading={createGRN.isPending} onPress={onCreateGRN} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
