import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Badge, Input, Button, Select, type SelectOption } from '@/components/ui';
import { useMaterialRate } from '@/services/project.queries';
import { useRateAnalyses, useRateAnalysis, type Resource, type RateAnalysis, type RateAnalysisComponent } from '@/services/estimate.queries';
import type { BoqItem } from '@/services/boq.queries';
import type { BoqShortfall } from '@/services/expansion.queries';

export interface IndentComponent {
  resourceId: string;
  miscName: string | null;
  unit: string;
  perUnitQty: number;
  totalQty: number;
  rate: number;
}

export interface IndentDraftLine {
  id: string;
  resourceId: string;
  boqItemId: string;
  rateAnalysisId: string;
  qty: string;
  expectedRate: string;
  rateSource?: string;
  rateManual: boolean;
  components: IndentComponent[];
  /** True when this line was auto-created by exploding a composite BOQ item.
   *  When true, the card shows material-level info instead of BOQ wrapper. */
  isExploded?: boolean;
  /** The BOQ description — shown as a subtitle for exploded material lines
   *  so the user knows which BOQ item it came from. */
  boqDescription?: string;
  /** The original quantity required by the BOQ rate analysis (fixed).
   *  Used in the stock info box so the user sees what the BOQ needs
   *  regardless of what they type in the editable quantity field. */
  boqQty?: string;
  /** The material name from the RA component — used when the catalog
   *  material list doesn't include this resource (different company,
   *  not loaded, etc.). Falls back to this for display. */
  resourceName?: string;
  /** The unit from the RA component. */
  resourceUnit?: string;
}

export function emptyIndentLine(): IndentDraftLine {
  return {
    id: Math.random().toString(36).slice(2),
    resourceId: '',
    boqItemId: '',
    rateAnalysisId: '',
    qty: '1',
    expectedRate: '',
    rateManual: false,
    components: [],
  };
}

const RATE_SOURCE_LABEL: Record<string, string> = {
  PROJECT: 'Project override',
  BOQ: 'BOQ',
  ESTIMATE: 'Estimate',
  REGION: 'Regional',
  LAST_PO: 'Last PO',
  CATALOG: 'Catalog',
  MANUAL: 'Manual',
};

function lineTotal(qty: string, rate: string): number {
  return (parseFloat(qty) || 0) * (parseFloat(rate) || 0);
}

function encodeBoq(id: string) { return `boq:${id}`; }
function encodeMat(id: string) { return `mat:${id}`; }
function encodeRa(id: string) { return `ra:${id}`; }

function decodeValue(v: string): { kind: 'boq' | 'mat' | 'ra'; id: string } | null {
  if (v.startsWith('boq:')) return { kind: 'boq', id: v.slice(4) };
  if (v.startsWith('mat:')) return { kind: 'mat', id: v.slice(4) };
  if (v.startsWith('ra:')) return { kind: 'ra', id: v.slice(3) };
  return null;
}

