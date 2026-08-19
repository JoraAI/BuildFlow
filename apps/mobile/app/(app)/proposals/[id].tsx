/**
 * BuildFlow - Proposal detail with estimate workspace + post-approve actions.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { AdaptiveSheet } from '@/components/layout/AdaptiveSheet';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import {
  Card,
  Badge,
  Button,
  EmptyState,
  LoadingSkeleton,
  Input,
  DateField,
} from '@/components/ui';
import { ActionBar } from '@/components/layout/ActionBar';
import { FormScreenHeader } from '@/components/layout/ScreenHeader';
import { navigateAppBack, dismissTo, DISMISS, createEstimateHref } from '@/utils/navigation';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { confirmAsync, alertAsync } from '@/utils/confirm';
import { useViewport } from '@/hooks/useViewport';
import {
  useProposal,
  usePromoteProposal,
  useDeleteProposal,
  useUpdateProposal,
  useImportTender,
  type TenderImportResult,
} from '@/services/proposal.queries';
import { useProjectEstimates, useCreateEstimate, type EstimateListRow } from '@/services/estimate.queries';
import { apiFetch, ApiError } from '@/lib/api-client';
import * as DocumentPicker from 'expo-document-picker';
import { Buffer as MobileBuffer } from 'buffer';
import { useAuthStore } from '@/stores/auth.store';
import { PROPOSAL_STATUS_META, ProposalStatus } from '@buildflow/shared';
import { formatINR, formatDate } from '@/utils/format';

type Tab = 'estimate' | 'summary';

const ESTIMATE_STATUS_COLOR: Record<string, string> = {
  DRAFT: 'neutral',
  REVIEWED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  SUPERSEDED: 'neutral',
};

export default function ProposalDetailScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { isDesktop } = useViewport();
  const [tab, setTab] = useState<Tab>('estimate');
  const [showPromote, setShowPromote] = useState(false);
  const [promoteForm, setPromoteForm] = useState({ code: '', startDate: '', endDate: '' });
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const { data: proposal, isLoading, refetch, isFetching } = useProposal(id ?? '');
  const promoteMut = usePromoteProposal(id ?? '');
  const deleteMut = useDeleteProposal();
  const updateMut = useUpdateProposal(id ?? '');

  const projectId = proposal?.temporaryProject?.id ?? '';
  const estimatesQ = useProjectEstimates(projectId);
  const estimates = estimatesQ.data ?? [];
  const approvedEstimate = estimates.find((e: EstimateListRow) => e.status === 'APPROVED');

  const isOwner = user?.role === 'OWNER';
  const canManage = isOwner || user?.role === 'PM';
  const showOutcomeBar =
    isOwner &&
    proposal &&
    (proposal.status === ProposalStatus.APPROVED || proposal.status === ProposalStatus.SENT) &&
    !proposal.promotedProjectId;

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      void refetch();
      if (projectId) void estimatesQ.refetch();
    }, [id, projectId, refetch, estimatesQ.refetch]),
  );

  if (isLoading || !id) {
    return (
      <SafeAreaView className="flex-1 bg-surface" edges={isDesktop ? [] : ['bottom']}>
        <OfflineBanner />
        {!isDesktop && (
          <FormScreenHeader
            title="Proposal"
            cancelLabel="Back"
            onCancel={() => navigateAppBack(DISMISS.proposals)}
          />
        )}
        <View className="p-4 gap-3">
          <LoadingSkeleton className="h-16 rounded-xl" />
          <LoadingSkeleton className="h-48 rounded-xl" />
        </View>
      </SafeAreaView>
    );
  }

  if (!proposal) {
    return (
      <SafeAreaView className="flex-1 bg-surface" edges={isDesktop ? [] : ['bottom']}>
        <OfflineBanner />
        {!isDesktop && (
          <FormScreenHeader
            title="Proposal not found"
            cancelLabel="Back"
            onCancel={() => navigateAppBack(DISMISS.proposals)}
          />
        )}
        <EmptyState title="Proposal not found" />
      </SafeAreaView>
    );
  }

  const statusMeta = PROPOSAL_STATUS_META[proposal.status as keyof typeof PROPOSAL_STATUS_META];

  async function handleKeep() {
    await alertAsync('Kept in pipeline', 'This proposal stays in your proposals list.');
    dismissTo(DISMISS.proposals);
  }

  function handleMarkLost() {
    setRejectReason('');
    setShowReject(true);
  }

  async function handleConfirmReject() {
    try {
      await updateMut.mutateAsync({
        status: ProposalStatus.LOST,
        rejectionReason: rejectReason.trim() || null,
      });
      setShowReject(false);
      await alertAsync('Marked as lost', 'Proposal archived as lost.');
      refetch();
    } catch (e) {
      await alertAsync('Error', e instanceof ApiError ? e.message : 'Failed to update');
    }
  }

  async function handleMarkSent() {
    try {
      await updateMut.mutateAsync({ status: ProposalStatus.SENT });
      await alertAsync('Marked as sent', 'Proposal status updated to Sent.');
      refetch();
    } catch (e) {
      await alertAsync('Error', e instanceof ApiError ? e.message : 'Failed to update');
    }
  }

  async function handleDelete() {
    const ok = await confirmAsync(
      'Delete proposal?',
      'This will permanently delete the proposal, temporary project, and all estimates.',
    );
    if (!ok) return;
    try {
      await deleteMut.mutateAsync(id);
      dismissTo(DISMISS.proposals);
    } catch (e) {
      await alertAsync('Delete failed', e instanceof ApiError ? e.message : 'Unknown error');
    }
  }

  async function handlePromote() {
    try {
      const result = await promoteMut.mutateAsync({
        code: promoteForm.code.trim() || undefined,
        startDate: promoteForm.startDate || undefined,
        endDate: promoteForm.endDate || undefined,
      });
      setShowPromote(false);
      const projectId = result.promotedProjectId ?? result.temporaryProject.id;
      await alertAsync(
        'Promoted to project',
        'This proposal is now a permanent project. You can convert the estimate to BOQ.',
      );
      router.replace(`/(app)/projects/${projectId}?tab=estimate` as never);
    } catch (e) {
      await alertAsync('Promote failed', e instanceof ApiError ? e.message : 'Unknown error');
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['bottom']}>
      <OfflineBanner />
      {!isDesktop && (
        <FormScreenHeader
          title={proposal.title}
          subtitle={proposal.clientName}
          cancelLabel="Back"
          onCancel={() => navigateAppBack(DISMISS.proposals)}
        />
      )}
      <ScrollView
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        contentContainerClassName={isDesktop ? 'px-8 py-6 gap-4 pb-32' : 'p-4 gap-4 pb-32'}
      >
        <Card>
          <View className="flex-row justify-between items-start mb-2">
            <View className="flex-1 pr-2">
              <Text className="text-lg font-bold text-text">{proposal.title}</Text>
              <Text className="text-sm text-text-muted">{proposal.clientName}</Text>
              {proposal.clientContact ? (
                <Text className="text-xs text-text-muted mt-0.5">{proposal.clientContact}</Text>
              ) : null}
            </View>
            <Badge color="primary" label={statusMeta?.label ?? proposal.status} />
          </View>
          <View className="flex-row flex-wrap gap-2 pt-2 border-t border-border">
            <Badge color="neutral" label={proposal.projectType} />
            {proposal.validUntil ? (
              <Text className="text-xs text-text-muted self-center">
                Valid until {formatDate(proposal.validUntil)}
              </Text>
            ) : null}
            {proposal.promotedProject ? (
              <Button
                label={`View project ${proposal.promotedProject.code}`}
                size="sm"
                variant="secondary"
                onPress={() =>
                  router.push(`/(app)/projects/${proposal.promotedProject!.id}` as never)
                }
              />
            ) : null}
          </View>
          {canManage && proposal.status === ProposalStatus.APPROVED && (
            <View className="mt-3 pt-3 border-t border-border">
              <Button label="Mark as Sent" variant="secondary" size="sm" onPress={handleMarkSent} />
            </View>
          )}
          {isOwner && ['APPROVED', 'SENT', 'IN_REVIEW'].includes(proposal.status) && (
            <View className="mt-2">
              <Button label="Reject / Mark Lost" variant="danger" size="sm" onPress={handleMarkLost} />
            </View>
          )}
          {proposal.status === ProposalStatus.LOST && proposal.rejectionReason && (
            <View className="mt-2 p-2 bg-danger/10 rounded-lg">
              <Text className="text-xs font-semibold text-danger">Rejection Reason</Text>
              <Text className="text-sm text-text mt-0.5">{proposal.rejectionReason}</Text>
            </View>
          )}
        </Card>

        <View className="flex-row gap-2">
          {(['estimate', 'summary'] as Tab[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              className={`px-4 py-2 rounded-full ${
                tab === t ? 'bg-primary' : 'bg-card border border-border'
              }`}
            >
              <Text className={`text-sm font-semibold ${tab === t ? 'text-white' : 'text-muted'}`}>
                {t === 'estimate' ? 'Estimate' : 'Summary'}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'estimate' ? (
          <EstimateSection
            proposalId={id}
            projectId={projectId}
            estimates={estimates}
            isLoading={estimatesQ.isLoading}
            isError={estimatesQ.isError}
            onRetry={() => estimatesQ.refetch()}
            canManage={canManage}
          />
        ) : (
          <SummarySection proposal={proposal} approvedEstimate={approvedEstimate} />
        )}
      </ScrollView>

      {showOutcomeBar && (
        <ActionBar>
          <View className="flex-row gap-2 flex-wrap">
            <Button label="Promote to Project" onPress={() => setShowPromote(true)} />
            <Button label="Keep Proposal" variant="secondary" onPress={handleKeep} />
            <Button label="Delete" variant="danger" onPress={handleDelete} />
          </View>
        </ActionBar>
      )}

      <AdaptiveSheet
        visible={showPromote}
        onClose={() => setShowPromote(false)}
        title="Promote to Project"
        subtitle={
          approvedEstimate
            ? `Budget will be set from the approved estimate: ${formatINR(Number(approvedEstimate.grandTotal))}.`
            : 'Budget will be set from the approved estimate.'
        }
        size="md"
        footer={
          <View className="flex-row gap-2">
            <Button
              label="Cancel"
              variant="secondary"
              className="flex-1"
              onPress={() => setShowPromote(false)}
            />
            <Button
              label={promoteMut.isPending ? 'Promoting…' : 'Promote'}
              className="flex-1"
              onPress={handlePromote}
              disabled={promoteMut.isPending}
            />
          </View>
        }
      >
        <Input
          label="Project code (optional)"
          value={promoteForm.code}
          onChangeText={(v) => setPromoteForm((p) => ({ ...p, code: v }))}
          placeholder={proposal.temporaryProject.code}
        />
        <DateField
          label="Start date (optional)"
          value={promoteForm.startDate}
          onChange={(v) => setPromoteForm((p) => ({ ...p, startDate: v }))}
        />
        <DateField
          label="End date (optional)"
          value={promoteForm.endDate}
          onChange={(v) => setPromoteForm((p) => ({ ...p, endDate: v }))}
        />
      </AdaptiveSheet>

      {/* Rejection reason sheet */}
      <AdaptiveSheet
        visible={showReject}
        onClose={() => setShowReject(false)}
        title="Reject / Mark as Lost"
        subtitle="This proposal will be archived as lost. Optionally add a reason."
        size="sm"
        footer={
          <View className="flex-row gap-2">
            <Button
              label="Cancel"
              variant="secondary"
              className="flex-1"
              onPress={() => setShowReject(false)}
            />
            <Button
              label={updateMut.isPending ? 'Updating…' : 'Confirm'}
              variant="danger"
              className="flex-1"
              onPress={handleConfirmReject}
              disabled={updateMut.isPending}
            />
          </View>
        }
      >
        <Input
          label="Reason (optional)"
          value={rejectReason}
          onChangeText={setRejectReason}
          placeholder="Why is this proposal being rejected?"
          multiline
        />
      </AdaptiveSheet>
    </SafeAreaView>
  );
}

