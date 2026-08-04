/**
 * BuildFlow - VariationsTab (VAR-B1–B6 rewrite)
 *
 * VAR-B1: Material picker scoped to BOQ (resourceId or RA components), not full catalog
 * VAR-B2: RA-linked BOQ shows MATERIAL component chips (procurement parity)
 * VAR-B3: Explode composite BOQ into one line per RA MATERIAL component
 * VAR-B5: Ad-hoc catalog material hidden by default when no BOQ linked
 */
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
  useRateAnalysis,
  type Resource,
  type RateAnalysis,
} from '@/services/estimate.queries';

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

function showMaterialPickerForLine(line: DraftLine, boqItems: BoqItem[]): boolean {
  if (!line.boqItemId) return false;
  const linked = boqItems.find((b) => b.id === line.boqItemId);
  if (!linked) return false;
  return !!(linked.resourceId || linked.rateAnalysisId);
}

function explodeCompositeBoq(boq: BoqItem, ra: RateAnalysis, qtyDelta: string): DraftLine[] {
  const qty = parseFloat(qtyDelta) || 0;
  return ra.components
    .filter((c) => c.type === 'MATERIAL' && c.resourceId)
    .map((c) => {
      const compQty = Number(c.quantityPerUnit) || 0;
      const compRate = Number(c.rate) || 0;
      return {
        id: Math.random().toString(36).slice(2),
        description: `${boq.itemCode} · ${c.resourceName || c.resource?.name || 'Material'}`,
        unit: c.unit || boq.unit,
        qtyDelta: String(Math.round(qty * compQty * 1000) / 1000),
        rate: String(compRate),
        boqItemId: boq.id,
        resourceId: c.resourceId ?? undefined,
      };
    });
}

function applyBoqLinkToLine(line: DraftLine, boq: BoqItem | null): DraftLine {
  if (!boq) {
    return { ...line, boqItemId: undefined, resourceId: undefined };
  }
  if (boq.resourceId) {
    return {
      ...line,
      boqItemId: boq.id,
      description: line.description || boq.description,
      unit: boq.unit,
      rate: String(parseFloat(boq.rate) || 0),
      resourceId: boq.resourceId ?? undefined,
    };
  }
  return {
    ...line,
    boqItemId: boq.id,
    description: line.description || boq.description,
    unit: boq.unit,
    rate: String(parseFloat(boq.rate) || 0),
  };
}

function formatLineSummary(line: ChangeOrderLine): string {
  const qty = parseFloat(line.qtyDelta) || 0;
  const rate = parseFloat(line.rate) || 0;
  const amount = parseFloat(line.amount) || qty * rate;
  return `• ${line.description} - ${qty} ${line.unit} @ ${formatINR(rate)} = ${formatINR(amount)}`;
}

