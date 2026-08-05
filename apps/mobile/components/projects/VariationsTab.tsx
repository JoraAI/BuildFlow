/**
 * BuildFlow - VariationsTab (VAR-C9 rewrite)
 *
 * VAR-C9: One line per BOQ, one line per RA. No Split/BOM expansion on this form.
 * RA/component explosion for procurement happens after approve (backend only,
 * fetchBoqMaterialDemands — VAR-C6b).
 *
 * VAR-C2: Remove line (min 1).
 * VAR-C3: All five cost types (MATERIAL, LABOUR, EQUIPMENT, SUBCONTRACTOR, MISC)
 * VAR-C3a: MaterialPicker for new-scope MATERIAL lines
 * VAR-C3b: RateAnalysisPicker for new-scope non-MISC lines
 * VAR-C4: Adjust vs new scope copy + FlowHint
 * VAR-C9b: BOQ dedupe — each BOQ chip usable on at most one draft line
 */
import React, { useMemo, useState } from 'react';
import { View, Text, Alert, Pressable, ScrollView } from 'react-native';
import { alertAsync, confirmAsync } from '@/utils/confirm';
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
  useChangeOrderImpact,
  useWorkOrders,
  type ChangeOrder,
  type ChangeOrderLine,
  type WorkOrder,
  type ChangeOrderImpact,
} from '@/services/expansion.queries';
import { useRouter } from 'expo-router';
import { useBoq, type BoqItem } from '@/services/boq.queries';
import { useTasks, type TaskRow } from '@/services/project.queries';
import {
  useResources,
  type Resource,
  type RateAnalysis,
} from '@/services/estimate.queries';
import { MaterialPicker } from '@/components/materials/MaterialPicker';
import { RateAnalysisPicker } from '@/components/estimation/RateAnalysisPicker';

const STATUS_COLOR: Record<string, 'neutral' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

// VAR-C3/C9: All five cost types matching estimate item types
const LINE_TYPES = ['MATERIAL', 'LABOUR', 'EQUIPMENT', 'SUBCONTRACTOR', 'MISC'] as const;
type LineType = (typeof LINE_TYPES)[number];

const LINE_TYPE_BADGE: Record<LineType, 'primary' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  MATERIAL: 'primary',
  LABOUR: 'success',
  EQUIPMENT: 'warning',
  SUBCONTRACTOR: 'danger',
  MISC: 'neutral',
};

interface DraftLine {
  id: string;
  description: string;
  unit: string;
  qtyDelta: string;
  rate: string;
  boqItemId?: string;
  resourceId?: string;
  type: LineType;
  rateAnalysisId?: string;
}

function emptyLine(): DraftLine {
  return {
    id: Math.random().toString(36).slice(2),
    description: '',
    unit: 'Nos',
    qtyDelta: '0',
    rate: '0',
    type: 'MATERIAL',
  };
}

function lineAmount(qtyDelta: string, rate: string): number {
  return Math.round((parseFloat(qtyDelta) || 0) * (parseFloat(rate) || 0) * 100) / 100;
}

function applyBoqLinkToLine(line: DraftLine, boq: BoqItem | null): DraftLine {
  if (!boq) {
    return { ...line, boqItemId: undefined, resourceId: undefined };
  }
  return {
    ...line,
    boqItemId: boq.id,
    description: line.description || boq.description,
    unit: boq.unit,
    rate: String(parseFloat(boq.rate) || 0),
    resourceId: boq.resourceId ?? undefined,
  };
}

function formatLineSummary(line: ChangeOrderLine): string {
  const qty = parseFloat(line.qtyDelta) || 0;
  const rate = parseFloat(line.rate) || 0;
  const amount = parseFloat(line.amount) || qty * rate;
  return `• ${line.description} - ${qty} ${line.unit} @ ${formatINR(rate)} = ${formatINR(amount)}`;
}

/**
 * R13-VO1: Approved variation impact section — shows BOQ before→after,
 * budget delta, and next-step CTAs (View BOQ / Review shortfalls).
 */
