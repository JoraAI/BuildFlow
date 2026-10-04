/**
 * Ice cream manufacturer - Recipes & Production (reuses Inventory page chrome).
 */
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { Card, Button, Input, EmptyState, LoadingSkeleton, Select, toast } from '@/components/ui';
import { InventoryPageHeader } from '@/components/inventory/InventoryPageHeader';
import { SegmentedTabs } from '@/components/inventory/SegmentedTabs';
import { useAuthStore } from '@/stores/auth.store';
import { usesIceCreamManufacturerCopy } from '@buildflow/shared';
import { useResources, type Resource } from '@/services/estimate.queries';
import {
  useRecipes,
  useCreateRecipe,
  useUpdateRecipe,
  useDeleteRecipe,
  useProductionBatches,
  useCreateProductionBatch,
  useCompleteProductionBatch,
  useSalesDashboard,
  type RecipeRow,
  type ProductionRow,
} from '@/services/ice-cream.queries';
import { formatINR } from '@/utils/format';
import { confirmAsync } from '@/utils/confirm';
import { useRouter } from 'expo-router';

type Tab = 'recipes' | 'production' | 'sales';

type DraftLine = {
  key: string;
  inputResourceId: string;
  quantity: number;
  label: string;
  unit: string;
};

export default function IceCreamProductionScreen() {
  const user = useAuthStore((s) => s.user);
  const enabled = usesIceCreamManufacturerCopy(user?.inventoryVertical);
  const [tab, setTab] = useState<Tab>('recipes');
  const router = useRouter();

  const recipesQ = useRecipes(enabled);
  const productionQ = useProductionBatches(enabled);
  const salesQ = useSalesDashboard(enabled);
  const resourcesQ = useResources();

  const createRecipe = useCreateRecipe();
  const updateRecipe = useUpdateRecipe();
  const deleteRecipe = useDeleteRecipe();
  const createBatch = useCreateProductionBatch();
  const completeBatch = useCompleteProductionBatch();

  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [recipeName, setRecipeName] = useState('New recipe');
  const [outputId, setOutputId] = useState('');
  const [outputQty, setOutputQty] = useState('100');
  const [inputId, setInputId] = useState('');
  const [inputQty, setInputQty] = useState('1');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [lineSeq, setLineSeq] = useState(0);

  const [batchRecipeId, setBatchRecipeId] = useState('');
  const [batchQty, setBatchQty] = useState('100');
  const [batchCode, setBatchCode] = useState(`B-${Date.now().toString().slice(-6)}`);

  // useResources() returns { data: Resource[] } (list envelope), not a bare array.
  const resources = useMemo<Resource[]>(
    () => (Array.isArray(resourcesQ.data) ? resourcesQ.data : (resourcesQ.data?.data ?? [])),
    [resourcesQ.data],
  );

  const resourceOptions = useMemo(
    () =>
      resources.map((r) => ({
        title: `${r.name}${r.sku ? ` (${r.sku})` : ''}`,
        value: r.id,
      })),
    [resources],
  );

  // Ingredient picker: exclude finished-goods output and lines already added.
  const ingredientOptions = useMemo(() => {
    const used = new Set(lines.map((l) => l.inputResourceId));
    return resources
      .filter((r) => r.id !== outputId && !used.has(r.id))
      .map((r) => ({
        title: `${r.name}${r.sku ? ` (${r.sku})` : ''}`,
        value: r.id,
      }));
  }, [resources, lines, outputId]);

  const activeRecipes = useMemo(
    () => ((recipesQ.data ?? []) as RecipeRow[]).filter((r) => r.isActive !== false),
    [recipesQ.data],
  );

  const resetRecipeForm = () => {
    setEditingRecipeId(null);
    setRecipeName('New recipe');
    setOutputId('');
    setOutputQty('100');
    setInputId('');
    setInputQty('1');
    setLines([]);
    setLineSeq(0);
  };

  const startEditRecipe = (recipe: RecipeRow) => {
    setEditingRecipeId(recipe.id);
    setRecipeName(recipe.name);
    setOutputId(recipe.outputResource.id);
    setOutputQty(String(recipe.outputQty));
    setInputId('');
    setInputQty('1');
    const seeded = recipe.lines.map((l, idx) => ({
      key: `edit-${recipe.id}-${idx}-${l.inputResource.id}`,
      inputResourceId: l.inputResource.id,
      quantity: Number(l.quantity) || 1,
      label: l.inputResource.name,
      unit: l.inputResource.unit ?? '',
    }));
    setLines(seeded);
    setLineSeq(seeded.length);
    setTab('recipes');
  };

  const addIngredientLine = () => {
    if (!inputId) {
      toast.error('Pick an ingredient first');
      return;
    }
    if (inputId === outputId) {
      toast.error('Ingredient cannot be the same as finished goods output');
      return;
    }
    if (lines.some((l) => l.inputResourceId === inputId)) {
      toast.error('That ingredient is already on the recipe');
      return;
    }
    const r = resources.find((x) => x.id === inputId);
    const nextSeq = lineSeq + 1;
    setLineSeq(nextSeq);
    setLines((prev) => [
      ...prev,
      {
        key: `line-${nextSeq}-${inputId}`,
        inputResourceId: inputId,
        quantity: Number(inputQty) || 1,
        label: r?.name ?? inputId,
        unit: r?.unit ?? '',
      },
    ]);
    setInputId('');
    setInputQty('1');
  };

  const saveRecipe = async () => {
    try {
      if (!recipeName.trim()) {
        toast.error('Recipe name is required');
        return;
      }
      if (!outputId || lines.length === 0) {
        toast.error('Output and at least one ingredient required');
        return;
      }
      const payload = {
        name: recipeName.trim(),
        outputResourceId: outputId,
        outputQty: Number(outputQty) || 1,
        lines: lines.map((l) => ({
          inputResourceId: l.inputResourceId,
          quantity: l.quantity,
        })),
      };
      if (editingRecipeId) {
        await updateRecipe.mutateAsync({ id: editingRecipeId, ...payload, isActive: true });
        toast.success('Recipe updated');
      } else {
        await createRecipe.mutateAsync(payload);
        toast.success('Recipe saved');
      }
      resetRecipeForm();
    } catch (e) {
      toast.error((e as Error).message || 'Failed');
    }
  };

  const handleDeleteRecipe = async (recipe: RecipeRow) => {
    const ok = await confirmAsync(
      'Delete recipe?',
      recipe.isActive === false
        ? `"${recipe.name}" is already inactive. Remove it if unused, or keep it for history.`
        : `Delete "${recipe.name}"? If it has production batches it will be deactivated instead of removed.`,
    );
    if (!ok) return;
    try {
      const result = await deleteRecipe.mutateAsync(recipe.id);
      if (editingRecipeId === recipe.id) resetRecipeForm();
      if (batchRecipeId === recipe.id) setBatchRecipeId('');
      toast.success(
        result.mode === 'deactivated'
          ? 'Recipe deactivated (linked to production batches)'
          : 'Recipe deleted',
      );
    } catch (e) {
      toast.error((e as Error).message || 'Failed');
    }
  };

  if (!enabled) {
    return (
      <View className="flex-1 bg-surface p-4">
        <EmptyState
          title="Ice cream vertical required"
          description="Enable Ice cream manufacturer under Settings → Shop vertical."
        />
      </View>
    );
  }

  const refresh = () => {
    void recipesQ.refetch();
    void productionQ.refetch();
    void salesQ.refetch();
  };

  const recipeSaving = createRecipe.isPending || updateRecipe.isPending;

  return (
    <View className="flex-1 bg-surface">
      <InventoryPageHeader
        title="Production"
        subtitle="Recipes, batches, and B2B sales overview"
      />
      <View className="px-4 pt-2">
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'recipes', label: 'Recipes' },
            { value: 'production', label: 'Batches' },
            { value: 'sales', label: 'Sales' },
          ]}
        />
      </View>

      {tab === 'recipes' ? (
        <ScrollView
          className="flex-1 px-4"
          refreshControl={<RefreshControl refreshing={!!recipesQ.isFetching} onRefresh={refresh} />}
        >
          <Card className="p-4 mt-3 mb-3">
            <Text className="text-sm font-bold text-text mb-2">
              {editingRecipeId ? 'Edit recipe' : 'New recipe'}
            </Text>
            <Input label="Name" value={recipeName} onChangeText={setRecipeName} />
            <View className="h-2" />
            <Select
              label="Finished goods output"
              value={outputId || undefined}
              onChange={(v) => {
                if (!v) return;
                setOutputId(v);
                if (inputId === v) setInputId('');
                setLines((prev) => prev.filter((l) => l.inputResourceId !== v));
              }}
              options={resourceOptions}
              title="Finished goods"
            />
            <View className="h-2" />
            <Input label="Output qty" value={outputQty} onChangeText={setOutputQty} keyboardType="decimal-pad" />
            <View className="h-2" />
            <Select
              label="Add ingredient"
              value={inputId || undefined}
              onChange={(v) => setInputId(v ?? '')}
              options={ingredientOptions}
              clearable
              placeholder="Pick next ingredient…"
              title="Ingredient"
            />
            <View className="h-2" />
            <Input label="Ingredient qty" value={inputQty} onChangeText={setInputQty} keyboardType="decimal-pad" />
            {lines.length > 0 ? (
              <View className="mt-3 gap-1.5">
                <Text className="text-xs font-semibold text-muted uppercase">
                  Ingredients ({lines.length})
                </Text>
                {lines.map((l) => (
                  <View
                    key={l.key}
                    className="flex-row items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2"
                  >
                    <Text className="text-sm text-text flex-1 min-w-0" numberOfLines={2}>
                      {l.label}: {l.quantity}
                      {l.unit ? ` ${l.unit}` : ''}
                    </Text>
                    <Pressable
                      onPress={() => setLines((prev) => prev.filter((row) => row.key !== l.key))}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${l.label}`}
                    >
                      <Text className="text-xs font-semibold text-danger">Remove</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
            <View className="flex-row flex-wrap gap-2 mt-3">
              <Button label="Add line" variant="secondary" size="sm" onPress={addIngredientLine} />
              <Button
                label={editingRecipeId ? 'Update recipe' : 'Save recipe'}
                size="sm"
                loading={recipeSaving}
                onPress={() => void saveRecipe()}
              />
              {editingRecipeId ? (
                <Button label="Cancel" variant="ghost" size="sm" onPress={resetRecipeForm} />
              ) : null}
            </View>
          </Card>

          {recipesQ.isLoading ? (
            <LoadingSkeleton />
          ) : (recipesQ.data?.length ?? 0) === 0 ? (
            <EmptyState title="No recipes yet" description="Create a recipe to convert raw materials into finished goods." />
          ) : (
            (recipesQ.data as RecipeRow[]).map((r) => (
              <Card key={r.id} className="p-4 mb-3">
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1 min-w-0">
                    <Text className="text-base font-bold text-text">{r.name}</Text>
                    {r.isActive === false ? (
                      <Text className="text-[11px] font-semibold text-warning mt-0.5">Inactive</Text>
                    ) : null}
                  </View>
                  <View className="flex-row gap-2 shrink-0">
                    <Button
                      label="Edit"
                      variant="secondary"
                      size="sm"
                      onPress={() => startEditRecipe(r)}
                    />
                    <Button
                      label="Delete"
                      variant="ghost"
                      size="sm"
                      loading={deleteRecipe.isPending}
                      onPress={() => void handleDeleteRecipe(r)}
                    />
                  </View>
                </View>
                <Text className="text-xs text-muted mt-1">
                  Output: {r.outputResource.name} × {String(r.outputQty)} {r.outputResource.unit}
                </Text>
                {r.lines.map((l) => (
                  <Text key={l.id} className="text-xs text-text mt-0.5">
                    – {l.inputResource.name}: {String(l.quantity)} {l.inputResource.unit}
                  </Text>
                ))}
              </Card>
            ))
          )}
          <View className="h-8" />
        </ScrollView>
      ) : null}

      {tab === 'production' ? (
        <ScrollView
          className="flex-1 px-4"
          refreshControl={<RefreshControl refreshing={!!productionQ.isFetching} onRefresh={refresh} />}
        >
          <Card className="p-4 mt-3 mb-3">
            <Text className="text-sm font-bold text-text mb-2">New production batch</Text>
            <Select
              label="Recipe"
              value={batchRecipeId || undefined}
              onChange={(v) => v && setBatchRecipeId(v)}
              options={activeRecipes.map((r) => ({ title: r.name, value: r.id }))}
              title="Recipe"
            />
            <View className="h-2" />
            <Input label="Output qty" value={batchQty} onChangeText={setBatchQty} keyboardType="decimal-pad" />
            <View className="h-2" />
            <Input label="Batch code" value={batchCode} onChangeText={setBatchCode} />
            <View className="mt-3">
              <Button
                label="Create draft batch"
                size="sm"
                loading={createBatch.isPending}
                onPress={async () => {
                  try {
                    if (!batchRecipeId) {
                      toast.error('Pick a recipe');
                      return;
                    }
                    await createBatch.mutateAsync({
                      recipeId: batchRecipeId,
                      outputQty: Number(batchQty) || 1,
                      batchCode,
                    });
                    toast.success('Draft batch created');
                    setBatchCode(`B-${Date.now().toString().slice(-6)}`);
                  } catch (e) {
                    toast.error((e as Error).message || 'Failed');
                  }
                }}
              />
            </View>
          </Card>

          {productionQ.isLoading ? (
            <LoadingSkeleton />
          ) : (
            (productionQ.data as ProductionRow[] | undefined)?.map((b) => (
              <Card key={b.id} className="p-4 mb-3">
                <View className="flex-row justify-between items-center">
                  <Text className="text-base font-bold text-text">{b.batchCode}</Text>
                  <Text className="text-xs text-muted">{b.status}</Text>
                </View>
                <Text className="text-xs text-muted mt-1">
                  {b.recipe.name} → {String(b.outputQty)} {b.recipe.outputResource.unit} @ {b.location.name}
                </Text>
                {b.status === 'DRAFT' ? (
                  <View className="mt-2">
                    <Button
                      label="Complete (consume raw / produce FG)"
                      size="sm"
                      variant="accent"
                      loading={completeBatch.isPending}
                      onPress={async () => {
                        try {
                          await completeBatch.mutateAsync(b.id);
                          toast.success('Production completed');
                        } catch (e) {
                          toast.error((e as Error).message || 'Failed');
                        }
                      }}
                    />
                  </View>
                ) : null}
              </Card>
            ))
          )}
          <View className="h-8" />
        </ScrollView>
      ) : null}

      {tab === 'sales' ? (
        <ScrollView
          className="flex-1 px-4"
          refreshControl={<RefreshControl refreshing={!!salesQ.isFetching} onRefresh={refresh} />}
        >
          {salesQ.isLoading ? (
            <LoadingSkeleton />
          ) : (
            <>
              <View className="flex-row flex-wrap gap-2 mt-3 mb-3">
                {[
                  ['Orders', salesQ.data?.totals.orderCount],
                  ['Value', formatINR(Number(salesQ.data?.totals.orderValue ?? 0))],
                  ['B2B orders', salesQ.data?.totals.b2bOrderCount],
                  ['B2B value', formatINR(Number(salesQ.data?.totals.b2bOrderValue ?? 0))],
                ].map(([label, value]) => (
                  <Card key={String(label)} className="p-3 min-w-[140px] flex-1">
                    <Text className="text-[10px] uppercase text-muted">{label}</Text>
                    <Text className="text-lg font-bold text-text">{String(value ?? 0)}</Text>
                  </Card>
                ))}
              </View>
              <Pressable onPress={() => router.push('/inventory/sales' as never)}>
                <Text className="text-sm font-semibold text-primary mb-2">Open Sales list →</Text>
              </Pressable>
              {(salesQ.data?.recent ?? []).map((o: {
                id: string;
                soNumber: string;
                customerName: string;
                status: string;
                source: string;
                total: string | number;
              }) => (
                <Card key={o.id} className="p-3 mb-2">
                  <View className="flex-row justify-between">
                    <Text className="text-sm font-bold text-text">{o.soNumber}</Text>
                    <Text className="text-xs text-muted">{o.source === 'B2B_APP' ? 'B2B app' : 'Manual'}</Text>
                  </View>
                  <Text className="text-xs text-muted mt-0.5">
                    {o.customerName} · {o.status} · {formatINR(Number(o.total))}
                  </Text>
                </Card>
              ))}
            </>
          )}
          <View className="h-8" />
        </ScrollView>
      ) : null}
    </View>
  );
}
