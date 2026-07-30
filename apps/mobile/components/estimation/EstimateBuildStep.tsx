/**
 * Step 2 of estimate wizard - sections, template loader, editable line items.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Button, Card, Badge } from '@/components/ui';
import { ActionBar } from '@/components/layout/ActionBar';
import { useViewport } from '@/hooks/useViewport';
import {
  useEstimate,
  useEstimateMutations,
  useMaterials,
  useRateAnalyses,
  type EstimateItem,
  type EstimateSection,
  type Resource,
  type RateAnalysis,
} from '@/services/estimate.queries';
import {
  ESTIMATE_TEMPLATES,
  type EstimateTemplate,
} from '@/constants/estimate-templates';
import { confirmAsync, alertAsync, promptLinkApplyAsync } from '@/utils/confirm';
import { formatINR } from '@/utils/format';
import { MaterialPicker } from '@/components/materials/MaterialPicker';
import { RateAnalysisPicker } from '@/components/estimation/RateAnalysisPicker';

function resolveTemplateItemLinks(
  item: import('@/constants/estimate-templates').EstimateTemplateItem,
  materials: Resource[],
  rateAnalyses: RateAnalysis[],
): { resourceId?: string; rateAnalysisId?: string } {
  const resourceId = item.resourceName
    ? materials.find((m) => m.name === item.resourceName)?.id
    : undefined;
  const rateAnalysisId = item.rateAnalysisName
    ? rateAnalyses.find((r) => r.name === item.rateAnalysisName)?.id
    : undefined;
  // Debug: trace RA link resolution
  if (item.rateAnalysisName) {
    const matched = rateAnalyses.find((r) => r.name === item.rateAnalysisName);
    console.log('[resolveTemplateItemLinks]', {
      itemDesc: item.description,
      rateAnalysisName: item.rateAnalysisName,
      matched: matched ? `${matched.id} (${matched.name})` : 'NOT FOUND',
      rateAnalysesCount: rateAnalyses.length,
    });
  }
  return { resourceId, rateAnalysisId };
}

type ScopeSetters = {
  setDesc?: (v: string) => void;
  setUnit?: (v: string) => void;
  setRate?: (v: string) => void;
};

async function handleCatalogSelect(
  resource: Resource,
  setResourceId: (id: string) => void,
  setRateAnalysisId: (id: string) => void,
  scope?: ScopeSetters,
) {
  const choice = await promptLinkApplyAsync(resource.name);
  if (choice === 'cancel') return;
  setResourceId(resource.id);
  setRateAnalysisId('');
  if (choice === 'apply_defaults' && scope) {
    scope.setDesc?.(resource.name);
    scope.setUnit?.(resource.unit);
    scope.setRate?.(String(parseFloat(resource.rate)));
  }
}

async function handleRateAnalysisSelect(
  analysis: RateAnalysis,
  setResourceId: (id: string) => void,
  setRateAnalysisId: (id: string) => void,
  scope?: ScopeSetters,
) {
  const choice = await promptLinkApplyAsync(analysis.name);
  if (choice === 'cancel') return;
  setRateAnalysisId(analysis.id);
  setResourceId('');
  if (choice === 'apply_defaults' && scope) {
    scope.setDesc?.(analysis.name);
    scope.setUnit?.(analysis.unit);
    scope.setRate?.(String(parseFloat(analysis.totalRate)));
  }
}

function ProcurementLinkFields({
  resourceId,
  rateAnalysisId,
  onResourceIdChange,
  onRateAnalysisIdChange,
  scope,
  compact,
}: {
  resourceId: string;
  rateAnalysisId: string;
  onResourceIdChange: (id: string) => void;
  onRateAnalysisIdChange: (id: string) => void;
  scope?: ScopeSetters;
  compact?: boolean;
}) {
  const hasLink = Boolean(resourceId || rateAnalysisId);

  return (
    <View className="gap-2 mt-1">
      <View className="flex-row items-center justify-between">
        <Text className="text-[10px] text-muted">Procurement link (optional)</Text>
        {hasLink ? (
          <Pressable
            onPress={() => {
              onResourceIdChange('');
              onRateAnalysisIdChange('');
            }}
          >
            <Text className="text-danger text-[10px] font-semibold">Clear link</Text>
          </Pressable>
        ) : null}
      </View>
      <View className="gap-1">
        <Text className="text-[10px] text-muted">Catalog material (1:1)</Text>
        <MaterialPicker
          selectedId={resourceId || undefined}
          onSelect={(r) =>
            void handleCatalogSelect(r, onResourceIdChange, onRateAnalysisIdChange, scope)
          }
          maxHeight={compact ? 100 : 140}
        />
      </View>
      <View className="gap-1">
        <Text className="text-[10px] text-muted">Rate analysis (composite BOM)</Text>
        <RateAnalysisPicker
          selectedId={rateAnalysisId || undefined}
          onSelect={(ra) =>
            void handleRateAnalysisSelect(ra, onResourceIdChange, onRateAnalysisIdChange, scope)
          }
          maxHeight={compact ? 100 : 140}
        />
      </View>
    </View>
  );
}

export function EstimateBuildStep({
  estimateId,
  overheadPct,
  contingencyPct,
  profitPct,
  onBack,
  onNext,
}: {
  estimateId: string;
  overheadPct: number;
  contingencyPct: number;
  profitPct: number;
  onBack: () => void;
  onNext: () => void;
}) {
  const mut = useEstimateMutations(estimateId);
  const { isDesktop } = useViewport();
  const [newSectionName, setNewSectionName] = useState('');
  const [showAddSection, setShowAddSection] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const { data: estimate, isLoading } = useEstimate(estimateId);
  const { data: materialsData } = useMaterials({ limit: 300 });
  const materials = materialsData?.data ?? [];
  const { data: rateAnalysesData } = useRateAnalyses();
  const rateAnalyses = rateAnalysesData ?? [];

  const summary = estimate?.summary;
  const sections = estimate?.sections ?? [];

  async function applyTemplate(template: EstimateTemplate) {
    // Rate analyses MUST be loaded before applying a template so that
    // rateAnalysisName → rateAnalysisId links resolve correctly.
    // Without this, BOQ items created from the estimate won't have RA links,
    // and procurement can't explode them into material lines.
    if (rateAnalyses.length === 0) {
      await alertAsync(
        'Rate analyses loading',
        'The rate analysis library is still loading. Please wait a moment and try again.',
      );
      return;
    }
    const hasRaItems = template.sections.some((s) =>
      s.items.some((i) => i.rateAnalysisName),
    );
    if (hasRaItems) {
      const missingRas = new Set<string>();
      for (const sec of template.sections) {
        for (const item of sec.items) {
          if (item.rateAnalysisName && !rateAnalyses.find((r) => r.name === item.rateAnalysisName)) {
            missingRas.add(item.rateAnalysisName);
          }
        }
      }
      if (missingRas.size > 0) {
        await alertAsync(
          'Missing rate analyses',
          `${missingRas.size} rate analysis template(s) not found in your library. Items will be added without RA links.`,
        );
      }
    }
    if (sections.length > 0) {
      const ok = await confirmAsync(
        'Load template?',
        'This will add template sections and items alongside your existing content. You can edit or remove any line afterward.',
      );
      if (!ok) return;
    }
    setLoadingTemplate(true);
    try {
      console.log('[applyTemplate] START', {
        templateName: template.name,
        rateAnalysesCount: rateAnalyses.length,
        materialsCount: materials.length,
      });
      for (const section of template.sections) {
        const created = await mut.addSection.mutateAsync({ name: section.name });
        for (const item of section.items) {
          const links = resolveTemplateItemLinks(item, materials, rateAnalyses);
          console.log('[applyTemplate] adding item', {
            desc: item.description,
            rateAnalysisName: item.rateAnalysisName,
            resolvedRateAnalysisId: links.rateAnalysisId ?? '(none)',
            resolvedResourceId: links.resourceId ?? '(none)',
          });
          await mut.addItem.mutateAsync({
            sectionId: created.id,
            description: item.description,
            unit: item.unit,
            quantity: item.quantity,
            rate: item.rate,
            type: item.type,
            itemCode: item.itemCode,
            ...links,
          });
        }
      }
      setShowTemplates(false);
      await alertAsync('Template loaded', `${template.name} - adjust quantities and rates as needed.`);
    } catch (e) {
      await alertAsync('Template failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoadingTemplate(false);
    }
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <ActivityIndicator color="#1E3A5F" />
      </View>
    );
  }

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerClassName={isDesktop ? 'px-8 py-4 gap-3 pb-40 max-w-6xl w-full self-center' : 'p-4 gap-3 pb-40'}
      >
        {/* Template picker */}
        <Card>
          <View className="flex-row justify-between items-center mb-2">
            <View className="flex-1 mr-2">
              <Text className="text-sm font-bold text-text">Start from a template</Text>
              <Text className="text-xs text-muted mt-0.5">
                Pre-made BOQ items - edit quantities, rates, add or remove lines
              </Text>
            </View>
            <Button
              label={showTemplates ? 'Hide' : 'Browse'}
              size="sm"
              variant="secondary"
              onPress={() => setShowTemplates((v) => !v)}
            />
          </View>
          {showTemplates && (
            <View className="gap-2 mt-2">
              {ESTIMATE_TEMPLATES.map((tpl) => (
                <Pressable
                  key={tpl.id}
                  onPress={() => applyTemplate(tpl)}
                  disabled={loadingTemplate}
                  className="border border-border rounded-lg p-3 active:bg-surface"
                >
                  <Text className="text-sm font-semibold text-text">{tpl.name}</Text>
                  <Text className="text-xs text-muted mt-0.5">{tpl.description}</Text>
                  <Text className="text-xs text-primary mt-1">
                    {tpl.sections.length} sections ·{' '}
                    {tpl.sections.reduce((n, s) => n + s.items.length, 0)} items
                  </Text>
                </Pressable>
              ))}
              {loadingTemplate && (
                <View className="py-2 items-center">
                  <ActivityIndicator color="#1E3A5F" />
                </View>
              )}
            </View>
          )}
        </Card>

        {/* Add section */}
        {showAddSection ? (
          <Card>
            <TextInput
              value={newSectionName}
              onChangeText={setNewSectionName}
              placeholder="Section name (e.g. Substructure)"
              placeholderTextColor="#94A3B8"
              className="border border-border rounded-lg px-3 py-2.5 text-text mb-2"
            />
            <View className="flex-row gap-2">
              <Button
                label="Add Section"
                size="sm"
                onPress={async () => {
                  if (!newSectionName.trim()) return;
                  await mut.addSection.mutateAsync({ name: newSectionName.trim() });
                  setNewSectionName('');
                  setShowAddSection(false);
                }}
              />
              <Button label="Cancel" size="sm" variant="ghost" onPress={() => setShowAddSection(false)} />
            </View>
          </Card>
        ) : (
          <Pressable onPress={() => setShowAddSection(true)} className="py-1">
            <Text className="text-primary text-sm font-semibold">+ Add Custom Section</Text>
          </Pressable>
        )}

        {/* Sections & items */}
        {sections.map((sec: EstimateSection) => {
          const secTotal = sec.items.reduce(
            (s: number, it: EstimateItem) => s + parseFloat(it.amount),
            0,
          );
          return (
            <Card key={sec.id}>
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-base font-semibold text-text">{sec.name}</Text>
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm font-bold text-primary">{formatINR(secTotal)}</Text>
                  <Pressable
                    onPress={async () => {
                      const ok = await confirmAsync(
                        'Delete section?',
                        `Remove "${sec.name}" and all its items?`,
                      );
                      if (ok) await mut.deleteSection.mutateAsync(sec.id);
                    }}
                  >
                    <Text className="text-danger text-xs font-semibold">Delete</Text>
                  </Pressable>
                </View>
              </View>
              {sec.items.map((it: EstimateItem) => (
                <EditableLineItem
                  key={it.id}
                  item={it}
                  mut={mut}
                  materials={materials}
                  rateAnalyses={rateAnalyses}
                />
              ))}
              <AddItemRow sectionId={sec.id} mut={mut} />
            </Card>
          );
        })}

        {sections.length === 0 && !showTemplates && (
          <Text className="text-sm text-muted text-center py-6">
            Load a template above or add a custom section to begin.
          </Text>
        )}
      </ScrollView>

      {summary && (
        <View className="border-t border-border bg-card">
          <View className={isDesktop ? 'px-8 py-3' : 'px-4 py-3'}>
            <View className="flex-row justify-between mb-1">
              <Text className="text-xs text-muted">Direct Cost</Text>
              <Text className="text-xs text-text">{formatINR(summary.subtotal)}</Text>
            </View>
            <View className="flex-row justify-between mb-1">
              <Text className="text-xs text-muted">
                +OH/Cont/Profit ({overheadPct + contingencyPct + profitPct}%)
              </Text>
              <Text className="text-xs text-text">
                {formatINR(
                  summary.overheadAmount + summary.contingencyAmount + summary.profitMarginAmount,
                )}
              </Text>
            </View>
            <View className="flex-row justify-between items-center pt-1 border-t border-border mt-1">
              <Text className="text-sm font-bold text-text">Grand Total</Text>
              <Text className="text-lg font-bold text-primary">{formatINR(summary.grandTotal)}</Text>
            </View>
          </View>
          <ActionBar>
            <Button label="Back" variant="secondary" size="sm" onPress={onBack} />
            <Button label="Review & Submit" size="sm" onPress={onNext} />
          </ActionBar>
        </View>
      )}
    </View>
  );
}