function RaComponentPicker({ boq, selectedResourceId, onSelect }: { boq: BoqItem; selectedResourceId: string | undefined; onSelect: (resourceId: string | undefined) => void }) {
  const { data: ra, isLoading } = useRateAnalysis(boq.rateAnalysisId!);
  if (isLoading) return <Text className="text-[10px] text-muted">Loading components…</Text>;
  if (!ra) return null;
  const materialComps = ra.components.filter((c) => c.type === 'MATERIAL' && c.resourceId);
  if (materialComps.length === 0) return null;
  return (
    <View className="gap-1">
      <Text className="text-xs text-muted">Materials for this BOQ (RA components)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1">
        <Pressable onPress={() => onSelect(undefined)} className={`px-2 py-1 rounded border ${!selectedResourceId ? 'bg-accent border-accent' : 'border-border'}`}>
          <Text className={`text-[10px] ${!selectedResourceId ? 'text-white' : 'text-muted'}`}>None</Text>
        </Pressable>
        {materialComps.map((c) => (
          <Pressable key={c.id} onPress={() => onSelect(c.resourceId ?? undefined)} className={`px-2 py-1 rounded border max-w-[160px] ${selectedResourceId === c.resourceId ? 'bg-accent border-accent' : 'border-border'}`}>
            <Text className={`text-[10px] ${selectedResourceId === c.resourceId ? 'text-white' : 'text-muted'}`} numberOfLines={1}>
              {c.resourceName || c.resource?.name || 'Material'} · {c.quantityPerUnit} {c.unit}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function ExplodeButton({ boq, qtyDelta, onExplode }: { boq: BoqItem; qtyDelta: string; onExplode: (lines: DraftLine[]) => void }) {
  const { data: ra } = useRateAnalysis(boq.rateAnalysisId!);
  if (!ra) return null;
  const materialComps = ra.components.filter((c) => c.type === 'MATERIAL' && c.resourceId);
  if (materialComps.length <= 1) return null;
  return (
    <Pressable onPress={() => onExplode(explodeCompositeBoq(boq, ra, qtyDelta))}>
      <Text className="text-primary text-xs font-semibold">⚡ Split into {materialComps.length} materials</Text>
    </Pressable>
  );
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
      {/* R13-VO1: Show impact + CTAs on approved variations */}
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
  const [adhocExpandid, setAdhocExpanded] = useState<Record<string, boolean>>({});
  const draftTotal = useMemo(() => lines.reduce((sum, l) => sum + lineAmount(l.qtyDelta, l.rate), 0), [lines]);
  const resetForm = () => { setNumber(''); setTitle(''); setReason(''); setScheduleDays('0'); setLinkedTaskId(''); setLinkedWorkOrderId(''); setLines([emptyLine()]); setAdhocExpanded({}); };

  const onCreate = () => {
    if (!number.trim() || !title.trim()) { void alertAsync('Required', 'Variation number and title are required.'); return; }
    const validLines = lines.filter((l) => l.description.trim());
    if (validLines.length === 0) { void alertAsync('Add lines', 'Add at least one line item.'); return; }
    createCo.mutate({
      number: number.trim(), title: title.trim(), reason: reason.trim() || undefined,
      scheduleImpactDays: parseInt(scheduleDays, 10) || 0, linkedTaskId: linkedTaskId || undefined, linkedWorkOrderId: linkedWorkOrderId || undefined,
      lines: validLines.map((l) => ({ description: l.description.trim(), unit: l.unit.trim() || 'Nos', qtyDelta: parseFloat(l.qtyDelta) || 0, rate: parseFloat(l.rate) || 0, boqItemId: l.boqItemId || undefined, resourceId: l.resourceId || undefined })),
    }, { onSuccess: () => { setModalOpen(false); resetForm(); }, onError: (e: Error) => void alertAsync('Error', e.message) });
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
      // R14-VO2: Approve success toast — BOQ updated, review shortfalls.
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
      {/* R13-VO1: Updated FlowHint — accurate baseline / shortfall guidance */}
      <FlowHintCard title="When to use variations" steps={[
        'Use when the client agrees to extra scope or quantity after BOQ was approved',
        'PM creates a variation → Owner approves → BOQ sanctioned qty updates (budget too)',
        'Approved estimate stays as original baseline — see Estimate tab for revised scope',
        'Material needs are NOT auto-indented — review Procurement → Shortfalls after approve',
        'Link to a subcontract work order to bump contract value when scope is subcontracted',
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
        <Text className="text-sm font-bold text-text -mb-2">Line items</Text>
        <Text className="text-xs text-muted mb-1">Link to BOQ updates billed quantity on approve. Material picker shows only BOQ-scoped materials.</Text>
        {lines.map((line, idx) => {
          const linkedBoq = boqItems.find((b) => b.id === line.boqItemId);
          const showPicker = showMaterialPickerForLine(line, boqItems);
          return (
            <View key={line.id} className="border border-border rounded-lg p-3 gap-2">
              <Text className="text-xs text-muted">Line {idx + 1}</Text>
              <Input label="Scope / BOQ description" value={line.description} onChangeText={(v: string) => setLines((prev) => prev.map((l) => (l.id === line.id ? { ...l, description: v } : l)))} placeholder="Work or scope description" fullWidth />
              {boqItems.length > 0 ? (
                <View className="gap-1">
                  <Text className="text-xs text-muted">Link to BOQ line (optional)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1">
                    <Pressable onPress={() => setLines((prev) => prev.map((l) => (l.id === line.id ? applyBoqLinkToLine(l, null) : l)))} className={`px-2 py-1 rounded border ${!line.boqItemId ? 'bg-accent border-accent' : 'border-border'}`}><Text className={`text-[10px] ${!line.boqItemId ? 'text-white' : 'text-muted'}`}>New</Text></Pressable>
                    {boqItems.map((b: BoqItem) => (<Pressable key={b.id} onPress={() => setLines((prev) => prev.map((l) => (l.id === line.id ? applyBoqLinkToLine(l, b) : l)))} className={`px-2 py-1 rounded border max-w-[140px] ${line.boqItemId === b.id ? 'bg-accent border-accent' : 'border-border'}`}><Text className={`text-[10px] ${line.boqItemId === b.id ? 'text-white' : 'text-muted'}`} numberOfLines={1}>{b.itemCode}</Text></Pressable>))}
                  </ScrollView>
                </View>
              ) : null}
              {showPicker && linkedBoq?.resourceId ? (
                <View className="gap-1">
                  <Text className="text-xs text-muted">Material for this BOQ</Text>
                  <View className="flex-row items-center gap-1">
                    <Badge color="neutral" label="Auto-linked" />
                    <Text className="text-xs text-text">{materialResources.find((r) => r.id === linkedBoq.resourceId)?.name ?? 'Linked material'}</Text>
                  </View>
                </View>
              ) : showPicker && linkedBoq?.rateAnalysisId ? (
                <RaComponentPicker boq={linkedBoq} selectedResourceId={line.resourceId} onSelect={(rid: string | undefined) => setLines((prev) => prev.map((l) => (l.id === line.id ? { ...l, resourceId: rid } : l)))} />
              ) : null}
              {showPicker && linkedBoq?.rateAnalysisId ? (
                <ExplodeButton boq={linkedBoq} qtyDelta={line.qtyDelta} onExplode={(explodedLines: DraftLine[]) => {
                  setLines((prev) => { const i = prev.findIndex((l) => l.id === line.id); return [...prev.slice(0, i), ...explodedLines, ...prev.slice(i + 1)]; });
                  void alertAsync('Exploded', `${explodedLines.length} material lines created.`);
                }} />
              ) : null}
              {!line.boqItemId ? (
                adhocExpandid[line.id] ? (
                  <View className="gap-1">
                    <Text className="text-xs text-muted">Catalog material (no BOQ)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1">
                      <Pressable onPress={() => setLines((prev) => prev.map((l) => (l.id === line.id ? { ...l, resourceId: undefined } : l)))} className={`px-2 py-1 rounded border ${!line.resourceId ? 'bg-accent border-accent' : 'border-border'}`}><Text className={`text-[10px] ${!line.resourceId ? 'text-white' : 'text-muted'}`}>None</Text></Pressable>
                      {materialResources.map((r) => (<Pressable key={r.id} onPress={() => setLines((prev) => prev.map((l) => (l.id === line.id ? { ...l, resourceId: r.id } : l)))} className={`px-2 py-1 rounded border ${line.resourceId === r.id ? 'bg-accent border-accent' : 'border-border'}`}><Text className={`text-[10px] ${line.resourceId === r.id ? 'text-white' : 'text-muted'}`} numberOfLines={1}>{r.name}</Text></Pressable>))}
                    </ScrollView>
                    <Pressable onPress={() => setAdhocExpanded((p) => ({ ...p, [line.id]: false }))}><Text className="text-[10px] text-muted">Hide catalog</Text></Pressable>
                  </View>
                ) : (<Pressable onPress={() => setAdhocExpanded((p) => ({ ...p, [line.id]: true }))}><Text className="text-[10px] text-accent">+ Link catalog material (no BOQ)</Text></Pressable>)
              ) : null}
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
