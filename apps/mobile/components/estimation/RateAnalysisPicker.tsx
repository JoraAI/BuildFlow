import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SearchBar } from '@/components/ui';
import { useRateAnalyses, type RateAnalysis } from '@/services/estimate.queries';
import { formatINR } from '@/utils/format';

export function RateAnalysisPicker({
  selectedId,
  onSelect,
  maxHeight = 240,
  emptyLabel = 'No rate analyses found',
}: {
  selectedId?: string;
  onSelect: (analysis: RateAnalysis) => void;
  maxHeight?: number;
  emptyLabel?: string;
}) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isFetching } = useRateAnalyses();
  const all = data ?? [];

  const analyses = useMemo(() => {
    if (!debouncedSearch) return all;
    const q = debouncedSearch.toLowerCase();
    return all.filter((r: RateAnalysis) => r.name.toLowerCase().includes(q));
  }, [all, debouncedSearch]);

  const footer = useMemo(() => {
    if (isLoading) return null;
    if (analyses.length === 0) return emptyLabel;
    return `${analyses.length} rate analysis${analyses.length === 1 ? '' : 'es'}`;
  }, [analyses.length, emptyLabel, isLoading]);

  return (
    <View className="gap-2">
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search rate analyses..." />
      {isLoading ? (
        <ActivityIndicator className="py-4" />
      ) : analyses.length === 0 ? (
        <Text className="text-sm text-muted py-2">{emptyLabel}</Text>
      ) : (
        <ScrollView style={{ maxHeight }} nestedScrollEnabled>
          {analyses.map((ra: RateAnalysis) => (
            <Pressable
              key={ra.id}
              onPress={() => onSelect(ra)}
              className={`flex-row items-center gap-3 p-2 rounded-lg border mb-1 ${
                selectedId === ra.id ? 'border-primary bg-primary/5' : 'border-border bg-card'
              }`}
            >
              <View className="flex-1 min-w-0">
                <Text className="text-sm text-text" numberOfLines={1}>
                  {ra.name}
                </Text>
                <Text className="text-xs text-muted">
                  {ra.unit} · {formatINR(parseFloat(ra.totalRate))} / {ra.unit}
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
