import React, { useState } from 'react';
import { View, Text, Modal, Alert, ScrollView, Pressable, TextInput } from 'react-native';
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
  useWorkOrders,
  useSubcontractors,
  useCreateSubcontractor,
  useCreateWorkOrder,
  useMeasurements,
  useCreateMeasurement,
  useSubmitMeasurement,
  useApproveMeasurement,
  downloadMeasurementBookPdf,
  downloadAbstractSheetPdf,
  type Measurement,
  type Subcontractor,
  type WorkOrder,
} from '@/services/expansion.queries';
import * as Sharing from 'expo-sharing';

const STATUS_COLOR: Record<string, 'neutral' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

function MeasurementsPanel({
  projectId,
  workOrderId,
}: {
  projectId: string;
  workOrderId: string;
}) {
  const user = useAuthStore((s) => s.user);
  const canCreate = user?.role === 'OWNER' || user?.role === 'PM' || user?.role === 'SUPERVISOR';
  const canApprove = user?.role === 'OWNER' || user?.role === 'PM';

  const { data, isLoading } = useMeasurements(projectId, workOrderId);
  const createMeas = useCreateMeasurement(projectId, workOrderId);
  const submitMeas = useSubmitMeasurement(projectId);
  const approveMeas = useApproveMeasurement(projectId);

  const [modalOpen, setModalOpen] = useState(false);
  const [periodLabel, setPeriodLabel] = useState('');
  const [desc, setDesc] = useState('');
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState('Nos');
  const [rate, setRate] = useState('0');

  const onCreate = () => {
    if (!periodLabel.trim() || !desc.trim()) {
      Alert.alert('Required', 'Period label and description are required.');
      return;
    }
    createMeas.mutate(
      {
        periodLabel: periodLabel.trim(),
        lines: [
          {
            description: desc.trim(),
            quantity: parseFloat(qty) || 1,
            unit: unit.trim() || 'Nos',
            rate: parseFloat(rate) || 0,
          },
        ],
      },
      {
        onSuccess: () => {
          setModalOpen(false);
          setPeriodLabel('');
          setDesc('');
        },
        onError: (e: Error) => Alert.alert('Error', e.message),
      },
    );
  };

  const onDownloadPdf = async (type: 'book' | 'abstract') => {
    try {
      const uri =
        type === 'book'
          ? await downloadMeasurementBookPdf(projectId)
          : await downloadAbstractSheetPdf(projectId);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert('Saved', 'PDF saved to device.');
      }
    } catch (e) {
      Alert.alert('Download failed', e instanceof Error ? e.message : 'Could not download PDF');
    }
  };

  if (isLoading) return <LoadingSkeleton className="h-16 rounded-lg mt-2" />;

  const measurements = data ?? [];

  return (
    <View className="mt-2 pl-2 border-l-2 border-border gap-2">
      <View className="flex-row justify-between items-center">
        <Text className="text-xs font-bold text-muted uppercase">Measurement sheets</Text>
        {canCreate && (
          <Pressable onPress={() => setModalOpen(true)}>
            <Text className="text-primary text-xs font-semibold">+ Add</Text>
          </Pressable>
        )}
      </View>
      {measurements.length === 0 ? (
        <Text className="text-xs text-muted italic">No measurements yet.</Text>
      ) : (
        measurements.map((m: Measurement) => (
          <View key={m.id} className="bg-surface rounded-lg p-2">
            <View className="flex-row justify-between items-center">
              <Text className="text-sm font-medium text-text">{m.periodLabel}</Text>
              <Badge color={STATUS_COLOR[m.status] ?? 'neutral'} label={m.status} />
            </View>
            <Text className="text-xs text-muted">{formatDate(m.createdAt)}</Text>
            <Text className="text-sm font-semibold text-text mt-1">
              {formatINR(parseFloat(m.totalAmount))}
            </Text>
            <View className="flex-row flex-wrap gap-2 mt-2">
              {canCreate && m.status === 'DRAFT' && (
                <Button
                  label="Submit"
                  size="sm"
                  variant="secondary"
                  onPress={() =>
                    submitMeas.mutate(m.id, {
                      onError: (e: Error) => Alert.alert('Error', e.message),
                    })
                  }
                />
              )}
              {canApprove && m.status === 'SUBMITTED' && (
                <Button
                  label="Approve"
                  size="sm"
                  onPress={() =>
                    approveMeas.mutate(m.id, {
                      onError: (e: Error) => Alert.alert('Error', e.message),
                    })
                  }
                />
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
        ))
      )}

      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <ScrollView className="bg-card rounded-t-2xl" contentContainerClassName="p-4 gap-3">
            <Text className="text-lg font-bold text-text">New Measurement</Text>
            <Input label="Period" value={periodLabel} onChangeText={setPeriodLabel} placeholder="Jan 2025" />
            <TextInput
              className="border border-border rounded-lg p-2 text-sm text-text"
              placeholder="Work description"
              value={desc}
              onChangeText={setDesc}
              multiline
            />
            <View className="flex-row gap-2">
              <Input label="Qty" value={qty} onChangeText={setQty} keyboardType="numeric" />
              <Input label="Unit" value={unit} onChangeText={setUnit} />
              <Input label="Rate" value={rate} onChangeText={setRate} keyboardType="numeric" />
            </View>
            <Button label="Create" loading={createMeas.isPending} onPress={onCreate} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

export function SubcontractsTab({ projectId }: { projectId: string }) {
  const { isDesktop } = useViewport();
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === 'OWNER' || user?.role === 'PM';

  const { data: workOrders, isLoading } = useWorkOrders(projectId);
  const { data: subcontractors } = useSubcontractors();
  const createSub = useCreateSubcontractor();
  const createWO = useCreateWorkOrder(projectId);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [woModal, setWoModal] = useState(false);
  const [subModal, setSubModal] = useState(false);

  const [woNumber, setWoNumber] = useState('');
  const [scope, setScope] = useState('');
  const [contractValue, setContractValue] = useState('');
  const [selectedSub, setSelectedSub] = useState('');

  const [subName, setSubName] = useState('');
  const [subGstin, setSubGstin] = useState('');
  const [subPhone, setSubPhone] = useState('');

  const onCreateSub = () => {
    if (!subName.trim()) {
      Alert.alert('Required', 'Subcontractor name is required.');
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
        onError: (e: Error) => Alert.alert('Error', e.message),
      },
    );
  };

  const onCreateWO = () => {
    if (!woNumber.trim() || !scope.trim() || !selectedSub) {
      Alert.alert('Required', 'WO number, scope, and subcontractor are required.');
      return;
    }
    createWO.mutate(
      {
        subcontractorId: selectedSub,
        woNumber: woNumber.trim(),
        scope: scope.trim(),
        contractValue: parseFloat(contractValue) || 0,
        retentionPct: 0,
        advanceAmount: 0,
      },
      {
        onSuccess: () => {
          setWoModal(false);
          setWoNumber('');
          setScope('');
        },
        onError: (e: Error) => Alert.alert('Error', e.message),
      },
    );
  };

  if (isLoading) return <LoadingSkeleton className="h-48 rounded-xl" />;

  const orders = workOrders ?? [];
  const subs = subcontractors ?? [];

  return (
    <View className="gap-3">
      <View className="flex-row justify-between items-center">
        <Text className="text-sm font-bold text-text">{orders.length} Work Orders</Text>
        {canManage && (
          <View className={`gap-2 ${isDesktop ? 'flex-row' : ''}`}>
            <Button label="Add Subcontractor" size="sm" variant="secondary" onPress={() => setSubModal(true)} />
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
                <Badge color="neutral" label={wo.status} />
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
              <MeasurementsPanel projectId={projectId} workOrderId={wo.id} />
            )}
          </Card>
        ))
      )}

      {/* Create WO modal */}
      <Modal visible={woModal} transparent animationType="slide" onRequestClose={() => setWoModal(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <ScrollView className="bg-card rounded-t-2xl" contentContainerClassName="p-4 gap-3">
            <Text className="text-lg font-bold text-text">New Work Order</Text>
            <Input label="WO Number" value={woNumber} onChangeText={setWoNumber} placeholder="WO-001" />
            <Input label="Scope" value={scope} onChangeText={setScope} multiline />
            <Input
              label="Contract value (₹)"
              value={contractValue}
              onChangeText={setContractValue}
              keyboardType="numeric"
            />
            <Text className="text-sm font-semibold text-text">Subcontractor</Text>
            {subs.map((s: Subcontractor) => (
              <Pressable
                key={s.id}
                onPress={() => setSelectedSub(s.id)}
                className={`p-2 rounded-lg border ${
                  selectedSub === s.id ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <Text className="text-sm text-text">{s.name}</Text>
              </Pressable>
            ))}
            <Button label="Create WO" loading={createWO.isPending} onPress={onCreateWO} />
          </ScrollView>
        </View>
      </Modal>

      {/* Create subcontractor modal */}
      <Modal visible={subModal} transparent animationType="slide" onRequestClose={() => setSubModal(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <ScrollView className="bg-card rounded-t-2xl" contentContainerClassName="p-4 gap-3">
            <Text className="text-lg font-bold text-text">Add Subcontractor</Text>
            <Input label="Name" value={subName} onChangeText={setSubName} />
            <Input label="GSTIN" value={subGstin} onChangeText={setSubGstin} autoCapitalize="characters" />
            <Input label="Phone" value={subPhone} onChangeText={setSubPhone} keyboardType="phone-pad" />
            <Button label="Save" loading={createSub.isPending} onPress={onCreateSub} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
