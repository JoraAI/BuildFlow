/**
 * BuildFlow - Project RFI & Submittal tab.
 * Raise RFIs, answer them, and review material/shop-drawing submittals.
 */
import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button, Badge, LoadingSkeleton, EmptyState, Input } from '@/components/ui';
import { AdaptiveSheet } from '@/components/layout/AdaptiveSheet';
import { useViewport } from '@/hooks/useViewport';
import { useAuthStore } from '@/stores/auth.store';
import {
  useRfis,
  useCreateRfi,
  useAnswerRfi,
  useCloseRfi,
  useSubmittals,
  useCreateSubmittal,
  useSubmitSubmittal,
  useReviewSubmittal,
  type RfiItem,
  type RfiPriority,
  type RfiStatus,
  type SubmittalItem,
  type SubmittalStatus,
  type SubmittalType,
} from '@/services/rfi.queries';
import { formatDate } from '@/utils/format';
import { alertAsync } from '@/utils/confirm';

const RFI_STATUS_FILTERS: { id: RfiStatus | 'ALL'; label: string }[] = [
  { id: 'ALL', label: 'All RFIs' },
  { id: 'OPEN', label: 'Open' },
  { id: 'ANSWERED', label: 'Answered' },
  { id: 'CLOSED', label: 'Closed' },
];

const PRIORITIES: RfiPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

const SUBMITTAL_TYPES: { id: SubmittalType; label: string }[] = [
  { id: 'MATERIAL', label: 'Material' },
  { id: 'SHOP_DRAWING', label: 'Shop drawing' },
  { id: 'METHOD_STATEMENT', label: 'Method statement' },
  { id: 'OTHER', label: 'Other' },
];

const MUTATE_ROLES = new Set(['OWNER', 'PM', 'SITE_SUPERVISOR', 'DPM']);
const REVIEW_ROLES = new Set(['OWNER', 'PM']);

function priorityBadge(p: RfiPriority): 'danger' | 'warning' | 'neutral' {
  if (p === 'URGENT' || p === 'HIGH') return 'danger';
  if (p === 'NORMAL') return 'warning';
  return 'neutral';
}

function statusBadge(s: string): 'danger' | 'warning' | 'success' | 'neutral' | 'accent' {
  if (s === 'OPEN' || s === 'SUBMITTED' || s === 'DRAFT') return 'warning';
  if (s === 'ANSWERED' || s === 'APPROVED') return 'success';
  if (s === 'REJECTED' || s === 'CANCELLED') return 'danger';
  if (s === 'REVISE') return 'accent';
  return 'neutral';
}

interface RfisTabProps {
  projectId: string;
}

