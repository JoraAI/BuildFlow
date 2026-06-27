/**
 * BuildFlow — Material Price Tracker.
 * Lists all materials with current rate + sparkline. Tap for full price history chart.
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal, TextInput, Alert, ActivityIndicator, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Card, Button, Badge, LoadingSkeleton, EmptyState, SearchBar } from '@/components/ui';
import { LineChart, Sparkline } from '@/components/charts/LineChart';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import {
  useResources,
  usePriceHistory,
  useAddPriceHistory,
  type Resource,
  type PriceHistoryPoint,
} from '@/services/estimate.queries';
import { formatINR, formatDate } from '@/utils/format';

export default function MaterialPriceTrackerScreen() {
  const router = useRouter();
  const { data, isLoading } = useResources();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const materials = (data?.data ?? []).filter(
    (r: Resource) => r.type === 'MATERIAL' && r.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['bottom']}>
      <OfflineBanner />
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <Pressable onPress={() => router.back()} className="mr-3">
          <Text className="text-primary text-lg">‹ Back</Text>
        </Pressable>
        <Text className="text-lg font-bold text-text flex-1">Material Prices</Text>
      </View>

      <View className="px-4 py-3">
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search materials..." />
      </View>

      <ScrollView contentContainerClassName="px-4 pb-32 gap-3">
        {isLoading ? (
          [1, 2, 3, 4, 5].map((i) => <LoadingSkeleton key={i} className="h-20 rounded-xl" />)
        ) : materials.length === 0 ? (
          <EmptyState title="No materials" description="Materials with price history will appear here." />
        ) : (
          materials.map((m: Resource) => <MaterialRow key={m.id} material={m} onPress={() => setSelected(m.id)} />)
        )}
      </ScrollView>

      {/* Price history modal */}
      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        {selected && <PriceHistorySheet resourceId={selected} onClose={() => setSelected(null)} />}
      </Modal>
    </SafeAreaView>
  );
}

function MaterialRow({ material, onPress }: { material: Resource; onPress: () => void }) {
  const { data: hist } = usePriceHistory(material.id);
  // Build sparkline data (last 6 points)
  const sparkData: number[] = (hist?.data ?? []).slice(-6).map((p: PriceHistoryPoint) => parseFloat(p.rate));
  if (sparkData.length === 0) sparkData.push(parseFloat(material.rate));
  const prevRate = sparkData.length > 1 ? sparkData[sparkData.length - 2] : sparkData[0];
  const curRate = parseFloat(material.rate);
  const change = curRate - prevRate;
  const changePct = prevRate > 0 ? (change / prevRate) * 100 : 0;

  return (
    <Pressable onPress={onPress}>
      <Card>
        <View className="flex-row justify-between items-start">
          <View className="flex-1 pr-2">
            <Text className="text-sm font-semibold text-text">{material.name}</Text>
            <Text className="text-xs text-text-muted">
              Rs {formatINR(curRate)}/{material.unit}
            </Text>
            {material.lastRateUpdatedAt && (
              <Text className="text-[10px] text-text-muted mt-0.5">
                Updated {formatDate(material.lastRateUpdatedAt)}
              </Text>
            )}
          </View>
          <View className="items-end">
            {change !== 0 && (
              <Badge
                label={`${change > 0 ? '▲' : '▼'} ${Math.abs(changePct).toFixed(1)}%`}
                color={change > 0 ? 'danger' : 'success'}
              />
            )}
          </View>
        </View>
        {/* Sparkline */}
        {sparkData.length > 1 && (
          <View className="mt-2 items-end">
            <Sparkline data={sparkData} width={280} height={32} color={change > 0 ? '#EF4444' : '#10B981'} />
          </View>
        )}
      </Card>
    </Pressable>
  );
}

