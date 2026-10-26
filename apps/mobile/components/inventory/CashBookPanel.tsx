/**
 * Inventory cash book + daily sales summary (all verticals).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, View, Text, FlatList, Modal, Pressable, ScrollView } from 'react-native';
import { Button, Card, EmptyState, Input, LoadingSkeleton, Select, toast, useBusy } from '@/components/ui';
import { useViewport } from '@/hooks/useViewport';
import {
  useCashBookCategories,
  useCashBookDay,
  useCreateCashBookCategory,
  useCreateCashBookEntry,
  useDailySalesSummary,
  useDeleteCashBookCategory,
  useDeleteCashBookEntry,
  useUpdateCashBookCategory,
  type CashBookCategory,
  type CashBookEntry,
} from '@/services/ice-cream.queries';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function confirmDelete(message: string): Promise<boolean> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.confirm(message);
  }
  return new Promise((resolve) => {
    Alert.alert('Delete category', message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

export function CashBookPanel() {
  const { isPhone } = useViewport();
  const { busy, run } = useBusy();
  const [date, setDate] = useState(todayIso());
  const [entryOpen, setEntryOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [direction, setDirection] = useState('');
  const [entryType, setEntryType] = useState('');
  const [category, setCategory] = useState('');
  const [paymentMode, setPaymentMode] = useState('');

  const dayQ = useCashBookDay(date);
  const categoriesQ = useCashBookCategories();
  const summaryQ = useDailySalesSummary(date, summaryOpen);
  const createEntry = useCreateCashBookEntry();
  const deleteEntry = useDeleteCashBookEntry();

  const entries: CashBookEntry[] = dayQ.data?.entries ?? [];
  const categories = categoriesQ.data ?? [];
  const filtersActive = Boolean(query.trim() || direction || entryType || category || paymentMode);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (direction && e.direction !== direction) return false;
      if (entryType && e.entryType !== entryType) return false;
      if (category && e.category !== category) return false;
      if (paymentMode && e.paymentMode !== paymentMode) return false;
      if (!q) return true;
      const hay = [
        e.description,
        e.reference ?? '',
        e.entryType,
        e.categoryName ?? e.category ?? '',
        e.paymentMode,
        e.recordedByName ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [entries, query, direction, entryType, category, paymentMode]);

  const typeOptions = useMemo(() => {
    const types = Array.from(new Set(entries.map((e) => e.entryType))).sort();
    return [
      { title: 'All types', value: '' },
      ...types.map((t) => ({ title: t.replace(/_/g, ' '), value: t })),
    ];
  }, [entries]);

  const categoryOptions = useMemo(
    () => [
      { title: 'All categories', value: '' },
      ...categories.map((c: CashBookCategory) => ({ title: c.name, value: c.slug })),
    ],
    [categories],
  );

  const header = useMemo(
    () => (
      <View className="gap-3 mb-3">
        <View className={isPhone ? 'gap-2' : 'flex-row flex-wrap items-end gap-2'}>
          <View className={isPhone ? 'w-full' : 'w-44'}>
            <Input
              label="Date"
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              compact
              fullWidth
            />
          </View>
          <View className="flex-row flex-wrap gap-2">
            <Button label="Add entry" size="sm" variant="accent" onPress={() => setEntryOpen(true)} />
            <Button label="Categories" size="sm" variant="secondary" onPress={() => setCategoriesOpen(true)} />
            <Button label="Daily summary" size="sm" variant="secondary" onPress={() => setSummaryOpen(true)} />
          </View>
        </View>
        <View className="flex-row flex-wrap gap-2">
          <Stat label="Opening" value={dayQ.data?.opening} />
          <Stat label="In" value={dayQ.data?.inTotal} />
          <Stat label="Out" value={dayQ.data?.outTotal} />
          <Stat label="Closing" value={dayQ.data?.closing} />
        </View>
        <Input
          label="Search"
          value={query}
          onChangeText={setQuery}
          placeholder="Description, person, category…"
          compact
          fullWidth
        />
        <View className={isPhone ? 'gap-2' : 'flex-row flex-wrap items-end gap-2'}>
          <View className={isPhone ? 'w-full' : 'w-40'}>
            <Select
              label="Direction"
              value={direction}
              onChange={(v) => setDirection(v ?? '')}
              compact={!isPhone}
              options={[
                { title: 'All', value: '' },
                { title: 'Money in', value: 'IN' },
                { title: 'Money out', value: 'OUT' },
              ]}
            />
          </View>
          <View className={isPhone ? 'w-full' : 'w-44'}>
            <Select
              label="Type"
              value={entryType}
              onChange={(v) => setEntryType(v ?? '')}
              compact={!isPhone}
              options={typeOptions}
            />
          </View>
          <View className={isPhone ? 'w-full' : 'w-44'}>
            <Select
              label="Category"
              value={category}
              onChange={(v) => setCategory(v ?? '')}
              compact={!isPhone}
              options={categoryOptions}
            />
          </View>
          <View className={isPhone ? 'w-full' : 'w-36'}>
            <Select
              label="Mode"
              value={paymentMode}
              onChange={(v) => setPaymentMode(v ?? '')}
              compact={!isPhone}
              options={[
                { title: 'All modes', value: '' },
                { title: 'Cash', value: 'CASH' },
                { title: 'UPI', value: 'UPI' },
                { title: 'Bank', value: 'BANK' },
                { title: 'Other', value: 'OTHER' },
              ]}
            />
          </View>
        </View>
        {filtersActive ? (
          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-muted">
              Showing {filtered.length} of {entries.length} entries
            </Text>
            <Button
              label="Clear filters"
              size="sm"
              variant="ghost"
              onPress={() => {
                setQuery('');
                setDirection('');
                setEntryType('');
                setCategory('');
                setPaymentMode('');
              }}
            />
          </View>
        ) : null}
      </View>
    ),
    [
      date,
      dayQ.data,
      isPhone,
      query,
      direction,
      entryType,
      category,
      paymentMode,
      typeOptions,
      categoryOptions,
      filtersActive,
      filtered.length,
      entries.length,
    ],
  );

  return (
    <View className="flex-1 px-4">
      {dayQ.isLoading ? (
        <View className="gap-2 mt-2">
          {[1, 2, 3].map((i) => (
            <LoadingSkeleton key={i} className="h-14 rounded-xl" />
          ))}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(e) => e.id}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <EmptyState
              title={filtersActive ? 'No matching entries' : 'No cash entries'}
              description={
                filtersActive
                  ? 'Try a different search or clear filters.'
                  : 'Add opening, expense, or deposit for this day.'
              }
            />
          }
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item }) => (
            <Card className="mb-2 p-3">
              <View className="flex-row justify-between gap-2">
                <View className="flex-1 min-w-0">
                  <Text className="text-sm font-semibold text-text" numberOfLines={2}>
                    {item.description}
                  </Text>
                  <Text className="text-[11px] text-muted mt-0.5">
                    {item.entryType.replace(/_/g, ' ')}
                    {item.categoryName || item.category
                      ? ` · ${item.categoryName ?? String(item.category).replace(/_/g, ' ')}`
                      : ''}
                    {' · '}
                    {item.paymentMode} · {item.direction}
                  </Text>
                  <Text className="text-[11px] text-muted mt-0.5">
                    By {item.recordedByName ?? 'Team member'}
                  </Text>
                </View>
                <View className="items-end">
                  <Text
                    className={`text-sm font-bold ${item.direction === 'IN' ? 'text-success' : 'text-danger'}`}
                  >
                    {item.direction === 'IN' ? '+' : '-'}₹{item.amount.toFixed(2)}
                  </Text>
                  {item.entryType !== 'SALE_COLLECTION' && item.entryType !== 'VENDOR_PAYMENT' ? (
                    <Button
                      label="Delete"
                      size="sm"
                      variant="secondary"
                      className="mt-1"
                      onPress={() =>
                        void run(async () => {
                          try {
                            await deleteEntry.mutateAsync(item.id);
                            toast.success('Entry deleted');
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : 'Could not delete');
                          }
                        })
                      }
                    />
                  ) : null}
                </View>
              </View>
            </Card>
          )}
        />
      )}

      <CashEntryModal
        open={entryOpen}
        date={date}
        busy={busy}
        categories={categories}
        onClose={() => setEntryOpen(false)}
        onSave={async (body) => {
          await run(async () => {
            await createEntry.mutateAsync(body);
            toast.success('Entry saved');
            setEntryOpen(false);
          });
        }}
      />

      <CategoriesModal open={categoriesOpen} onClose={() => setCategoriesOpen(false)} />

      <Modal visible={summaryOpen} transparent animationType={isPhone ? 'slide' : 'fade'} onRequestClose={() => setSummaryOpen(false)}>
        <Pressable
          className={`flex-1 bg-black/40 ${isPhone ? 'justify-end' : 'items-center justify-center p-4'}`}
          onPress={() => setSummaryOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className={`bg-card w-full ${isPhone ? 'rounded-t-2xl max-h-[92%] p-4' : 'rounded-2xl max-w-lg max-h-[85%] p-4'}`}
          >
            <Text className="text-lg font-bold text-text mb-2">Daily sale summary · {date}</Text>
            {summaryQ.isLoading ? (
              <LoadingSkeleton className="h-40 rounded-xl" />
            ) : summaryQ.data ? (
              <ScrollView>
                <Text className="text-sm font-semibold text-text mb-1">Sales</Text>
                <Text className="text-xs text-muted mb-2">
                  {summaryQ.data.sales.invoiceCount} invoices · Gross ₹{summaryQ.data.sales.gross.toFixed(2)} ·
                  Discount ₹{summaryQ.data.sales.discount.toFixed(2)} · GST ₹{summaryQ.data.sales.gst.toFixed(2)} ·
                  Net ₹{summaryQ.data.sales.net.toFixed(2)}
                </Text>
                <Text className="text-xs text-muted mb-3">
                  Collected ₹{summaryQ.data.sales.collected.toFixed(2)} · Outstanding ₹
                  {summaryQ.data.sales.outstanding.toFixed(2)}
                </Text>
                <Text className="text-sm font-semibold text-text mb-1">Cash</Text>
                <Text className="text-xs text-muted mb-1">
                  Opening ₹{summaryQ.data.cash.opening.toFixed(2)} · Closing ₹{summaryQ.data.cash.closing.toFixed(2)}
                </Text>
                <Text className="text-xs text-muted mb-1">
                  Collections — Cash ₹{summaryQ.data.cash.collectionsByMode.CASH.toFixed(2)} · UPI ₹
                  {summaryQ.data.cash.collectionsByMode.UPI.toFixed(2)} · Bank ₹
                  {summaryQ.data.cash.collectionsByMode.BANK.toFixed(2)}
                </Text>
                <Text className="text-xs text-muted mb-4">
                  Expenses ₹{summaryQ.data.cash.expenses.toFixed(2)} · Deposits ₹
                  {summaryQ.data.cash.deposits.toFixed(2)}
                </Text>
                <Button label="Close" variant="secondary" onPress={() => setSummaryOpen(false)} />
              </ScrollView>
            ) : (
              <Text className="text-sm text-muted">Could not load summary.</Text>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <View className="bg-card border border-border rounded-xl px-3 py-2 min-w-[72px]">
      <Text className="text-[10px] uppercase text-muted font-bold">{label}</Text>
      <Text className="text-sm font-semibold text-text">₹{(value ?? 0).toFixed(2)}</Text>
    </View>
  );
}

function CategoriesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isPhone } = useViewport();
  const { busy, run } = useBusy();
  const categoriesQ = useCashBookCategories();
  const createCat = useCreateCashBookCategory();
  const updateCat = useUpdateCashBookCategory();
  const deleteCat = useDeleteCashBookCategory();
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const rows = categoriesQ.data ?? [];

  return (
    <Modal visible={open} transparent animationType={isPhone ? 'slide' : 'fade'} onRequestClose={onClose}>
      <Pressable
        className={`flex-1 bg-black/40 ${isPhone ? 'justify-end' : 'items-center justify-center p-4'}`}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className={`bg-card w-full ${isPhone ? 'rounded-t-2xl max-h-[92%] p-4' : 'rounded-2xl max-w-lg max-h-[85%] p-4'}`}
        >
          <Text className="text-lg font-bold text-text mb-1">Expense categories</Text>
          <Text className="text-xs text-muted mb-3">
            Add shop-specific labels. Hidden categories stay on older entries.
          </Text>
          <View className="flex-row items-end gap-2 mb-3">
            <View className="flex-1 min-w-0">
              <Input
                label="New category"
                value={name}
                onChangeText={setName}
                placeholder="e.g. Shop rent"
                compact
                fullWidth
              />
            </View>
            <Button
              label="Add"
              size="sm"
              variant="accent"
              loading={busy}
              onPress={() =>
                void run(async () => {
                  if (!name.trim()) {
                    toast.error('Enter a category name');
                    return;
                  }
                  try {
                    await createCat.mutateAsync({ name: name.trim() });
                    setName('');
                    toast.success('Category added');
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Could not add');
                  }
                })
              }
            />
          </View>
          <ScrollView className={isPhone ? 'max-h-[60%]' : 'max-h-96'}>
            {categoriesQ.isLoading ? (
              <LoadingSkeleton className="h-20 rounded-xl" />
            ) : rows.length === 0 ? (
              <Text className="text-sm text-muted">No categories yet.</Text>
            ) : (
              rows.map((c: CashBookCategory) => (
                <View key={c.id} className="border border-border rounded-xl p-3 mb-2">
                  {editingId === c.id ? (
                    <>
                      <Input label="Name" value={editName} onChangeText={setEditName} />
                      <View className="flex-row gap-2 mt-2">
                        <Button
                          label="Save"
                          size="sm"
                          variant="accent"
                          className="flex-1"
                          onPress={() =>
                            void run(async () => {
                              if (!editName.trim()) return;
                              try {
                                await updateCat.mutateAsync({ id: c.id, name: editName.trim() });
                                setEditingId(null);
                                toast.success('Category updated');
                              } catch (e) {
                                toast.error(e instanceof Error ? e.message : 'Could not update');
                              }
                            })
                          }
                        />
                        <Button
                          label="Cancel"
                          size="sm"
                          variant="secondary"
                          className="flex-1"
                          onPress={() => setEditingId(null)}
                        />
                      </View>
                    </>
                  ) : (
                    <View className="flex-row items-center justify-between gap-2">
                      <View className="flex-1 min-w-0">
                        <Text className="text-sm font-semibold text-text">{c.name}</Text>
                        <Text className="text-[11px] text-muted">{c.isPreset ? 'Preset' : 'Custom'}</Text>
                      </View>
                      <View className="flex-row gap-1">
                        <Button
                          label="Edit"
                          size="sm"
                          variant="ghost"
                          onPress={() => {
                            setEditingId(c.id);
                            setEditName(c.name);
                          }}
                        />
                        <Button
                          label="Delete"
                          size="sm"
                          variant="ghost"
                          onPress={() =>
                            void run(async () => {
                              const ok = await confirmDelete(
                                `Remove “${c.name}”? Entries that already use it will keep the old label.`,
                              );
                              if (!ok) return;
                              try {
                                const result = await deleteCat.mutateAsync(c.id);
                                toast.success(
                                  result.archived
                                    ? 'Category hidden (still used on older entries)'
                                    : 'Category deleted',
                                );
                              } catch (e) {
                                toast.error(e instanceof Error ? e.message : 'Could not delete');
                              }
                            })
                          }
                        />
                      </View>
                    </View>
                  )}
                </View>
              ))
            )}
          </ScrollView>
          <Button label="Done" variant="secondary" className="mt-3" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function CashEntryModal({
  open,
  date,
  busy,
  categories,
  onClose,
  onSave,
}: {
  open: boolean;
  date: string;
  busy: boolean;
  categories: CashBookCategory[];
  onClose: () => void;
  onSave: (body: {
    entryDate: string;
    direction: 'IN' | 'OUT';
    entryType: 'OPENING' | 'EXPENSE' | 'DEPOSIT' | 'ADJUSTMENT';
    paymentMode: 'CASH' | 'UPI' | 'BANK' | 'OTHER';
    amount: number;
    description: string;
    reference?: string;
    category?: string;
  }) => Promise<void>;
}) {
  const { isPhone } = useViewport();
  const [entryType, setEntryType] = useState<'OPENING' | 'EXPENSE' | 'DEPOSIT' | 'ADJUSTMENT'>('EXPENSE');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'BANK' | 'OTHER'>('CASH');
  const [category, setCategory] = useState<string>('MISC');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');

  const categoryOptions = categories.map((c) => ({ title: c.name, value: c.slug }));

  useEffect(() => {
    if (!categories.length) return;
    if (!categories.some((c) => c.slug === category)) {
      setCategory(categories.find((c) => c.slug === 'MISC')?.slug ?? categories[0].slug);
    }
  }, [categories, category]);

  const direction: 'IN' | 'OUT' =
    entryType === 'EXPENSE' || entryType === 'DEPOSIT' ? 'OUT' : entryType === 'OPENING' ? 'IN' : 'IN';

  const submit = async () => {
    setError('');
    if (!Number(amount) || !description.trim()) {
      setError('Amount and description are required.');
      return;
    }
    try {
      await onSave({
        entryDate: date,
        direction: entryType === 'ADJUSTMENT' ? 'OUT' : direction,
        entryType,
        paymentMode,
        amount: Number(amount),
        description: description.trim(),
        reference: reference.trim() || undefined,
        category: entryType === 'EXPENSE' ? category : undefined,
      });
      setAmount('');
      setDescription('');
      setReference('');
      setCategory(categories.find((c) => c.slug === 'MISC')?.slug ?? category);
      setEntryType('EXPENSE');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  };

  return (
    <Modal visible={open} transparent animationType={isPhone ? 'slide' : 'fade'} onRequestClose={onClose}>
      <Pressable
        className={`flex-1 bg-black/40 ${isPhone ? 'justify-end' : 'items-center justify-center p-4'}`}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className={`bg-card w-full ${isPhone ? 'rounded-t-2xl max-h-[92%] p-4' : 'rounded-2xl max-w-lg p-4'}`}
        >
          <Text className="text-lg font-bold text-text mb-2">Cash book entry</Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Select
              label="Type"
              value={entryType}
              onChange={(v) => v && setEntryType(v as typeof entryType)}
              options={[
                { title: 'Expense', value: 'EXPENSE' },
                { title: 'Deposit (bank)', value: 'DEPOSIT' },
                { title: 'Opening', value: 'OPENING' },
                { title: 'Adjustment', value: 'ADJUSTMENT' },
              ]}
            />
            <Select
              label="Payment mode"
              value={paymentMode}
              onChange={(v) => v && setPaymentMode(v as typeof paymentMode)}
              options={[
                { title: 'Cash', value: 'CASH' },
                { title: 'UPI', value: 'UPI' },
                { title: 'Bank', value: 'BANK' },
                { title: 'Other', value: 'OTHER' },
              ]}
            />
            {entryType === 'EXPENSE' ? (
              <Select
                label="Expense category"
                value={category}
                onChange={(v) => v && setCategory(v)}
                options={
                  categoryOptions.length
                    ? categoryOptions
                    : [{ title: 'Other', value: 'OTHER' }]
                }
              />
            ) : null}
            <Input label="Amount ₹" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
            <Input label="Description" value={description} onChangeText={setDescription} />
            <Input label="Reference (optional)" value={reference} onChangeText={setReference} />
            {error ? <Text className="text-danger text-sm mt-2">{error}</Text> : null}
            <View className="flex-row gap-2 mt-4 mb-4">
              <Button label="Cancel" variant="secondary" className="flex-1" onPress={onClose} disabled={busy} />
              <Button label="Save" variant="accent" className="flex-1" loading={busy} onPress={submit} />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