export function RfisTab({ projectId }: RfisTabProps) {
  const { isDesktop, isTablet } = useViewport();
  const role = useAuthStore((s) => s.user?.role);
  const canMutate = !!role && MUTATE_ROLES.has(role);
  const canReview = !!role && REVIEW_ROLES.has(role);

  const [section, setSection] = useState<'rfis' | 'submittals'>('rfis');
  const [rfiFilter, setRfiFilter] = useState<RfiStatus | 'ALL'>('ALL');
  const [showCreateRfi, setShowCreateRfi] = useState(false);
  const [showCreateSub, setShowCreateSub] = useState(false);
  const [answerTarget, setAnswerTarget] = useState<RfiItem | null>(null);

  const [subject, setSubject] = useState('');
  const [question, setQuestion] = useState('');
  const [priority, setPriority] = useState<RfiPriority>('NORMAL');
  const [answerText, setAnswerText] = useState('');

  const [subTitle, setSubTitle] = useState('');
  const [subDesc, setSubDesc] = useState('');
  const [subType, setSubType] = useState<SubmittalType>('MATERIAL');

  const rfisQ = useRfis({
    projectId,
    status: rfiFilter === 'ALL' ? undefined : rfiFilter,
  });
  const subsQ = useSubmittals({ projectId });

  const createRfi = useCreateRfi();
  const answerRfi = useAnswerRfi();
  const closeRfi = useCloseRfi();
  const createSub = useCreateSubmittal();
  const submitSub = useSubmitSubmittal();
  const reviewSub = useReviewSubmittal();

  const rfis = rfisQ.data?.data ?? [];
  const subs = subsQ.data?.data ?? [];

  const resetRfiForm = () => {
    setSubject('');
    setQuestion('');
    setPriority('NORMAL');
    setShowCreateRfi(false);
  };

  const resetSubForm = () => {
    setSubTitle('');
    setSubDesc('');
    setSubType('MATERIAL');
    setShowCreateSub(false);
  };

  const handleCreateRfi = async () => {
    if (!subject.trim() || !question.trim()) {
      await alertAsync('Required', 'Subject and question are required.');
      return;
    }
    try {
      await createRfi.mutateAsync({
        projectId,
        subject: subject.trim(),
        question: question.trim(),
        priority,
      });
      resetRfiForm();
      await alertAsync('RFI raised', 'The question is open for PM review.');
    } catch (e: unknown) {
      await alertAsync('Error', e instanceof Error ? e.message : 'Failed to raise RFI');
    }
  };

  const handleAnswer = async () => {
    if (!answerTarget || !answerText.trim()) {
      await alertAsync('Required', 'Provide an answer before submitting.');
      return;
    }
    try {
      await answerRfi.mutateAsync({ id: answerTarget.id, answer: answerText.trim() });
      setAnswerTarget(null);
      setAnswerText('');
      await alertAsync('Answered', 'RFI marked answered and notifier sent.');
    } catch (e: unknown) {
      await alertAsync('Error', e instanceof Error ? e.message : 'Failed to answer RFI');
    }
  };

  const handleCreateSub = async () => {
    if (!subTitle.trim()) {
      await alertAsync('Required', 'Submittal title is required.');
      return;
    }
    try {
      await createSub.mutateAsync({
        projectId,
        title: subTitle.trim(),
        description: subDesc.trim() || undefined,
        type: subType,
      });
      resetSubForm();
      await alertAsync('Submittal created', 'Draft saved — submit when ready for review.');
    } catch (e: unknown) {
      await alertAsync('Error', e instanceof Error ? e.message : 'Failed to create submittal');
    }
  };

  const gridClass = isDesktop || isTablet ? 'grid grid-cols-2 lg:grid-cols-3 gap-3' : 'gap-2.5';

  return (
    <View className="gap-4">
      <View className="flex-row justify-between items-start gap-2 flex-wrap">
        <View className="flex-1 min-w-[180px]">
          <Text className="text-xl font-bold text-text">RFIs & Submittals</Text>
          <Text className="text-xs text-muted mt-0.5">
            Site questions for clarification and material / drawing approvals
          </Text>
        </View>
        {canMutate ? (
          <Button
            label={section === 'rfis' ? 'Raise RFI' : 'New Submittal'}
            size="sm"
            onPress={() => (section === 'rfis' ? setShowCreateRfi(true) : setShowCreateSub(true))}
            icon={<Ionicons name="add" size={16} color="#fff" />}
          />
        ) : null}
      </View>

      <View className="flex-row flex-wrap gap-1.5">
        {(
          [
            { id: 'rfis' as const, label: 'RFIs' },
            { id: 'submittals' as const, label: 'Submittals' },
          ] as const
        ).map((s) => {
          const active = section === s.id;
          return (
            <Pressable
              key={s.id}
              onPress={() => setSection(s.id)}
              className={`px-3 py-1.5 rounded-lg border ${
                active ? 'bg-primary border-primary' : 'bg-card border-border'
              }`}
            >
              <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-text'}`}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {section === 'rfis' ? (
        <>
          <View className="flex-row flex-wrap gap-1.5">
            {RFI_STATUS_FILTERS.map((s) => {
              const active = rfiFilter === s.id;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setRfiFilter(s.id)}
                  className={`px-3 py-1.5 rounded-lg border ${
                    active ? 'bg-primary border-primary' : 'bg-card border-border'
                  }`}
                >
                  <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-text'}`}>
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {rfisQ.isLoading ? (
            <View className={gridClass}>
              <LoadingSkeleton className="h-24 rounded-xl" />
              <LoadingSkeleton className="h-24 rounded-xl" />
            </View>
          ) : rfis.length === 0 ? (
            <EmptyState
              title="No RFIs yet"
              description="Raise a request for information when drawings or specs need clarification."
            />
          ) : (
            <View className={gridClass}>
              {rfis.map((rfi: RfiItem) => (
                <Card key={rfi.id} className="p-3.5 gap-2">
                  <View className="flex-row justify-between items-start gap-2">
                    <View className="flex-1">
                      <Text className="text-xs text-muted font-medium">{rfi.rfiNumber}</Text>
                      <Text className="text-sm font-bold text-text mt-0.5">{rfi.subject}</Text>
                    </View>
                    <View className="items-end gap-1">
                      <Badge label={rfi.status} color={statusBadge(rfi.status)} />
                      <Badge label={rfi.priority} color={priorityBadge(rfi.priority)} />
                    </View>
                  </View>
                  <Text className="text-xs text-muted" numberOfLines={3}>
                    {rfi.question}
                  </Text>
                  {rfi.answer ? (
                    <View className="bg-surface rounded-lg p-2 border border-border">
                      <Text className="text-[10px] font-bold text-muted uppercase mb-0.5">
                        Answer
                      </Text>
                      <Text className="text-xs text-text">{rfi.answer}</Text>
                    </View>
                  ) : null}
                  <Text className="text-[10px] text-muted">
                    Raised {formatDate(rfi.createdAt)}
                    {rfi.raisedByUser?.name ? ` · ${rfi.raisedByUser.name}` : ''}
                  </Text>
                  <View className="flex-row flex-wrap gap-2 mt-1">
                    {canReview && rfi.status === 'OPEN' ? (
                      <Button
                        label="Answer"
                        size="sm"
                        variant="secondary"
                        onPress={() => {
                          setAnswerTarget(rfi);
                          setAnswerText('');
                        }}
                      />
                    ) : null}
                    {canMutate && (rfi.status === 'OPEN' || rfi.status === 'ANSWERED') ? (
                      <Button
                        label="Close"
                        size="sm"
                        variant="ghost"
                        onPress={async () => {
                          try {
                            await closeRfi.mutateAsync(rfi.id);
                          } catch (e: unknown) {
                            await alertAsync(
                              'Error',
                              e instanceof Error ? e.message : 'Failed to close',
                            );
                          }
                        }}
                      />
                    ) : null}
                  </View>
                </Card>
              ))}
            </View>
          )}
        </>
      ) : (
        <>
          {subsQ.isLoading ? (
            <View className={gridClass}>
              <LoadingSkeleton className="h-24 rounded-xl" />
              <LoadingSkeleton className="h-24 rounded-xl" />
            </View>
          ) : subs.length === 0 ? (
            <EmptyState
              title="No submittals yet"
              description="Create material datasheets, shop drawings, or method statements for approval."
            />
          ) : (
            <View className={gridClass}>
              {subs.map((sub: SubmittalItem) => (
                <Card key={sub.id} className="p-3.5 gap-2">
                  <View className="flex-row justify-between items-start gap-2">
                    <View className="flex-1">
                      <Text className="text-xs text-muted font-medium">{sub.submittalNo}</Text>
                      <Text className="text-sm font-bold text-text mt-0.5">{sub.title}</Text>
                    </View>
                    <Badge label={sub.status as SubmittalStatus} color={statusBadge(sub.status)} />
                  </View>
                  <Text className="text-xs text-muted">
                    {SUBMITTAL_TYPES.find((t) => t.id === sub.type)?.label ?? sub.type}
                  </Text>
                  {sub.description ? (
                    <Text className="text-xs text-muted" numberOfLines={2}>
                      {sub.description}
                    </Text>
                  ) : null}
                  {sub.reviewNotes ? (
                    <Text className="text-xs text-text">Review: {sub.reviewNotes}</Text>
                  ) : null}
                  <View className="flex-row flex-wrap gap-2 mt-1">
                    {canMutate && (sub.status === 'DRAFT' || sub.status === 'REVISE') ? (
                      <Button
                        label="Submit for review"
                        size="sm"
                        variant="secondary"
                        onPress={async () => {
                          try {
                            await submitSub.mutateAsync(sub.id);
                          } catch (e: unknown) {
                            await alertAsync(
                              'Error',
                              e instanceof Error ? e.message : 'Failed to submit',
                            );
                          }
                        }}
                      />
                    ) : null}
                    {canReview && sub.status === 'SUBMITTED' ? (
                      <>
                        <Button
                          label="Approve"
                          size="sm"
                          onPress={async () => {
                            try {
                              await reviewSub.mutateAsync({ id: sub.id, status: 'APPROVED' });
                            } catch (e: unknown) {
                              await alertAsync(
                                'Error',
                                e instanceof Error ? e.message : 'Failed to approve',
                              );
                            }
                          }}
                        />
                        <Button
                          label="Revise"
                          size="sm"
                          variant="secondary"
                          onPress={async () => {
                            try {
                              await reviewSub.mutateAsync({
                                id: sub.id,
                                status: 'REVISE',
                                reviewNotes: 'Please revise and resubmit',
                              });
                            } catch (e: unknown) {
                              await alertAsync(
                                'Error',
                                e instanceof Error ? e.message : 'Failed to request revise',
                              );
                            }
                          }}
                        />
                        <Button
                          label="Reject"
                          size="sm"
                          variant="ghost"
                          onPress={async () => {
                            try {
                              await reviewSub.mutateAsync({
                                id: sub.id,
                                status: 'REJECTED',
                                reviewNotes: 'Rejected',
                              });
                            } catch (e: unknown) {
                              await alertAsync(
                                'Error',
                                e instanceof Error ? e.message : 'Failed to reject',
                              );
                            }
                          }}
                        />
                      </>
                    ) : null}
                  </View>
                </Card>
              ))}
            </View>
          )}
        </>
      )}

      <AdaptiveSheet
        visible={showCreateRfi}
        onClose={resetRfiForm}
        title="Raise RFI"
      >
        <View className="gap-3 p-1">
          <Input label="Subject" value={subject} onChangeText={setSubject} placeholder="e.g. Slab pour level discrepancy" />
          <Input
            label="Question"
            value={question}
            onChangeText={setQuestion}
            placeholder="Describe what needs clarification…"
            multiline
          />
          <Text className="text-xs font-semibold text-muted">Priority</Text>
          <View className="flex-row flex-wrap gap-1.5">
            {PRIORITIES.map((p) => (
              <Pressable
                key={p}
                onPress={() => setPriority(p)}
                className={`px-3 py-1.5 rounded-lg border ${
                  priority === p ? 'bg-primary border-primary' : 'bg-card border-border'
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    priority === p ? 'text-white' : 'text-text'
                  }`}
                >
                  {p}
                </Text>
              </Pressable>
            ))}
          </View>
          <Button
            label="Submit RFI"
            onPress={handleCreateRfi}
            loading={createRfi.isPending}
          />
        </View>
      </AdaptiveSheet>

      <AdaptiveSheet
        visible={!!answerTarget}
        onClose={() => {
          setAnswerTarget(null);
          setAnswerText('');
        }}
        title={answerTarget ? `Answer ${answerTarget.rfiNumber}` : 'Answer RFI'}
      >
        <View className="gap-3 p-1">
          {answerTarget ? (
            <Text className="text-xs text-muted">{answerTarget.question}</Text>
          ) : null}
          <Input
            label="Answer"
            value={answerText}
            onChangeText={setAnswerText}
            placeholder="Provide clarification…"
            multiline
          />
          <Button label="Send answer" onPress={handleAnswer} loading={answerRfi.isPending} />
        </View>
      </AdaptiveSheet>

      <AdaptiveSheet visible={showCreateSub} onClose={resetSubForm} title="New Submittal">
        <View className="gap-3 p-1">
          <Input label="Title" value={subTitle} onChangeText={setSubTitle} placeholder="e.g. Tile sample datasheet" />
          <Input
            label="Description"
            value={subDesc}
            onChangeText={setSubDesc}
            placeholder="Optional notes"
            multiline
          />
          <Text className="text-xs font-semibold text-muted">Type</Text>
          <View className="flex-row flex-wrap gap-1.5">
            {SUBMITTAL_TYPES.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => setSubType(t.id)}
                className={`px-3 py-1.5 rounded-lg border ${
                  subType === t.id ? 'bg-primary border-primary' : 'bg-card border-border'
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    subType === t.id ? 'text-white' : 'text-text'
                  }`}
                >
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Button
            label="Create draft"
            onPress={handleCreateSub}
            loading={createSub.isPending}
          />
        </View>
      </AdaptiveSheet>
    </View>
  );
}