function PriceHistorySheet({ resourceId, onClose }: { resourceId: string; onClose: () => void }) {
  const { width: screenWidth } = useWindowDimensions();
  const { data: material } = useResources();
  const { data: hist, isLoading } = usePriceHistory(resourceId);
  const addMut = useAddPriceHistory(resourceId);
  const [showForm, setShowForm] = useState(false);
  const [newRate, setNewRate] = useState('');
  const [notes, setNotes] = useState('');

  const res = material?.data.find((r: Resource) => r.id === resourceId);
  const chartData = (hist?.data ?? []).map((p: PriceHistoryPoint) => ({
    x: p.effectiveDate,
    y: parseFloat(p.rate),
  }));

  async function handleSave() {
    const rate = parseFloat(newRate);
    if (!rate || rate <= 0) return Alert.alert('Enter valid rate');
    try {
      await addMut.mutateAsync({ rate, notes: notes.trim() || undefined });
      setNewRate('');
      setNotes('');
      setShowForm(false);
    } catch (e) {
      Alert.alert('Failed', e instanceof Error ? e.message : '');
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <Pressable onPress={onClose} className="mr-3">
          <Text className="text-primary text-lg">‹ Back</Text>
        </Pressable>
        <View className="flex-1">
          <Text className="text-lg font-bold text-text">{res?.name ?? 'Material'}</Text>
          <Text className="text-xs text-text-muted">Price History</Text>
        </View>
        <Button label="Update Rate" size="sm" onPress={() => setShowForm(true)} />
      </View>

      <ScrollView contentContainerClassName="p-4 gap-4">
        {/* Chart */}
        <Card>
          <Text className="text-sm font-bold text-text mb-2">Price Trend</Text>
          {isLoading ? (
            <ActivityIndicator />
          ) : chartData.length > 0 ? (
            <LineChart
              data={chartData}
              width={Math.min(screenWidth - 48, 360)}
              height={220}
              color="#1E3A5F"
              yLabelPrefix="₹"
              xTickFormat={(v: number | string) => {
                const date = new Date(v as string);
                return `${date.getDate()}/${date.getMonth() + 1}`;
              }}
            />
          ) : (
            <Text className="text-sm text-text-muted text-center py-8">No history yet</Text>
          )}
        </Card>

        {/* Update form */}
        {showForm && (
          <Card>
            <Text className="text-sm font-semibold text-text mb-2">Record New Market Rate</Text>
            <View className="flex-row items-center mb-2">
              <Text className="text-sm text-text-muted mr-2">Rate:</Text>
              <TextInput
                value={newRate}
                onChangeText={setNewRate}
                keyboardType="decimal-pad"
                placeholder={res?.rate ?? '0'}
                placeholderTextColor="#94A3B8"
                className="border border-border rounded px-3 py-2 text-sm text-text flex-1"
              />
              <Text className="text-sm text-text-muted ml-2">/{res?.unit}</Text>
            </View>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Notes (optional)"
              placeholderTextColor="#94A3B8"
              className="border border-border rounded px-3 py-2 text-sm text-text mb-2"
            />
            <View className="flex-row gap-2">
              <Button label="Save" size="sm" onPress={handleSave} loading={addMut.isPending} />
              <Button label="Cancel" size="sm" variant="ghost" onPress={() => setShowForm(false)} />
            </View>
          </Card>
        )}

        {/* History list */}
        <Text className="text-sm font-bold text-text">History</Text>
        {(hist?.data ?? [])
          .slice()
          .reverse()
          .map((p: PriceHistoryPoint) => (
            <Card key={p.id}>
              <View className="flex-row justify-between items-center">
                <View>
                  <Text className="text-sm font-semibold text-text">Rs {formatINR(parseFloat(p.rate))}</Text>
                  <Text className="text-xs text-text-muted">{formatDate(p.effectiveDate)}</Text>
                </View>
                {p.notes && <Text className="text-xs text-text-muted flex-1 ml-3">{p.notes}</Text>}
              </View>
            </Card>
          ))}
      </ScrollView>
    </SafeAreaView>
  );
}