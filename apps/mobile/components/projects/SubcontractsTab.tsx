import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Alert, ScrollView, Pressable, TextInput, Share, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AdaptiveSheet } from '@/components/layout/AdaptiveSheet';
import {
  Card,
  Badge,
  Button,
  EmptyState,
  LoadingSkeleton,
  Input,
  ProgressBar,
} from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';
import { useViewport } from '@/hooks/useViewport';
import { formatINR, formatDate } from '@/utils/format';
import {
  useWorkOrders,
  useWorkOrderSummary,
  useSubcontractors,
  useCreateSubcontractor,
  useCreateWorkOrder,
  useCreateWorkOrderFromBoq,
  useUpdateWorkOrder,
  useMeasurements,
  useCreateMeasurement,
  useSubmitMeasurement,
  useApproveMeasurement,
  useRejectMeasurement,
  useCreateSubcontractorPortalAccess,
  useMaterialIssues,
  useIssueMaterial,
  useRecoverMaterial,
  useStockSummary,
  type SubcontractorMaterialIssue,
  type Measurement,
  type Subcontractor,
  type WorkOrder,
  type WorkOrderSummary,
} from '@/services/expansion.queries';
// SUB-UX1: Import MaterialPicker + Resource type for stock-first picker
import { MaterialPicker, type ProjectMaterial } from '@/components/materials/MaterialPicker';
import { type Resource } from '@/services/estimate.queries';
import { useBills, type Bill } from '@/services/accounting.queries';
import { useBoq, type BoqItem } from '@/services/boq.queries';
import { apiFetch } from '@/lib/api-client';
import { billDetailHref, projectTabHref } from '@/utils/navigation';
import * as Sharing from 'expo-sharing';
import { alertAsync, confirmAsync } from '@/utils/confirm';
import { downloadReportPdf, reportPaths } from '@/services/report-download';
import { FlowHintCard } from '@/components/ui/FlowHintCard';
import { TermHint } from '@/components/ui/TermHint';

const STATUS_COLOR: Record<string, 'neutral' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  ACTIVE: 'success',
  COMPLETED: 'neutral',
  CANCELLED: 'danger',
};

const BILL_STATUS_COLOR: Record<string, 'neutral' | 'warning' | 'success' | 'danger' | 'primary'> = {
  PENDING: 'warning',
  APPROVED: 'primary',
  PAID: 'success',
  REJECTED: 'danger',
};

interface DraftMeasLine {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  rate: string;
  workOrderLineId?: string;
  boqItemId?: string;
}

function emptyMeasLine(): DraftMeasLine {
  return {
    id: Math.random().toString(36).slice(2),
    description: '',
    quantity: '1',
    unit: 'Nos',
    rate: '0',
  };
}

function lineAmount(qty: string, rate: string) {
  return Math.round((parseFloat(qty) || 0) * (parseFloat(rate) || 0) * 100) / 100;
}

function WorkOrderSummaryBar({ projectId, workOrderId }: { projectId: string; workOrderId: string }) {
  const { data, isLoading } = useWorkOrderSummary(projectId, workOrderId);

  if (isLoading) return <LoadingSkeleton className="h-20 rounded-lg mt-2" />;
  if (!data) return null;

  return <SummaryContent summary={data} />;
}

function SummaryContent({ summary }: { summary: WorkOrderSummary }) {
  type Metric = { label: string; value: string; accent?: boolean; highlight?: boolean };
  const metrics: Metric[] = [
    { label: 'Contract', value: formatINR(summary.contractValue) },
    { label: 'Certified', value: formatINR(summary.certifiedTotal) },
    { label: 'Paid', value: formatINR(summary.paidTotal), accent: true },
    { label: 'Retention', value: formatINR(summary.retentionHeld) },
    ...(summary.advanceRecovered > 0
      ? [{ label: 'Advance recovered', value: formatINR(summary.advanceRecovered) }]
      : []),
    { label: 'Balance', value: formatINR(summary.balanceRemaining), highlight: true },
  ];

  // SUB-C1b: Supply mode badge
  const mode = summary.materialSupplyMode ?? 'NONE';
  const modeLabel = mode === 'GC_SUPPLIED' ? 'GC Stock' : mode === 'MIXED' ? 'Mixed Supply' : 'Contractor';
  const modeColor = mode !== 'NONE' ? 'primary' : 'neutral';

  return (
    <View className="mt-3 p-3 bg-surface rounded-xl border border-border gap-3">
      <View className="flex-row items-center gap-2 mb-1">
        <Badge color={modeColor as 'neutral' | 'primary'} label={`Supply: ${modeLabel}`} />
        {mode !== 'NONE' && (summary.netMaterialOnWO ?? 0) > 0 && (
          <Text className="text-xs text-muted">
            Net material: {formatINR(summary.netMaterialOnWO ?? 0)}
          </Text>
        )}
      </View>
      <View className="flex-row flex-wrap gap-2">
        {metrics.map((m) => (
          <View
            key={m.label}
            className={`px-2.5 py-1.5 rounded-lg border min-w-[46%] flex-1 ${
              m.highlight ? 'bg-primary/5 border-primary/20' : 'bg-card border-border/60'
            }`}
          >
            <Text className="text-[10px] uppercase tracking-wide text-muted">{m.label}</Text>
            <Text
              className={`text-sm font-semibold mt-0.5 ${
                m.highlight ? 'text-primary' : m.accent ? 'text-success' : 'text-text'
              }`}
            >
              {m.value}
            </Text>
          </View>
        ))}
      </View>
      <View>
        <View className="flex-row justify-between mb-1">
          <Text className="text-xs text-muted">Certification progress</Text>
          <Text className="text-xs font-semibold text-text">{summary.certifiedPct}%</Text>
        </View>
        <ProgressBar value={summary.certifiedPct} color="#1E3A5F" />
      </View>
      {summary.retentionReleased > 0 && (
        <Text className="text-xs text-accent">Retention released {formatINR(summary.retentionReleased)}</Text>
      )}
      {summary.variationTotal > 0 && (
        <Text className="text-xs text-accent">
          Variations: +{formatINR(summary.variationTotal)}
          {summary.variations.length > 0
            ? ` (${summary.variations.map((v) => v.number).join(', ')})`
            : ''}
        </Text>
      )}
    </View>
  );
}

function SectionHeader({
  title,
  icon,
  action,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  action?: React.ReactNode;
}) {
  return (
    <View className="flex-row items-center justify-between mb-2">
      <View className="flex-row items-center gap-2">
        <Ionicons name={icon} size={16} color="#64748B" />
        <Text className="text-xs font-bold text-muted uppercase tracking-wide">{title}</Text>
      </View>
      {action}
    </View>
  );
}

function getCompleteBlockReason(summary?: WorkOrderSummary): string | null {
  if (!summary) return 'Loading work order summary…';
  if (summary.submittedPending > 0) return 'Resolve submitted measurement sheets first';
  if (summary.balanceRemaining > 0.01) {
    return `Certify remaining ${formatINR(summary.balanceRemaining)} first`;
  }
  return null;
}

