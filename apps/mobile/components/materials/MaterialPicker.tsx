import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SearchBar } from '@/components/ui';
import { useMaterials, type Resource } from '@/services/estimate.queries';
import { MaterialThumbnail } from './MaterialThumbnail';

export function MaterialPicker({
  selectedId,
  onSelect,
  maxHeight = 240,
  emptyLabel = 'No materials found',
}: {
  selectedId?: string;
  onSelect: (resource: Resource) => void;
  maxHeight?: number;
  emptyLabel?: string;
}) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isFetching } = useMaterials({ search: debouncedSearch, limit: 200 });
  const materials = data?.data ?? [];
  const total = data?.meta.total ?? materials.length;

  const footer = useMemo(() => {
    if (isLoading) return null;
    if (total === 0) return emptyLabel;
    if (materials.length < total) {
      return `Showing ${materials.length} of ${total} - refine search to find more`;
    }
    return `${total} material${total === 1 ? '' : 's'}`;
  }, [emptyLabel, isLoading, materials.length, total]);

  return (
    <View className="gap-2">
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search materials..." />
      {isLoading ? (
        <ActivityIndicator className="py-4" />
      ) : materials.length === 0 ? (
        <Text className="text-sm text-muted py-2">{emptyLabel}</Text>
      ) : (
        <ScrollView style={{ maxHeight }} nestedScrollEnabled>
          {materials.map((r: Resource) => (
            <Pressable
              key={r.id}
              onPress={() => onSelect(r)}
              className={`flex-row items-center gap-3 p-2 rounded-lg border mb-1 ${
                selectedId === r.id ? 'border-primary bg-primary/5' : 'border-border bg-card'
              }`}
            >
              <MaterialThumbnail material={r} size={36} />
              <View className="flex-1 min-w-0">
                <Text className="text-sm text-text" numberOfLines={1}>
                  {r.name}
                </Text>
                <Text className="text-xs text-muted">
                  {r.unit}
                  {r.category ? ` · ${r.category}` : ''}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
      {footer ? (
        <Text className="text-[10px] text-muted">
          {footer}
          {isFetching && !isLoading ? ' · updating…' : ''}
        </Text>
      ) : null}
    </View>
  );
}
