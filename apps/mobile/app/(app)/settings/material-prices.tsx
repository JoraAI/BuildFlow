/**
 * BuildFlow - Material Price Tracker.
 * Row list with thumbnails; desktop master-detail for price history.
 */
import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button, Badge, LoadingSkeleton, EmptyState, SearchBar, DateField, Input } from '@/components/ui';
import { LineChart, Sparkline } from '@/components/charts/LineChart';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { SettingsPageLayout } from '@/components/layout/SettingsPageLayout';
import { FormScreenHeader } from '@/components/layout/ScreenHeader';
import { useViewport } from '@/hooks/useViewport';
import { MaterialThumbnail } from '@/components/materials/MaterialThumbnail';
import {
  useMaterials,
  usePriceHistory,
  useAddPriceHistory,
  useCreateResource,
  useUpdateResource,
  useDeleteResource,
  useUploadMaterialImage,
  type Resource,
  type PriceHistoryPoint,
} from '@/services/estimate.queries';
import { formatINR, formatDate } from '@/utils/format';
import { todayDateOnly } from '@/utils/date-field';
import { alertAsync, confirmAsync } from '@/utils/confirm';
import { ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import {
  suggestHsn,
  suggestGst,
  hsnSuggestHelperText,
  type CatalogMaterialRef,
} from '@buildflow/shared';

const MATERIAL_CATEGORIES = ['Cement', 'Steel', 'Aggregates', 'Bricks', 'Other'] as const;

type MaterialFormState = {
  name: string;
  unit: string;
  category: string;
  hsnSacCode: string;
  rate: string;
  gstRate: string;
  localImageUri: string | null;
  removeImage: boolean;
};

const EMPTY_MATERIAL_FORM: MaterialFormState = {
  name: '',
  unit: 'bag',
  category: 'Cement',
  hsnSacCode: '',
  rate: '',
  gstRate: '18',
  localImageUri: null,
  removeImage: false,
};

type CategoryVisual = {
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  tint: string;
};

const CATEGORY_VISUAL: Record<string, CategoryVisual> = {
  Cement: { icon: 'cube-outline', bg: '#F1F5F9', tint: '#475569' },
  Steel: { icon: 'git-commit-outline', bg: '#E0E7FF', tint: '#1E3A5F' },
  Aggregates: { icon: 'layers-outline', bg: '#FEF3C7', tint: '#B45309' },
  Bricks: { icon: 'grid-outline', bg: '#FEE2E2', tint: '#B91C1C' },
};

const DEFAULT_VISUAL: CategoryVisual = {
  icon: 'construct-outline',
  bg: '#ECFDF5',
  tint: '#047857',
};

function categoryVisual(category: string | null): CategoryVisual {
  if (!category) return DEFAULT_VISUAL;
  return CATEGORY_VISUAL[category] ?? DEFAULT_VISUAL;
}

function useMaterialTrend(material: Resource, loadHistory: boolean) {
  const { data: hist } = usePriceHistory(loadHistory ? material.id : '');
  const points = hist ?? [];
  const sparkData: number[] = points.slice(-6).map((p: PriceHistoryPoint) => parseFloat(p.rate));
  if (sparkData.length === 0) sparkData.push(parseFloat(material.rate));
  const prevRate = sparkData.length > 1 ? sparkData[sparkData.length - 2] : sparkData[0];
  const curRate = parseFloat(material.rate);
  const change = curRate - prevRate;
  const changePct = prevRate > 0 ? (change / prevRate) * 100 : 0;
  return { sparkData, curRate, change, changePct };
}

export default function MaterialPriceTrackerScreen() {
  const { isDesktop } = useViewport();
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === 'OWNER' || user?.role === 'PM';
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const listScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isError, refetch, isFetching } = useMaterials({
    search: debouncedSearch,
    limit: 200,
  });
  const createMut = useCreateResource();
  const uploadMut = useUploadMaterialImage();
  const deleteMut = useDeleteResource();
  const [selected, setSelected] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<MaterialFormState>(EMPTY_MATERIAL_FORM);
  const [addError, setAddError] = useState<string | null>(null);

  const materials = useMemo(() => {
    return [...(data?.data ?? [])].sort((a: Resource, b: Resource) => {
      const cat = (a.category ?? '').localeCompare(b.category ?? '');
      return cat !== 0 ? cat : a.name.localeCompare(b.name);
    });
  }, [data?.data]);

  const totalMaterials = data?.meta.total ?? materials.length;
  const showingCount = materials.length;

  useEffect(() => {
    if (!isDesktop || materials.length === 0) return;
    setSelected((prev) => (prev && materials.some((m: Resource) => m.id === prev) ? prev : materials[0]!.id));
  }, [isDesktop, materials]);

  async function uploadFormImage(form: MaterialFormState): Promise<string | undefined | null> {
    if (form.removeImage) return null;
    if (!form.localImageUri) return undefined;
    const ext = form.localImageUri.split('.').pop()?.toLowerCase() ?? 'jpg';
    const contentType =
      ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'heic' ? 'image/heic' : 'image/jpeg';
    try {
      return await uploadMut.mutateAsync({
        uri: form.localImageUri,
        filename: `material.${ext}`,
        contentType,
      });
    } catch {
      throw new ApiError('UPLOAD_FAILED', 'Photo upload failed. Check S3 in Integrations or save without a photo.', 0);
    }
  }

  async function handleAddMaterial() {
    const rate = parseFloat(addForm.rate);
    if (!addForm.name.trim()) {
      setAddError('Material name is required');
      return;
    }
    if (!addForm.unit.trim()) {
      setAddError('Unit is required');
      return;
    }
    if (!rate || rate <= 0) {
      setAddError('Enter a valid initial rate');
      return;
    }
    setAddError(null);
    try {
      let imageUrl: string | undefined;
      if (addForm.localImageUri) {
        imageUrl = (await uploadFormImage(addForm)) ?? undefined;
      }
      const created = await createMut.mutateAsync({
        name: addForm.name.trim(),
        type: 'MATERIAL',
        unit: addForm.unit.trim(),
        rate,
        category: addForm.category === 'Other' ? undefined : addForm.category,
        hsnSacCode: addForm.hsnSacCode.trim() || undefined,
        gstRate: addForm.gstRate ? parseFloat(addForm.gstRate) : undefined,
        ...(imageUrl ? { imageUrl } : {}),
      });
      setShowAddModal(false);
      setAddForm(EMPTY_MATERIAL_FORM);
      setSearch('');
      setDebouncedSearch('');
      setSelected(created.id);
      listScrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Failed to add material';
      setAddError(msg);
      await alertAsync('Failed', msg);
    }
  }

  async function handleDeleteMaterial(id: string, name: string) {
    const ok = await confirmAsync('Delete material?', `Remove "${name}" from the catalog? This cannot be undone if unused.`);
    if (!ok) return;
    try {
      await deleteMut.mutateAsync(id);
      if (selected === id) setSelected(null);
    } catch (e) {
      await alertAsync('Delete failed', e instanceof ApiError ? e.message : 'Unknown error');
    }
  }

  const listBody = isLoading ? (
    <View className="gap-0">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <LoadingSkeleton key={i} className="h-[72px] rounded-none border-b border-border/40" />
      ))}
    </View>
  ) : materials.length === 0 ? (
    <EmptyState
      title={isError ? "Couldn't load materials" : 'No materials'}
      description={
        isError
          ? 'Your session may be stale after a database reset. Log out and sign in again, or retry.'
          : canManage
            ? 'Add materials to track market rates for your estimates.'
            : 'View-only access. Ask your owner or PM to add or update materials.'
      }
      action={
        isError ? (
          <View className="gap-2">
            <Button label="Retry" onPress={() => refetch()} loading={isFetching} />
            <Button label="Log out" variant="secondary" onPress={() => useAuthStore.getState().logout()} />
          </View>
        ) : canManage ? (
          <Button label="Add Material" onPress={() => setShowAddModal(true)} />
        ) : undefined
      }
    />
  ) : (
    <Card className="overflow-hidden p-0 border border-border">
      {isDesktop && <MaterialListHeader />}
      <ScrollView ref={listScrollRef} nestedScrollEnabled={isDesktop}>
        {materials.map((m: Resource, idx: number) => (
          <MaterialListRow
            key={m.id}
            material={m}
            selected={selected === m.id}
            isLast={idx === materials.length - 1}
            onPress={() => setSelected(m.id)}
          />
        ))}
      </ScrollView>
    </Card>
  );

  const searchBar = (
    <View className="mb-4">
      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search by name, category, or HSN..." />
        </View>
        {canManage && !isDesktop ? (
          <Button label="Add" size="sm" onPress={() => setShowAddModal(true)} />
        ) : null}
      </View>
      {!isLoading && totalMaterials > 0 ? (
        <Text className="text-xs text-muted mt-2">
          {debouncedSearch || showingCount < totalMaterials
            ? `Showing ${showingCount} of ${totalMaterials} materials`
            : `${totalMaterials} material${totalMaterials === 1 ? '' : 's'}`}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View className="flex-1 bg-surface">
      <OfflineBanner />
      <SettingsPageLayout
        title="Material Prices"
        subtitle={
          canManage
            ? 'Track market rates and manage your material catalog'
            : 'View market rates (read-only)'
        }
        maxWidth="default"
        refreshing={isFetching}
        onRefresh={refetch}
        actions={
          canManage && isDesktop ? (
            <Button
              label="Add Material"
              size="sm"
              onPress={() => setShowAddModal(true)}
              icon={<Ionicons name="add" size={18} color="#fff" />}
            />
          ) : undefined
        }
      >
        {isDesktop ? (
          <View className="flex-row gap-6 items-start">
            <View className="flex-1 min-w-0 max-w-2xl">
              {searchBar}
              {listBody}
            </View>
            <View className="flex-[1.15] min-w-[380px] max-w-xl">
              {selected ? (
                <PriceHistoryPanel
                  resourceId={selected}
                  embedded
                  canManage={canManage}
                  onClose={() => setSelected(null)}
                  onDelete={handleDeleteMaterial}
                />
              ) : (
                <Card className="min-h-[420px] items-center justify-center p-8 border-dashed">
                  <Ionicons name="analytics-outline" size={40} color="#94A3B8" />
                  <Text className="text-base font-semibold text-text mt-4 text-center">Select a material</Text>
                  <Text className="text-sm text-muted mt-1 text-center max-w-xs">
                    Choose a row to view price trends, history, and record a new market rate.
                  </Text>
                </Card>
              )}
            </View>
          </View>
        ) : (
          <>
            {searchBar}
            {listBody}
          </>
        )}
      </SettingsPageLayout>

      {!isDesktop && (
        <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
          {selected && (
            <PriceHistoryPanel
              resourceId={selected}
              canManage={canManage}
              onClose={() => setSelected(null)}
              onDelete={handleDeleteMaterial}
            />
          )}
        </Modal>
      )}

      <MaterialFormModal
        visible={showAddModal}
        title="Add Material"
        form={addForm}
        error={addError}
        loading={createMut.isPending || uploadMut.isPending}
        catalog={materials}
        onChange={setAddForm}
        onClose={() => {
          setShowAddModal(false);
          setAddForm(EMPTY_MATERIAL_FORM);
          setAddError(null);
        }}
        onSubmit={handleAddMaterial}
      />
    </View>
  );
}

function MaterialListHeader() {
  return (
    <View className="flex-row items-center px-4 py-2.5 bg-surface border-b border-border">
      <Text className="flex-[2] text-[11px] font-bold text-muted uppercase tracking-wide">Material</Text>
      <Text className="flex-1 text-[11px] font-bold text-muted uppercase tracking-wide">Rate</Text>
      <Text className="w-28 text-[11px] font-bold text-muted uppercase tracking-wide text-center">Trend</Text>
      <Text className="w-20 text-[11px] font-bold text-muted uppercase tracking-wide text-right">Change</Text>
    </View>
  );
}

function MaterialListRow({
  material,
  selected,
  isLast,
  onPress,
}: {
  material: Resource;
  selected?: boolean;
  isLast?: boolean;
  onPress: () => void;
}) {
  const { isDesktop } = useViewport();
  const { sparkData, curRate, change, changePct } = useMaterialTrend(material, false);
  const trendColor = change > 0 ? '#EF4444' : change < 0 ? '#10B981' : '#94A3B8';

  if (isDesktop) {
    return (
      <Pressable
        onPress={onPress}
        className={`flex-row items-center px-4 py-3 border-b border-border/50 active:opacity-90 ${
          selected ? 'bg-primary/5 border-l-4 border-l-primary' : 'bg-card border-l-4 border-l-transparent'
        } ${isLast ? 'border-b-0' : ''}`}
      >
        <View className="flex-[2] flex-row items-center gap-3 min-w-0 pr-3">
          <MaterialThumbnail material={material} size={48} />
          <View className="flex-1 min-w-0">
            <Text className="text-sm font-semibold text-text" numberOfLines={1}>
              {material.name}
            </Text>
            <View className="flex-row flex-wrap items-center gap-1.5 mt-0.5">
              {material.category ? <Badge color="neutral" label={material.category} /> : null}
              {material.hsnSacCode ? (
                <Text className="text-[10px] text-muted">HSN {material.hsnSacCode}</Text>
              ) : null}
            </View>
          </View>
        </View>
        <View className="flex-1 pr-2">
          <Text className="text-sm font-bold text-text">{formatINR(curRate)}</Text>
          <Text className="text-xs text-muted">per {material.unit}</Text>
        </View>
        <View className="w-28 items-center justify-center">
          {sparkData.length > 1 ? (
            <Sparkline data={sparkData} width={96} height={28} color={trendColor} />
          ) : (
            <Text className="text-xs text-muted">-</Text>
          )}
        </View>
        <View className="w-20 items-end">
          {change !== 0 ? (
            <Badge
              label={`${change > 0 ? '▲' : '▼'} ${Math.abs(changePct).toFixed(1)}%`}
              color={change > 0 ? 'danger' : 'success'}
            />
          ) : (
            <Text className="text-xs text-muted">-</Text>
          )}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center px-3 py-3 border-b border-border/50 active:bg-surface ${isLast ? 'border-b-0' : ''}`}
    >
      <MaterialThumbnail material={material} size={52} />
      <View className="flex-1 min-w-0 mx-3">
        <Text className="text-sm font-semibold text-text" numberOfLines={2}>
          {material.name}
        </Text>
        <View className="flex-row flex-wrap items-center gap-2 mt-1">
          {material.category ? <Badge color="neutral" label={material.category} /> : null}
          <Text className="text-xs text-muted">
            {formatINR(curRate)}/{material.unit}
          </Text>
        </View>
        {material.lastRateUpdatedAt ? (
          <Text className="text-[10px] text-muted mt-0.5">Updated {formatDate(material.lastRateUpdatedAt)}</Text>
        ) : null}
      </View>
      <View className="items-end gap-1.5">
        {change !== 0 && (
          <Badge
            label={`${change > 0 ? '▲' : '▼'} ${Math.abs(changePct).toFixed(1)}%`}
            color={change > 0 ? 'danger' : 'success'}
          />
        )}
        {sparkData.length > 1 && <Sparkline data={sparkData} width={72} height={24} color={trendColor} />}
        <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
      </View>
    </Pressable>
  );
}

function PriceHistoryPanel({
  resourceId,
  onClose,
  embedded = false,
  canManage = false,
  onDelete,
}: {
  resourceId: string;
  onClose: () => void;
  embedded?: boolean;
  canManage?: boolean;
  onDelete?: (id: string, name: string) => void;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const { isDesktop } = useViewport();
  const { data: materialList } = useMaterials({ limit: 200 });
  const { data: hist, isLoading } = usePriceHistory(resourceId);
  const addMut = useAddPriceHistory(resourceId);
  const updateMut = useUpdateResource(resourceId);
  const uploadMut = useUploadMaterialImage();
  const [showForm, setShowForm] = useState(false);
  const [showEditMeta, setShowEditMeta] = useState(false);
  const [editForm, setEditForm] = useState<MaterialFormState>(EMPTY_MATERIAL_FORM);
  const [editError, setEditError] = useState<string | null>(null);
  const [newRate, setNewRate] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(todayDateOnly());
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const res = materialList?.data.find((r: Resource) => r.id === resourceId);
  const history = hist ?? [];
  const pendingScheduled = history.find((p: PriceHistoryPoint) => p.isScheduled);
  const chartData = history
    .filter((p: PriceHistoryPoint) => !p.isScheduled)
    .map((p: PriceHistoryPoint) => ({
      x: p.effectiveDate,
      y: parseFloat(p.rate),
    }));

  function openRateForm() {
    setEffectiveDate(todayDateOnly());
    setFormError(null);
    setShowForm(true);
  }

  function openEditMeta() {
    if (!res) return;
    setEditForm({
      name: res.name,
      unit: res.unit,
      category: res.category ?? 'Other',
      hsnSacCode: res.hsnSacCode ?? '',
      rate: res.rate,
      gstRate: res.gstRate ?? '18',
      localImageUri: null,
      removeImage: false,
    });
    setEditError(null);
    setShowEditMeta(true);
  }

  async function handleSaveMeta() {
    if (!editForm.name.trim() || !editForm.unit.trim()) {
      setEditError('Name and unit are required');
      return;
    }
    setEditError(null);
    try {
      let imagePatch: { imageUrl?: string | null } = {};
      if (editForm.removeImage) {
        imagePatch = { imageUrl: null };
      } else if (editForm.localImageUri) {
        const ext = editForm.localImageUri.split('.').pop()?.toLowerCase() ?? 'jpg';
        const contentType =
          ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'heic' ? 'image/heic' : 'image/jpeg';
        const imageUrl = await uploadMut.mutateAsync({
          uri: editForm.localImageUri,
          filename: `material.${ext}`,
          contentType,
        });
        imagePatch = { imageUrl };
      }
      await updateMut.mutateAsync({
        name: editForm.name.trim(),
        unit: editForm.unit.trim(),
        category: editForm.category === 'Other' ? undefined : editForm.category,
        hsnSacCode: editForm.hsnSacCode.trim() || undefined,
        ...imagePatch,
      });
      setShowEditMeta(false);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Failed to update';
      setEditError(msg);
      await alertAsync('Failed', msg);
    }
  }

  async function handleSave() {
    const rate = parseFloat(newRate);
    if (!rate || rate <= 0) {
      setFormError('Enter a valid rate');
      await alertAsync('Required', 'Enter a valid rate');
      return;
    }
    if (!effectiveDate) {
      setFormError('Effective date is required');
      return;
    }
    if (pendingScheduled) {
      const msg = `A rate is already scheduled for ${formatDate(pendingScheduled.effectiveDate)}. Wait until it takes effect.`;
      setFormError(msg);
      await alertAsync('Scheduled rate pending', msg);
      return;
    }
    setFormError(null);
    try {
      await addMut.mutateAsync({
        rate,
        effectiveDate,
        notes: notes.trim() || undefined,
      });
      setNewRate('');
      setNotes('');
      setEffectiveDate(todayDateOnly());
      setShowForm(false);
    } catch (e) {
      let msg = e instanceof Error ? e.message : 'Failed to save';
      if (e instanceof ApiError && e.details?.length) {
        const detail = e.details[0] as { message?: string };
        if (detail?.message) msg = detail.message;
      }
      setFormError(msg);
      await alertAsync('Failed', msg);
    }
  }

  const chartWidth = embedded
    ? Math.min(screenWidth * 0.32, 420)
    : Math.min(screenWidth - 32, 400);

  const materialSubtitle = res
    ? `${formatINR(parseFloat(res.rate))}/${res.unit}${res.category ? ` · ${res.category}` : ''}`
    : undefined;

  const actionButtons = canManage ? (
    <View className={`flex-row gap-2 ${embedded ? '' : 'px-4 pb-4'}`}>
      <View className="flex-1">
        <Button label="Edit" size="sm" variant="secondary" fullWidth onPress={openEditMeta} />
      </View>
      <View className="flex-1">
        <Button
          label="Update Rate"
          size="sm"
          fullWidth
          onPress={openRateForm}
          disabled={!!pendingScheduled}
        />
      </View>
    </View>
  ) : null;

  const header = embedded ? (
    <View className="pb-4 mb-4 border-b border-border">
      <View className="flex-row items-center gap-3">
        {res ? <MaterialThumbnail material={res} size={56} /> : null}
        <View className="flex-1 min-w-0">
          <Text className="font-bold text-text text-lg" numberOfLines={2}>
            {res?.name ?? 'Material'}
          </Text>
          <Text className="text-xs text-muted">{materialSubtitle ?? 'Price history'}</Text>
        </View>
        {canManage ? (
          <View className="flex-row gap-1 shrink-0">
            <Button label="Edit" size="sm" variant="secondary" onPress={openEditMeta} />
            <Button
              label="Update Rate"
              size="sm"
              onPress={openRateForm}
              disabled={!!pendingScheduled}
            />
          </View>
        ) : null}
      </View>
    </View>
  ) : (
    <View className="border-b border-border bg-surface shrink-0">
      <FormScreenHeader
        title={res?.name ?? 'Material'}
        subtitle={materialSubtitle}
        onCancel={onClose}
        cancelLabel="Back"
      />
      {actionButtons}
    </View>
  );

  const body = (
    <ScrollView
      className="flex-1"
      contentContainerClassName={embedded ? 'gap-4 pb-4' : 'p-4 gap-4 pb-8'}
      showsVerticalScrollIndicator={!embedded}
    >
      <Card>
        <Text className="text-sm font-bold text-text mb-2">Price Trend</Text>
        {isLoading ? (
          <ActivityIndicator />
        ) : chartData.length > 0 ? (
          <LineChart
            data={chartData}
            width={chartWidth}
            height={embedded ? 200 : 220}
            color="#1E3A5F"
            yLabelPrefix="₹"
            xTickFormat={(v: number | string) => {
              const date = new Date(v as string);
              return `${date.getDate()}/${date.getMonth() + 1}`;
            }}
          />
        ) : (
          <Text className="text-sm text-text-muted text-center py-8">No history yet</Text>
        )}
      </Card>

      {pendingScheduled ? (
        <Card className="border border-accent/40 bg-accent/5">
          <View className="flex-row items-start gap-2">
            <Ionicons name="time-outline" size={18} color="#B45309" />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-text">Scheduled rate pending</Text>
              <Text className="text-xs text-muted mt-1 leading-relaxed">
                {formatINR(parseFloat(pendingScheduled.rate))} effective{' '}
                {formatDate(pendingScheduled.effectiveDate)}. Add another rate after that date.
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      {showForm && canManage && (
        <Card>
          <Text className="text-sm font-semibold text-text mb-3">Record New Market Rate</Text>
          <View className={isDesktop ? 'max-w-md gap-1' : ''}>
            <DateField
              label="Effective date"
              value={effectiveDate}
              onChange={setEffectiveDate}
              minimumDate={todayDateOnly()}
              helper="Today applies immediately. A future date schedules the rate."
            />
            <Input
              label={`Rate (per ${res?.unit ?? 'unit'})`}
              value={newRate}
              onChangeText={setNewRate}
              keyboardType="decimal-pad"
              placeholder={res?.rate ?? '0'}
            />
            <Input
              label="Notes (optional)"
              value={notes}
              onChangeText={setNotes}
              placeholder="Market source, supplier, etc."
              multiline
            />
            {formError ? <Text className="text-sm text-danger mb-2">{formError}</Text> : null}
            <View className="flex-row gap-2 mt-1">
              <Button label="Save" size="sm" onPress={handleSave} loading={addMut.isPending} />
              <Button label="Cancel" size="sm" variant="ghost" onPress={() => setShowForm(false)} />
            </View>
          </View>
        </Card>
      )}

      <Text className="text-sm font-bold text-text">History</Text>
      {history
        .slice()
        .reverse()
        .map((p: PriceHistoryPoint) => (
          <View key={p.id} className="flex-row justify-between items-center py-3 px-1 border-b border-border/50">
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-sm font-semibold text-text">{formatINR(parseFloat(p.rate))}</Text>
                {p.isScheduled ? <Badge color="warning" label="Scheduled" /> : null}
              </View>
              <Text className="text-xs text-text-muted">{formatDate(p.effectiveDate)}</Text>
            </View>
            {p.notes ? (
              <Text className="text-xs text-text-muted flex-1 ml-3 text-right" numberOfLines={2}>
                {p.notes}
              </Text>
            ) : null}
          </View>
        ))}
      {canManage && res && onDelete ? (
        <View className="pt-2 mt-2 border-t border-border">
          <Button
            label="Delete Material"
            variant="danger"
            size="sm"
            fullWidth
            onPress={() => onDelete(res.id, res.name)}
          />
        </View>
      ) : null}
    </ScrollView>
  );

  const editModal = (
    <MaterialFormModal
      visible={showEditMeta}
      title="Edit Material"
      form={editForm}
      error={editError}
      loading={updateMut.isPending || uploadMut.isPending}
      catalog={materialList?.data}
      isEdit
      existingImageUrl={res?.imageUrl}
      onChange={setEditForm}
      onClose={() => setShowEditMeta(false)}
      onSubmit={handleSaveMeta}
      hideRate
    />
  );

  if (embedded) {
    return (
      <>
        <Card className="overflow-hidden p-4 min-h-[420px] max-h-[calc(100vh-180px)]">
          {header}
          {body}
        </Card>
        {editModal}
      </>
    );
  }

  return (
    <>
      <SafeAreaView className="flex-1 bg-surface" edges={['bottom']}>
        {header}
        {body}
      </SafeAreaView>
      {editModal}
    </>
  );
}

function MaterialFormModal({
  visible,
  title,
  form,
  error,
  loading,
  onChange,
  onClose,
  onSubmit,
  hideRate = false,
  catalog,
  isEdit = false,
  existingImageUrl,
}: {
  visible: boolean;
  title: string;
  form: MaterialFormState;
  error: string | null;
  loading: boolean;
  onChange: (form: MaterialFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
  hideRate?: boolean;
  catalog?: CatalogMaterialRef[];
  isEdit?: boolean;
  existingImageUrl?: string | null;
}) {
  const [hsnTouched, setHsnTouched] = useState(false);
  const [gstTouched, setGstTouched] = useState(false);
  const [hsnHint, setHsnHint] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const previewMaterial: Pick<Resource, 'category' | 'imageUrl'> = {
    category: form.category,
    imageUrl: form.removeImage ? null : existingImageUrl ?? null,
  };

  async function pickPhoto(fromCamera: boolean) {
    setPhotoError(null);
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setPhotoError('Permission required to add a photo');
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.85,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.85,
        });
    if (result.canceled || !result.assets[0]) return;
    onChange({
      ...form,
      localImageUri: result.assets[0].uri,
      removeImage: false,
    });
  }

  useEffect(() => {
    if (!visible) return;
    if (isEdit) {
      setHsnTouched(true);
      setGstTouched(true);
      setHsnHint(null);
    } else {
      setHsnTouched(false);
      setGstTouched(false);
      setHsnHint(null);
    }
  }, [visible, isEdit]);

  function applyAutoSuggest(next: MaterialFormState) {
    const suggestion = suggestHsn({
      name: next.name,
      category: next.category,
      catalog,
    });
    if (!suggestion) return;

    const updated = { ...next, hsnSacCode: suggestion.hsn };
    if (!hideRate && !gstTouched && !updated.gstRate.trim()) {
      const gst = suggestGst(next.category);
      if (gst !== null) updated.gstRate = String(gst);
    }
    onChange(updated);
    setHsnHint(hsnSuggestHelperText(suggestion.source));
  }

  useEffect(() => {
    if (!visible || isEdit || hsnTouched) return;
    applyAutoSuggest(form);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- category change applies immediately
  }, [form.category, visible, isEdit, hsnTouched]);

  useEffect(() => {
    if (!visible || isEdit || hsnTouched) return;
    const timer = setTimeout(() => applyAutoSuggest(form), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounced name only
  }, [form.name, visible, isEdit, hsnTouched]);

  const set = <K extends keyof MaterialFormState>(key: K, value: MaterialFormState[K]) =>
    onChange({ ...form, [key]: value });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-center bg-black/40 px-4">
        <Card className="max-w-md w-full self-center max-h-[90%]">
          <ScrollView contentContainerClassName="gap-3 p-1">
            <Text className="text-lg font-bold text-text">{title}</Text>
            <View className="items-center gap-2">
              <MaterialThumbnail
                material={previewMaterial}
                localUri={form.localImageUri}
                size={88}
              />
              <View className="flex-row flex-wrap gap-2 justify-center">
                <Button label="Gallery" size="sm" variant="secondary" onPress={() => pickPhoto(false)} />
                <Button label="Camera" size="sm" variant="secondary" onPress={() => pickPhoto(true)} />
                {(form.localImageUri || existingImageUrl) && !form.removeImage ? (
                  <Button
                    label="Remove"
                    size="sm"
                    variant="secondary"
                    onPress={() =>
                      onChange({ ...form, localImageUri: null, removeImage: true })
                    }
                  />
                ) : null}
              </View>
              {photoError ? <Text className="text-xs text-danger text-center">{photoError}</Text> : null}
              <Text className="text-[10px] text-muted text-center">
                Optional. Requires S3 configured under Integrations.
              </Text>
            </View>
            <Input label="Name" value={form.name} onChangeText={(v) => set('name', v)} />
            <Input label="Unit" value={form.unit} onChangeText={(v) => set('unit', v)} placeholder="bag, kg, ton..." />
            <View>
              <Text className="text-sm font-medium text-text mb-2">Category</Text>
              <View className="flex-row flex-wrap gap-2">
                {MATERIAL_CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() => set('category', cat)}
                    className={`px-3 py-1.5 rounded-lg border ${
                      form.category === cat ? 'bg-primary border-primary' : 'bg-card border-border'
                    }`}
                  >
                    <Text className={`text-xs font-medium ${form.category === cat ? 'text-white' : 'text-muted'}`}>
                      {cat}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View>
              <Input
                label="HSN code (optional)"
                value={form.hsnSacCode}
                onChangeText={(v) => {
                  setHsnTouched(true);
                  setHsnHint(null);
                  set('hsnSacCode', v);
                }}
              />
              {hsnHint && !hsnTouched ? (
                <Text className="text-xs text-muted mt-1">{hsnHint}</Text>
              ) : null}
            </View>
            {!hideRate && (
              <>
                <Input
                  label={`Initial rate (per ${form.unit || 'unit'})`}
                  value={form.rate}
                  onChangeText={(v) => set('rate', v)}
                  keyboardType="decimal-pad"
                />
                <Input
                  label="GST % (optional)"
                  value={form.gstRate}
                  onChangeText={(v) => {
                    setGstTouched(true);
                    set('gstRate', v);
                  }}
                  keyboardType="decimal-pad"
                />
              </>
            )}
            {error ? <Text className="text-sm text-danger">{error}</Text> : null}
            <View className="flex-row gap-2 mt-1">
              <Button label="Cancel" variant="secondary" className="flex-1" onPress={onClose} />
              <Button label="Save" className="flex-1" onPress={onSubmit} loading={loading} />
            </View>
          </ScrollView>
        </Card>
      </View>
    </Modal>
  );
}