function WorkOrderBillsPanel({ projectId, workOrderId }: { projectId: string; workOrderId: string }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const canPay = user?.role === 'OWNER' || user?.role === 'PM' || user?.role === 'ACCOUNTANT';
  const { data: bills, isLoading } = useBills(projectId);
  const woBills = useMemo(
    () => (bills ?? []).filter((b: Bill) => b.workOrderId === workOrderId),
    [bills, workOrderId],
  );

  if (isLoading) return <LoadingSkeleton className="h-12 rounded-lg mt-3" />;
  if (woBills.length === 0) return null;

  return (
    <View className="mt-3 p-3 rounded-xl border border-border bg-card/50 gap-2">
      <View className="flex-row items-center justify-between mb-1">
        <SectionHeader title="Linked bills" icon="receipt-outline" />
        <TermHint term="BILL" label="Payable bills" />
      </View>
      <Text className="text-[10px] text-muted mb-1">
        Open a bill to approve or record payment. Created when measurement sheets are approved.
      </Text>
      {woBills.map((bill: Bill) => {
        const balance = Math.max(0, bill.total - bill.paidAmount);
        const paidPct = bill.total > 0 ? Math.min(100, Math.round((bill.paidAmount / bill.total) * 100)) : 0;
        const statusColor = BILL_STATUS_COLOR[bill.status] ?? 'neutral';

        return (
          <Pressable
            key={bill.id}
            onPress={() =>
              router.push(billDetailHref(bill.id, projectTabHref(projectId, 'subcontracts')) as never)
            }
            className="rounded-xl border border-border bg-card p-3 active:opacity-80 active:bg-surface"
          >
            <View className="flex-row justify-between items-start gap-2">
              <View className="flex-1 min-w-0">
                <Text className="text-sm font-mono font-semibold text-text" numberOfLines={1}>
                  {bill.billNumber}
                </Text>
                {bill.isRetentionRelease && (
                  <Text className="text-xs text-accent mt-0.5">Retention release</Text>
                )}
              </View>
              <Badge color={statusColor} label={bill.status} />
            </View>
            <View className="flex-row justify-between items-end mt-2">
              <View>
                <Text className="text-xs text-muted">Net payable</Text>
                <Text className="text-base font-bold text-text">{formatINR(bill.total)}</Text>
              </View>
              {bill.paidAmount > 0 && (
                <View className="items-end">
                  <Text className="text-xs text-muted">Paid</Text>
                  <Text className="text-sm font-semibold text-success">{formatINR(bill.paidAmount)}</Text>
                </View>
              )}
            </View>
            {bill.paidAmount > 0 && bill.paidAmount < bill.total && (
              <View className="mt-2">
                <ProgressBar value={paidPct} color="#16A34A" height={4} />
                <Text className="text-[10px] text-muted mt-1">
                  {paidPct}% paid · {formatINR(balance)} due
                </Text>
              </View>
            )}
            {canPay && bill.status === 'PENDING' && (
              <View className="flex-row items-center gap-1 mt-2 pt-2 border-t border-border/60">
                <Ionicons name="document-text-outline" size={14} color="#1E3A5F" />
                <Text className="text-xs font-medium text-primary">Open to review & pay</Text>
                <Ionicons name="chevron-forward" size={14} color="#1E3A5F" style={{ marginLeft: 'auto' }} />
              </View>
            )}
            {canPay && bill.status === 'APPROVED' && balance > 0.01 && (
              <View className="flex-row items-center gap-1 mt-2 pt-2 border-t border-border/60">
                <Ionicons name="card-outline" size={14} color="#1E3A5F" />
                <Text className="text-xs font-medium text-primary">Open to record payment</Text>
                <Ionicons name="chevron-forward" size={14} color="#1E3A5F" style={{ marginLeft: 'auto' }} />
              </View>
            )}
            {bill.status === 'PAID' && (
              <View className="flex-row justify-end mt-1">
                <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function MeasurementsPanel({
  projectId,
  workOrderId,
  woNumber,
  woStatus,
  summary,
}: {
  projectId: string;
  workOrderId: string;
  woNumber: string;
  woStatus: string;
  summary?: WorkOrderSummary;
}) {
  const user = useAuthStore((s) => s.user);
  const canCreate = user?.role === 'OWNER' || user?.role === 'PM' || user?.role === 'SUPERVISOR';
  const canApprove = user?.role === 'OWNER' || user?.role === 'PM';

  const { data, isLoading } = useMeasurements(projectId, workOrderId);
  const createMeas = useCreateMeasurement(projectId, workOrderId);
  const submitMeas = useSubmitMeasurement(projectId);
  const approveMeas = useApproveMeasurement(projectId);
  const rejectMeas = useRejectMeasurement(projectId);

  const { isDesktop } = useViewport();
  const [modalOpen, setModalOpen] = useState(false);
  const [periodLabel, setPeriodLabel] = useState('');
  const [lines, setLines] = useState<DraftMeasLine[]>([emptyMeasLine()]);
  const [expandedMeas, setExpandedMeas] = useState<Set<string>>(new Set());
  const [woPickerOpen, setWoPickerOpen] = useState(false);

  // SUB-UX2c: Period quick-pick chips
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const currentMonthChip = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthChip = `${monthNames[lastMonth.getMonth()]} ${lastMonth.getFullYear()}`;
  const periodChips = [currentMonthChip, lastMonthChip, `Week ${Math.ceil(now.getDate() / 7)}`];

  // SUB-UX2c: Balance hints from summary.lines
  const getLineBalance = (workOrderLineId?: string) => {
    if (!workOrderLineId || !summary) return undefined;
    const sl = summary.lines.find((l) => l.id === workOrderLineId);
    return sl ? { qty: sl.balanceQty, unit: sl.unit } : undefined;
  };

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + lineAmount(l.quantity, l.rate), 0),
    [lines],
  );

  const copyFromContractLines = () => {
    if (!summary?.lines.length) {
      void alertAsync('No contract lines', 'Add contract lines to the work order first.');
      return;
    }
    setLines(
      summary.lines
        .filter((l) => l.balanceQty > 0)
        .map((l) => ({
          id: Math.random().toString(36).slice(2),
          description: l.description,
          quantity: String(l.balanceQty),
          unit: l.unit,
          rate: String(l.rate),
          workOrderLineId: l.id,
          boqItemId: l.boqItemId ?? undefined,
        })),
    );
    if (summary.lines.every((l) => l.balanceQty <= 0)) {
      void alertAsync('Fully certified', 'All contract lines are fully certified.');
    }
  };

  const onCreate = () => {
    if (!periodLabel.trim()) {
      void alertAsync('Required', 'Period label is required.');
      return;
    }
    const validLines = lines.filter((l) => l.description.trim());
    if (validLines.length === 0) {
      void alertAsync('Required', 'Add at least one line with a description.');
      return;
    }
    createMeas.mutate(
      {
        periodLabel: periodLabel.trim(),
        lines: validLines.map((l) => ({
          description: l.description.trim(),
          quantity: parseFloat(l.quantity) || 0,
          unit: l.unit.trim() || 'Nos',
          rate: parseFloat(l.rate) || 0,
          workOrderLineId: l.workOrderLineId,
          boqItemId: l.boqItemId,
        })),
      },
      {
        onSuccess: () => {
          setModalOpen(false);
          setPeriodLabel('');
          setLines([emptyMeasLine()]);
        },
        onError: (e: Error) => void alertAsync('Error', e.message),
      },
    );
  };

  const onDownloadPdf = (type: 'book' | 'abstract') => {
    const path =
      type === 'book'
        ? reportPaths.subcontractMeasurementBook(projectId, workOrderId)
        : reportPaths.subcontractAbstractSheet(projectId, workOrderId);
    return downloadReportPdf(path, `sub-${type}-${workOrderId}.pdf`);
  };

  if (isLoading) return <LoadingSkeleton className="h-16 rounded-lg mt-3" />;

  const measurements = data ?? [];

  return (
    <View className="mt-3 p-3 rounded-xl border border-border bg-card/50 gap-2">
      <View className="flex-row items-center justify-between mb-1">
        <SectionHeader
          title="Measurement sheets"
          icon="clipboard-outline"
          action={
            canCreate && woStatus === 'ACTIVE' ? (
              <Pressable onPress={() => setModalOpen(true)} className="flex-row items-center gap-1">
                <Ionicons name="add-circle-outline" size={16} color="#1E3A5F" />
                <Text className="text-primary text-xs font-semibold">Add</Text>
              </Pressable>
            ) : undefined
          }
        />
        <TermHint term="MEASUREMENT_SHEET" />
      </View>
      <Text className="text-[10px] text-muted mb-1">
        Record work done each period. Approval creates a linked bill (see above).
      </Text>
      {woStatus !== 'ACTIVE' && (
        <Text className="text-xs text-muted italic mb-1">
          Measurements can only be added on active work orders.
        </Text>
      )}
      {measurements.length === 0 ? (
        <Text className="text-xs text-muted italic py-2">No measurements yet.</Text>
      ) : (
        measurements.map((m: Measurement) => {
          const isExpandedMeas = expandedMeas.has(m.id);
          const lineCount = m.lines?.length ?? 0;
          return (
          <View key={m.id} className="rounded-xl border border-border bg-card p-3 gap-1">
            <View className="flex-row justify-between items-start gap-2">
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm font-semibold text-text">{m.periodLabel}</Text>
                  {lineCount > 0 && (
                    <View className="px-1.5 py-0.5 rounded bg-muted/10">
                      <Text className="text-[9px] text-muted font-medium">{lineCount} {lineCount === 1 ? 'line' : 'lines'}</Text>
                    </View>
                  )}
                </View>
                <Text className="text-xs text-muted mt-0.5">{formatDate(m.createdAt)}</Text>
              </View>
              <Badge color={STATUS_COLOR[m.status] ?? 'neutral'} label={m.status} />
            </View>
            <Text className="text-lg font-bold text-text mt-1">
              {formatINR(parseFloat(m.totalAmount))}
            </Text>
            {m.rejectionReason ? (
              <Text className="text-xs text-danger mt-1">Rejected: {m.rejectionReason}</Text>
            ) : null}
            {/* SUB-UX2: Expandable lines — show first 2 when collapsed, all when expanded */}
            {(m.lines ?? []).slice(0, isExpandedMeas ? undefined : 2).map((l) => (
              <Text key={l.id} className="text-xs text-muted" numberOfLines={isExpandedMeas ? undefined : 1}>
                {l.description} · {l.quantity} {l.unit} @ {formatINR(parseFloat(l.rate))}
              </Text>
            ))}
            {/* Expand/collapse toggle */}
            {lineCount > 2 && (
              <Pressable
                onPress={() => {
                  setExpandedMeas((prev) => {
                    const next = new Set(prev);
                    if (next.has(m.id)) next.delete(m.id);
                    else next.add(m.id);
                    return next;
                  });
                }}
                className="flex-row items-center gap-1 mt-0.5"
              >
                <Ionicons
                  name={isExpandedMeas ? 'chevron-up-outline' : 'chevron-down-outline'}
                  size={12}
                  color="#1E3A5F"
                />
                <Text className="text-[10px] font-semibold text-primary">
                  {isExpandedMeas ? 'Show less' : `Show all ${lineCount} lines`}
                </Text>
              </Pressable>
            )}
            <View className="flex-row flex-wrap gap-2 mt-2 pt-2 border-t border-border/60">
              {canCreate && (m.status === 'DRAFT' || m.status === 'REJECTED') && (
                <Button
                  label="Submit"
                  size="sm"
                  variant="secondary"
                  onPress={() =>
                    submitMeas.mutate(m.id, {
                      onError: (e: Error) => void alertAsync('Error', e.message),
                    })
                  }
                />
              )}
              {canApprove && m.status === 'SUBMITTED' && (
                <>
                  <Button
                    label="Approve"
                    size="sm"
                    onPress={() =>
                      approveMeas.mutate(m.id, {
                        onSuccess: (res) => {
                          const bill = res.bill;
                          if (bill) {
                            void alertAsync(
                              'Approved',
                              `Bill ${bill.billNumber} created - net ${formatINR(parseFloat(bill.total))}`,
                            );
                          }
                        },
                        onError: (e: Error) => void alertAsync('Error', e.message),
                      })
                    }
                  />
                  <Button
                    label="Reject"
                    size="sm"
                    variant="secondary"
                    onPress={() =>
                      rejectMeas.mutate(
                        { measurementId: m.id, reason: 'Needs revision' },
                        { onError: (e: Error) => void alertAsync('Error', e.message) },
                      )
                    }
                  />
                </>
              )}
              <Button
                label="MB PDF"
                size="sm"
                variant="secondary"
                onPress={() => onDownloadPdf('book')}
              />
              <Button
                label="Abstract"
                size="sm"
                variant="secondary"
                onPress={() => onDownloadPdf('abstract')}
              />
            </View>
          </View>
          );
        })
      )}

      <AdaptiveSheet
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`New Measurement - ${woNumber}`}
        size="lg"
        footer={
          <View className="gap-2">
            <Text className="text-sm font-semibold text-text text-right">
              Subtotal: {formatINR(subtotal)}
            </Text>
            <Button label="Create" loading={createMeas.isPending} onPress={onCreate} />
          </View>
        }
      >
        {/* SUB-UX2c: Period field with quick-pick chips */}
        <Input label="Period" value={periodLabel} onChangeText={setPeriodLabel} placeholder="Jan 2025" />
        <View className="flex-row gap-2 mb-2">
          {periodChips.map((chip) => (
            <Pressable
              key={chip}
              onPress={() => setPeriodLabel(chip)}
              className={`px-2.5 py-1.5 rounded-lg border ${
                periodLabel === chip ? 'border-primary bg-primary/5' : 'border-border bg-card'
              }`}
            >
              <Text className={`text-xs font-medium ${
                periodLabel === chip ? 'text-primary' : 'text-muted'
              }`}>{chip}</Text>
            </Pressable>
          ))}
        </View>

        {summary && summary.lines.length > 0 && (
          <View className="flex-row gap-2 mb-2">
            <View className="flex-1">
              <Button label="Copy all WO lines" variant="secondary" size="sm" onPress={copyFromContractLines} />
            </View>
            <View className="flex-1">
              <Button
                label="Pick from WO lines"
                variant="secondary"
                size="sm"
                onPress={() => setWoPickerOpen(true)}
              />
            </View>
          </View>
        )}

        {/* SUB-UX2c: Desktop table header */}
        {isDesktop && lines.length > 0 && (
          <View className="flex-row px-2 py-1 border-b border-border">
            <Text className="text-[10px] font-bold text-muted w-6">#</Text>
            <Text className="text-[10px] font-bold text-muted flex-1">Description</Text>
            <Text className="text-[10px] font-bold text-muted w-16 text-center">Qty</Text>
            <Text className="text-[10px] font-bold text-muted w-14 text-center">Unit</Text>
            <Text className="text-[10px] font-bold text-muted w-16 text-center">Rate</Text>
            <Text className="text-[10px] font-bold text-muted w-20 text-right">Amount</Text>
            <Text className="text-[10px] font-bold text-muted w-6" />
          </View>
        )}

        {lines.map((line, idx) => {
          const balance = getLineBalance(line.workOrderLineId);
          const qtyOverBalance = balance !== undefined && (parseFloat(line.quantity) || 0) > balance.qty;
          return (
          <View key={line.id} className="border border-border rounded-lg p-2 mb-2 gap-1">
            {isDesktop ? (
              <View className="flex-row items-center gap-1">
                <Text className="text-xs text-muted w-6">{idx + 1}</Text>
                <TextInput
                  className="border border-border rounded-lg px-2 py-1 text-sm text-text flex-1"
                  placeholder="Description"
                  value={line.description}
                  onChangeText={(v) =>
                    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, description: v } : l)))
                  }
                />
                <TextInput
                  className="border border-border rounded-lg px-2 py-1 text-sm text-text w-16 text-center"
                  value={line.quantity}
                  onChangeText={(v) =>
                    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, quantity: v } : l)))
                  }
                  keyboardType="numeric"
                />
                <TextInput
                  className="border border-border rounded-lg px-2 py-1 text-sm text-text w-14 text-center"
                  value={line.unit}
                  onChangeText={(v) =>
                    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, unit: v } : l)))
                  }
                />
                <TextInput
                  className="border border-border rounded-lg px-2 py-1 text-sm text-text w-16 text-center"
                  value={line.rate}
                  onChangeText={(v) =>
                    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, rate: v } : l)))
                  }
                  keyboardType="numeric"
                />
                <Text className="text-xs text-muted w-20 text-right">
                  {formatINR(lineAmount(line.quantity, line.rate))}
                </Text>
                {lines.length > 1 && (
                  <Pressable onPress={() => setLines((prev) => prev.filter((_, i) => i !== idx))}>
                    <Ionicons name="trash-outline" size={14} color="#EF4444" />
                  </Pressable>
                )}
              </View>
            ) : (
              <>
                <TextInput
                  className="border border-border rounded-lg p-2 text-sm text-text"
                  placeholder="Description"
                  value={line.description}
                  onChangeText={(v) =>
                    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, description: v } : l)))
                  }
                  multiline
                />
                <View className="flex-row gap-2">
                  <Input
                    label="Qty"
                    value={line.quantity}
                    onChangeText={(v) =>
                      setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, quantity: v } : l)))
                    }
                    keyboardType="numeric"
                  />
                  <Input
                    label="Unit"
                    value={line.unit}
                    onChangeText={(v) =>
                      setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, unit: v } : l)))
                    }
                  />
                  <Input
                    label="Rate"
                    value={line.rate}
                    onChangeText={(v) =>
                      setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, rate: v } : l)))
                    }
                    keyboardType="numeric"
                  />
                </View>
                <Text className="text-xs text-muted">{formatINR(lineAmount(line.quantity, line.rate))}</Text>
                {lines.length > 1 && (
                  <Pressable
                    onPress={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                    className="self-end"
                  >
                    <Text className="text-xs text-danger">Remove line</Text>
                  </Pressable>
                )}
              </>
            )}
            {/* SUB-UX2c: Balance hint for WO-linked lines */}
            {balance && (
              <Text className={`text-[10px] ${qtyOverBalance ? 'text-warning' : 'text-muted'}`}>
                Balance: {balance.qty} {balance.unit}
                {qtyOverBalance && ` — exceeds remaining (warn only)`}
              </Text>
            )}
          </View>
          );
        })}
        <Button label="+ Add line" variant="secondary" onPress={() => setLines((p) => [...p, emptyMeasLine()])} />
      </AdaptiveSheet>

      {/* SUB-UX2c: Pick from WO lines sub-sheet */}
      <AdaptiveSheet
        visible={woPickerOpen}
        onClose={() => setWoPickerOpen(false)}
        title="Pick from WO contract lines"
        size="md"
      >
        {summary && summary.lines.filter((l) => l.balanceQty > 0).length === 0 ? (
          <Text className="text-sm text-muted py-4 text-center">
            All contract lines are fully certified.
          </Text>
        ) : (
          (summary?.lines ?? [])
            .filter((l) => l.balanceQty > 0)
            .filter((l) => !lines.some((dl) => dl.workOrderLineId === l.id))
            .map((l) => (
              <Pressable
                key={l.id}
                onPress={() => {
                  setLines((prev) => [
                    ...prev,
                    {
                      id: Math.random().toString(36).slice(2),
                      description: l.description,
                      quantity: String(l.balanceQty),
                      unit: l.unit,
                      rate: String(l.rate),
                      workOrderLineId: l.id,
                      boqItemId: l.boqItemId ?? undefined,
                    },
                  ]);
                  setWoPickerOpen(false);
                }}
                className="p-2 rounded-lg border border-border mb-1 active:bg-surface"
              >
                <Text className="text-sm text-text">{l.description}</Text>
                <Text className="text-xs text-muted">
                  Balance: {l.balanceQty} {l.unit} @ {formatINR(l.rate)}
                </Text>
              </Pressable>
            ))
        )}
      </AdaptiveSheet>
    </View>
  );
}

