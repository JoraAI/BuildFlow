import React, { useState } from 'react';
import { View, Text, Modal, Alert, TextInput, ScrollView, Pressable } from 'react-native';
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
  type ChangeOrder,
} from '@/services/expansion.queries';

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

export function VariationsTab({ projectId }: { projectId: string }) {
  const { isDesktop } = useViewport();
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === 'OWNER' || user?.role === 'PM';
  const canApprove = user?.role === 'OWNER';

  const { data, isLoading, refetch } = useChangeOrders(projectId);
  const createCo = useCreateChangeOrder(projectId);
  const submitCo = useSubmitChangeOrder(projectId);
  const approveCo = useApproveChangeOrder(projectId);
  const rejectCo = useRejectChangeOrder(projectId);

  const [modalOpen, setModalOpen] = useState(false);
  const [number, setNumber] = useState('');
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [scheduleDays, setScheduleDays] = useState('0');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);

  const resetForm = () => {
    setNumber('');
    setTitle('');
    setReason('');
    setScheduleDays('0');
    setLines([emptyLine()]);
  };

  const onCreate = () => {
    if (!number.trim() || !title.trim()) {
      Alert.alert('Required', 'Variation number and title are required.');
      return;
    }
    const validLines = lines.filter((l) => l.description.trim());
    if (validLines.length === 0) {
      Alert.alert('Add lines', 'Add at least one line item.');
      return;
    }
    createCo.mutate(
      {
        number: number.trim(),
        title: title.trim(),
        reason: reason.trim() || undefined,
        scheduleImpactDays: parseInt(scheduleDays, 10) || 0,
        lines: validLines.map((l) => ({
          description: l.description.trim(),
          unit: l.unit.trim() || 'Nos',
          qtyDelta: parseFloat(l.qtyDelta) || 0,
          rate: parseFloat(l.rate) || 0,
        })),
      },
      {
        onSuccess: () => {
          setModalOpen(false);
          resetForm();
        },
        onError: (e: Error) => Alert.alert('Error', e.message),
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
          { onError: (e: Error) => Alert.alert('Error', e.message) },
        );
      },
    );
    if (!Alert.prompt) {
      rejectCo.mutate(
        { changeOrderId: co.id, reason: 'Rejected' },
        { onError: (e: Error) => Alert.alert('Error', e.message) },
      );
    }
  };

  if (isLoading) return <LoadingSkeleton className="h-48 rounded-xl" />;

  const orders = data ?? [];

  return (
    <View className="gap-3">
      <View className="flex-row justify-between items-center">
        <Text className="text-sm font-bold text-text">{orders.length} Variations</Text>
        {canManage && (
          <Button label="New Variation" size="sm" onPress={() => setModalOpen(true)} />
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
      ) : (
        orders.map((co: ChangeOrder) => (
          <Card key={co.id}>
            <View className="flex-row justify-between items-start mb-2">
              <View className="flex-1 mr-2">
                <Text className="text-sm font-semibold text-text">
                  {co.number} — {co.title}
                </Text>
                <Text className="text-xs text-muted">{formatDate(co.createdAt)}</Text>
              </View>
              <Badge color={STATUS_COLOR[co.status] ?? 'neutral'} label={co.status} />
            </View>
            {co.reason ? (
              <Text className="text-xs text-muted mb-2" numberOfLines={2}>
                {co.reason}
              </Text>
            ) : null}
            <View className="flex-row justify-between items-center pt-2 border-t border-border">
              <Text className="text-xs text-muted">
                {co.lines.length} lines • {co.scheduleImpactDays}d schedule
              </Text>
              <Text className="text-sm font-bold text-primary">
                {formatINR(parseFloat(co.costImpact))}
              </Text>
            </View>
            {canManage && (co.status === 'DRAFT' || co.status === 'REJECTED') && (
              <View className="mt-2">
                <Button
                  label="Submit for approval"
                  size="sm"
                  variant="secondary"
                  loading={submitCo.isPending}
                  onPress={() =>
                    submitCo.mutate(co.id, {
                      onError: (e: Error) => Alert.alert('Error', e.message),
                    })
                  }
                />
              </View>
            )}
            {canApprove && co.status === 'SUBMITTED' && (
              <View className={`mt-2 ${isDesktop ? 'flex-row gap-2' : 'gap-2'}`}>
                <View className={isDesktop ? 'flex-1' : undefined}>
                  <Button
                    label="Approve"
                    size="sm"
                    loading={approveCo.isPending}
                    onPress={() =>
                      approveCo.mutate(co.id, {
                        onError: (e: Error) => Alert.alert('Error', e.message),
                      })
                    }
                  />
                </View>
                <View className={isDesktop ? 'flex-1' : undefined}>
                  <Button
                    label="Reject"
                    size="sm"
                    variant="secondary"
                    loading={rejectCo.isPending}
                    onPress={() => onReject(co)}
                  />
                </View>
              </View>
            )}
          </Card>
        ))
      )}

      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-card rounded-t-2xl max-h-[90%]">
            <ScrollView contentContainerClassName="p-4 gap-3">
              <Text className="text-lg font-bold text-text">New Variation</Text>
              <Input label="Number" value={number} onChangeText={setNumber} placeholder="CO-001" />
              <Input label="Title" value={title} onChangeText={setTitle} placeholder="Additional foundation work" />
              <Input
                label="Reason"
                value={reason}
                onChangeText={setReason}
                placeholder="Client request"
                multiline
              />
              <Input
                label="Schedule impact (days)"
                value={scheduleDays}
                onChangeText={setScheduleDays}
                keyboardType="numeric"
              />
              <Text className="text-sm font-bold text-text">Line items</Text>
              {lines.map((line, idx) => (
                <View key={line.id} className="border border-border rounded-lg p-2 gap-2">
                  <Text className="text-xs text-muted">Line {idx + 1}</Text>
                  <TextInput
                    className="border border-border rounded-lg p-2 text-sm text-text"
                    placeholder="Description"
                    value={line.description}
                    onChangeText={(v) =>
                      setLines((prev) =>
                        prev.map((l) => (l.id === line.id ? { ...l, description: v } : l)),
                      )
                    }
                  />
                  <View className="flex-row gap-2">
                    <TextInput
                      className="flex-1 border border-border rounded-lg p-2 text-sm text-text"
                      placeholder="Qty Δ"
                      value={line.qtyDelta}
                      onChangeText={(v) =>
                        setLines((prev) =>
                          prev.map((l) => (l.id === line.id ? { ...l, qtyDelta: v } : l)),
                        )
                      }
                      keyboardType="numeric"
                    />
                    <TextInput
                      className="w-16 border border-border rounded-lg p-2 text-sm text-text"
                      placeholder="Unit"
                      value={line.unit}
                      onChangeText={(v) =>
                        setLines((prev) =>
                          prev.map((l) => (l.id === line.id ? { ...l, unit: v } : l)),
                        )
                      }
                    />
                    <TextInput
                      className="flex-1 border border-border rounded-lg p-2 text-sm text-text"
                      placeholder="Rate"
                      value={line.rate}
                      onChangeText={(v) =>
                        setLines((prev) =>
                          prev.map((l) => (l.id === line.id ? { ...l, rate: v } : l)),
                        )
                      }
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              ))}
              <Pressable onPress={() => setLines((prev) => [...prev, emptyLine()])}>
                <Text className="text-primary text-sm font-semibold">+ Add line</Text>
              </Pressable>
              <View className="flex-row gap-2 pb-4">
                <View className="flex-1">
                  <Button label="Cancel" variant="secondary" onPress={() => setModalOpen(false)} />
                </View>
                <View className="flex-1">
                  <Button label="Create" loading={createCo.isPending} onPress={onCreate} />
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
