/**
 * BuildFlow - Estimate Detail / Approval screen.
 * Read-only summary + role-based actions (approve/reject/convert/duplicate).
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Badge, LoadingSkeleton, EmptyState } from '@/components/ui';
import { ActionBar } from '@/components/layout/ActionBar';
import { FormScreenHeader } from '@/components/layout/ScreenHeader';
import { dismissTo, DISMISS } from '@/utils/navigation';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { useViewport } from '@/hooks/useViewport';
import { confirmAsync, alertAsync } from '@/utils/confirm';
import { SummaryBreakdownCard } from '@/components/ui';
import { useEstimate, useEstimateMutations, useExportEstimate, type EstimateSection, type EstimateItem } from '@/services/estimate.queries';
import { useProject } from '@/services/project.queries';
import { useAuthStore } from '@/stores/auth.store';
import { formatINR, formatDate } from '@/utils/format';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'neutral',
  REVIEWED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  SUPERSEDED: 'neutral',
};

export default function EstimateDetailScreen() {
  const { id, fromProposal } = useLocalSearchParams<{ id: string; fromProposal?: string }>();
  const proposalId = Array.isArray(fromProposal) ? fromProposal[0] : fromProposal;
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: estimate, isLoading } = useEstimate(id);
  const projectQ = useProject(estimate?.projectId ?? '');
  const mut = useEstimateMutations(id);
  const exportMut = useExportEstimate(id);
  const { isDesktop } = useViewport();
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <OfflineBanner />
        <View className="p-4 gap-3">
          <LoadingSkeleton className="h-16 rounded-xl" />
          <LoadingSkeleton className="h-64 rounded-xl" />
        </View>
      </SafeAreaView>
    );
  }

  if (!estimate) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <OfflineBanner />
        <EmptyState title="Estimate not found" />
      </SafeAreaView>
    );
  }

  const s = estimate.summary;
  const isOwner = user?.role === 'OWNER';
  const canEdit = (user?.role === 'OWNER' || user?.role === 'PM') && estimate.status === 'DRAFT';
  const canApprove = isOwner && estimate.status === 'REVIEWED';
  const isTemporaryProject = projectQ.data?.isTemporary === true;
  const canConvert = isOwner && estimate.status === 'APPROVED' && !isTemporaryProject;

  function handleBack() {
    if (proposalId) {
      dismissTo(DISMISS.proposalDetail(proposalId));
      return;
    }
    dismissTo(DISMISS.estimateTab(estimate!.projectId));
  }

  const breakdownRows = [
    { label: 'Materials', amount: s.materialCost, pct: s.materialPct, color: '#1E3A5F' },
    { label: 'Labour', amount: s.labourCost, pct: s.labourPct, color: '#F59E0B' },
    { label: 'Equipment', amount: s.equipmentCost, pct: s.equipmentPct, color: '#10B981' },
    { label: 'Subcontractor', amount: s.subcontractorCost, pct: s.subPct, color: '#8B5CF6' },
    { label: 'Misc', amount: s.miscCost, pct: s.miscPct, color: '#94A3B8' },
  ];

  async function handleApprove() {
    try {
      await mut.approve.mutateAsync();
      if (proposalId && isTemporaryProject) {
        await alertAsync(
          'Approved',
          'Choose whether to promote this proposal to a project, keep it in the pipeline, or delete it.',
        );
        dismissTo(DISMISS.proposalDetail(proposalId));
        return;
      }
      const msg = isTemporaryProject
        ? 'Estimate approved. Open the proposal to promote, keep, or delete.'
        : 'Estimate is now approved. You can convert it to BOQ.';
      await alertAsync('Approved', msg);
    } catch (e) {
      await alertAsync('Approve failed', e instanceof Error ? e.message : '');
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      setRejectError('Enter rejection reason');
      await alertAsync('Required', 'Enter rejection reason');
      return;
    }
    setRejectError(null);
    try {
      await mut.reject.mutateAsync(rejectReason.trim());
      setShowReject(false);
      await alertAsync('Rejected', 'PM has been notified.');
    } catch (e) {
      await alertAsync('Reject failed', e instanceof Error ? e.message : '');
    }
  }

  async function handleConvert() {
    const ok = await confirmAsync(
      'Convert to BOQ?',
      'This will archive the existing BOQ and create new BOQ items from this estimate. The project budget will be updated.',
    );
    if (!ok) return;
    try {
      const res = await mut.convertToBoq.mutateAsync();
      await alertAsync(
        'BOQ Created',
        `Created ${res.created} BOQ item${res.created === 1 ? '' : 's'}${res.archived > 0 ? ` (archived ${res.archived} previous)` : ''}. Project budget set to ${formatINR(res.budget)}.`,
      );
      router.push(`/projects/${res.projectId}?tab=boq` as never);
    } catch (e) {
      await alertAsync('Conversion failed', e instanceof Error ? e.message : 'Unknown error');
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['bottom']}>
      <FormScreenHeader
        title={estimate.name}
        subtitle={`Version ${estimate.version}.0 · ${estimate.status}`}
        cancelLabel="Back"
        onCancel={handleBack}
      />
      <OfflineBanner />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerClassName={isDesktop ? 'px-8 py-6 gap-4 pb-8' : 'p-4 gap-4 pb-32'}>
          {/* Header */}
          <Card>
            <View className="flex-row justify-between items-start mb-2">
              <View className="flex-1 pr-2">
                <Text className="text-lg font-bold text-text">{estimate.name}</Text>
                <Text className="text-xs text-text-muted">Version {estimate.version}.0</Text>
              </View>
              <Badge color={(STATUS_COLORS[estimate.status] ?? 'neutral') as 'neutral'} label={estimate.status} />
            </View>
            <View className="flex-row justify-between border-t border-border pt-2 mt-1">
              <View>
                <Text className="text-xs text-text-muted">Prepared by</Text>
                <Text className="text-sm font-medium text-text">{estimate.createdByUser?.name ?? '-'}</Text>
              </View>
              <View>
                <Text className="text-xs text-text-muted">Date</Text>
                <Text className="text-sm font-medium text-text">{formatDate(estimate.createdAt)}</Text>
              </View>
            </View>
            {estimate.status === 'REVIEWED' && estimate.approvedByUser && (
              <View className="mt-2 pt-2 border-t border-border">
                <Text className="text-xs text-text-muted">Submitted for review</Text>
              </View>
            )}
            {estimate.status === 'REJECTED' && estimate.rejectionReason && (
              <View className="mt-2 p-2 bg-danger/10 rounded-lg">
                <Text className="text-xs font-semibold text-danger">Rejection Reason</Text>
                <Text className="text-sm text-text mt-0.5">{estimate.rejectionReason}</Text>
              </View>
            )}
          </Card>

          {/* Direct costs by section */}
          <Card>
            <Text className="text-sm font-bold text-text mb-2">Direct Costs by Section</Text>
            {estimate.sections.map((sec: EstimateSection) => {
              const total = sec.items.reduce((sum: number, it: EstimateItem) => sum + parseFloat(it.amount), 0);
              return (
                <View key={sec.id} className="flex-row justify-between py-1">
                  <Text className="text-sm text-text">{sec.name}</Text>
                  <Text className="text-sm font-semibold text-text">{formatINR(total)}</Text>
                </View>
              );
            })}
            <View className="flex-row justify-between pt-2 mt-1 border-t border-border">
              <Text className="text-sm font-bold text-text">Subtotal</Text>
              <Text className="text-sm font-bold text-primary">{formatINR(s.subtotal)}</Text>
            </View>
          </Card>

          {/* Breakdown by type */}
          <SummaryBreakdownCard rows={breakdownRows} totalLabel="Subtotal" total={s.subtotal} />

          {/* Add-ons & Grand total */}
          <Card>
            <Text className="text-sm font-bold text-text mb-2">Summary</Text>
            <View className="flex-row justify-between py-1">
              <Text className="text-sm text-text-muted">Subtotal</Text>
              <Text className="text-sm text-text">{formatINR(s.subtotal)}</Text>
            </View>
            <View className="flex-row justify-between py-1">
              <Text className="text-sm text-text-muted">Overhead ({s.overheadPct}%)</Text>
              <Text className="text-sm text-text">{formatINR(s.overheadAmount)}</Text>
            </View>
            <View className="flex-row justify-between py-1">
              <Text className="text-sm text-text-muted">Contingency ({s.contingencyPct}%)</Text>
              <Text className="text-sm text-text">{formatINR(s.contingencyAmount)}</Text>
            </View>
            <View className="flex-row justify-between py-1">
              <Text className="text-sm text-text-muted">Profit ({s.profitMarginPct}%)</Text>
              <Text className="text-sm text-text">{formatINR(s.profitMarginAmount)}</Text>
            </View>
            <View className="flex-row justify-between pt-2 mt-1 border-t border-border">
              <Text className="text-sm font-bold text-text">Total Before Tax</Text>
              <Text className="text-sm font-bold text-text">{formatINR(s.grandTotalBeforeGST)}</Text>
            </View>
            <View className="flex-row justify-between py-1">
              <Text className="text-sm text-text-muted">GST (weighted)</Text>
              <Text className="text-sm text-text">{formatINR(s.gstAmount)}</Text>
            </View>
            <View className="flex-row justify-between pt-2 mt-1 border-t border-border">
              <Text className="text-base font-bold text-text">GRAND TOTAL</Text>
              <Text className="text-lg font-bold text-primary">{formatINR(s.grandTotal)}</Text>
            </View>
          </Card>

          {/* Notes */}
          {estimate.notes && (
            <Card>
              <Text className="text-sm font-bold text-text mb-1">Notes / Assumptions</Text>
              <Text className="text-sm text-text-muted">{estimate.notes}</Text>
            </Card>
          )}

          {/* Line items detail */}
          <Text className="text-sm font-bold text-text mt-2">Detailed Line Items</Text>
          {estimate.sections.map((sec: EstimateSection) => (
            <Card key={sec.id}>
              <Text className="text-sm font-semibold text-primary mb-2">{sec.name}</Text>
              {sec.items.map((it: EstimateItem) => (
                <View key={it.id} className="border-t border-border py-2">
                  <View className="flex-row justify-between">
                    <Text className="text-sm text-text flex-1 mr-2" numberOfLines={2}>{it.description}</Text>
                    <Text className="text-sm font-semibold text-text">{formatINR(parseFloat(it.amount))}</Text>
                  </View>
                  <View className="flex-row gap-3 mt-0.5">
                    <Text className="text-xs text-text-muted">{parseFloat(it.quantity)} {it.unit}</Text>
                    <Text className="text-xs text-text-muted">@ {formatINR(parseFloat(it.rate))}</Text>
                    <Badge label={it.type} color="neutral" />
                  </View>
                </View>
              ))}
            </Card>
          ))}

          {/* Rejection form */}
          {showReject && (
            <Card>
              <Text className="text-sm font-semibold text-text mb-1">Rejection Reason</Text>
              <TextInput
                value={rejectReason}
                onChangeText={(v) => {
                  setRejectReason(v);
                  if (rejectError) setRejectError(null);
                }}
                placeholder="Explain why this estimate is rejected..."
                placeholderTextColor="#94A3B8"
                multiline
                className="border border-border rounded-lg px-3 py-2.5 text-text min-h-[80px] mb-2"
              />
              {rejectError ? (
                <Text className="text-sm text-danger mb-2">{rejectError}</Text>
              ) : null}
              <View className="flex-row gap-2">
                <Button label="Confirm Reject" variant="danger" onPress={handleReject} loading={mut.reject.isPending} />
                <Button label="Cancel" variant="ghost" onPress={() => setShowReject(false)} />
              </View>
            </Card>
          )}
        </ScrollView>

        {/* Action footer */}
        <ActionBar>
          {canEdit && (
            <Button
              label="Edit Estimate"
              variant="secondary"
              size="sm"
              onPress={() =>
                router.push(
                  `/(app)/estimation/create?projectId=${estimate.projectId}&estimateId=${id}${
                    proposalId ? `&fromProposal=${proposalId}` : ''
                  }`,
                )
              }
            />
          )}
          {canApprove && (
            <>
              <Button label="Approve" size="sm" onPress={handleApprove} loading={mut.approve.isPending} />
              <Button label="Reject" variant="danger" size="sm" onPress={() => setShowReject(true)} />
            </>
          )}
          {canConvert && (
            <Button
              label="Convert to BOQ"
              size="sm"
              onPress={handleConvert}
              loading={mut.convertToBoq.isPending}
            />
          )}
          <Button
            label="Duplicate"
            variant="ghost"
            size="sm"
            onPress={async () => {
              try {
                await mut.duplicate.mutateAsync();
                dismissTo(DISMISS.estimateTab(estimate.projectId));
              } catch (e) {
                await alertAsync('Duplicate failed', e instanceof Error ? e.message : '');
              }
            }}
          />
          <Button
            label="Export Excel"
            variant="secondary"
            size="sm"
            loading={exportMut.isPending}
            onPress={async () => {
              try {
                await exportMut.mutateAsync('excel');
              } catch (e) {
                await alertAsync('Export failed', e instanceof Error ? e.message : '');
              }
            }}
          />
          <Button
            label="Export PDF"
            variant="secondary"
            size="sm"
            loading={exportMut.isPending}
            onPress={async () => {
              try {
                await exportMut.mutateAsync('pdf');
              } catch (e) {
                await alertAsync('Export failed', e instanceof Error ? e.message : '');
              }
            }}
          />
        </ActionBar>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}