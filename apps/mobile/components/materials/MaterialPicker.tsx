/**
 * BuildFlow - Material picker.
 *
 * Shows project-relevant materials first (on-hand stock + BOQ-linked),
 * then falls back to the full company catalog via search.
 *
 * Peer alignment (Procore / Fieldwire / PlanGrid): supervisors logging a
 * daily report primarily consume materials already committed to the project.
 * Showing all 500+ catalog items is cognitive overload; the catalog search
 * remains available as a secondary "add one-off" path.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SearchBar } from '@/components/ui';
import { useMaterials, type Resource } from '@/services/estimate.queries';
import { MaterialThumbnail } from './MaterialThumbnail';

export interface ProjectMaterial {
  id: string;
  name: string;
  unit: string;
  type?: 'MATERIAL' | 'LABOUR' | 'EQUIPMENT' | 'SUBCONTRACTOR';
  category?: string | null;
  /** Optional on-hand balance to surface inline. */
  balance?: number;
}

export function MaterialPicker({
  selectedId,
  onSelect,
  maxHeight = 240,
  emptyLabel = 'No materials found',
  /**
   * Materials relevant to the current project (from stock summary + BOQ).
   * When provided, these are shown in a "On this project" section above the
   * catalog search. Omit to keep the legacy catalog-only behaviour.
   */
  projectMaterials,
}: {
  selectedId?: string;
  onSelect: (resource: Resource) => void;
  maxHeight?: number;
  emptyLabel?: string;
  projectMaterials?: ProjectMaterial[];
}) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isFetching } = useMaterials({
    search: debouncedSearch,
    limit: 200,
    // Only fetch catalog when user is searching or has expanded "all materials".
    enabled: showAll || debouncedSearch.length > 0,
  });
  const catalogMaterials = data?.data ?? [];
  const total = data?.meta.total ?? catalogMaterials.length;

  const hasProjectMaterials = !!projectMaterials && projectMaterials.length > 0;
  const q = debouncedSearch.toLowerCase();

  // Project section is also filtered by the active search term.
  const filteredProjectMaterials = useMemo(() => {
    if (!projectMaterials) return [];
    if (!q) return projectMaterials;
    return projectMaterials.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.category ?? '').toLowerCase().includes(q),
    );
  }, [projectMaterials, q]);

  const showProjectSection = hasProjectMaterials && filteredProjectMaterials.length > 0;
  const showCatalogSection =
    !hasProjectMaterials || showAll || debouncedSearch.length > 0;

  const footer = useMemo(() => {
    if (isLoading) return null;
    if (total === 0 && !showProjectSection) return emptyLabel;
    if (catalogMaterials.length < total && showCatalogSection) {
      return `Showing ${catalogMaterials.length} of ${total} - refine search to find more`;
    }
    if (showCatalogSection) return `${total} material${total === 1 ? '' : 's'}`;
    return null;
  }, [emptyLabel, isLoading, catalogMaterials.length, total, showProjectSection, showCatalogSection]);

  const renderRow = (
    r: { id: string; name: string; unit: string; type?: Resource['type']; category?: string | null },
    balance?: number,
  ) => (
    <Pressable
      key={r.id}
      onPress={() =>
        onSelect({
          id: r.id,
          name: r.name,
          unit: r.unit,
          type: r.type ?? 'MATERIAL',
          rate: '0',
          category: r.category ?? null,
        } as Resource)
      }
      className={`flex-row items-center gap-3 p-2 rounded-lg border mb-1 ${
        selectedId === r.id ? 'border-primary bg-primary/5' : 'border-border bg-card'
      }`}
    >
      <MaterialThumbnail material={r as Resource} size={36} />
      <View className="flex-1 min-w-0">
        <Text className="text-sm text-text" numberOfLines={1}>
          {r.name}
        </Text>
        <Text className="text-xs text-muted">
          {r.unit}
          {r.category ? ` · ${r.category}` : ''}
        </Text>
      </View>
      {balance !== undefined && (
        <View className="px-2 py-0.5 rounded bg-success/10">
          <Text className="text-[10px] text-success font-medium">
            {balance} on hand
          </Text>
        </View>
      )}
    </Pressable>
  );

  return (
    <View className="gap-2">
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search materials..." />

      {isLoading && showCatalogSection ? (
        <ActivityIndicator className="py-4" />
      ) : showProjectSection || showCatalogSection ? (
        <ScrollView style={{ maxHeight }} nestedScrollEnabled>
          {/* Project-relevant materials first */}
          {showProjectSection && (
            <View className="mb-2">
              <Text className="text-[10px] font-semibold text-muted uppercase tracking-wide mb-1">
                On this project
              </Text>
              {filteredProjectMaterials.map((m) => renderRow(m, m.balance))}
            </View>
          )}

          {/* Full catalog (secondary) */}
          {showCatalogSection && (
            <View>
              {hasProjectMaterials && !showAll && debouncedSearch.length === 0 ? null : (
                <>
                  {hasProjectMaterials && (
                    <Text className="text-[10px] font-semibold text-muted uppercase tracking-wide mb-1 mt-1">
                      All materials
                    </Text>
                  )}
                  {catalogMaterials.length === 0 ? (
                    <Text className="text-sm text-muted py-2">{emptyLabel}</Text>
                  ) : (
                    catalogMaterials.map((r: Resource) => renderRow(r))
                  )}
                </>
              )}
            </View>
          )}
        </ScrollView>
      ) : (
        <Text className="text-sm text-muted py-2">{emptyLabel}</Text>
      )}

      <View className="flex-row items-center justify-between">
        {footer ? (
          <Text className="text-[10px] text-muted flex-1">
            {footer}
            {isFetching && !isLoading ? ' · updating…' : ''}
          </Text>
        ) : (
          <View className="flex-1" />
        )}
        {hasProjectMaterials && !showAll && debouncedSearch.length === 0 && (
          <Pressable
            onPress={() => setShowAll(true)}
            className="px-2 py-1 rounded bg-surface border border-border"
          >
            <Text className="text-[10px] text-primary font-medium">
              Browse all materials
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}