function ApprovedImpactSection({ projectId, co }: { projectId: string; co: ChangeOrder }) {
  const router = useRouter();
  const { data: impact } = useChangeOrderImpact(projectId, co.id);
  if (!impact) return null;

  return (
    <View className="mt-2 pt-2 border-t border-border gap-1.5">
      <Text className="text-xs font-bold text-text">Impact on approve</Text>
      {impact.boqChanges.length > 0 ? (
        impact.boqChanges.map((change: ChangeOrderImpact['boqChanges'][number], idx: number) => (
          <View key={idx} className="flex-row justify-between items-center">
            <Text className="text-[10px] text-muted flex-1 mr-2" numberOfLines={1}>
              {change.itemCode} · {change.description}
            </Text>
            <Text className="text-[10px] font-semibold text-text">
              {change.qtyBefore} → {change.qtyAfter}
            </Text>
          </View>
        ))
      ) : (
        <Text className="text-[10px] text-muted">No BOQ lines changed.</Text>
      )}
      <View className="flex-row justify-between items-center mt-1">
        <Text className="text-[10px] text-muted">Budget</Text>
        <Text className="text-[10px] font-semibold text-success">+ {formatINR(impact.budgetDelta)}</Text>
      </View>
      <View className="flex-row gap-2 mt-2">
        <View className="flex-1">
          <Button
            label="View BOQ"
            size="sm"
            variant="secondary"
            onPress={() => router.push(`/projects/${projectId}?tab=boq` as never)}
          />
        </View>
        <View className="flex-1">
          <Button
            label="Review shortfalls"
            size="sm"
            variant="secondary"
            onPress={() => router.push(`/projects/${projectId}?tab=procurement` as never)}
          />
        </View>
      </View>
    </View>
  );
}

