/**
 * BuildFlow - Rate regions settings (regional material rate books).
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Card,
  Button,
  Input,
  LoadingSkeleton,
  EmptyState,
  DateField,
} from '@/components/ui';
import { SettingsPageLayout } from '@/components/layout/SettingsPageLayout';
import { FormScreenHeader } from '@/components/layout/ScreenHeader';
import { useViewport } from '@/hooks/useViewport';
import { MaterialPicker } from '@/components/materials/MaterialPicker';
import {
  useRateRegions,
  useCreateRateRegion,
  useRegionalRates,
  useUpsertRegionalRates,
  type RateRegionRow,
  type RegionalRateRow,
} from '@/services/rate-region.queries';
import { useMaterials, type Resource } from '@/services/estimate.queries';
import { formatINR } from '@/utils/format';
import { todayDateOnly } from '@/utils/date-field';
import { alertAsync } from '@/utils/confirm';
import { useRouter } from 'expo-router';

export default function RateRegionsScreen() {
  const router = useRouter();
  const { isDesktop } = useViewport();
  const { data: regions, isLoading } = useRateRegions();
  const createRegion = useCreateRateRegion();
  const { data: materialsData } = useMaterials({ limit: 200 });
  const materials: Resource[] = materialsData?.data ?? [];

  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [newName, setNewName] = useState('');
  const [newState, setNewState] = useState('');
  const [addResourceId, setAddResourceId] = useState('');
  const [addRate, setAddRate] = useState('');
  const [addDate, setAddDate] = useState(todayDateOnly());

  const activeRegionId = selectedRegionId || regions?.[0]?.id || '';
  const ratesQ = useRegionalRates(activeRegionId);
  const upsertRates = useUpsertRegionalRates(activeRegionId);

  const onCreateRegion = () => {
    if (!newName.trim()) {
      void alertAsync('Required', 'Enter a region name.');
      return;
    }
    createRegion.mutate(
      { name: newName.trim(), state: newState.trim() || undefined },
      {
        onSuccess: (row) => {
          setSelectedRegionId(row.id);
          setNewName('');
          setNewState('');
        },
        onError: (e: Error) => void alertAsync('Error', e.message),
      },
    );
  };

  const onAddRate = () => {
    const res = materials.find((m) => m.id === addResourceId);
    if (!res || !addRate.trim()) {
      void alertAsync('Required', 'Select material and enter rate.');
      return;
    }
    upsertRates.mutate(
      [
        {
          resourceId: res.id,
          rate: parseFloat(addRate) || 0,
          unit: res.unit,
          effectiveDate: addDate,
        },
      ],
      {
        onSuccess: () => {
          setAddResourceId('');
          setAddRate('');
        },
        onError: (e: Error) => void alertAsync('Error', e.message),
      },
    );
  };

  const body = (
    <ScrollView className="flex-1" contentContainerClassName="p-4 gap-4 pb-16">
      <Card>
        <Text className="text-sm font-bold text-text mb-2">New Rate Region</Text>
        <Input label="Name" value={newName} onChangeText={setNewName} placeholder="Hyderabad" />
        <Input label="State (optional)" value={newState} onChangeText={setNewState} placeholder="Telangana" />
        <Button label="Create region" loading={createRegion.isPending} onPress={onCreateRegion} />
      </Card>

      {isLoading ? (
        <LoadingSkeleton className="h-32 rounded-xl" />
      ) : !regions?.length ? (
        <EmptyState title="No regions yet" description="Create a rate region to manage local material defaults." />
      ) : (
        <>
          <View className="flex-row flex-wrap gap-2">
            {regions.map((r: RateRegionRow) => (
              <Pressable
                key={r.id}
                onPress={() => setSelectedRegionId(r.id)}
                className={`px-3 py-2 rounded-lg border ${
                  activeRegionId === r.id ? 'border-primary bg-primary/5' : 'border-border bg-card'
                }`}
              >
                <Text className="text-sm font-semibold text-text">{r.name}</Text>
                <Text className="text-[10px] text-muted">
                  {r.ratesCount} rates · {r.projectsCount} projects
                </Text>
              </Pressable>
            ))}
          </View>

          <Card>
            <Text className="text-sm font-bold text-text mb-2">Regional Rates</Text>
            {ratesQ.isLoading ? (
              <LoadingSkeleton className="h-24 rounded-lg" />
            ) : (ratesQ.data ?? []).length === 0 ? (
              <Text className="text-xs text-muted">No rates for this region yet.</Text>
            ) : (
              (ratesQ.data ?? []).map((row: RegionalRateRow) => (
                <View key={row.id} className="py-2 border-b border-border/60 flex-row justify-between">
                  <View className="flex-1">
                    <Text className="text-sm text-text">{row.resourceName}</Text>
                    <Text className="text-[10px] text-muted">{row.effectiveDate.slice(0, 10)}</Text>
                  </View>
                  <Text className="text-sm font-semibold text-text">
                    {formatINR(row.rate)}/{row.unit}
                  </Text>
                </View>
              ))
            )}

            <View className="mt-3 pt-3 border-t border-border gap-2">
              <Text className="text-xs font-semibold text-muted">Add rate</Text>
              <MaterialPicker
                selectedId={addResourceId}
                onSelect={(m) => {
                  setAddResourceId(m.id);
                  setAddRate(m.rate);
                }}
                maxHeight={160}
              />
              <Input label="Rate (₹)" value={addRate} onChangeText={setAddRate} keyboardType="numeric" />
              <DateField label="Effective from" value={addDate} onChange={setAddDate} />
              <Button label="Save rate" size="sm" loading={upsertRates.isPending} onPress={onAddRate} />
            </View>
          </Card>
        </>
      )}
    </ScrollView>
  );

  if (isDesktop) {
    return (
      <SettingsPageLayout title="Rate Regions" subtitle="Regional material rate books for new projects.">
        {body}
      </SettingsPageLayout>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <FormScreenHeader title="Rate Regions" onCancel={() => router.back()} />
      {body}
    </SafeAreaView>
  );
}
