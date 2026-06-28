import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  Card,
  Button,
  Input,
  LoadingSkeleton,
  EmptyState,
} from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';
import { MaterialPicker } from '@/components/materials/MaterialPicker';
import {
  useProjectMaterialRates,
  useUpsertProjectMaterialRates,
  useCopyProjectRatesFromRegion,
  useCopyProjectRatesFromEstimate,
  useRateRegions,
  type ProjectMaterialRateRow,
  type RateRegionRow,
} from '@/services/rate-region.queries';
import { useMaterials, type Resource } from '@/services/estimate.queries';
import { useUpdateProject, useProject } from '@/services/project.queries';
import { alertAsync } from '@/utils/confirm';
import { formatINR } from '@/utils/format';

export function ProjectMaterialRatesSection({ projectId }: { projectId: string }) {
  const user = useAuthStore((s) => s.user);
  const canEdit = user?.role === 'OWNER' || user?.role === 'PM';
  const { data: project, refetch: refetchProject } = useProject(projectId);
  const { data: regions } = useRateRegions();
  const ratesQ = useProjectMaterialRates(projectId);
  const { data: materialsData } = useMaterials({ limit: 200 });
  const materials: Resource[] = materialsData?.data ?? [];

  const updateProject = useUpdateProject(projectId);
  const upsertRates = useUpsertProjectMaterialRates(projectId);
  const copyFromRegion = useCopyProjectRatesFromRegion(projectId);
  const copyFromEstimate = useCopyProjectRatesFromEstimate(projectId);

  const [editResourceId, setEditResourceId] = useState('');
  const [editRate, setEditRate] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const rates = ratesQ.data ?? [];
  const selectedMaterial = materials.find((m) => m.id === editResourceId);

  const onSaveRate = () => {
    if (!editResourceId || !selectedMaterial) {
      void alertAsync('Required', 'Select a material and enter a rate.');
      return;
    }
    upsertRates.mutate(
      [
        {
          resourceId: editResourceId,
          rate: parseFloat(editRate) || 0,
          unit: selectedMaterial.unit,
          notes: editNotes.trim() || undefined,
        },
      ],
      {
        onSuccess: () => {
          setEditResourceId('');
          setEditRate('');
          setEditNotes('');
        },
        onError: (e: Error) => void alertAsync('Error', e.message),
      },
    );
  };

  const onRegionChange = (regionId: string) => {
    updateProject.mutate(
      { rateRegionId: regionId || null },
      {
        onSuccess: () => refetchProject(),
        onError: (e: Error) => void alertAsync('Error', e.message),
      },
    );
  };

  return (
    <View className="gap-3">
      <Card>
        <Text className="text-sm font-bold text-text mb-2">Rate Region</Text>
        <Text className="text-xs text-muted mb-2">
          Regional defaults apply when no project override or estimate rate exists.
        </Text>
        {(regions ?? []).length === 0 ? (
          <Text className="text-xs text-muted">No rate regions configured in Settings.</Text>
        ) : (
          <View className="flex-row flex-wrap gap-2">
            <Pressable
              onPress={() => canEdit && onRegionChange('')}
              className={`px-3 py-1.5 rounded-full border ${
                !project?.rateRegionId ? 'bg-primary border-primary' : 'border-border'
              }`}
            >
              <Text className={`text-xs font-semibold ${!project?.rateRegionId ? 'text-white' : 'text-muted'}`}>
                None
              </Text>
            </Pressable>
            {(regions ?? []).map((r: RateRegionRow) => (
              <Pressable
                key={r.id}
                onPress={() => canEdit && onRegionChange(r.id)}
                className={`px-3 py-1.5 rounded-full border ${
                  project?.rateRegionId === r.id ? 'bg-primary border-primary' : 'border-border'
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    project?.rateRegionId === r.id ? 'text-white' : 'text-muted'
                  }`}
                >
                  {r.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </Card>

      <Card>
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-sm font-bold text-text">Project Material Rates</Text>
          {canEdit && (
            <View className="flex-row gap-2">
              <Button
                label="From region"
                size="sm"
                variant="secondary"
                loading={copyFromRegion.isPending}
                onPress={() =>
                  copyFromRegion.mutate(undefined, {
                    onError: (e: Error) => void alertAsync('Error', e.message),
                  })
                }
              />
              <Button
                label="From estimate"
                size="sm"
                variant="secondary"
                loading={copyFromEstimate.isPending}
                onPress={() =>
                  copyFromEstimate.mutate(undefined, {
                    onError: (e: Error) => void alertAsync('Error', e.message),
                  })
                }
              />
            </View>
          )}
        </View>

        {ratesQ.isLoading ? (
          <LoadingSkeleton className="h-24 rounded-lg" />
        ) : rates.length === 0 ? (
          <EmptyState
            title="No project overrides"
            description="Overrides take priority over estimate, regional, and catalog rates."
          />
        ) : (
          rates.map((r: ProjectMaterialRateRow) => (
            <View key={r.id} className="py-2 border-b border-border/60 flex-row justify-between">
              <View className="flex-1 pr-2">
                <Text className="text-sm text-text">{r.resourceName}</Text>
                {r.notes ? (
                  <Text className="text-[10px] text-muted" numberOfLines={1}>
                    {r.notes}
                  </Text>
                ) : null}
              </View>
              <Text className="text-sm font-semibold text-text">
                {formatINR(r.rate)}/{r.unit}
              </Text>
            </View>
          ))
        )}

        {canEdit && (
          <View className="mt-3 gap-2 pt-3 border-t border-border">
            <Text className="text-xs font-semibold text-muted">Add / update override</Text>
            <MaterialPicker
              selectedId={editResourceId}
              onSelect={(m) => {
                setEditResourceId(m.id);
                const existing = rates.find((row: ProjectMaterialRateRow) => row.resourceId === m.id);
                setEditRate(existing ? String(existing.rate) : m.rate);
              }}
              maxHeight={180}
            />
            <Input
              label="Rate (₹)"
              value={editRate}
              onChangeText={setEditRate}
              keyboardType="numeric"
            />
            <Input label="Notes (optional)" value={editNotes} onChangeText={setEditNotes} />
            <Button label="Save override" size="sm" loading={upsertRates.isPending} onPress={onSaveRate} />
          </View>
        )}
      </Card>
    </View>
  );
}
