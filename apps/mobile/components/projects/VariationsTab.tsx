import React, { useMemo, useState } from 'react';
import { View, Text, Alert, Pressable, ScrollView } from 'react-native';
import { alertAsync } from '@/utils/confirm';
import { FlowHintCard } from '@/components/ui/FlowHintCard';
import { AdaptiveSheet } from '@/components/layout/AdaptiveSheet';
import { ResponsiveGrid } from '@/components/layout/ResponsiveGrid';
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
import { formatINR, formatDate } from '@/utils/format';
import {
  useChangeOrders,
  useCreateChangeOrder,
  useSubmitChangeOrder,
  useApproveChangeOrder,
  useRejectChangeOrder,
  useWorkOrders,
  type ChangeOrder,
  type ChangeOrderLine,
  type WorkOrder,
} from '@/services/expansion.queries';
import { useBoq, type BoqItem } from '@/services/boq.queries';
import { useTasks, type TaskRow } from '@/services/project.queries';
import { useResources, type Resource } from '@/services/estimate.queries';

const STATUS_COLOR: Record<string, 'neutral' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

interface DraftLine {
  id: string;
  description: string;
  unit: string;
  qtyDelta: string;
  rate: string;
  boqItemId?: string;
  resourceId?: string;
}

function emptyLine(): DraftLine {
  return {
    id: Math.random().toString(36).slice(2),
    description: '',
    unit: 'Nos',
    qtyDelta: '0',
    rate: '0',
  };
}

function lineAmount(qtyDelta: string, rate: string): number {
  return Math.round((parseFloat(qtyDelta) || 0) * (parseFloat(rate) || 0) * 100) / 100;
}

function isMaterialBoqCategory(category: string | null | undefined): boolean {
  return category === 'MATERIAL';
}

function applyBoqLinkToLine(line: DraftLine, boq: BoqItem | null): DraftLine {
  if (!boq) {
    return { ...line, boqItemId: undefined, resourceId: undefined };
  }
  const isMaterial = isMaterialBoqCategory(boq.category);
  return {
    ...line,
    boqItemId: boq.id,
    description: line.description || boq.description,
    unit: boq.unit,
    rate: String(parseFloat(boq.rate) || 0),
    resourceId: isMaterial && boq.resourceId ? boq.resourceId : undefined,
  };
}

function showMaterialPickerForLine(line: DraftLine, boqItems: BoqItem[]): boolean {
  if (!line.boqItemId) return true;
  const linked = boqItems.find((b) => b.id === line.boqItemId);
  return isMaterialBoqCategory(linked?.category);
}

function formatLineSummary(line: ChangeOrderLine): string {
  const qty = parseFloat(line.qtyDelta) || 0;
  const rate = parseFloat(line.rate) || 0;
  const amount = parseFloat(line.amount) || qty * rate;
  return `• ${line.description} - ${qty} ${line.unit} @ ${formatINR(rate)} = ${formatINR(amount)}`;
}