export function IndentDraftLineCard({
  projectId,
  index,
  line,
  materials,
  boqItems,
  shortfalls,
  canRemove,
  onChange,
  onRemove,
  onExplode,
  stockByResource,
}: {
  projectId: string;
  index: number;
  line: IndentDraftLine;
  materials: Resource[];
  boqItems: BoqItem[];
  shortfalls: BoqShortfall[];
  canRemove: boolean;
  onChange: (line: IndentDraftLine) => void;
  onRemove: () => void;
  /** When set, selecting a composite BOQ item (with rateAnalysisId) will
   *  auto-explode it into separate material lines via this callback instead
   *  of showing a single composite line with component breakdown. */
  onExplode?: (lines: IndentDraftLine[]) => void;
  /** Map of resourceId → on-hand stock quantity. Used to show per-material
   *  stock info on exploded lines. */
  stockByResource?: Map<string, number>;
}) {
  const { data: rateAnalyses } = useRateAnalyses();
  const analyses: RateAnalysis[] = rateAnalyses ?? [];
  const [showComponents, setShowComponents] = useState(false);
  // Track when we're waiting for RA detail to auto-explode a composite BOQ.
  const [pendingExplodeBoqId, setPendingExplodeBoqId] = useState<string | null>(null);

  const selectedBoq = boqItems.find((b) => b.id === line.boqItemId);
  const selectedMaterial = materials.find((r) => r.id === line.resourceId);
  const selectedAnalysis = analyses.find((a) => a.id === line.rateAnalysisId);

  // Fetch rate-analysis components when a rate analysis is selected directly
  // OR when a BOQ item is selected that has a linked rate analysis.
  const effectiveRateAnalysisId = line.rateAnalysisId || selectedBoq?.rateAnalysisId || '';
  const raDetailQ = useRateAnalysis(effectiveRateAnalysisId);

  const pickerValue = line.boqItemId
    ? encodeBoq(line.boqItemId)
    : line.rateAnalysisId
    ? encodeRa(line.rateAnalysisId)
    : line.resourceId
    ? encodeMat(line.resourceId)
    : undefined;

  const options: SelectOption[] = useMemo(() => {
    const opts: SelectOption[] = [];
    for (const b of boqItems) {
      // Only show procurement-relevant BOQ items: MATERIAL and MISC.
      // Skip LABOUR (daily reports), SUBCONTRACTOR (work orders), and
      // EQUIPMENT (rented via hire orders, not stocked via GRN).
      if (['LABOUR', 'SUBCONTRACTOR', 'EQUIPMENT'].includes(b.category ?? '')) continue;

      const preview = shortfalls.find((s) => s.boqItemId === b.id);
      const remaining = b.balanceQty ?? Math.max(0, parseFloat(b.quantity) - (b.executedQty ?? 0));
      const shortfall = preview?.shortfall ?? remaining;
      const boqQty = parseFloat(b.quantity);
      const executed = b.executedQty ?? 0;
      const procured = b.procuredQty ?? 0;
      opts.push({
        value: encodeBoq(b.id),
        title: `${b.itemCode} · ${b.description.slice(0, 60)}${b.description.length > 60 ? '…' : ''}`,
        subtitle: `BOQ: ${boqQty} ${b.unit} @ Rs ${parseFloat(b.rate)}`,
        meta: shortfall > 0 ? `Shortfall: ${shortfall} ${b.unit}` : 'Covered',
        tooltip: shortfall > 0
          ? `BOQ: ${boqQty} ${b.unit} · Executed: ${executed} · Procured: ${procured} · Balance: ${remaining} ${b.unit}`
          : undefined,
        groupKey: 'From BOQ',
        tone: shortfall > 0 ? 'warning' : 'success',
      });
    }
    for (const m of materials.slice(0, 100)) {
      opts.push({
        value: encodeMat(m.id),
        title: m.name,
        subtitle: `${m.type} · ${m.unit}`,
        meta: `Rs ${parseFloat(m.rate)}`,
        groupKey: 'Catalog Materials',
      });
    }
    for (const ra of analyses.slice(0, 50)) {
      opts.push({
        value: encodeRa(ra.id),
        title: ra.name,
        subtitle: `Rate Analysis · ${ra.unit}`,
        meta: `Rs ${parseFloat(ra.totalRate)}`,
        groupKey: 'Rate Analysis (Composite)',
        tone: 'accent',
      });
    }
    return opts;
  }, [boqItems, materials, analyses, shortfalls]);

  const rateQ = useMaterialRate(projectId, line.resourceId, {
    boqItemId: line.boqItemId || undefined,
    enabled: !!line.resourceId,
  });

  useEffect(() => {
    if (!rateQ.data || line.rateManual) return;
    const nextRate = String(rateQ.data.rate);
    if (line.expectedRate === nextRate && line.rateSource === rateQ.data.source) return;
    onChange({
      ...line,
      expectedRate: nextRate,
      rateSource: rateQ.data.source,
    });
  }, [
    rateQ.data,
    line.rateManual,
    line.expectedRate,
    line.rateSource,
    line.resourceId,
    line.boqItemId,
    line.id,
    line.qty,
    onChange,
  ]);

  // Auto-populate components when rate analysis detail loads
  useEffect(() => {
    if (!raDetailQ.data || !effectiveRateAnalysisId) return;

    // If we're in explode mode (composite BOQ selected with onExplode callback),
    // auto-explode into separate material lines instead of showing components.
    if (pendingExplodeBoqId && onExplode) {
      // Clear IMMEDIATELY to prevent duplicate explosions on re-render
      const boqId = pendingExplodeBoqId;
      setPendingExplodeBoqId(null);

      const boq = boqItems.find((b) => b.id === boqId);
      if (!boq) {
        return;
      }
      const lineQty = parseFloat(line.qty) || 1;
      // Create separate lines for MATERIAL-type components only.
      // Skip EQUIPMENT and LABOUR (not procurement items).
      const explodedLines: IndentDraftLine[] = raDetailQ.data.components
        .filter((c: RateAnalysisComponent) => {
          // Only include components that resolve to a catalog material
          // or are MISC-type (consumables). Skip equipment/labour.
          // Only explode MATERIAL and MISC types (skip EQUIPMENT, LABOUR, SUBCONTRACTOR)
          // Only MATERIAL — skip MISC (overheads like formwork, electricity),
          // EQUIPMENT, LABOUR, SUBCONTRACTOR (handled via other workflows)
          return c.type === 'MATERIAL';
        })
        .map((c: RateAnalysisComponent) => {
          const totalQty = parseFloat(String(c.quantityPerUnit)) * lineQty;
          const mat = materials.find((m) => m.id === c.resourceId);
          return {
            id: Math.random().toString(36).slice(2),
            resourceId: c.resourceId ?? '',
            boqItemId: boq.id, // link back to the BOQ for traceability
            rateAnalysisId: effectiveRateAnalysisId,
            qty: String(Math.round(totalQty * 1000) / 1000),
            boqQty: String(Math.round(totalQty * 1000) / 1000),
            expectedRate: String(parseFloat(String(c.rate))),
            rateSource: 'BOQ',
            rateManual: false,
            components: [],
            isExploded: true,
            boqDescription: `${boq.itemCode} · ${boq.description}`,
            resourceName: c.resourceName ?? undefined,
            resourceUnit: c.unit,
          };
        });

      if (explodedLines.length > 0) {
        onExplode(explodedLines);
        // Clear current line (parent will replace it with exploded lines)
        onChange({
          ...emptyIndentLine(),
          boqItemId: '',
          resourceId: '',
        });
      }
      return;
    }

    const lineQty = parseFloat(line.qty) || 1;
    const newComponents: IndentComponent[] = raDetailQ.data.components.map((c: RateAnalysisComponent) => ({
      resourceId: c.resourceId ?? '',
      miscName: c.miscName,
      unit: c.unit,
      perUnitQty: parseFloat(String(c.quantityPerUnit)),
      totalQty: parseFloat(String(c.quantityPerUnit)) * lineQty,
      rate: parseFloat(String(c.rate)),
    }));
    // Only update if components actually changed (avoid infinite loop)
    const existing = JSON.stringify(line.components);
    const updated = JSON.stringify(newComponents);
    if (existing !== updated) {
      onChange({ ...line, components: newComponents });
    }
  }, [raDetailQ.data]);

  // Recalculate component totals when line qty changes
  useEffect(() => {
    if (line.components.length === 0) return;
    const lineQty = parseFloat(line.qty) || 1;
    const recalced: IndentComponent[] = line.components.map((c: IndentComponent) => ({
      ...c,
      totalQty: c.perUnitQty * lineQty,
    }));
    const existing = JSON.stringify(line.components.map((c) => c.totalQty));
    const updated = JSON.stringify(recalced.map((c) => c.totalQty));
    if (existing !== updated) {
      onChange({ ...line, components: recalced });
    }
  }, [line.qty]);

  const total = lineTotal(line.qty, line.expectedRate);

  function handlePickerChange(v: string | undefined) {
    if (!v) {
      onChange({ ...line, resourceId: '', boqItemId: '', rateAnalysisId: '', components: [], rateManual: false, qty: '1', expectedRate: '' });
      return;
    }
    const decoded = decodeValue(v);
    if (!decoded) return;

    if (decoded.kind === 'boq') {
      const boq = boqItems.find((b) => b.id === decoded.id);
      if (!boq) return;
      const preview = shortfalls.find((s) => s.boqItemId === boq.id);
      const remaining = boq.balanceQty ?? Math.max(0, parseFloat(boq.quantity) - (boq.executedQty ?? 0));
      const suggested = preview?.shortfall ?? remaining;
      onChange({
        ...line,
        boqItemId: boq.id,
        resourceId: boq.resourceId ?? '',
        rateAnalysisId: '',
        components: [],
        qty: suggested > 0 ? String(suggested) : line.qty,
        // Set BOQ rate immediately so the user sees it right away.
        // useMaterialRate may override with a more specific rate if available.
        expectedRate: String(parseFloat(boq.rate)),
        rateSource: 'BOQ',
        rateManual: false,
      });
      // Every BOQ item should explode into its constituent materials.
      // - Composite BOQ (rateAnalysisId): wait for RA detail → explode into multiple lines
      // - Simple material BOQ (resourceId, no RA): explode NOW into single material line
      // - Plain BOQ (no links): explode NOW into single line with BOQ desc as name
      if (onExplode) {
        if (boq.rateAnalysisId) {
          // Composite — need RA detail to load first, then explode via effect
          setPendingExplodeBoqId(boq.id);
        } else {
          // Simple material or plain line — explode immediately.
          // Resolve the material name from the catalog if the BOQ has a resourceId.
          const linkedMat = boq.resourceId ? materials.find((m) => m.id === boq.resourceId) : undefined;
          const explodedLine: IndentDraftLine = {
            id: Math.random().toString(36).slice(2),
            resourceId: boq.resourceId ?? '',
            boqItemId: boq.id,
            rateAnalysisId: '',
            qty: suggested > 0 ? String(suggested) : '1',
            boqQty: suggested > 0 ? String(suggested) : '1',
            expectedRate: String(parseFloat(boq.rate)),
            rateSource: 'BOQ',
            rateManual: false,
            components: [],
            isExploded: true,
            boqDescription: `${boq.itemCode} · ${boq.description}`,
            // Show the catalog material name when available; fall back to BOQ description.
            resourceName: linkedMat?.name ?? boq.description,
            resourceUnit: linkedMat?.unit ?? boq.unit,
          };
          onExplode([explodedLine]);
        }
      }
    } else if (decoded.kind === 'mat') {
      const mat = materials.find((m) => m.id === decoded.id);
      if (!mat) return;
      onChange({
        ...line,
        resourceId: mat.id,
        boqItemId: '',
        rateAnalysisId: '',
        components: [],
        rateManual: false,
      });
    } else if (decoded.kind === 'ra') {
      const ra = analyses.find((a) => a.id === decoded.id);
      if (!ra) return;
      onChange({
        ...line,
        rateAnalysisId: ra.id,
        resourceId: '',
        boqItemId: '',
        components: [],
        qty: '1',
        expectedRate: String(parseFloat(ra.totalRate)),
        rateSource: 'CATALOG',
        rateManual: false,
      });
    }
  }

  function updateComponentQty(idx: number, totalQty: number) {
    const updated = [...line.components];
    updated[idx] = { ...updated[idx], totalQty };
    onChange({ ...line, components: updated });
  }

  return (
    <View className="border border-border rounded-lg p-3 gap-2 bg-card">
      <View className="flex-row justify-between items-center">
        <Text className="text-xs font-semibold text-muted">Line {index + 1}</Text>
        {canRemove ? (
          <Button label="✕ Remove" size="sm" variant="ghost" onPress={onRemove} />
        ) : null}
      </View>

      {/* Hide the Select dropdown for exploded lines — they show static material info */}
      {!line.isExploded ? (
        <Select
          label="Select Item"
          value={pickerValue}
          placeholder="Search BOQ, materials, or rate analysis…"
          title="Select Item"
          searchPlaceholder="Search by name, code, or description…"
          clearable
          options={options}
          onChange={handlePickerChange}
        />
      ) : null}

      {/* For exploded lines — unified display using line data */}
      {line.isExploded ? (
        <View className="gap-1 -mt-1">
          {/* Unified display: use line.resourceName or fall back to catalog */}
          <View className="flex-row items-center gap-2 flex-wrap">
            <Badge label="Material" color="success" />
            <Text className="text-[10px] text-muted flex-1" numberOfLines={1}>
              {selectedMaterial
                ? `${selectedMaterial.name} (${selectedMaterial.unit})`
                : `${line.resourceName ?? 'Unknown'}${line.resourceUnit ? ` (${line.resourceUnit})` : ''}`}
            </Text>
          </View>
          {line.boqDescription ? (
            <Text className="text-[10px] text-primary ml-2" numberOfLines={1}>
              From BOQ: {line.boqDescription}
            </Text>
          ) : null}
          {/* Per-material stock info */}
          {(() => {
            const stockId = line.resourceId || selectedMaterial?.id || '';
            const stockUnit = selectedMaterial?.unit || line.resourceUnit || '';
            const onHand = stockId ? (stockByResource?.get(stockId) ?? 0) : 0;
            const boqNeeded = parseFloat(line.boqQty || line.qty) || 0;
            const suggested = Math.max(0, boqNeeded - onHand);
            return (
              <View className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 gap-0.5">
                <View className="flex-row justify-between">
                  <Text className="text-xs text-muted">📦 On hand</Text>
                  <Text className="text-xs font-semibold text-text">{onHand} {stockUnit}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-xs text-muted">📋 BOQ requires</Text>
                  <Text className="text-xs font-semibold text-text">{boqNeeded} {stockUnit}</Text>
                </View>
                {suggested > 0 ? (
                  <View className="flex-row justify-between pt-0.5 mt-0.5 border-t border-accent/20">
                    <Text className="text-xs font-semibold text-accent">⚠️ Suggested to procure</Text>
                    <Text className="text-xs font-bold text-accent">{suggested} {stockUnit}</Text>
                  </View>
                ) : (
                  <View className="flex-row justify-between pt-0.5 mt-0.5 border-t border-accent/20">
                    <Text className="text-xs font-semibold text-success">✓ Covered by stock</Text>
                    <Text className="text-xs font-bold text-success">0 {stockUnit}</Text>
                  </View>
                )}
              </View>
            );
          })()}
        </View>
      ) : selectedBoq ? (
        <View className="gap-1 -mt-1">
          <View className="flex-row items-center gap-2 flex-wrap">
            <Badge label="BOQ Linked" color="primary" />
            <Text className="text-[10px] text-muted flex-1" numberOfLines={1}>
              {selectedBoq.itemCode} · {selectedBoq.description}
            </Text>
          </View>
          {/* Stock info box — shows what's already on hand so the user
              knows how much to procure. */}
          {(() => {
            const onHand = selectedBoq.stockQty ?? 0;
            const boqQty = parseFloat(selectedBoq.quantity) || 0;
            const executed = selectedBoq.executedQty ?? 0;
            const balance = selectedBoq.balanceQty ?? Math.max(0, boqQty - executed);
            const shortfall = Math.max(0, balance - onHand);
            if (onHand === 0 && balance === 0) return null;
            return (
              <View className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 gap-0.5">
                <View className="flex-row justify-between">
                  <Text className="text-xs text-muted">📦 On hand (site stock)</Text>
                  <Text className="text-xs font-semibold text-text">
                    {onHand} {selectedBoq.unit}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-xs text-muted">📋 Balance to execute</Text>
                  <Text className="text-xs font-semibold text-text">
                    {balance} {selectedBoq.unit}
                  </Text>
                </View>
                {shortfall > 0 ? (
                  <View className="flex-row justify-between pt-0.5 mt-0.5 border-t border-accent/20">
                    <Text className="text-xs font-semibold text-accent">⚠️ Shortfall (procure)</Text>
                    <Text className="text-xs font-bold text-accent">
                      {shortfall} {selectedBoq.unit}
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row justify-between pt-0.5 mt-0.5 border-t border-accent/20">
                    <Text className="text-xs font-semibold text-success">✓ Covered by stock</Text>
                    <Text className="text-xs font-bold text-success">0 {selectedBoq.unit}</Text>
                  </View>
                )}
              </View>
            );
          })()}
        </View>
      ) : selectedAnalysis ? (
        <View className="flex-row items-center gap-2 flex-wrap -mt-1">
          <Badge label="Rate Analysis" color="accent" />
          <Text className="text-[10px] text-muted flex-1" numberOfLines={1}>
            {selectedAnalysis.name} ({selectedAnalysis.unit})
          </Text>
        </View>
      ) : selectedMaterial ? (
        <View className="flex-row items-center gap-2 flex-wrap -mt-1">
          <Badge label={selectedMaterial.type} color="neutral" />
          <Text className="text-[10px] text-muted flex-1" numberOfLines={1}>
            {selectedMaterial.name} ({selectedMaterial.unit})
          </Text>
        </View>
      ) : null}

      <View className="flex-row gap-2">
        <View className="flex-1">
          <Input
            label="Quantity"
            value={line.qty}
            onChangeText={(qty) => onChange({ ...line, qty })}
            keyboardType="numeric"
            placeholder="0"
          />
        </View>
        <View className="flex-1">
          <Input
            label="Unit Rate (₹)"
            value={line.expectedRate}
            onChangeText={(expectedRate) =>
              onChange({
                ...line,
                expectedRate,
                rateSource: 'MANUAL',
                rateManual: true,
              })
            }
            keyboardType="numeric"
            placeholder="0"
          />
        </View>
      </View>

      {rateQ.data && !line.rateManual ? (
        <Text className="text-[10px] text-primary">
          Auto: Rs {rateQ.data.rate} ({RATE_SOURCE_LABEL[rateQ.data.source] ?? rateQ.data.source})
        </Text>
      ) : null}

      {/* Rate Analysis Component Breakdown — hidden for exploded lines */}
      {line.components.length > 0 && !line.isExploded && (
        <View className="mt-1 border border-accent/30 rounded-lg bg-accent/5 overflow-hidden">
          <Pressable
            onPress={() => setShowComponents(!showComponents)}
            className="flex-row items-center justify-between px-3 py-2"
          >
            <View className="flex-row items-center gap-2">
              <Badge label={`${line.components.length} components`} color="accent" />
              <Text className="text-xs font-semibold text-text">Component Breakdown</Text>
            </View>
            <Text className="text-xs text-primary font-medium">{showComponents ? '▲ Hide' : '▼ Show'}</Text>
          </Pressable>

          {showComponents && (
            <View className="px-3 pb-2 gap-1.5">
              <Text className="text-[10px] text-muted mb-1">
                Quantities auto-calculated from rate analysis × line quantity. Edit if needed.
              </Text>
              {line.components.map((comp, ci) => {
                const resName = comp.resourceId
                  ? materials.find((m) => m.id === comp.resourceId)?.name ?? comp.resourceId
                  : comp.miscName ?? 'Misc';
                return (
                  <View key={ci} className="flex-row items-center gap-2 py-1 border-t border-accent/10">
                    <View className="flex-[2]">
                      <Text className="text-xs text-text" numberOfLines={1}>{resName}</Text>
                      <Text className="text-[10px] text-muted">
                        {comp.perUnitQty}/{selectedAnalysis?.unit ?? 'unit'} × {line.qty} = {comp.totalQty.toFixed(3)} {comp.unit}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Input
                        value={String(comp.totalQty)}
                        onChangeText={(v) => updateComponentQty(ci, parseFloat(v) || 0)}
                        keyboardType="numeric"
                        placeholder="0"
                      />
                    </View>
                    <Text className="text-[10px] text-muted w-12 text-right">
                      Rs {(comp.totalQty * comp.rate).toFixed(0)}
                    </Text>
                  </View>
                );
              })}
              <View className="flex-row justify-between pt-2 mt-1 border-t border-accent/20">
                <Text className="text-[10px] font-semibold text-muted">Components total</Text>
                <Text className="text-[10px] font-semibold text-text">
                  Rs {line.components.reduce((s, c) => s + c.totalQty * c.rate, 0).toFixed(0)}
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

      {total > 0 ? (
        <View className="flex-row justify-end">
          <Text className="text-xs font-semibold text-text">
            Line total: Rs {total.toFixed(0)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function indentLineTotal(line: IndentDraftLine): number {
  return lineTotal(line.qty, line.expectedRate);
}