// SUB-UX1: Materials section for GC_SUPPLIED / MIXED work orders
// Uses MaterialPicker with project stock balances; groups issues by resource
function MaterialsPanel({
  projectId,
  workOrderId,
  materialSupplyMode,
}: {
  projectId: string;
  workOrderId: string;
  materialSupplyMode?: string;
}) {
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === 'OWNER' || user?.role === 'PM' || user?.role === 'STORE_INCHARGE';

  const { data: issues, isLoading } = useMaterialIssues(projectId, workOrderId);
  const { data: stockSummary } = useStockSummary(projectId);
  const { data: boq } = useBoq(projectId);
  const issueMat = useIssueMaterial(projectId, workOrderId);
  const recoverMat = useRecoverMaterial(projectId, workOrderId);

  const [issueModal, setIssueModal] = useState(false);
  const [selectedResource, setSelectedResource] = useState<{ id: string; name: string; unit: string; rate?: string } | null>(null);
  const [selectedBoqItemId, setSelectedBoqItemId] = useState<string | null>(null);
  useEffect(() => {
    setSelectedBoqItemId(null);
  }, [selectedResource?.id]);
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('');
  const [rate, setRate] = useState('');
  const [recoveringId, setRecoveringId] = useState<string | null>(null);
  const [recoverQty, setRecoverQty] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // SUB-UX1c: Build projectMaterials from stock + BOQ union (daily-report pattern)
  const projectMaterials = useMemo<ProjectMaterial[]>(() => {
    const map = new Map<string, ProjectMaterial>();
    const stock = stockSummary ?? [];
    const boqItems = (boq?.items ?? []) as Array<{ resourceId?: string | null; description: string; unit: string; section?: string | null }>;
    for (const s of stock) {
      const boqItem = boqItems.find((b) => b.resourceId === s.resourceId);
      map.set(s.resourceId, {
        id: s.resourceId,
        name: s.name,
        unit: s.unit,
        type: 'MATERIAL',
        balance: s.balance,
        category: boqItem?.section,
      });
    }
    for (const b of boqItems) {
      if (b.resourceId && !map.has(b.resourceId)) {
        map.set(b.resourceId, {
          id: b.resourceId,
          name: b.description || 'BOQ material',
          unit: b.unit,
          type: 'MATERIAL',
          category: b.section,
        });
      }
    }
    return Array.from(map.values());
  }, [stockSummary, boq]);

  // SUB-UX1c: onHand for selected material
  const selectedOnHand = selectedResource ? projectMaterials.find((m) => m.id === selectedResource.id)?.balance : undefined;
  const qtyOverOnHand = selectedOnHand !== undefined && qty !== '' && (parseFloat(qty) || 0) > selectedOnHand;

  // Group issues by resourceId for ledger display (must run before any early return — Rules of Hooks)
  const groupedIssues = useMemo(() => {
    const allIssues: SubcontractorMaterialIssue[] = issues ?? [];
    const groups = new Map<string, {
      resourceId: string;
      resourceName: string;
      unit: string;
      issues: SubcontractorMaterialIssue[];
      totalIssuedQty: number;
      totalRecoveredQty: number;
      totalIssuedAmt: number;
      totalRecoveredAmt: number;
    }>();
    for (const mi of allIssues) {
      const key = mi.resourceId;
      const g = groups.get(key) ?? {
        resourceId: key,
        resourceName: mi.resource?.name ?? 'Unknown',
        unit: mi.unit,
        issues: [],
        totalIssuedQty: 0,
        totalRecoveredQty: 0,
        totalIssuedAmt: 0,
        totalRecoveredAmt: 0,
      };
      g.issues.push(mi);
      g.totalIssuedQty += parseFloat(mi.quantity);
      g.totalRecoveredQty += parseFloat(mi.recoveredQty);
      g.totalIssuedAmt += parseFloat(mi.amount);
      g.totalRecoveredAmt += parseFloat(mi.recoveredAmount);
      groups.set(key, g);
    }
    return Array.from(groups.values());
  }, [issues]);

  const grandIssued = groupedIssues.reduce((s, g) => s + g.totalIssuedAmt, 0);
  const grandRecovered = groupedIssues.reduce((s, g) => s + g.totalRecoveredAmt, 0);

  // Hide when NONE — after all hooks
  if (materialSupplyMode === 'NONE' || !materialSupplyMode) return null;

  const onIssue = () => {
    if (!selectedResource || !qty || !unit || !rate) {
      void alertAsync('Required', 'Select a material, then enter quantity, unit, and rate.');
      return;
    }
    const matchingBoqIds = (boq?.items ?? [])
      .filter(
        (b: BoqItem) =>
          b.resourceId === selectedResource.id && b.category === 'MATERIAL',
      )
      .map((b: BoqItem) => b.id);
    const boqItemId =
      selectedBoqItemId && matchingBoqIds.includes(selectedBoqItemId)
        ? selectedBoqItemId
        : undefined;
    issueMat.mutate(
      {
        resourceId: selectedResource.id,
        quantity: parseFloat(qty) || 0,
        unit,
        rate: parseFloat(rate) || 0,
        issueDate: new Date().toISOString().slice(0, 10),
        ...(boqItemId ? { boqItemId } : {}),
      },
      {
        onSuccess: () => {
          setIssueModal(false);
          setSelectedResource(null);
          setQty('');
          setUnit('');
          setRate('');
        },
        onError: (e: Error) => void alertAsync('Error', e.message),
      },
    );
  };

  const onRecover = (issueId: string) => {
    if (!recoverQty) {
      void alertAsync('Required', 'Enter quantity to recover.');
      return;
    }
    recoverMat.mutate(
      { issueId, recoveredQty: parseFloat(recoverQty) || 0 },
      {
        onSuccess: () => {
          setRecoveringId(null);
          setRecoverQty('');
        },
        onError: (e: Error) => void alertAsync('Error', e.message),
      },
    );
  };

  if (isLoading) return <LoadingSkeleton className="h-16 rounded-lg mt-3" />;

  const toggleGroup = (resourceId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(resourceId)) next.delete(resourceId);
      else next.add(resourceId);
      return next;
    });
  };

  return (
    <View className="mt-3 p-3 rounded-xl border border-border bg-card/50 gap-2">
      <View className="flex-row items-center justify-between mb-1">
        <SectionHeader
          title="Materials from site stock"
          icon="cube-outline"
          action={
            canManage ? (
              <Pressable
                onPress={() => {
                  setSelectedResource(null);
                  setQty('');
                  setUnit('');
                  setRate('');
                  setIssueModal(true);
                }}
                className="flex-row items-center gap-1"
              >
                <Ionicons name="add-circle-outline" size={16} color="#1E3A5F" />
                <Text className="text-primary text-xs font-semibold">Issue</Text>
              </Pressable>
            ) : undefined
          }
        />
      </View>
      <Text className="text-[10px] text-muted mb-1">
        Issue materials from site stock to this subcontractor. Recover unused materials anytime.
      </Text>

      {/* Summary strip when issues exist */}
      {groupedIssues.length > 0 && (
        <View className="flex-row gap-2 mb-1">
          <View className="flex-1 px-2 py-1.5 rounded-lg border border-border bg-card">
            <Text className="text-[10px] text-muted">Issued</Text>
            <Text className="text-sm font-semibold text-text">{formatINR(grandIssued)}</Text>
          </View>
          <View className="flex-1 px-2 py-1.5 rounded-lg border border-border bg-card">
            <Text className="text-[10px] text-muted">Recovered</Text>
            <Text className="text-sm font-semibold text-success">{formatINR(grandRecovered)}</Text>
          </View>
          <View className="flex-1 px-2 py-1.5 rounded-lg border border-primary/20 bg-primary/5">
            <Text className="text-[10px] text-muted">Net on WO</Text>
            <Text className="text-sm font-semibold text-primary">{formatINR(grandIssued - grandRecovered)}</Text>
          </View>
        </View>
      )}

      {groupedIssues.length === 0 ? (
        <View className="items-center py-4 gap-2">
          <Ionicons name="cube-outline" size={32} color="#94A3B8" />
          <Text className="text-sm text-muted">No materials issued yet</Text>
          {canManage && (
            <Button label="Issue from stock" size="sm" onPress={() => setIssueModal(true)} />
          )}
        </View>
      ) : (
        groupedIssues.map((group) => {
          const isExpanded = expandedGroups.has(group.resourceId);
          const netQty = group.totalIssuedQty - group.totalRecoveredQty;
          const lastIssueDate = group.issues[0]?.issueDate ?? '';
          const onHand = projectMaterials.find((m) => m.id === group.resourceId)?.balance;

          return (
            <View key={group.resourceId} className="rounded-xl border border-border bg-card overflow-hidden">
              {/* Group header */}
              <Pressable
                onPress={() => toggleGroup(group.resourceId)}
                className="p-3 active:bg-surface"
              >
                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-text">{group.resourceName}</Text>
                    <Text className="text-xs text-muted mt-0.5">
                      Issued {group.totalIssuedQty} {group.unit}
                      {group.totalRecoveredQty > 0 && ` · Recovered ${group.totalRecoveredQty} ${group.unit}`}
                    </Text>
                    {onHand !== undefined && (
                      <Text className="text-[10px] text-muted mt-0.5">
                        Stock on hand: {onHand} {group.unit}
                      </Text>
                    )}
                  </View>
                  <View className="items-end">
                    <Text className="text-xs font-bold text-primary">
                      Net {netQty} {group.unit}
                    </Text>
                    <Text className="text-[10px] text-muted">{formatINR(group.totalIssuedAmt)}</Text>
                  </View>
                </View>
              </Pressable>

              {/* Expanded: individual issue rows */}
              {isExpanded && (
                <View className="border-t border-border/60 px-3 py-2 gap-1">
                  {group.issues.map((mi) => {
                    const remaining = parseFloat(mi.quantity) - parseFloat(mi.recoveredQty);
                    return (
                      <View key={mi.id} className="py-1.5 border-b border-border/30">
                        <View className="flex-row justify-between">
                          <Text className="text-xs text-muted">
                            {mi.issueDate} · {mi.issuedByUser?.name ?? '—'}
                          </Text>
                          <Text className="text-xs text-muted">
                            {mi.quantity} {mi.unit} @ {formatINR(parseFloat(mi.rate))}
                          </Text>
                        </View>
                        {parseFloat(mi.recoveredQty) > 0 && (
                          <Text className="text-[10px] text-success">
                            Recovered {mi.recoveredQty} {mi.unit}
                          </Text>
                        )}
                        {/* Recover action */}
                        {canManage && remaining > 0 && (
                          <View className="mt-1">
                            {recoveringId === mi.id ? (
                              <View className="flex-row gap-2 items-center">
                                <TextInput
                                  className="flex-1 border border-border rounded-lg px-2 py-1 text-xs text-text"
                                  placeholder="Qty to recover"
                                  value={recoverQty}
                                  onChangeText={setRecoverQty}
                                  keyboardType="numeric"
                                />
                                <Button
                                  label="Confirm"
                                  size="sm"
                                  loading={recoverMat.isPending}
                                  onPress={() => onRecover(mi.id)}
                                />
                                <Button
                                  label="Cancel"
                                  size="sm"
                                  variant="secondary"
                                  onPress={() => {
                                    setRecoveringId(null);
                                    setRecoverQty('');
                                  }}
                                />
                              </View>
                            ) : (
                              <Pressable
                                onPress={() => setRecoveringId(mi.id)}
                                className="flex-row items-center gap-1"
                              >
                                <Ionicons name="arrow-undo-outline" size={12} color="#16A34A" />
                                <Text className="text-[10px] font-semibold text-success">Recover</Text>
                              </Pressable>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Per-group actions */}
              {canManage && (
                <View className="flex-row gap-2 px-3 py-2 border-t border-border/60">
                  <Button
                    label="Issue more"
                    size="sm"
                    variant="secondary"
                    onPress={() => {
                      setSelectedResource({
                        id: group.resourceId,
                        name: group.resourceName,
                        unit: group.unit,
                      });
                      setUnit(group.unit);
                      setRate(String(group.issues[0]?.rate ?? '0'));
                      setQty('');
                      setIssueModal(true);
                    }}
                  />
                </View>
              )}
            </View>
          );
        })
      )}

      {/* Issue modal — MaterialPicker + review step (SUB-UX3) */}
      <AdaptiveSheet
        visible={issueModal}
        onClose={() => {
          if (selectedResource && (qty || rate)) {
            void confirmAsync(
              'Discard?',
              'You have unsaved entries. Close without issuing?',
            ).then((ok) => {
              if (!ok) return;
              setIssueModal(false);
              setSelectedResource(null);
              setQty('');
              setUnit('');
              setRate('');
            });
          } else {
            setIssueModal(false);
            setSelectedResource(null);
          }
        }}
        title="Issue Material from Stock"
        size="lg"
        footer={
          <View className="gap-2">
            {selectedResource && (
              <View className="flex-row gap-2">
                <Button
                  label="Cancel"
                  variant="secondary"
                  onPress={() => {
                    setIssueModal(false);
                    setSelectedResource(null);
                    setQty('');
                    setUnit('');
                    setRate('');
                  }}
                  className="flex-1"
                />
                <Button
                  label="Issue to subcontractor"
                  loading={issueMat.isPending}
                  disabled={qtyOverOnHand || !qty}
                  onPress={onIssue}
                  className="flex-1"
                />
              </View>
            )}
          </View>
        }
      >
        {!selectedResource ? (
          <>
            <Text className="text-sm font-semibold text-text mb-2">Select material from project stock</Text>
            <MaterialPicker
              selectedId={undefined}
              projectMaterials={projectMaterials}
              onSelect={async (r) => {
                setSelectedResource(r);
                setUnit(r.unit);
                setQty('');
                // SUB-UX1c: Fetch rate from rate API
                try {
                  const resolved = await apiFetch<{ rate: string; source: string }>(
                    `/projects/${projectId}/resources/${r.id}/rate`,
                  );
                  setRate(resolved.rate || (parseFloat(r.rate || '0') > 0 ? r.rate : '0'));
                } catch {
                  setRate(parseFloat(r.rate || '0') > 0 ? r.rate : '0');
                }
              }}
              maxHeight={300}
            />
          </>
        ) : (
          <>
            {/* SUB-UX3: Review step with "Change material" link (not bare X) */}
            <View className="flex-row items-center justify-between p-2 rounded-lg border border-primary/20 bg-primary/5 mb-2">
              <View className="flex-1">
                <Text className="text-sm font-semibold text-text">{selectedResource.name}</Text>
                <Text className="text-xs text-muted">
                  {selectedResource.unit}
                  {projectMaterials.find((m) => m.id === selectedResource.id)?.balance !== undefined && (
                    ` · On hand: ${projectMaterials.find((m) => m.id === selectedResource.id)?.balance} ${selectedResource.unit}`
                  )}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  if (qty || rate) {
                    void confirmAsync(
                      'Change material?',
                      'This will discard the quantity and rate you entered.',
                    ).then((ok) => {
                      if (!ok) return;
                      setSelectedResource(null);
                      setQty('');
                      setRate('');
                    });
                  } else {
                    setSelectedResource(null);
                  }
                }}
              >
                <Text className="text-xs text-primary font-medium">Change</Text>
              </Pressable>
            </View>
            <Input label="Quantity" value={qty} onChangeText={setQty} keyboardType="numeric" placeholder="0" />
            {/* SUB-UX1c: qty ≤ onHand client validation */}
            {qtyOverOnHand && (
              <Text className="text-xs text-danger mt-0.5">
                Only {selectedOnHand} {selectedResource.unit} on hand. Reduce quantity or receive more stock.
              </Text>
            )}
            <View className="flex-row gap-2">
              <Input label="Unit" value={unit} onChangeText={setUnit} />
              <Input label="Rate (₹)" value={rate} onChangeText={setRate} keyboardType="numeric" />
            </View>
            {qty && rate && (
              <Text className="text-sm font-semibold text-text mt-1">
                Amount: {formatINR((parseFloat(qty) || 0) * (parseFloat(rate) || 0))}
              </Text>
            )}
            {/* SUB-BOQ1B: Optional BOQ line link when matching MATERIAL lines exist */}
            {(() => {
              const matchingBoqLines = (boq?.items ?? [])
                .filter((b: BoqItem) => b.resourceId === selectedResource.id && b.category === 'MATERIAL');
              if (matchingBoqLines.length === 0) return null;
              return (
                <View className="mt-2">
                  <Text className="text-xs font-semibold text-text mb-1">
                    Link to BOQ line (optional)
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <Pressable
                      onPress={() => setSelectedBoqItemId(null)}
                      className={`px-3 py-1.5 rounded-lg border mr-1 ${
                        selectedBoqItemId === null ? 'border-primary bg-primary/5' : 'border-border'
                      }`}
                    >
                      <Text className="text-xs text-muted">None</Text>
                    </Pressable>
                    {matchingBoqLines.map((b: BoqItem) => (
                      <Pressable
                        key={b.id}
                        onPress={() => setSelectedBoqItemId(b.id)}
                        className={`px-3 py-1.5 rounded-lg border mr-1 ${
                          selectedBoqItemId === b.id ? 'border-primary bg-primary/5' : 'border-border'
                        }`}
                      >
                        <Text className={`text-xs ${selectedBoqItemId === b.id ? 'text-primary font-semibold' : 'text-muted'}`}>
                          {b.itemCode}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              );
            })()}
          </>
        )}
      </AdaptiveSheet>
    </View>
  );
}

export function SubcontractsTab({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { isDesktop } = useViewport();
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === 'OWNER' || user?.role === 'PM';

  const { data: workOrders, isLoading } = useWorkOrders(projectId);
  const { data: boq } = useBoq(projectId);
  const { data: subcontractors } = useSubcontractors();
  const createSub = useCreateSubcontractor();
  const createWO = useCreateWorkOrder(projectId);
  const createWOBoq = useCreateWorkOrderFromBoq(projectId);
  const updateWO = useUpdateWorkOrder(projectId);
  const createPortal = useCreateSubcontractorPortalAccess(projectId);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [woModal, setWoModal] = useState(false);
  const [subModal, setSubModal] = useState(false);
  const [boqModal, setBoqModal] = useState(false);

  const [woNumber, setWoNumber] = useState('');
  const [scope, setScope] = useState('');
  const [contractValue, setContractValue] = useState('');
  const [retentionPct, setRetentionPct] = useState('5');
  const [advanceAmount, setAdvanceAmount] = useState('0');
  const [selectedSub, setSelectedSub] = useState('');
  const [selectedBoqIds, setSelectedBoqIds] = useState<string[]>([]);
  const [materialSupplyMode, setMaterialSupplyMode] = useState<'NONE' | 'GC_SUPPLIED' | 'MIXED'>('NONE');

  const [subName, setSubName] = useState('');
  const [subGstin, setSubGstin] = useState('');
  const [subPhone, setSubPhone] = useState('');

  // SUB-C1b: Edit WO modal state
  const [editModal, setEditModal] = useState(false);
  const [editWOId, setEditWOId] = useState<string | null>(null);
  const [editMaterialSupplyMode, setEditMaterialSupplyMode] = useState<'NONE' | 'GC_SUPPLIED' | 'MIXED'>('NONE');

  const onSaveEdit = () => {
    if (!editWOId) return;
    updateWO.mutate(
      { workOrderId: editWOId, materialSupplyMode: editMaterialSupplyMode },
      {
        onSuccess: () => {
          setEditModal(false);
          setEditWOId(null);
        },
        onError: (e: Error) => void alertAsync('Error', e.message),
      },
    );
  };

  const expandedSummary = useWorkOrderSummary(projectId, expandedId ?? '', !!expandedId);
  const subcontractBoqItems = useMemo(
    () => (boq?.items ?? []).filter((i: BoqItem) => i.category === 'SUBCONTRACTOR'),
    [boq],
  );

  const onCreateSub = () => {
    if (!subName.trim()) {
      void alertAsync('Required', 'Subcontractor name is required.');
      return;
    }
    createSub.mutate(
      {
        name: subName.trim(),
        gstin: subGstin.trim() || undefined,
        contactPhone: subPhone.trim() || undefined,
      },
      {
        onSuccess: (s) => {
          setSelectedSub(s.id);
          setSubModal(false);
          setSubName('');
        },
        onError: (e: Error) => void alertAsync('Error', e.message),
      },
    );
  };

  const onCreateWO = () => {
    if (!woNumber.trim() || !scope.trim() || !selectedSub) {
      void alertAsync('Required', 'WO number, scope, and subcontractor are required.');
      return;
    }
    createWO.mutate(
      {
        subcontractorId: selectedSub,
        woNumber: woNumber.trim(),
        scope: scope.trim(),
        contractValue: parseFloat(contractValue) || 0,
        retentionPct: parseFloat(retentionPct) || 0,
        advanceAmount: parseFloat(advanceAmount) || 0,
        materialSupplyMode,
      },
      {
        onSuccess: () => {
          setWoModal(false);
          setWoNumber('');
          setScope('');
        },
        onError: (e: Error) => void alertAsync('Error', e.message),
      },
    );
  };

  const onCreateFromBoq = () => {
    if (!woNumber.trim() || !selectedSub || selectedBoqIds.length === 0) {
      void alertAsync('Required', 'WO number, subcontractor, and BOQ lines are required.');
      return;
    }
    createWOBoq.mutate(
      {
        subcontractorId: selectedSub,
        woNumber: woNumber.trim(),
        boqItemIds: selectedBoqIds,
        retentionPct: parseFloat(retentionPct) || 0,
        advanceAmount: parseFloat(advanceAmount) || 0,
      },
      {
        onSuccess: () => {
          setBoqModal(false);
          setWoNumber('');
          setSelectedBoqIds([]);
        },
        onError: (e: Error) => void alertAsync('Error', e.message),
      },
    );
  };

  const onSharePortal = (wo: WorkOrder) => {
    createPortal.mutate(
      {
        subcontractorId: wo.subcontractor.id,
        workOrderId: wo.id,
        label: `${wo.woNumber} portal`,
        scopes: ['VIEW_WO', 'SUBMIT_MEASUREMENT', 'VIEW_PAYMENTS'],
        expiresInDays: 30,
      },
      {
        onSuccess: async (res) => {
          const origin =
            Platform.OS === 'web' && typeof window !== 'undefined'
              ? window.location.origin
              : 'https://app.buildflow.in';
          const url = `${origin}/portal/sub/${res.token}`;
          try {
            await Share.share({ message: `Subcontractor portal: ${url}`, url });
          } catch {
            void alertAsync('Portal link', url);
          }
        },
        onError: (e: Error) => void alertAsync('Error', e.message),
      },
    );
  };

  const onUpdateStatus = (wo: WorkOrder, status: string) => {
    updateWO.mutate(
      { workOrderId: wo.id, status },
      {
        onSuccess: (res) => {
          if (res.retentionReleaseBill) {
            void alertAsync(
              'Work order completed',
              `Retention release bill ${res.retentionReleaseBill.billNumber} created for ${formatINR(res.retentionReleaseBill.total)}`,
            );
          }
        },
        onError: (e: Error) => void alertAsync('Error', e.message),
      },
    );
  };

  if (isLoading) return <LoadingSkeleton className="h-48 rounded-xl" />;

  const orders = workOrders ?? [];
  const subs = subcontractors ?? [];

  return (
    <View className="gap-3">
      <FlowHintCard
        title="How subcontract billing works"
        steps={[
          'Create a work order with contract scope and retention %',
          'Add a measurement sheet for work done in a period',
          'Submit the sheet — PM approves it and a linked bill is created',
          'Accountant approves the bill and records payment in Accounts',
          'When all work is certified, complete the WO to release retention',
        ]}
        defaultCollapsed
      />

      <View className="flex-row justify-between items-center">
        <Text className="text-sm font-bold text-text">{orders.length} Work Orders</Text>
        {canManage && orders.length > 0 && (
          <View className={`gap-2 ${isDesktop ? 'flex-row flex-wrap' : ''}`}>
            <Button label="Add Subcontractor" size="sm" variant="secondary" onPress={() => setSubModal(true)} />
            {subcontractBoqItems.length > 0 && (
              <Button label="Import from BOQ" size="sm" variant="secondary" onPress={() => setBoqModal(true)} />
            )}
            <Button label="New WO" size="sm" onPress={() => setWoModal(true)} />
          </View>
        )}
      </View>

      {orders.length === 0 ? (
        <EmptyState
          title="No work orders"
          description="Create subcontract work orders and track measurement sheets."
          action={
            canManage ? (
              <Button label="Create Work Order" onPress={() => setWoModal(true)} />
            ) : undefined
          }
        />
      ) : (
        orders.map((wo: WorkOrder) => (
          <Card key={wo.id}>
            <Pressable onPress={() => setExpandedId(expandedId === wo.id ? null : wo.id)}>
              <View className="flex-row justify-between items-start">
                <View className="flex-1 mr-2">
                  <Text className="text-sm font-semibold text-text">{wo.woNumber}</Text>
                  <Text className="text-xs text-muted">{wo.subcontractor.name}</Text>
                </View>
                <Badge color={STATUS_COLOR[wo.status] ?? 'neutral'} label={wo.status} />
              </View>
              <Text className="text-xs text-muted mt-1" numberOfLines={2}>
                {wo.scope}
              </Text>
              <View className="flex-row justify-between mt-2 pt-2 border-t border-border">
                <Text className="text-xs text-muted">
                  {wo._count?.measurements ?? 0} measurements
                </Text>
                <Text className="text-sm font-bold text-primary">
                  {formatINR(parseFloat(wo.contractValue))}
                </Text>
              </View>
            </Pressable>
            {expandedId === wo.id && (
              <>
                {expandedSummary.data ? (
                  <SummaryContent summary={expandedSummary.data} />
                ) : (
                  <WorkOrderSummaryBar projectId={projectId} workOrderId={wo.id} />
                )}
                {canManage && (
                  <View className="flex-row flex-wrap gap-2 mt-2">
                    {wo.status === 'DRAFT' && (
                      <>
                        <Button label="Activate" size="sm" onPress={() => onUpdateStatus(wo, 'ACTIVE')} />
                        <Button
                          label="Edit"
                          size="sm"
                          variant="secondary"
                          onPress={() => {
                            setEditWOId(wo.id);
                            setEditMaterialSupplyMode(
                              (expandedSummary.data?.materialSupplyMode as 'NONE' | 'GC_SUPPLIED' | 'MIXED') ?? 'NONE',
                            );
                            setEditModal(true);
                          }}
                        />
                      </>
                    )}
                    {wo.status === 'ACTIVE' && (
                      <>
                        {(() => {
                          const blockReason = getCompleteBlockReason(expandedSummary.data);
                          return (
                            <>
                              <Button
                                label="Complete"
                                size="sm"
                                variant="secondary"
                                disabled={!!blockReason}
                                onPress={() => onUpdateStatus(wo, 'COMPLETED')}
                              />
                              {blockReason && (
                                <Text className="text-xs text-muted w-full">{blockReason}</Text>
                              )}
                            </>
                          );
                        })()}
                        <Button
                          label="Edit supply"
                          size="sm"
                          variant="secondary"
                          onPress={() => {
                            setEditWOId(wo.id);
                            setEditMaterialSupplyMode(
                              (expandedSummary.data?.materialSupplyMode as 'NONE' | 'GC_SUPPLIED' | 'MIXED') ?? 'NONE',
                            );
                            setEditModal(true);
                          }}
                        />
                        <Button
                          label="Record vendor bill"
                          size="sm"
                          variant="secondary"
                          onPress={() => {
                            const returnTo = encodeURIComponent(projectTabHref(projectId, 'subcontracts'));
                            const vendor = encodeURIComponent(wo.subcontractor.name);
                            const billNum = encodeURIComponent(`BILL-${wo.woNumber.replace(/^WO-/, '')}`);
                            router.push(
                              `/accounting/create-bill?projectId=${projectId}&vendorName=${vendor}&category=SUBCONTRACTOR&suggestedBillNumber=${billNum}&returnTo=${returnTo}` as never,
                            );
                          }}
                        />
                        <Button
                          label="Cancel"
                          size="sm"
                          variant="secondary"
                          onPress={() => onUpdateStatus(wo, 'CANCELLED')}
                        />
                      </>
                    )}
                    <Button
                      label="Share portal"
                      size="sm"
                      variant="secondary"
                      onPress={() => onSharePortal(wo)}
                    />
                  </View>
                )}
                <WorkOrderBillsPanel projectId={projectId} workOrderId={wo.id} />
                <MeasurementsPanel
                  projectId={projectId}
                  workOrderId={wo.id}
                  woNumber={wo.woNumber}
                  woStatus={wo.status}
                  summary={expandedSummary.data}
                />
                {/* SUB-C2b: Materials section (hidden when NONE) */}
                <MaterialsPanel
                  projectId={projectId}
                  workOrderId={wo.id}
                  materialSupplyMode={expandedSummary.data?.materialSupplyMode}
                />
              </>
            )}
          </Card>
        ))
      )}

      <AdaptiveSheet
        visible={woModal}
        onClose={() => setWoModal(false)}
        title="New Work Order"
        size="lg"
        footer={<Button label="Create WO" loading={createWO.isPending} onPress={onCreateWO} />}
      >
        <Input label="WO Number" value={woNumber} onChangeText={setWoNumber} placeholder="WO-001" />
        <Input label="Scope" value={scope} onChangeText={setScope} multiline />
        <Input
          label="Contract value (₹)"
          value={contractValue}
          onChangeText={setContractValue}
          keyboardType="numeric"
        />
        <Input
          label="Retention %"
          value={retentionPct}
          onChangeText={setRetentionPct}
          keyboardType="numeric"
        />
        <Input
          label="Advance amount (₹)"
          value={advanceAmount}
          onChangeText={setAdvanceAmount}
          keyboardType="numeric"
        />
        {/* SUB-C1: Material supply mode selector */}
        <Text className="text-sm font-semibold text-text mt-2">
          Will you issue materials from site stock to this contractor?
        </Text>
        <View className="flex-row gap-2 mt-1 mb-2">
          {(['NONE', 'GC_SUPPLIED', 'MIXED'] as const).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => setMaterialSupplyMode(mode)}
              className={`px-3 py-2 rounded-lg border flex-1 ${
                materialSupplyMode === mode ? 'border-primary bg-primary/5' : 'border-border'
              }`}
            >
              <Text className={`text-xs font-semibold text-center ${
                materialSupplyMode === mode ? 'text-primary' : 'text-muted'
              }`}>
                {mode === 'NONE' ? 'No (Contractor)' : mode === 'GC_SUPPLIED' ? 'Yes (GC stock)' : 'Mixed'}
              </Text>
            </Pressable>
          ))}
        </View>
        {materialSupplyMode === 'GC_SUPPLIED' && (
          <Text className="text-[10px] text-muted italic mb-2">
            Materials will be issued from site stock. The contractor can return unused materials.
          </Text>
        )}

        <Text className="text-sm font-semibold text-text">Subcontractor</Text>
        <ScrollView className="max-h-40">
          {subs.map((s: Subcontractor) => (
            <Pressable
              key={s.id}
              onPress={() => setSelectedSub(s.id)}
              className={`p-2 rounded-lg border mb-1 ${
                selectedSub === s.id ? 'border-primary bg-primary/5' : 'border-border'
              }`}
            >
              <Text className="text-sm text-text">{s.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </AdaptiveSheet>

      <AdaptiveSheet
        visible={boqModal}
        onClose={() => setBoqModal(false)}
        title="Import from BOQ"
        size="lg"
        footer={
          <Button label="Create WO" loading={createWOBoq.isPending} onPress={onCreateFromBoq} />
        }
      >
        <Input label="WO Number" value={woNumber} onChangeText={setWoNumber} placeholder="WO-TRAIL-001" />
        <Input
          label="Retention %"
          value={retentionPct}
          onChangeText={setRetentionPct}
          keyboardType="numeric"
        />
        <Input
          label="Advance amount (₹)"
          value={advanceAmount}
          onChangeText={setAdvanceAmount}
          keyboardType="numeric"
        />
        <Text className="text-sm font-semibold text-text">Subcontractor</Text>
        {subs.map((s: Subcontractor) => (
          <Pressable
            key={s.id}
            onPress={() => setSelectedSub(s.id)}
            className={`p-2 rounded-lg border mb-1 ${
              selectedSub === s.id ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          >
            <Text className="text-sm text-text">{s.name}</Text>
          </Pressable>
        ))}
        <Text className="text-sm font-semibold text-text mt-2">SUBCONTRACTOR BOQ lines</Text>
        {subcontractBoqItems.map((item: BoqItem) => {
          const selected = selectedBoqIds.includes(item.id);
          return (
            <Pressable
              key={item.id}
              onPress={() =>
                setSelectedBoqIds((prev) =>
                  selected ? prev.filter((id) => id !== item.id) : [...prev, item.id],
                )
              }
              className={`p-2 rounded-lg border mb-1 ${
                selected ? 'border-primary bg-primary/5' : 'border-border'
              }`}
            >
              <Text className="text-xs font-mono text-muted">{item.itemCode}</Text>
              <Text className="text-sm text-text">{item.description}</Text>
              <Text className="text-xs text-muted">
                {item.quantity} {item.unit} @ {formatINR(parseFloat(item.rate))}
              </Text>
            </Pressable>
          );
        })}
      </AdaptiveSheet>

      <AdaptiveSheet
        visible={subModal}
        onClose={() => setSubModal(false)}
        title="Add Subcontractor"
        size="md"
        footer={<Button label="Save" loading={createSub.isPending} onPress={onCreateSub} />}
      >
        <Input label="Name" value={subName} onChangeText={setSubName} />
        <Input label="GSTIN" value={subGstin} onChangeText={setSubGstin} autoCapitalize="characters" />
        <Input label="Phone" value={subPhone} onChangeText={setSubPhone} keyboardType="phone-pad" />
      </AdaptiveSheet>

      {/* SUB-C1b: Edit WO modal */}
      <AdaptiveSheet
        visible={editModal}
        onClose={() => { setEditModal(false); setEditWOId(null); }}
        title="Edit Work Order"
        size="md"
        footer={<Button label="Save" loading={updateWO.isPending} onPress={onSaveEdit} />}
      >
        <Text className="text-sm font-semibold text-text mt-2">
          Material supply mode
        </Text>
        <View className="flex-row gap-2 mt-1 mb-2">
          {(['NONE', 'GC_SUPPLIED', 'MIXED'] as const).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => setEditMaterialSupplyMode(mode)}
              className={`px-3 py-2 rounded-lg border flex-1 ${
                editMaterialSupplyMode === mode ? 'border-primary bg-primary/5' : 'border-border'
              }`}
            >
              <Text className={`text-xs font-semibold text-center ${
                editMaterialSupplyMode === mode ? 'text-primary' : 'text-muted'
              }`}>
                {mode === 'NONE' ? 'No (Contractor)' : mode === 'GC_SUPPLIED' ? 'Yes (GC stock)' : 'Mixed'}
              </Text>
            </Pressable>
          ))}
        </View>
      </AdaptiveSheet>
    </View>
  );
}