function VariationCard({ co, canManage, canApprove, isDesktop, submitPending, approvePending, rejectPending, onSubmit, onApprove, onReject, projectId }: { co: ChangeOrder; canManage: boolean; canApprove: boolean; isDesktop: boolean; submitPending: boolean; approvePending: boolean; rejectPending: boolean; onSubmit: () => void; onApprove: () => void; onReject: () => void; projectId: string }) {
  const orderLines = co.lines ?? [];
  return (
    <Card>
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1 min-w-0 mr-2">
          <Text className="text-sm font-semibold text-text" numberOfLines={2}>{co.number} - {co.title}</Text>
          <Text className="text-xs text-muted">{formatDate(co.createdAt)}</Text>
        </View>
        <View className="shrink-0"><Badge color={STATUS_COLOR[co.status] ?? 'neutral'} label={co.status} /></View>
      </View>
      {co.reason ? <Text className="text-xs text-muted mb-2" numberOfLines={2}>{co.reason}</Text> : null}
      {co.linkedWorkOrder ? <Text className="text-xs text-accent mb-1">Linked WO: {co.linkedWorkOrder.woNumber}{co.status === 'APPROVED' ? ` - contract +${formatINR(co.costImpact)}` : ''}</Text> : null}
      {orderLines.map((line) => (<Text key={line.id} className="text-xs text-text mb-0.5" numberOfLines={2}>{formatLineSummary(line)}</Text>))}
      <View className="flex-row justify-between items-center pt-2 mt-2 border-t border-border">
        <Text className="flex-1 text-xs text-muted mr-2">{orderLines.length} lines • {co.scheduleImpactDays}d schedule</Text>
        <Text className="shrink-0 text-sm font-bold text-primary">{formatINR(co.costImpact)}</Text>
      </View>
      {co.status === 'APPROVED' && <ApprovedImpactSection projectId={projectId} co={co} />}
      {canManage && (co.status === 'DRAFT' || co.status === 'REJECTED') && (
        <View className="mt-2"><Button label="Submit for approval" size="sm" variant="secondary" fullWidth={!isDesktop} loading={submitPending} onPress={onSubmit} /></View>
      )}
      {canApprove && co.status === 'SUBMITTED' && (
        <View className={`mt-2 ${isDesktop ? 'flex-row gap-2' : 'gap-2'}`}>
          <View className={isDesktop ? 'flex-1' : undefined}><Button label="Approve" size="sm" fullWidth={!isDesktop} loading={approvePending} onPress={onApprove} /></View>
          <View className={isDesktop ? 'flex-1' : undefined}><Button label="Reject" size="sm" variant="secondary" fullWidth={!isDesktop} loading={rejectPending} onPress={onReject} /></View>
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
  const materialResources: Resource[] = (resourcesRaw?.data ?? []).filter((r: Resource) => r.type === 'MATERIAL');
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
  const draftTotal = useMemo(() => lines.reduce((sum, l) => sum + lineAmount(l.qtyDelta, l.rate), 0), [lines]);
  const resetForm = () => { setNumber(''); setTitle(''); setReason(''); setScheduleDays('0'); setLinkedTaskId(''); setLinkedWorkOrderId(''); setLines([emptyLine()]); };

  // VAR-C9b: Compute BOQ IDs already used on other lines for dedup
  const usedBoqIds = useMemo(() => {
    const ids = new Set<string>();
    for (const l of lines) {
      if (l.boqItemId) ids.add(l.boqItemId);
    }
    return ids;
  }, [lines]);

  const onCreate = () => {
    if (!number.trim() || !title.trim()) { void alertAsync('Required', 'Variation number and title are required.'); return; }
    const validLines = lines.filter((l) => l.description.trim());
    if (validLines.length === 0) { void alertAsync('Add lines', 'Add at least one line item.'); return; }
    createCo.mutate({
      number: number.trim(), title: title.trim(), reason: reason.trim() || undefined,
      scheduleImpactDays: parseInt(scheduleDays, 10) || 0, linkedTaskId: linkedTaskId || undefined, linkedWorkOrderId: linkedWorkOrderId || undefined,
      lines: validLines.map((l) => ({ description: l.description.trim(), unit: l.unit.trim() || 'Nos', qtyDelta: parseFloat(l.qtyDelta) || 0, rate: parseFloat(l.rate) || 0, boqItemId: l.boqItemId || undefined, resourceId: l.resourceId || undefined, rateAnalysisId: l.rateAnalysisId || undefined })),
    }, { onSuccess: () => { setModalOpen(false); resetForm(); }, onError: (e: Error) => void alertAsync('Error', e.message) });
  };

  // VAR-C2: Remove line — keep at least one; confirm if line has data
  const removeLine = async (id: string) => {
    const line = lines.find((l) => l.id === id);
    const hasData = line && (line.description.trim() || parseFloat(line.qtyDelta) > 0 || parseFloat(line.rate) > 0);
    if (hasData) {
      const ok = await confirmAsync('Remove line?', 'This line has data. Remove it?');
      if (!ok) return;
    }
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== id)));
  };

  const onReject = (co: ChangeOrder) => {
    Alert.prompt?.('Reject variation', 'Enter rejection reason:', (reasonText: string | null) => {
      if (!reasonText?.trim()) return;
      rejectCo.mutate({ changeOrderId: co.id, reason: reasonText.trim() }, { onError: (e: Error) => void alertAsync('Error', e.message) });
    });
    if (!Alert.prompt) { rejectCo.mutate({ changeOrderId: co.id, reason: 'Rejected' }, { onError: (e: Error) => void alertAsync('Error', e.message) }); }
  };

  if (isLoading) return <LoadingSkeleton className="h-48 rounded-xl" />;
  const orders = data ?? [];

  const renderCard = (co: ChangeOrder) => (
    <VariationCard key={co.id} co={co} projectId={projectId} canManage={canManage} canApprove={canApprove} isDesktop={isDesktop} submitPending={submitCo.isPending} approvePending={approveCo.isPending} rejectPending={rejectCo.isPending}
      onSubmit={() => submitCo.mutate(co.id, { onError: (e: Error) => void alertAsync('Error', e.message) })}
      onApprove={() =>
        approveCo.mutate(co.id, {
          onSuccess: async () => {
            await alertAsync(
              'Variation approved',
              'BOQ sanctioned qty updated. Review material shortfalls in Procurement if needed.',
            );
          },
          onError: (e: Error) => void alertAsync('Error', e.message),
        })
      }
      onReject={() => onReject(co)} />
  );

  return (
    <View className="gap-3">
      {/* VAR-C9c: FlowHint — single line per BOQ/RA, all 5 types, no split */}
      <FlowHintCard title="When to use variations" steps={[
        'Use when the client agrees to extra scope or quantity after BOQ was approved',
        'PM creates a variation → Owner approves → BOQ sanctioned qty updates (budget too)',
        'Approved estimate stays as original baseline — see Estimate tab for revised scope',
        'Material needs are NOT auto-indented — review Procurement → Shortfalls after approve',
        'Link to a subcontract work order to bump contract value when scope is subcontracted',
        'One line per BOQ chip (qty Δ) or one line per new scope item (type + material/RA)',
      ]} defaultCollapsed />
      <View className="flex-row justify-between items-center">
        <Text className="text-sm font-bold text-text shrink">{orders.length} Variations</Text>
        {canManage && orders.length > 0 && (<View className="shrink-0 ml-2"><Button label="New Variation" size="sm" onPress={() => setModalOpen(true)} /></View>)}
      </View>
      {orders.length === 0 ? (
        <EmptyState title="No variations yet" description="Track scope changes and cost impacts with change orders." action={canManage ? <Button label="Create Variation" onPress={() => setModalOpen(true)} /> : undefined} />
      ) : isDesktop ? (
        <ResponsiveGrid columns={2} gap={12}>{orders.map(renderCard)}</ResponsiveGrid>
      ) : (orders.map(renderCard))}
      <AdaptiveSheet visible={modalOpen} onClose={() => setModalOpen(false)} title="New Variation" size="lg"
        footer={<View className="flex-row gap-2"><View className="flex-1"><Button label="Cancel" variant="secondary" onPress={() => setModalOpen(false)} /></View><View className="flex-1"><Button label="Create" loading={createCo.isPending} onPress={onCreate} /></View></View>}>
        <Input label="Number" value={number} onChangeText={setNumber} placeholder="CO-001" fullWidth />
        <Input label="Title" value={title} onChangeText={setTitle} placeholder="Additional foundation work" fullWidth />
        <Input label="Reason" value={reason} onChangeText={setReason} placeholder="Client request" multiline fullWidth />
        <Input label="Schedule impact (days)" value={scheduleDays} onChangeText={setScheduleDays} keyboardType="numeric" fullWidth />
        {taskList.length > 0 ? (
          <View className="gap-1">
            <Text className="text-sm font-semibold text-text">Linked task (schedule)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
              <Pressable onPress={() => setLinkedTaskId('')} className={`px-3 py-1.5 rounded-full border ${!linkedTaskId ? 'bg-primary border-primary' : 'border-border'}`}><Text className={`text-xs ${!linkedTaskId ? 'text-white' : 'text-muted'}`}>None</Text></Pressable>
              {taskList.map((t: TaskRow) => (<Pressable key={t.id} onPress={() => setLinkedTaskId(t.id)} className={`px-3 py-1.5 rounded-full border ${linkedTaskId === t.id ? 'bg-primary border-primary' : 'border-border'}`}><Text className={`text-xs ${linkedTaskId === t.id ? 'text-white' : 'text-muted'}`} numberOfLines={1}>{t.name}</Text></Pressable>))}
            </ScrollView>
          </View>
        ) : null}
        {woList.length > 0 ? (
          <View className="gap-1">
            <Text className="text-sm font-semibold text-text">Linked subcontract WO</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
              <Pressable onPress={() => setLinkedWorkOrderId('')} className={`px-3 py-1.5 rounded-full border ${!linkedWorkOrderId ? 'bg-primary border-primary' : 'border-border'}`}><Text className={`text-xs ${!linkedWorkOrderId ? 'text-white' : 'text-muted'}`}>None</Text></Pressable>
              {woList.map((wo: WorkOrder) => (<Pressable key={wo.id} onPress={() => setLinkedWorkOrderId(wo.id)} className={`px-3 py-1.5 rounded-full border ${linkedWorkOrderId === wo.id ? 'bg-primary border-primary' : 'border-border'}`}><Text className={`text-xs ${linkedWorkOrderId === wo.id ? 'text-white' : 'text-muted'}`}>{wo.woNumber}</Text></Pressable>))}
            </ScrollView>
          </View>
        ) : null}
        {/* VAR-C9c: Section copy — single line per BOQ/RA */}
        <Text className="text-sm font-bold text-text -mb-2">Line items</Text>
        <View className="rounded-lg bg-primary/5 border border-primary/20 p-2 mb-1">
          <Text className="text-[10px] text-muted leading-4">
            <Text className="font-semibold text-text">Adjust existing BOQ:</Text> Link one BOQ chip per line → qty Δ.{'\n'}
            <Text className="font-semibold text-text">Add new scope:</Text> Pick type (Material, Labour, Equipment, Subcontractor, Misc) + material or RA — one line each.
          </Text>
        </View>
        {lines.map((line, idx) => {
          const linkedBoq = boqItems.find((b) => b.id === line.boqItemId);
          const isNewScope = !line.boqItemId;
          return (
            <View key={line.id} className="border border-border rounded-lg p-3 gap-2">
              {/* VAR-C2: Line header with Remove button */}
              <View className="flex-row justify-between items-center">
                <Text className="text-xs text-muted">Line {idx + 1}</Text>
                {lines.length > 1 && (
                  <Pressable onPress={() => void removeLine(line.id)} hitSlop={8} className="px-2 py-1">
                    <Text className="text-danger text-xs font-semibold">✕ Remove</Text>
                  </Pressable>
                )}
              </View>
              <Input label="Scope / BOQ description" value={line.description} onChangeText={(v: string) => setLines((prev) => prev.map((l) => (l.id === line.id ? { ...l, description: v } : l)))} placeholder="Work or scope description" fullWidth />
              {boqItems.length > 0 ? (
                <View className="gap-1">
                  <Text className="text-xs text-muted">Link to BOQ line (optional)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1">
                    <Pressable onPress={() => setLines((prev) => prev.map((l) => (l.id === line.id ? applyBoqLinkToLine(l, null) : l)))} className={`px-2 py-1 rounded border ${!line.boqItemId ? 'bg-accent border-accent' : 'border-border'}`}><Text className={`text-[10px] ${!line.boqItemId ? 'text-white' : 'text-muted'}`}>New</Text></Pressable>
                    {boqItems.map((b: BoqItem) => {
                      // VAR-C9b: Disable BOQ chips already used on other lines
                      const isUsedElsewhere = usedBoqIds.has(b.id) && line.boqItemId !== b.id;
                      return (
                        <Pressable
                          key={b.id}
                          disabled={isUsedElsewhere}
                          onPress={() => setLines((prev) => prev.map((l) => (l.id === line.id ? applyBoqLinkToLine(l, b) : l)))}
                          className={`px-2 py-1 rounded border max-w-[140px] ${line.boqItemId === b.id ? 'bg-accent border-accent' : isUsedElsewhere ? 'border-border opacity-30' : 'border-border'}`}
                        >
                          <Text className={`text-[10px] ${line.boqItemId === b.id ? 'text-white' : 'text-muted'}`} numberOfLines={1}>{b.itemCode}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  {usedBoqIds.size > 0 && (
                    <Text className="text-[10px] text-muted">Greyed chips are already used on another line.</Text>
                  )}
                </View>
              ) : null}
              {/* VAR-C9: BOQ-linked line — show RA badge if composite, no split/expansion */}
              {line.boqItemId && linkedBoq?.rateAnalysisId ? (
                <View className="flex-row items-center gap-2">
                  <Badge color="primary" label={line.type} />
                  <Badge color="accent" label="Composite (RA linked)" />
                  <Text className="text-[10px] text-muted">One line — materials explode after approve</Text>
                </View>
              ) : line.boqItemId && linkedBoq?.resourceId ? (
                <View className="flex-row items-center gap-2">
                  <Badge color="primary" label={line.type} />
                  <Text className="text-xs text-text">{materialResources.find((r) => r.id === linkedBoq.resourceId)?.name ?? 'Linked material'}</Text>
                </View>
              ) : null}
              {/* VAR-C3/C9: Line type chips for new scope (all five types) */}
              {isNewScope && (
                <View className="gap-1">
                  <Text className="text-xs text-muted">Line type</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1">
                    {LINE_TYPES.map((t) => (
                      <Pressable key={t} onPress={() => setLines((prev) => prev.map((l) => (l.id === line.id ? { ...l, type: t } : l)))} className={`px-2 py-1 rounded border ${line.type === t ? 'bg-primary border-primary' : 'border-border'}`}>
                        <Text className={`text-[10px] font-semibold ${line.type === t ? 'text-white' : 'text-muted'}`}>{t}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
              {/* VAR-C3a: MaterialPicker for new scope MATERIAL lines */}
              {isNewScope && line.type === 'MATERIAL' && (
                <View className="gap-1">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-xs text-muted">Catalog material</Text>
                    {line.resourceId && (
                      <Pressable onPress={() => setLines((prev) => prev.map((l) => (l.id === line.id ? { ...l, resourceId: undefined, rateAnalysisId: undefined } : l)))}>
                        <Text className="text-[10px] text-danger">✕ Clear link</Text>
                      </Pressable>
                    )}
                  </View>
                  <MaterialPicker
                    selectedId={line.resourceId}
                    onSelect={(r: Resource) =>
                      setLines((prev) => prev.map((l) =>
                        l.id === line.id ? {
                          ...l,
                          resourceId: r.id,
                          description: l.description || r.name,
                          unit: r.unit || 'Nos',
                          rateAnalysisId: undefined,
                        } : l,
                      ))
                    }
                    maxHeight={180}
                  />
                </View>
              )}
              {/* VAR-C3b: RateAnalysisPicker for new scope (all types except MISC) */}
              {isNewScope && line.type !== 'MISC' && (
                <View className="gap-1">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-xs text-muted">Rate analysis (optional)</Text>
                    {line.rateAnalysisId && (
                      <Pressable onPress={() => setLines((prev) => prev.map((l) => (l.id === line.id ? { ...l, rateAnalysisId: undefined } : l)))}>
                        <Text className="text-[10px] text-danger">✕ Clear RA</Text>
                      </Pressable>
                    )}
                  </View>
                  <RateAnalysisPicker
                    selectedId={line.rateAnalysisId}
                    onSelect={(ra: RateAnalysis) =>
                      setLines((prev) => prev.map((l) =>
                        l.id === line.id ? {
                          ...l,
                          rateAnalysisId: ra.id,
                          description: l.description || ra.name,
                          rate: String(parseFloat(String(ra.totalRate ?? '0')) || 0),
                          resourceId: undefined,
                        } : l,
                      ))
                    }
                    maxHeight={180}
                  />
                </View>
              )}
              {/* VAR-C9: New scope helper */}
              {isNewScope && (
                <Text className="text-[10px] text-muted italic">New scope — creates a BOQ line on approve. RA materials explode in Procurement → Shortfalls.</Text>
              )}
              <View className="flex-row gap-2">
                <View className="flex-1"><Input label="Qty Δ" value={line.qtyDelta} onChangeText={(v: string) => setLines((prev) => prev.map((l) => (l.id === line.id ? { ...l, qtyDelta: v } : l)))} keyboardType="decimal-pad" fullWidth /></View>
                <View className="w-20"><Input label="Unit" value={line.unit} onChangeText={(v: string) => setLines((prev) => prev.map((l) => (l.id === line.id ? { ...l, unit: v } : l)))} fullWidth /></View>
                <View className="flex-1"><Input label="Rate (₹)" value={line.rate} onChangeText={(v: string) => setLines((prev) => prev.map((l) => (l.id === line.id ? { ...l, rate: v } : l)))} keyboardType="decimal-pad" fullWidth /></View>
              </View>
              <Text className="text-xs text-muted text-right">Line total: {formatINR(lineAmount(line.qtyDelta, line.rate))}</Text>
            </View>
          );
        })}
        <Pressable onPress={() => setLines((prev) => [...prev, emptyLine()])}><Text className="text-primary text-sm font-semibold">+ Add line</Text></Pressable>
        <View className="rounded-lg bg-primary/10 p-3 flex-row justify-between items-center">
          <Text className="text-sm font-semibold text-text">Estimated cost impact</Text>
          <Text className="text-base font-bold text-primary">{formatINR(draftTotal)}</Text>
        </View>
      </AdaptiveSheet>
    </View>
  );
}