function VariationCard({
  co,
  canManage,
  canApprove,
  isDesktop,
  submitPending,
  approvePending,
  rejectPending,
  onSubmit,
  onApprove,
  onReject,
}: {
  co: ChangeOrder;
  canManage: boolean;
  canApprove: boolean;
  isDesktop: boolean;
  submitPending: boolean;
  approvePending: boolean;
  rejectPending: boolean;
  onSubmit: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const orderLines = co.lines ?? [];

  return (
    <Card>
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1 min-w-0 mr-2">
          <Text className="text-sm font-semibold text-text" numberOfLines={2}>
            {co.number} - {co.title}
          </Text>
          <Text className="text-xs text-muted">{formatDate(co.createdAt)}</Text>
        </View>
        <View className="shrink-0">
          <Badge color={STATUS_COLOR[co.status] ?? 'neutral'} label={co.status} />
        </View>
      </View>
      {co.reason ? (
        <Text className="text-xs text-muted mb-2" numberOfLines={2}>
          {co.reason}
        </Text>
      ) : null}
      {co.linkedWorkOrder ? (
        <Text className="text-xs text-accent mb-1">
          Linked WO: {co.linkedWorkOrder.woNumber}
          {co.status === 'APPROVED' ? ` - contract +${formatINR(co.costImpact)}` : ''}
        </Text>
      ) : null}
      {orderLines.map((line) => (
        <Text key={line.id} className="text-xs text-text mb-0.5" numberOfLines={2}>
          {formatLineSummary(line)}
        </Text>
      ))}
      <View className="flex-row justify-between items-center pt-2 mt-2 border-t border-border">
        <Text className="flex-1 text-xs text-muted mr-2">
          {orderLines.length} lines • {co.scheduleImpactDays}d schedule
        </Text>
        <Text className="shrink-0 text-sm font-bold text-primary">
          {formatINR(co.costImpact)}
        </Text>
      </View>
      {canManage && (co.status === 'DRAFT' || co.status === 'REJECTED') && (
        <View className="mt-2">
          <Button
            label="Submit for approval"
            size="sm"
            variant="secondary"
            fullWidth={!isDesktop}
            loading={submitPending}
            onPress={onSubmit}
          />
        </View>
      )}
      {canApprove && co.status === 'SUBMITTED' && (
        <View className={`mt-2 ${isDesktop ? 'flex-row gap-2' : 'gap-2'}`}>
          <View className={isDesktop ? 'flex-1' : undefined}>
            <Button
              label="Approve"
              size="sm"
              fullWidth={!isDesktop}
              loading={approvePending}
              onPress={onApprove}
            />
          </View>
          <View className={isDesktop ? 'flex-1' : undefined}>
            <Button
              label="Reject"
              size="sm"
              variant="secondary"
              fullWidth={!isDesktop}
              loading={rejectPending}
              onPress={onReject}
            />
          </View>
        </View>
      )}
    </Card>
  );
}

export function VariationsTab({ projectId }: { projectId: string }) {
  const { isDesktop } = useViewport();
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === 'OWNER' || user?.role === 'PM';
  const canApprove = user?.role === 'OWNER';

  const { data, isLoading } = useChangeOrders(projectId);
  const { data: boq } = useBoq(projectId);
  const { data: tasks } = useTasks(projectId);
  const { data: workOrders } = useWorkOrders(projectId);
  const { data: resourcesRaw } = useResources();
  const materialResources: Resource[] = (resourcesRaw?.data ?? []).filter(
    (r: Resource) => r.type === 'MATERIAL',
  );
  const boqItems = boq?.items ?? [];
  const taskList = tasks ?? [];
  const woList = workOrders ?? [];

  const createCo = useCreateChangeOrder(projectId);
  const submitCo = useSubmitChangeOrder(projectId);
  const approveCo = useApproveChangeOrder(projectId);
  const rejectCo = useRejectChangeOrder(projectId);

  const [modalOpen, setModalOpen] = useState(false);
  const [number, setNumber] = useState('');
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [scheduleDays, setScheduleDays] = useState('0');
  const [linkedTaskId, setLinkedTaskId] = useState('');
  const [linkedWorkOrderId, setLinkedWorkOrderId] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);

  const draftTotal = useMemo(
    () => lines.reduce((sum, l) => sum + lineAmount(l.qtyDelta, l.rate), 0),
    [lines],
  );

  const resetForm = () => {
    setNumber('');
    setTitle('');
    setReason('');
    setScheduleDays('0');
    setLinkedTaskId('');
    setLinkedWorkOrderId('');
    setLines([emptyLine()]);
  };

  const onCreate = () => {
    if (!number.trim() || !title.trim()) {
      void alertAsync('Required', 'Variation number and title are required.');
      return;
    }
    const validLines = lines.filter((l) => l.description.trim());
    if (validLines.length === 0) {
      void alertAsync('Add lines', 'Add at least one line item.');
      return;
    }
    createCo.mutate(
      {
        number: number.trim(),
        title: title.trim(),
        reason: reason.trim() || undefined,
        scheduleImpactDays: parseInt(scheduleDays, 10) || 0,
        linkedTaskId: linkedTaskId || undefined,
        linkedWorkOrderId: linkedWorkOrderId || undefined,
        lines: validLines.map((l) => ({
          description: l.description.trim(),
          unit: l.unit.trim() || 'Nos',
          qtyDelta: parseFloat(l.qtyDelta) || 0,
          rate: parseFloat(l.rate) || 0,
          boqItemId: l.boqItemId || undefined,
          resourceId: l.resourceId || undefined,
        })),
      },
      {
        onSuccess: () => {
          setModalOpen(false);
          resetForm();
        },
        onError: (e: Error) => void alertAsync('Error', e.message),
      },
    );
  };

  const onReject = (co: ChangeOrder) => {
    Alert.prompt?.(
      'Reject variation',
      'Enter rejection reason:',
      (reasonText) => {
        if (!reasonText?.trim()) return;
        rejectCo.mutate(
          { changeOrderId: co.id, reason: reasonText.trim() },
          { onError: (e: Error) => void alertAsync('Error', e.message) },
        );
      },
    );
    if (!Alert.prompt) {
      rejectCo.mutate(
        { changeOrderId: co.id, reason: 'Rejected' },
        { onError: (e: Error) => void alertAsync('Error', e.message) },
      );
    }
  };

  if (isLoading) return <LoadingSkeleton className="h-48 rounded-xl" />;

  const orders = data ?? [];

  const renderCard = (co: ChangeOrder) => (
    <VariationCard
      key={co.id}
      co={co}
      canManage={canManage}
      canApprove={canApprove}
      isDesktop={isDesktop}
      submitPending={submitCo.isPending}
      approvePending={approveCo.isPending}
      rejectPending={rejectCo.isPending}
      onSubmit={() =>
        submitCo.mutate(co.id, {
          onError: (e: Error) => void alertAsync('Error', e.message),
        })
      }
      onApprove={() =>
        approveCo.mutate(co.id, {
          onError: (e: Error) => void alertAsync('Error', e.message),
        })
      }
      onReject={() => onReject(co)}
    />
  );

  return (
    <View className="gap-3">
      <FlowHintCard
        title="When to use variations"
        steps={[
          'Use when the client agrees to extra scope or quantity after BOQ was approved',
          'PM creates a variation → Owner approves → BOQ and budget update automatically',
          'Link to a subcontract work order to bump contract value when scope is subcontracted',
        ]}
        defaultCollapsed
      />

      <View className="flex-row justify-between items-center">
        <Text className="text-sm font-bold text-text shrink">{orders.length} Variations</Text>
        {canManage && orders.length > 0 && (
          <View className="shrink-0 ml-2">
            <Button label="New Variation" size="sm" onPress={() => setModalOpen(true)} />
          </View>
        )}
      </View>

      {orders.length === 0 ? (
        <EmptyState
          title="No variations yet"
          description="Track scope changes and cost impacts with change orders."
          action={
            canManage ? (
              <Button label="Create Variation" onPress={() => setModalOpen(true)} />
            ) : undefined
          }
        />
      ) : isDesktop ? (
        <ResponsiveGrid columns={2} gap={12}>
          {orders.map(renderCard)}
        </ResponsiveGrid>
      ) : (
        orders.map(renderCard)
      )}

      <AdaptiveSheet
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Variation"
        size="lg"
        footer={
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button label="Cancel" variant="secondary" onPress={() => setModalOpen(false)} />
            </View>
            <View className="flex-1">
              <Button label="Create" loading={createCo.isPending} onPress={onCreate} />
            </View>
          </View>
        }
      >
        <Input label="Number" value={number} onChangeText={setNumber} placeholder="CO-001" fullWidth />
        <Input label="Title" value={title} onChangeText={setTitle} placeholder="Additional foundation work" fullWidth />
        <Input
          label="Reason"
          value={reason}
          onChangeText={setReason}
          placeholder="Client request"
          multiline
          fullWidth
        />
        <Input
          label="Schedule impact (days)"
          value={scheduleDays}
          onChangeText={setScheduleDays}
          keyboardType="numeric"
          fullWidth
        />
        {taskList.length > 0 ? (
          <View className="gap-1">
            <Text className="text-sm font-semibold text-text">Linked task (schedule)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
              <Pressable
                onPress={() => setLinkedTaskId('')}
                className={`px-3 py-1.5 rounded-full border ${!linkedTaskId ? 'bg-primary border-primary' : 'border-border'}`}
              >
                <Text className={`text-xs ${!linkedTaskId ? 'text-white' : 'text-muted'}`}>None</Text>
              </Pressable>
              {taskList.map((t: TaskRow) => (
                <Pressable
                  key={t.id}
                  onPress={() => setLinkedTaskId(t.id)}
                  className={`px-3 py-1.5 rounded-full border ${linkedTaskId === t.id ? 'bg-primary border-primary' : 'border-border'}`}
                >
                  <Text className={`text-xs ${linkedTaskId === t.id ? 'text-white' : 'text-muted'}`} numberOfLines={1}>
                    {t.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
        {woList.length > 0 ? (
          <View className="gap-1">
            <Text className="text-sm font-semibold text-text">Linked subcontract WO</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
              <Pressable
                onPress={() => setLinkedWorkOrderId('')}
                className={`px-3 py-1.5 rounded-full border ${!linkedWorkOrderId ? 'bg-primary border-primary' : 'border-border'}`}
              >
                <Text className={`text-xs ${!linkedWorkOrderId ? 'text-white' : 'text-muted'}`}>None</Text>
              </Pressable>
              {woList.map((wo: WorkOrder) => (
                <Pressable
                  key={wo.id}
                  onPress={() => setLinkedWorkOrderId(wo.id)}
                  className={`px-3 py-1.5 rounded-full border ${linkedWorkOrderId === wo.id ? 'bg-primary border-primary' : 'border-border'}`}
                >
                  <Text className={`text-xs ${linkedWorkOrderId === wo.id ? 'text-white' : 'text-muted'}`}>
                    {wo.woNumber}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
        <Text className="text-sm font-bold text-text -mb-2">Line items</Text>
        <Text className="text-xs text-muted mb-1">
          Link to BOQ updates billed quantity on approve. Pick a catalog material only when this
          variation needs extra material ordered.
        </Text>
        {lines.map((line, idx) => (
          <View key={line.id} className="border border-border rounded-lg p-3 gap-2">
            <Text className="text-xs text-muted">Line {idx + 1}</Text>
            <Input
              label="Scope / BOQ description"
              value={line.description}
              onChangeText={(v) =>
                setLines((prev) =>
                  prev.map((l) => (l.id === line.id ? { ...l, description: v } : l)),
                )
              }
              placeholder="Work or scope description"
              fullWidth
            />
            {boqItems.length > 0 ? (
              <View className="gap-1">
                <Text className="text-xs text-muted">Link to BOQ line (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1">
                  <Pressable
                    onPress={() =>
                      setLines((prev) =>
                        prev.map((l) =>
                          l.id === line.id ? applyBoqLinkToLine(l, null) : l,
                        ),
                      )
                    }
                    className={`px-2 py-1 rounded border ${!line.boqItemId ? 'bg-accent border-accent' : 'border-border'}`}
                  >
                    <Text className={`text-[10px] ${!line.boqItemId ? 'text-white' : 'text-muted'}`}>New</Text>
                  </Pressable>
                  {boqItems.map((b: BoqItem) => (
                    <Pressable
                      key={b.id}
                      onPress={() =>
                        setLines((prev) =>
                          prev.map((l) =>
                            l.id === line.id ? applyBoqLinkToLine(l, b) : l,
                          ),
                        )
                      }
                      className={`px-2 py-1 rounded border max-w-[140px] ${line.boqItemId === b.id ? 'bg-accent border-accent' : 'border-border'}`}
                    >
                      <Text
                        className={`text-[10px] ${line.boqItemId === b.id ? 'text-white' : 'text-muted'}`}
                        numberOfLines={1}
                      >
                        {b.itemCode}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
            {materialResources.length > 0 && showMaterialPickerForLine(line, boqItems) ? (
              <View className="gap-1">
                <Text className="text-xs text-muted">Catalog material for procurement (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1">
                  <Pressable
                    onPress={() =>
                      setLines((prev) =>
                        prev.map((l) => (l.id === line.id ? { ...l, resourceId: undefined } : l)),
                      )
                    }
                    className={`px-2 py-1 rounded border ${!line.resourceId ? 'bg-accent border-accent' : 'border-border'}`}
                  >
                    <Text className={`text-[10px] ${!line.resourceId ? 'text-white' : 'text-muted'}`}>None</Text>
                  </Pressable>
                  {materialResources.map((r) => (
                    <Pressable
                      key={r.id}
                      onPress={() =>
                        setLines((prev) =>
                          prev.map((l) => (l.id === line.id ? { ...l, resourceId: r.id } : l)),
                        )
                      }
                      className={`px-2 py-1 rounded border ${line.resourceId === r.id ? 'bg-accent border-accent' : 'border-border'}`}
                    >
                      <Text
                        className={`text-[10px] ${line.resourceId === r.id ? 'text-white' : 'text-muted'}`}
                        numberOfLines={1}
                      >
                        {r.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : line.boqItemId && !showMaterialPickerForLine(line, boqItems) ? (
              <Text className="text-[10px] text-muted italic">
                Linked BOQ line is not material-type - no procurement indent needed.
              </Text>
            ) : null}
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Input
                  label="Qty Δ"
                  value={line.qtyDelta}
                  onChangeText={(v) =>
                    setLines((prev) =>
                      prev.map((l) => (l.id === line.id ? { ...l, qtyDelta: v } : l)),
                    )
                  }
                  keyboardType="decimal-pad"
                  fullWidth
                />
              </View>
              <View className="w-20">
                <Input
                  label="Unit"
                  value={line.unit}
                  onChangeText={(v) =>
                    setLines((prev) =>
                      prev.map((l) => (l.id === line.id ? { ...l, unit: v } : l)),
                    )
                  }
                  fullWidth
                />
              </View>
              <View className="flex-1">
                <Input
                  label="Rate (₹)"
                  value={line.rate}
                  onChangeText={(v) =>
                    setLines((prev) =>
                      prev.map((l) => (l.id === line.id ? { ...l, rate: v } : l)),
                    )
                  }
                  keyboardType="decimal-pad"
                  fullWidth
                />
              </View>
            </View>
            <Text className="text-xs text-muted text-right">
              Line total: {formatINR(lineAmount(line.qtyDelta, line.rate))}
            </Text>
          </View>
        ))}
        <Pressable onPress={() => setLines((prev) => [...prev, emptyLine()])}>
          <Text className="text-primary text-sm font-semibold">+ Add line</Text>
        </Pressable>
        <View className="rounded-lg bg-primary/10 p-3 flex-row justify-between items-center">
          <Text className="text-sm font-semibold text-text">Estimated cost impact</Text>
          <Text className="text-base font-bold text-primary">{formatINR(draftTotal)}</Text>
        </View>
      </AdaptiveSheet>
    </View>
  );
}
