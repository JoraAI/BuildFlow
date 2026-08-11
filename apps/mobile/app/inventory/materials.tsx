/**
 * Inventory shell - Materials catalog.
 *
 * Create and list materials (resources) for indents, POs, GRNs, and stock.
 */
import React, { useState } from 'react';
import { View, Text, FlatList, Modal, ScrollView, RefreshControl, Pressable } from 'react-native';
import { Card, Button, Input, EmptyState, LoadingSkeleton, Select, toast } from '@/components/ui';
import { useResources, useCreateResource, type Resource } from '@/services/estimate.queries';
import { formatINR } from '@/utils/format';

export default function InventoryMaterialsScreen() {
  const { data, isLoading, isFetching, refetch } = useResources();
  const createResource = useCreateResource();
  const [createOpen, setCreateOpen] = useState(false);

  const materials = (data?.data ?? []).filter((r: Resource) => r.type === 'MATERIAL' || !r.type);

  return (
    <View className="flex-1 bg-surface">
      <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
        <View className="flex-1 mr-2">
          <Text className="text-2xl font-bold text-text">Materials</Text>
          <Text className="text-sm text-muted mt-0.5">Catalog items for procurement & stock</Text>
        </View>
        <Button label="Add material" variant="accent" size="sm" onPress={() => setCreateOpen(true)} />
      </View>

      {isLoading ? (
        <View className="px-4 gap-3">
          {[1, 2, 3].map((i) => (
            <LoadingSkeleton key={i} className="rounded-xl h-16" />
          ))}
        </View>
      ) : (
        <FlatList
          className="flex-1"
          data={materials}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} tintColor="#1E3A5F" />
          }
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ListEmptyComponent={
            <EmptyState
              title="No materials yet"
              description="Add materials to your catalog, then create an indent and receive stock via GRN."
            />
          }
          renderItem={({ item }) => (
            <Card className="mb-2 p-4">
              <View className="flex-row items-start justify-between">
                <View className="flex-1 mr-2">
                  <Text className="text-sm font-semibold text-text">{item.name}</Text>
                  <Text className="text-xs text-muted mt-0.5">
                    {item.unit}
                    {item.brandOrSpec ? ` · ${item.brandOrSpec}` : ''}
                    {item.category ? ` · ${item.category}` : ''}
                  </Text>
                </View>
                <Text className="text-sm font-bold text-primary">{formatINR(Number(item.rate))}</Text>
              </View>
            </Card>
          )}
        />
      )}

      <AddMaterialModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={async (input) => {
          await createResource.mutateAsync(input);
          toast.success('Material added');
          setCreateOpen(false);
          void refetch();
        }}
        submitting={createResource.isPending}
      />
    </View>
  );
}

function AddMaterialModal({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    name: string;
    type: 'MATERIAL';
    unit: string;
    rate: number;
    gstRate?: number;
    brandOrSpec?: string;
    category?: string;
  }) => Promise<void>;
  submitting: boolean;
}) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('nos');
  const [rate, setRate] = useState('');
  const [gstRate, setGstRate] = useState('18');
  const [brandOrSpec, setBrandOrSpec] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setUnit('nos');
    setRate('');
    setGstRate('18');
    setBrandOrSpec('');
    setCategory('');
    setError(null);
  };

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40 justify-end" onPress={onClose}>
        <Pressable
          className="bg-card rounded-t-2xl max-h-[85%] p-4"
          onPress={(e) => e.stopPropagation()}
        >
          <Text className="text-lg font-bold text-text mb-3">Add material</Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Input label="Name" value={name} onChangeText={setName} placeholder="e.g. OPC 53 Cement" />
            <Select
              label="Unit"
              value={unit}
              onChange={(v) => v && setUnit(v)}
              options={[
                { title: 'Nos', value: 'nos' },
                { title: 'Bag', value: 'bag' },
                { title: 'Kg', value: 'kg' },
                { title: 'MT', value: 'mt' },
                { title: 'Cum', value: 'cum' },
                { title: 'Sqm', value: 'sqm' },
                { title: 'Litre', value: 'ltr' },
                { title: 'Box', value: 'box' },
              ]}
            />
            <Input
              label="Rate (₹)"
              value={rate}
              onChangeText={setRate}
              keyboardType="decimal-pad"
              placeholder="0"
            />
            <Input
              label="GST %"
              value={gstRate}
              onChangeText={setGstRate}
              keyboardType="decimal-pad"
              placeholder="18"
            />
            <Input
              label="Brand / spec (optional)"
              value={brandOrSpec}
              onChangeText={setBrandOrSpec}
            />
            <Input label="Category (optional)" value={category} onChangeText={setCategory} />
            {error ? <Text className="text-sm text-danger mt-2">{error}</Text> : null}
            <View className="flex-row gap-2 mt-4 mb-6">
              <Button
                label="Cancel"
                variant="secondary"
                className="flex-1"
                onPress={() => {
                  reset();
                  onClose();
                }}
              />
              <Button
                label={submitting ? 'Saving…' : 'Save'}
                variant="accent"
                className="flex-1"
                disabled={submitting}
                onPress={() => {
                  if (!name.trim()) {
                    setError('Name is required');
                    return;
                  }
                  const rateNum = Number(rate);
                  if (!Number.isFinite(rateNum) || rateNum < 0) {
                    setError('Enter a valid rate');
                    return;
                  }
                  setError(null);
                  void onSubmit({
                    name: name.trim(),
                    type: 'MATERIAL',
                    unit,
                    rate: rateNum,
                    gstRate: Number(gstRate) || 0,
                    brandOrSpec: brandOrSpec.trim() || undefined,
                    category: category.trim() || undefined,
                  }).then(reset);
                }}
              />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
