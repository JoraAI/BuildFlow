import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
        <View className="items-center py-4 gap-2">
          <Ionicons name="calculator-outline" size={28} color="#94A3B8" />
          <Text className="text-sm text-muted">{emptyLabel}</Text>
        </View>
      ) : (
        <ScrollView style={{ maxHeight }} nestedScrollEnabled>
          <Text className="text-[10px] font-semibold text-muted uppercase tracking-wide mb-1">
            Rate analyses
          </Text>
          {analyses.map((ra: RateAnalysis) => {
            const isSelected = selectedId === ra.id;
            return (
              <Pressable
                key={ra.id}
                onPress={() => onSelect(ra)}
                className={`flex-row items-center gap-3 p-2.5 rounded-lg border mb-1 active:bg-surface ${
                  isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card'
                }`}
              >
                <View className="w-10 h-10 rounded-lg bg-primary/10 items-center justify-center">
                  <Ionicons name="calculator-outline" size={18} color="#1E3A5F" />
                </View>
                <View className="flex-1 min-w-0">
                  <Text
                    className={`text-sm ${isSelected ? 'font-semibold text-primary' : 'text-text'}`}
                    numberOfLines={1}
                  >
                    {ra.name}
                  </Text>
                  <View className="flex-row items-center gap-2">
                    <View className="px-1.5 py-0.5 rounded bg-muted/10">
                      <Text className="text-[9px] text-muted font-medium">{ra.unit}</Text>
                    </View>
                    <Text className="text-xs text-muted">
                      {formatINR(parseFloat(ra.totalRate))} / {ra.unit}
                    </Text>
                  </View>
                </View>
                {/* MOB-PICK1: Checkmark when selected */}
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={20} color="#1E3A5F" />
                )}
              </Pressable>
            );
          })}
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