function EstimateSection({
  proposalId,
  projectId,
  estimates,
  isLoading,
  isError,
  onRetry,
  canManage,
}: {
  proposalId: string;
  projectId: string;
  estimates: EstimateListRow[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  canManage: boolean;
}) {
  const router = useRouter();
  const fromProposal = `&fromProposal=${proposalId}`;
  const importMut = useImportTender(proposalId);
  const createEst = useCreateEstimate(projectId);
  const [tenderResult, setTenderResult] = useState<TenderImportResult | null>(null);

  // Create an estimate from the extracted tender items, then add all items.
  const createEstimateFromTender = useMutation({
    mutationFn: async () => {
      if (!tenderResult || tenderResult.items.length === 0) throw new Error('No tender items');
      // 1. Create the estimate
      const estName = `Tender Import (${tenderResult.items.length} items)`;
      const est = await apiFetch<{ id: string }>(`/projects/${projectId}/estimates`, {
        method: 'POST',
        body: JSON.stringify({ name: estName }),
      });
      // 2. Group items by section
      const sectionMap = new Map<string, typeof tenderResult.items>();
      for (const item of tenderResult.items) {
        const sec = item.section || 'General';
        if (!sectionMap.has(sec)) sectionMap.set(sec, []);
        sectionMap.get(sec)!.push(item);
      }
      // 3. Create sections + items
      let secIdx = 0;
      for (const [secName, items] of sectionMap) {
        const section = await apiFetch<{ id: string }>(`/estimates/${est.id}/sections`, {
          method: 'POST',
          body: JSON.stringify({ name: secName, orderIndex: secIdx++ }),
        });
        for (const item of items) {
          await apiFetch<{ id: string }>(`/estimates/${est.id}/sections/${section.id}/items`, {
            method: 'POST',
            body: JSON.stringify({
              description: item.description,
              unit: item.unit,
              quantity: item.quantity,
              rate: item.rate,
              type: item.type,
              resourceId: item.resourceId ?? undefined,
              rateAnalysisId: item.rateAnalysisId ?? undefined,
            }),
          });
        }
      }
      return est;
    },
    onSuccess: (est: { id: string }) => {
      setTenderResult(null);
      router.push(`/(app)/estimation/${est.id}`);
    },
    onError: (e: Error) => {
      void alertAsync('Failed', e.message);
    },
  });

  function handleCreateEstimateFromTender() {
    createEstimateFromTender.mutate();
  }

  async function handleImportTender() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      const response = await fetch(file.uri);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = MobileBuffer.from(arrayBuffer).toString('base64');
      const res = await importMut.mutateAsync({
        fileContent: base64,
        filename: file.name,
        contentType: file.mimeType ?? 'application/octet-stream',
      });
      setTenderResult(res);
      if (res.items.length === 0) {
        await alertAsync('No items extracted', res.notes ?? 'Try a different file or add items manually.');
      }
    } catch (e) {
      await alertAsync('Import failed', e instanceof Error ? e.message : 'Unknown error');
    }
  }

  if (isLoading) return <LoadingSkeleton className="h-48 rounded-xl" />;

  if (isError) {
    return (
      <EmptyState
        title="Couldn't load estimates"
        action={<Button label="Retry" onPress={onRetry} />}
      />
    );
  }

  if (estimates.length === 0) {
    return (
      <EmptyState
        title="No estimates yet"
        description="Build your cost estimate for this proposal."
        action={
          canManage ? (
            <Button
              label="New Estimate"
              onPress={() =>
                router.push(
                  createEstimateHref({ projectId, fromProposal: proposalId }),
                )
              }
            />
          ) : undefined
        }
      />
    );
  }

  return (
    <View className="gap-3">
      {canManage && (
        <View className="flex-row gap-2 flex-wrap">
          <Button
            label="New Estimate"
            size="sm"
            onPress={() =>
              router.push(createEstimateHref({ projectId, fromProposal: proposalId }))
            }
          />
          {estimates.length >= 2 && (
            <Button
              label="Compare Versions"
              variant="secondary"
              size="sm"
              onPress={() =>
                router.push(`/(app)/estimation/compare?projectId=${projectId}${fromProposal}`)
              }
            />
          )}
        </View>
      )}

      {tenderResult && tenderResult.items.length > 0 && (
        <Card>
          <View className="flex-row justify-between items-center mb-1">
            <Text className="text-sm font-bold text-text">Extracted Items ({tenderResult.items.length})</Text>
            <Button
              label="Create Estimate →"
              size="sm"
              loading={createEstimateFromTender.isPending}
              onPress={handleCreateEstimateFromTender}
            />
          </View>
          {tenderResult.notes && (
            <Text className="text-xs text-text-muted mb-2">{tenderResult.notes}</Text>
          )}
          <Text className="text-xs text-text-muted mb-1">
            Tap "Create Estimate" to auto-create an estimate with all items grouped by section.
          </Text>
          {tenderResult.items.map((item, idx) => (
            <View key={idx} className="flex-row justify-between border-t border-border py-1.5">
              <View className="flex-1 pr-2">
                <Text className="text-sm text-text" numberOfLines={2}>{item.description}</Text>
                <Text className="text-xs text-text-muted">
                  {item.quantity} {item.unit} @ {formatINR(item.rate)}
                  {item.section ? ` · ${item.section}` : ''}
                </Text>
              </View>
              <Text className="text-sm font-semibold text-text">{formatINR(item.amount ?? item.quantity * item.rate)}</Text>
            </View>
          ))}
        </Card>
      )}
      {estimates.map((e: EstimateListRow) => (
        <Card
          key={e.id}
          onPress={() =>
            router.push(`/(app)/estimation/${e.id}?fromProposal=${proposalId}`)
          }
          className={e.status === 'APPROVED' ? 'border-2 border-accent' : undefined}
        >
          <View className="flex-row justify-between items-start mb-1">
            <View className="flex-1 pr-2">
              <Text className="text-sm font-semibold text-text">
                v{e.version}.0 - {e.name}
              </Text>
              <Text className="text-xs text-text-muted">{formatDate(e.createdAt)}</Text>
            </View>
            <Badge color={(ESTIMATE_STATUS_COLOR[e.status] ?? 'neutral') as 'neutral'} label={e.status} />
          </View>
          <View className="flex-row justify-between items-center pt-2 mt-1 border-t border-border">
            <Text className="text-xs text-text-muted">Grand Total</Text>
            <Text className="text-base font-bold text-primary">{formatINR(Number(e.grandTotal))}</Text>
          </View>
        </Card>
      ))}
    </View>
  );
}

function SummarySection({
  proposal,
  approvedEstimate,
}: {
  proposal: NonNullable<ReturnType<typeof useProposal>['data']>;
  approvedEstimate?: EstimateListRow;
}) {
  return (
    <Card>
      <Text className="text-sm font-bold text-text mb-2">Proposal Summary</Text>
      {proposal.notes ? (
        <Text className="text-sm text-text-muted mb-3">{proposal.notes}</Text>
      ) : (
        <Text className="text-sm text-text-muted mb-3">No notes added.</Text>
      )}
      {approvedEstimate ? (
        <View className="pt-2 border-t border-border">
          <Text className="text-xs text-text-muted">Approved estimate total</Text>
          <Text className="text-xl font-bold text-primary">
            {formatINR(Number(approvedEstimate.grandTotal))}
          </Text>
        </View>
      ) : (
        <Text className="text-sm text-text-muted">No approved estimate yet.</Text>
      )}
    </Card>
  );
}
