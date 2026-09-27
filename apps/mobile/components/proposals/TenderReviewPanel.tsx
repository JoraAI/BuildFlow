/**
 * Review AI-extracted tender lines before creating an estimate.
 * Shows catalog match status; user can exclude, rematch, or create a catalog resource.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { Card, Button, Badge, Input } from '@/components/ui';
import { AdaptiveSheet } from '@/components/layout/AdaptiveSheet';
import { formatINR } from '@/utils/format';
import { alertAsync } from '@/utils/confirm';
import {
  useRateAnalyses,
  useResources,
  useCreateResource,
  type RateAnalysis,
  type Resource,
} from '@/services/estimate.queries';
import type { TenderExtractedItem, TenderImportResult } from '@/services/proposal.queries';

type ReviewItem = TenderExtractedItem & { included: boolean; localKey: string };

function matchBadge(item: TenderExtractedItem): {
  label: string;
  color: 'success' | 'warning' | 'danger' | 'neutral';
} {
  if (item.suggestedAction === 'LINKED' && item.matchLabel) {
    return {
      label: item.matchKind === 'RATE_ANALYSIS' ? `RA: ${item.matchLabel}` : `Mat: ${item.matchLabel}`,
      color: 'success',
    };
  }
  if (item.suggestedAction === 'REVIEW' && item.matchLabel) {
    return { label: `Check: ${item.matchLabel}`, color: 'warning' };
  }
  return { label: 'Unmatched — link or create', color: 'danger' };
}

interface Props {
  result: TenderImportResult;
  loading?: boolean;
  onConfirm: (items: TenderExtractedItem[]) => void;
  onDiscard: () => void;
}

export function TenderReviewPanel({ result, loading, onConfirm, onDiscard }: Props) {
  const { data: analyses = [] } = useRateAnalyses();
  const { data: resources = [] } = useResources();
  const createResource = useCreateResource();

  const [rows, setRows] = useState<ReviewItem[]>(() =>
    result.items.map((i, idx) => ({ ...i, included: true, localKey: `${idx}-${i.description}` })),
  );
  const [rematchIdx, setRematchIdx] = useState<number | null>(null);
  const [rematchQuery, setRematchQuery] = useState('');
  const [createIdx, setCreateIdx] = useState<number | null>(null);
  const [newResourceName, setNewResourceName] = useState('');
  const [newResourceUnit, setNewResourceUnit] = useState('nos');
  const [newResourceRate, setNewResourceRate] = useState('');

  useEffect(() => {
    setRows(result.items.map((i, idx) => ({ ...i, included: true, localKey: `${idx}-${i.description}` })));
  }, [result]);

  const stats = useMemo(() => {
    const included = rows.filter((r) => r.included);
    return {
      total: rows.length,
      included: included.length,
      linked: included.filter((r) => r.suggestedAction === 'LINKED').length,
      review: included.filter((r) => r.suggestedAction === 'REVIEW').length,
      create: included.filter((r) => r.suggestedAction === 'CREATE').length,
    };
  }, [rows]);

  const rematchOptions = useMemo(() => {
    const q = rematchQuery.trim().toLowerCase();
    const ras = (analyses as RateAnalysis[])
      .filter((a) => !q || a.name.toLowerCase().includes(q))
      .slice(0, 40)
      .map((a) => ({
        kind: 'RATE_ANALYSIS' as const,
        id: a.id,
        name: a.name,
        rate: Number(a.totalRate ?? 0),
      }));
    const mats = (resources as Resource[])
      .filter((r) => r.type === 'MATERIAL')
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .slice(0, 40)
      .map((r) => ({
        kind: 'RESOURCE' as const,
        id: r.id,
        name: r.name,
        rate: Number(r.rate ?? 0),
      }));
    return [...ras, ...mats];
  }, [analyses, resources, rematchQuery]);

  function toggle(idx: number) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, included: !r.included } : r)));
  }

  function applyMatch(
    idx: number,
    opt: { kind: 'RESOURCE' | 'RATE_ANALYSIS'; id: string; name: string; rate: number },
  ) {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const rate = r.rate > 0 ? r.rate : opt.rate;
        return {
          ...r,
          resourceId: opt.kind === 'RESOURCE' ? opt.id : null,
          rateAnalysisId: opt.kind === 'RATE_ANALYSIS' ? opt.id : null,
          matchKind: opt.kind,
          matchLabel: opt.name,
          matchScore: 1,
          suggestedAction: 'LINKED',
          libraryRate: opt.rate,
          rate,
          amount: Math.round(r.quantity * rate * 100) / 100,
        };
      }),
    );
    setRematchIdx(null);
    setRematchQuery('');
  }

  function clearMatch(idx: number) {
    setRows((prev) =>
      prev.map((r, i) =>
        i !== idx
          ? r
          : {
              ...r,
              resourceId: null,
              rateAnalysisId: null,
              matchKind: 'NONE',
              matchLabel: null,
              matchScore: null,
              suggestedAction: 'CREATE',
              libraryRate: null,
            },
      ),
    );
  }

  async function handleCreateResource() {
    if (createIdx == null) return;
    const row = rows[createIdx];
    if (!row) return;
    const name = newResourceName.trim() || row.description.slice(0, 120);
    const rate = parseFloat(newResourceRate) || row.rate || 0;
    try {
      const created = await createResource.mutateAsync({
        name,
        type: 'MATERIAL',
        unit: newResourceUnit.trim() || row.unit || 'nos',
        rate,
      });
      applyMatch(createIdx, {
        kind: 'RESOURCE',
        id: created.id,
        name: created.name,
        rate: Number(created.rate),
      });
      setCreateIdx(null);
      setNewResourceName('');
      setNewResourceRate('');
      setNewResourceUnit('nos');
    } catch (e) {
      await alertAsync('Create failed', e instanceof Error ? e.message : 'Could not create resource');
    }
  }

  function handleConfirm() {
    const included = rows
      .filter((r) => r.included)
      .map(({ included: _i, localKey: _k, ...rest }) => rest);
    onConfirm(included);
  }

  const rematchRow = rematchIdx != null ? rows[rematchIdx] : null;
  const createRow = createIdx != null ? rows[createIdx] : null;

  return (
    <Card>
      <View className="gap-2 mb-2">
        <Text className="text-base font-bold text-text">Review tender extraction</Text>
        <Text className="text-xs text-muted">
          Confirm catalog links (or rematch / create) before finalizing. Nothing is saved until you
          confirm.
        </Text>
        {result.notes ? (
          <Text className="text-xs text-muted bg-surface border border-border rounded-lg p-2">
            {result.notes}
          </Text>
        ) : null}
        <View className="flex-row flex-wrap gap-2">
          <Badge label={`${stats.included}/${stats.total} included`} color="neutral" />
          <Badge label={`${stats.linked} linked`} color="success" />
          <Badge label={`${stats.review} check`} color="warning" />
          <Badge label={`${stats.create} new`} color="danger" />
        </View>
      </View>

      <ScrollView className="max-h-96" nestedScrollEnabled>
        {rows.map((item, idx) => {
          const badge = matchBadge(item);
          return (
            <View
              key={item.localKey}
              className={`border-t border-border py-2.5 ${item.included ? '' : 'opacity-45'}`}
            >
              <Pressable onPress={() => toggle(idx)}>
                <View className="flex-row justify-between items-start gap-2">
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-text" numberOfLines={2}>
                      {item.included ? '☑ ' : '☐ '}
                      {item.description}
                    </Text>
                    <Text className="text-xs text-muted mt-0.5">
                      {item.quantity} {item.unit} @ {formatINR(item.rate)}
                      {item.section ? ` · ${item.section}` : ''}
                      {item.libraryRate != null && item.libraryRate > 0
                        ? ` · library ${formatINR(item.libraryRate)}`
                        : ''}
                    </Text>
                    <View className="mt-1 self-start">
                      <Badge label={badge.label} color={badge.color} />
                    </View>
                  </View>
                  <Text className="text-sm font-semibold text-text">
                    {formatINR(item.amount ?? item.quantity * item.rate)}
                  </Text>
                </View>
              </Pressable>
              {item.included ? (
                <View className="flex-row flex-wrap gap-2 mt-2">
                  <Button
                    label="Rematch"
                    size="sm"
                    variant="secondary"
                    onPress={() => {
                      setRematchIdx(idx);
                      setRematchQuery('');
                    }}
                  />
                  {item.suggestedAction === 'CREATE' || !item.matchLabel ? (
                    <Button
                      label="Create material"
                      size="sm"
                      variant="secondary"
                      onPress={() => {
                        setCreateIdx(idx);
                        setNewResourceName(item.description.slice(0, 120));
                        setNewResourceUnit(item.unit || 'nos');
                        setNewResourceRate(item.rate > 0 ? String(item.rate) : '');
                      }}
                    />
                  ) : (
                    <Button
                      label="Clear link"
                      size="sm"
                      variant="secondary"
                      onPress={() => clearMatch(idx)}
                    />
                  )}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      <View className="flex-row gap-2 mt-3 flex-wrap">
        <Button
          label={`Finalize ${stats.included} item${stats.included === 1 ? '' : 's'}`}
          size="sm"
          loading={loading}
          disabled={stats.included === 0}
          onPress={handleConfirm}
        />
        <Button label="Discard" size="sm" variant="secondary" onPress={onDiscard} disabled={loading} />
      </View>

      <AdaptiveSheet
        visible={rematchIdx != null}
        onClose={() => setRematchIdx(null)}
        title="Rematch catalog"
        subtitle={rematchRow?.description}
      >
        <TextInput
          value={rematchQuery}
          onChangeText={setRematchQuery}
          placeholder="Search rate analyses or materials…"
          className="border border-border rounded-lg px-3 py-2 text-sm text-text mb-3 bg-card"
        />
        <ScrollView className="max-h-80">
          {rematchOptions.map((opt) => (
            <Pressable
              key={`${opt.kind}-${opt.id}`}
              onPress={() => rematchIdx != null && applyMatch(rematchIdx, opt)}
              className="py-2.5 border-b border-border"
            >
              <Text className="text-sm font-medium text-text">{opt.name}</Text>
              <Text className="text-xs text-muted">
                {opt.kind === 'RATE_ANALYSIS' ? 'Rate analysis' : 'Material'} · {formatINR(opt.rate)}
              </Text>
            </Pressable>
          ))}
          {rematchOptions.length === 0 ? (
            <Text className="text-sm text-muted py-4 text-center">No matches</Text>
          ) : null}
        </ScrollView>
      </AdaptiveSheet>

      <AdaptiveSheet
        visible={createIdx != null}
        onClose={() => setCreateIdx(null)}
        title="Create material"
        subtitle={createRow?.description}
        footer={
          <View className="flex-row gap-2">
            <Button label="Cancel" variant="secondary" className="flex-1" onPress={() => setCreateIdx(null)} />
            <Button
              label="Create & link"
              className="flex-1"
              loading={createResource.isPending}
              onPress={() => void handleCreateResource()}
            />
          </View>
        }
      >
        <View className="gap-3">
          <Input label="Name" value={newResourceName} onChangeText={setNewResourceName} />
          <Input label="Unit" value={newResourceUnit} onChangeText={setNewResourceUnit} />
          <Input
            label="Rate (₹)"
            value={newResourceRate}
            onChangeText={setNewResourceRate}
            keyboardType="decimal-pad"
          />
        </View>
      </AdaptiveSheet>
    </Card>
  );
}
