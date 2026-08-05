/**
 * BuildFlow - ProcurementLinkPicker
 *
 * Unified picker for linking an estimate/variation line to either:
 *  - a catalog material (resourceId), OR
 *  - a composite rate analysis (rateAnalysisId)
 *
 * Mutual exclusion: setting one clears the other.
 * Single SearchBar + AdaptiveSheet browse — replaces stacked MaterialPicker + RateAnalysisPicker.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AdaptiveSheet } from '@/components/layout/AdaptiveSheet';
import { SearchBar } from '@/components/ui';
import { useMaterials, useRateAnalyses, type Resource, type RateAnalysis } from '@/services/estimate.queries';
import { MaterialThumbnail } from '@/components/materials/MaterialThumbnail';
import { formatINR } from '@/utils/format';

export type ProcurementLinkKind = 'material' | 'rate_analysis';

export type ProcurementLinkValue = {
  resourceId?: string;
  rateAnalysisId?: string;
};

export function ProcurementLinkPicker({
  value,
  onChange,
  allowedKinds = ['material', 'rate_analysis'],
  lineType = 'MATERIAL',
  onApplyDefaults,
  hasExistingDescription = false,
  compact = false,
  disabled = false,
}: {
  value: ProcurementLinkValue;
  onChange: (next: ProcurementLinkValue) => void;
  allowedKinds?: ProcurementLinkKind[];
  lineType?: 'MATERIAL' | 'LABOUR' | 'EQUIPMENT' | 'SUBCONTRACTOR' | 'MISC';
  onApplyDefaults?: (fields: { description: string; unit: string; rate: string }) => void;
  hasExistingDescription?: boolean;
  compact?: boolean;
  disabled?: boolean;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [segment, setSegment] = useState<ProcurementLinkKind>(
    lineType === 'MATERIAL' ? 'material' : 'rate_analysis',
  );
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [applyDefaults, setApplyDefaults] = useState(!hasExistingDescription);

  // Reset applyDefaults when opening with a different existing-description state
  useEffect(() => {
    if (sheetOpen) setApplyDefaults(!hasExistingDescription);
  }, [sheetOpen, hasExistingDescription]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Resolve display names for inline summary
  const { data: materialsData } = useMaterials({ limit: 300, enabled: true });
  const { data: rateAnalysesData } = useRateAnalyses();
  const allMaterials = materialsData?.data ?? [];
  const allRateAnalyses = rateAnalysesData ?? [];

  const linkedResource = value.resourceId
    ? allMaterials.find((m: Resource) => m.id === value.resourceId)
    : undefined;
  const linkedRa = value.rateAnalysisId
    ? allRateAnalyses.find((r: RateAnalysis) => r.id === value.rateAnalysisId)
    : undefined;

  // Sheet data (fetch/search only when sheet open)
  const { data: sheetMaterialsData, isLoading: materialsLoading } = useMaterials({
    search: debouncedSearch,
    limit: 200,
    enabled: sheetOpen && segment === 'material',
  });
  const sheetMaterials = sheetMaterialsData?.data ?? [];

  const sheetRateAnalyses = useMemo(() => {
    if (!debouncedSearch) return allRateAnalyses;
    const q = debouncedSearch.toLowerCase();
    return allRateAnalyses.filter((r: RateAnalysis) => r.name.toLowerCase().includes(q));
  }, [allRateAnalyses, debouncedSearch]);

  const hasLink = Boolean(value.resourceId || value.rateAnalysisId);
  const showSegmented = allowedKinds.length > 1;

  // Selection handlers (mutual exclusion)
  function selectMaterial(resource: Resource, doApply: boolean) {
    onChange({ resourceId: resource.id, rateAnalysisId: undefined });
    if (doApply && onApplyDefaults) {
      onApplyDefaults({
        description: resource.name,
        unit: resource.unit,
        rate: String(parseFloat(resource.rate) || 0),
      });
    }
    setSheetOpen(false);
    setSearch('');
  }

  function selectRateAnalysis(ra: RateAnalysis, doApply: boolean) {
    onChange({ resourceId: undefined, rateAnalysisId: ra.id });
    if (doApply && onApplyDefaults) {
      onApplyDefaults({
        description: ra.name,
        unit: ra.unit,
        rate: String(parseFloat(ra.totalRate) || 0),
      });
    }
    setSheetOpen(false);
    setSearch('');
  }

  // ── Inline (collapsed) UI ──────────────────────────────────────────
  return (
    <View className={compact ? 'mt-1' : 'mt-2'}>
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-[10px] text-muted">Procurement link (optional)</Text>
        {hasLink && !disabled ? (
          <Pressable onPress={() => onChange({})}>
            <Text className="text-danger text-[10px] font-semibold">Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Linked: Material */}
      {linkedResource ? (
        <Pressable
          onPress={() => !disabled && setSheetOpen(true)}
          disabled={disabled}
          className="flex-row items-center gap-3 p-2.5 rounded-lg border border-primary/20 bg-primary/5 active:bg-surface"
        >
          <MaterialThumbnail material={linkedResource} size={36} />
          <View className="flex-1 min-w-0">
            <Text className="text-sm font-semibold text-text" numberOfLines={1}>{linkedResource.name}</Text>
            <Text className="text-xs text-muted">
              Material · {linkedResource.unit} · {formatINR(parseFloat(linkedResource.rate))}
            </Text>
          </View>
          {!disabled && <Text className="text-xs text-primary font-medium">Change</Text>}
        </Pressable>

      // Linked: Rate Analysis
      ) : linkedRa ? (
        <Pressable
          onPress={() => !disabled && setSheetOpen(true)}
          disabled={disabled}
          className="flex-row items-center gap-3 p-2.5 rounded-lg border border-primary/20 bg-primary/5 active:bg-surface"
        >
          <View className="w-9 h-9 rounded-lg bg-primary/10 items-center justify-center">
            <Ionicons name="calculator-outline" size={16} color="#1E3A5F" />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-sm font-semibold text-text" numberOfLines={1}>{linkedRa.name}</Text>
            <Text className="text-xs text-muted">
              Rate analysis · {linkedRa.unit} · {formatINR(parseFloat(linkedRa.totalRate))}/u
            </Text>
          </View>
          {!disabled && <Text className="text-xs text-primary font-medium">Change</Text>}
        </Pressable>

      // Empty: tap to open sheet
      ) : (
        <Pressable
          onPress={() => !disabled && setSheetOpen(true)}
          disabled={disabled}
          className="flex-row items-center gap-2 p-3 rounded-lg border border-dashed border-border bg-card active:bg-surface"
        >
          <Ionicons name="link-outline" size={16} color="#94A3B8" />
          <Text className="text-sm text-muted flex-1">Link to material or rate analysis…</Text>
        </Pressable>
      )}
      <Text className="text-[10px] text-muted mt-0.5">
        Link for procurement & BOQ material explosion
      </Text>

      {/* ── Browse Sheet ─────────────────────────────────────────── */}
      <AdaptiveSheet
        visible={sheetOpen}
        onClose={() => { setSheetOpen(false); setSearch(''); }}
        title="Link to library"
        size="lg"
        footer={
          onApplyDefaults ? (
            <Pressable
              onPress={() => setApplyDefaults((v) => !v)}
              className="flex-row items-center gap-2 py-1"
            >
              <Switch
                value={applyDefaults}
                onValueChange={setApplyDefaults}
                trackColor={{ false: '#CBD5E1', true: '#1E3A5F' }}
              />
              <Text className="text-xs text-text flex-1">
                Apply description, unit & rate from library
              </Text>
            </Pressable>
          ) : undefined
        }
      >
        {/* Segmented control (only when both kinds allowed) */}
        {showSegmented ? (
          <View className="flex-row gap-2 mb-2">
            {allowedKinds.map((kind) => (
              <Pressable
                key={kind}
                onPress={() => { setSegment(kind); setSearch(''); }}
                className={`flex-1 px-3 py-2 rounded-lg border ${
                  segment === kind ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <Text className={`text-xs font-semibold text-center ${
                  segment === kind ? 'text-primary' : 'text-muted'
                }`}>
                  {kind === 'material' ? 'Material' : 'Rate analysis'}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Single SearchBar */}
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder={segment === 'material' ? 'Search materials…' : 'Search rate analyses…'}
        />

        {/* Scrollable list */}
        {segment === 'material' ? (
          materialsLoading && sheetMaterials.length === 0 ? (
            <ActivityIndicator className="py-4" />
          ) : sheetMaterials.length === 0 ? (
            <View className="items-center py-6 gap-2">
              <Ionicons name="cube-outline" size={28} color="#94A3B8" />
              <Text className="text-sm text-muted">No materials found</Text>
            </View>
          ) : (
            <ScrollView nestedScrollEnabled className="flex-1 mt-1">
              {sheetMaterials.map((r: Resource) => {
                const isSelected = value.resourceId === r.id;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => selectMaterial(r, applyDefaults)}
                    className={`flex-row items-center gap-3 p-2.5 rounded-lg border mb-1 active:bg-surface ${
                      isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card'
                    }`}
                  >
                    <MaterialThumbnail material={r} size={40} />
                    <View className="flex-1 min-w-0">
                      <Text className={`text-sm ${isSelected ? 'font-semibold text-primary' : 'text-text'}`} numberOfLines={1}>
                        {r.name}
                      </Text>
                      <Text className="text-xs text-muted">
                        {r.unit}{r.category ? ` · ${r.category}` : ''}
                      </Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color="#1E3A5F" />}
                  </Pressable>
                );
              })}
            </ScrollView>
          )
        ) : (
          // Rate analysis segment
          sheetRateAnalyses.length === 0 ? (
            <View className="items-center py-6 gap-2">
              <Ionicons name="calculator-outline" size={28} color="#94A3B8" />
              <Text className="text-sm text-muted">No rate analyses found</Text>
            </View>
          ) : (
            <ScrollView nestedScrollEnabled className="flex-1 mt-1">
              {sheetRateAnalyses.map((ra: RateAnalysis) => {
                const isSelected = value.rateAnalysisId === ra.id;
                return (
                  <Pressable
                    key={ra.id}
                    onPress={() => selectRateAnalysis(ra, applyDefaults)}
                    className={`flex-row items-center gap-3 p-2.5 rounded-lg border mb-1 active:bg-surface ${
                      isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card'
                    }`}
                  >
                    <View className="w-10 h-10 rounded-lg bg-primary/10 items-center justify-center">
                      <Ionicons name="calculator-outline" size={18} color="#1E3A5F" />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className={`text-sm ${isSelected ? 'font-semibold text-primary' : 'text-text'}`} numberOfLines={1}>
                        {ra.name}
                      </Text>
                      <View className="flex-row items-center gap-2">
                        <View className="px-1.5 py-0.5 rounded bg-muted/10">
                          <Text className="text-[9px] text-muted font-medium">{ra.unit}</Text>
                        </View>
                        <Text className="text-xs text-muted">{formatINR(parseFloat(ra.totalRate))} / {ra.unit}</Text>
                      </View>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color="#1E3A5F" />}
                  </Pressable>
                );
              })}
            </ScrollView>
          )
        )}
      </AdaptiveSheet>
    </View>
  );
}