function EditableLineItem({
  item,
  mut,
  materials,
  rateAnalyses,
}: {
  item: EstimateItem;
  mut: ReturnType<typeof useEstimateMutations>;
  materials: Resource[];
  rateAnalyses: RateAnalysis[];
}) {
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(item.description);
  const [qty, setQty] = useState(String(parseFloat(item.quantity)));
  const [rate, setRate] = useState(String(parseFloat(item.rate)));
  const [unit, setUnit] = useState(item.unit);
  const [resourceId, setResourceId] = useState(item.resourceId ?? '');
  const [rateAnalysisId, setRateAnalysisId] = useState(item.rateAnalysisId ?? '');

  const linkedResource = materials.find((m) => m.id === (resourceId || item.resourceId));
  const linkedRa = rateAnalyses.find((r) => r.id === (rateAnalysisId || item.rateAnalysisId));

  async function clearLink() {
    await mut.updateItem.mutateAsync({
      itemId: item.id,
      body: { resourceId: null, rateAnalysisId: null },
    });
  }

  if (!editing) {
    return (
      <View className="border-t border-border py-2">
        <View className="flex-row justify-between items-start">
          <View className="flex-1 mr-2">
            <Pressable onPress={() => setEditing(true)}>
              <Text className="text-sm text-text" numberOfLines={2}>
                {item.description}
              </Text>
              <View className="flex-row gap-3 mt-0.5 flex-wrap">
                <Text className="text-xs text-muted">
                  {parseFloat(item.quantity)} {item.unit}
                </Text>
                <Text className="text-xs text-muted">@ {formatINR(parseFloat(item.rate))}</Text>
                <Badge label={item.type} color="neutral" />
              </View>
            </Pressable>
            {item.type === 'MATERIAL' && (linkedResource || linkedRa) ? (
              <View className="flex-row items-center gap-2 mt-0.5 flex-wrap">
                <Text className="text-[10px] text-primary">
                  {linkedResource
                    ? `Catalog: ${linkedResource.name}`
                    : linkedRa
                      ? `Rate analysis: ${linkedRa.name}`
                      : null}
                </Text>
                <Pressable onPress={() => void clearLink()}>
                  <Text className="text-danger text-[10px] font-semibold">Clear link</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
          <View className="items-end gap-1">
            <Text className="text-sm font-semibold text-text">
              {formatINR(parseFloat(item.amount))}
            </Text>
            <Pressable
              onPress={async () => {
                const ok = await confirmAsync('Delete item?', item.description);
                if (ok) await mut.deleteItem.mutateAsync(item.id);
              }}
            >
              <Text className="text-danger text-[10px] font-semibold">Remove</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="border-t border-border py-2 gap-1.5">
      <TextInput
        value={desc}
        onChangeText={setDesc}
        className="border border-border rounded px-2 py-1.5 text-sm text-text"
      />
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Text className="text-[10px] text-muted">Qty</Text>
          <TextInput
            value={qty}
            onChangeText={setQty}
            keyboardType="decimal-pad"
            className="border border-border rounded px-2 py-1.5 text-sm text-text"
          />
        </View>
        <View style={{ width: 64 }}>
          <Text className="text-[10px] text-muted">Unit</Text>
          <TextInput
            value={unit}
            onChangeText={setUnit}
            className="border border-border rounded px-2 py-1.5 text-sm text-text"
          />
        </View>
        <View className="flex-1">
          <Text className="text-[10px] text-muted">Rate ₹</Text>
          <TextInput
            value={rate}
            onChangeText={setRate}
            keyboardType="decimal-pad"
            className="border border-border rounded px-2 py-1.5 text-sm text-text"
          />
        </View>
      </View>
      {item.type === 'MATERIAL' ? (
        <ProcurementLinkFields
          resourceId={resourceId}
          rateAnalysisId={rateAnalysisId}
          onResourceIdChange={setResourceId}
          onRateAnalysisIdChange={setRateAnalysisId}
          scope={{ setDesc, setUnit, setRate }}
        />
      ) : null}
      <View className="flex-row gap-2">
        <Button
          label="Save"
          size="sm"
          onPress={async () => {
            await mut.updateItem.mutateAsync({
              itemId: item.id,
              body: {
                description: desc.trim(),
                quantity: parseFloat(qty) || 0,
                rate: parseFloat(rate) || 0,
                unit: unit.trim() || 'unit',
                resourceId: resourceId || null,
                rateAnalysisId: rateAnalysisId || null,
              },
            });
            setEditing(false);
          }}
        />
        <Button
          label="Cancel"
          size="sm"
          variant="ghost"
          onPress={() => {
            setDesc(item.description);
            setQty(String(parseFloat(item.quantity)));
            setRate(String(parseFloat(item.rate)));
            setUnit(item.unit);
            setResourceId(item.resourceId ?? '');
            setRateAnalysisId(item.rateAnalysisId ?? '');
            setEditing(false);
          }}
        />
      </View>
    </View>
  );
}

function AddItemRow({
  sectionId,
  mut,
}: {
  sectionId: string;
  mut: ReturnType<typeof useEstimateMutations>;
}) {
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState('');
  const [unit, setUnit] = useState('cum');
  const [qty, setQty] = useState('1');
  const [rate, setRate] = useState('0');
  const [resourceId, setResourceId] = useState('');
  const [rateAnalysisId, setRateAnalysisId] = useState('');
  const [type, setType] = useState<'MATERIAL' | 'LABOUR' | 'EQUIPMENT' | 'SUBCONTRACTOR' | 'MISC'>(
    'MATERIAL',
  );

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} className="pt-2">
        <Text className="text-primary text-xs font-semibold">+ Add Item</Text>
      </Pressable>
    );
  }

  return (
    <View className="mt-2 border border-border rounded-lg p-2 gap-1.5">
      <TextInput
        value={desc}
        onChangeText={setDesc}
        placeholder="Description"
        placeholderTextColor="#94A3B8"
        className="border border-border rounded px-2 py-1.5 text-sm text-text"
      />
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Text className="text-xs text-muted">Qty</Text>
          <TextInput
            value={qty}
            onChangeText={setQty}
            keyboardType="decimal-pad"
            className="border border-border rounded px-2 py-1.5 text-sm text-text"
          />
        </View>
        <View style={{ width: 70 }}>
          <Text className="text-xs text-muted">Unit</Text>
          <TextInput
            value={unit}
            onChangeText={setUnit}
            className="border border-border rounded px-2 py-1.5 text-sm text-text"
          />
        </View>
        <View className="flex-1">
          <Text className="text-xs text-muted">Rate ₹</Text>
          <TextInput
            value={rate}
            onChangeText={setRate}
            keyboardType="decimal-pad"
            className="border border-border rounded px-2 py-1.5 text-sm text-text"
          />
        </View>
      </View>
      <View className="flex-row items-center justify-between">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1">
          {(['MATERIAL', 'LABOUR', 'EQUIPMENT', 'SUBCONTRACTOR', 'MISC'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setType(t)}
              className={`px-2 py-1 rounded ${type === t ? 'bg-primary' : 'bg-border'}`}
            >
              <Text className={`text-[10px] ${type === t ? 'text-white' : 'text-text'}`}>{t}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text className="text-xs font-semibold text-text">
          = {formatINR((parseFloat(qty) || 0) * (parseFloat(rate) || 0))}
        </Text>
      </View>
      {type === 'MATERIAL' ? (
        <ProcurementLinkFields
          resourceId={resourceId}
          rateAnalysisId={rateAnalysisId}
          onResourceIdChange={setResourceId}
          onRateAnalysisIdChange={setRateAnalysisId}
          scope={{ setDesc, setUnit, setRate }}
          compact
        />
      ) : null}
      <View className="flex-row gap-2 mt-1">
        <Button
          label="Add"
          size="sm"
          onPress={async () => {
            if (!desc.trim()) return;
            await mut.addItem.mutateAsync({
              sectionId,
              description: desc.trim(),
              unit: unit.trim() || 'unit',
              quantity: parseFloat(qty) || 0,
              rate: parseFloat(rate) || 0,
              type,
              resourceId: resourceId || undefined,
              rateAnalysisId: rateAnalysisId || undefined,
            });
            setDesc('');
            setQty('1');
            setRate('0');
            setResourceId('');
            setRateAnalysisId('');
            setOpen(false);
          }}
        />
        <Button label="Cancel" size="sm" variant="ghost" onPress={() => setOpen(false)} />
      </View>
    </View>
  );
}
