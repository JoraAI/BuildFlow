import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Input, Badge } from '@/components/ui';
import {
  useCatalogLibrary,
  useImportCatalogItems,
  type CatalogLibraryItem,
  type CatalogMasterSelection,
} from '@/services/settings.queries';
import { useViewport } from '@/hooks/useViewport';

type Draft = CatalogMasterSelection & { item: CatalogLibraryItem };

export function KiranaSkuPicker({
  open,
  onClose,
  onImported,
  initialTemplateKey,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  /** Opens straight onto one product when the caller tapped a specific row. */
  initialTemplateKey?: string;
}) {
  const { isPhone } = useViewport();
  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customSku, setCustomSku] = useState('');
  const [customUnit, setCustomUnit] = useState('pack');
  const [customCategory, setCustomCategory] = useState('');
  const [customGst, setCustomGst] = useState('0');
  const [customHsn, setCustomHsn] = useState('');
  const [customMrp, setCustomMrp] = useState('');
  const [customRate, setCustomRate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const library = useCatalogLibrary(search, '', open);
  const importItems = useImportCatalogItems();
  const selected = useMemo(() => Object.values(drafts), [drafts]);

  useEffect(() => {
    if (open) {
      setSearch(initialTemplateKey ?? '');
    } else {
      setSearch('');
      setDrafts({});
      setCustomOpen(false);
      setError(null);
    }
  }, [open, initialTemplateKey]);

  // Preselect the product the caller tapped once its library row arrives.
  useEffect(() => {
    if (!open || !initialTemplateKey) return;
    const match = library.data?.items.find(
      (i: CatalogLibraryItem) => i.templateKey === initialTemplateKey,
    );
    if (!match) return;
    setDrafts((prev) =>
      prev[match.templateKey]
        ? prev
        : {
            ...prev,
            [match.templateKey]: {
              item: match,
              templateKey: match.templateKey,
              mrp: match.suggestedMrp,
              rate: match.suggestedMrp,
            },
          },
    );
  }, [open, initialTemplateKey, library.data]);

  const toggle = (item: CatalogLibraryItem) => {
    setDrafts((prev) => {
      const next = { ...prev };
      if (next[item.templateKey]) delete next[item.templateKey];
      else {
        next[item.templateKey] = {
          item,
          templateKey: item.templateKey,
          mrp: item.suggestedMrp,
          rate: item.suggestedMrp,
        };
      }
      return next;
    });
  };

  const patch = (key: string, values: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key]!, ...values } }));

  const submit = async () => {
    setError(null);
    if (!selected.length) return setError('Select at least one SKU.');
    for (const row of selected) {
      if (row.mrp < 0 || row.rate < 0) return setError(`Enter valid prices for ${row.item.name}.`);
      if (row.mrp > 0 && row.rate > row.mrp) {
        return setError(`${row.item.name}: selling price cannot exceed MRP.`);
      }
    }
    try {
      await importItems.mutateAsync(
        selected.map(({ item: _item, ...row }) => row),
      );
      onImported();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add selected items.');
    }
  };

  const submitCustom = async () => {
    setError(null);
    const mrp = Number(customMrp);
    const rate = Number(customRate);
    const gstRate = Number(customGst);
    if (!customName.trim() || !customSku.trim() || !customUnit.trim()) {
      return setError('Name, SKU and unit are required.');
    }
    if (!Number.isFinite(mrp) || mrp < 0 || !Number.isFinite(rate) || rate < 0) {
      return setError('Enter valid MRP and selling price.');
    }
    if (mrp > 0 && rate > mrp) return setError('Selling price cannot exceed MRP.');
    if (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100) return setError('Enter a valid GST rate.');
    try {
      await importItems.mutateAsync([{
        custom: {
          name: customName.trim(),
          sku: customSku.trim().toUpperCase(),
          unit: customUnit.trim(),
          category: customCategory.trim() || undefined,
          gstRate,
          hsn: customHsn.trim() || undefined,
        },
        mrp,
        rate,
      }]);
      onImported();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create custom item.');
    }
  };

  return (
    <Modal visible={open} transparent animationType={isPhone ? 'slide' : 'fade'} onRequestClose={onClose}>
      <Pressable
        className={`flex-1 bg-black/40 ${isPhone ? 'justify-end' : 'items-center justify-center p-4'}`}
        onPress={onClose}
      >
        <Pressable
          className={`bg-card w-full ${isPhone ? 'rounded-t-2xl max-h-[94%]' : 'rounded-2xl max-w-5xl max-h-[90%]'}`}
          onPress={(e) => e.stopPropagation()}
        >
          <View className="p-4 border-b border-border">
            <Text className="text-lg font-bold text-text">Add item</Text>
            <Text className="text-xs text-muted mt-1">
              Pick a suggested product or create your own item. Stock is received separately.
            </Text>
            {customOpen ? (
              <Button label="← Back to products" variant="ghost" size="sm" onPress={() => setCustomOpen(false)} />
            ) : (
              <>
                <Input
                  label="Search product, pack or category"
                  value={search}
                  onChangeText={setSearch}
                  placeholder="e.g. toothpaste, biscuit, KIR-058"
                  accessibilityLabel="Search Kirana products"
                />
                <Button label="Create your own item" variant="secondary" size="sm" onPress={() => setCustomOpen(true)} />
              </>
            )}
          </View>
          <ScrollView className="px-4" keyboardShouldPersistTaps="handled">
            {customOpen ? (
              <View className="py-4">
                <Text className="text-sm font-bold text-text mb-2">New custom item</Text>
                <Text className="text-xs text-muted mb-3">
                  This item is added only to your shop’s item master, not to BuildFlow’s shared library.
                </Text>
                <Input label="Item name" value={customName} onChangeText={setCustomName} placeholder="e.g. Local Mango Pickle 500 g" />
                <Input label="Your SKU code" value={customSku} onChangeText={setCustomSku} autoCapitalize="characters" placeholder="e.g. PICKLE-MANGO-500" />
                <View className={`${isPhone ? '' : 'flex-row'} gap-2`}>
                  <View className="flex-1"><Input label="Unit" value={customUnit} onChangeText={setCustomUnit} placeholder="pack" /></View>
                  <View className="flex-1"><Input label="Category (optional)" value={customCategory} onChangeText={setCustomCategory} /></View>
                  <View className="flex-1"><Input label="GST %" value={customGst} onChangeText={setCustomGst} keyboardType="decimal-pad" /></View>
                </View>
                <View className={`${isPhone ? '' : 'flex-row'} gap-2`}>
                  <View className="flex-1"><Input label="HSN (optional)" value={customHsn} onChangeText={setCustomHsn} /></View>
                  <View className="flex-1"><Input label="MRP (₹)" value={customMrp} onChangeText={setCustomMrp} keyboardType="decimal-pad" /></View>
                  <View className="flex-1"><Input label="Selling price (₹)" value={customRate} onChangeText={setCustomRate} keyboardType="decimal-pad" /></View>
                </View>
              </View>
            ) : (
              <>
            {library.isLoading ? <Text className="text-muted py-5">Loading SKU library…</Text> : null}
            {library.data?.items.map((item: CatalogLibraryItem) => {
              const draft = drafts[item.templateKey];
              return (
                <View key={item.templateKey} className="py-3 border-b border-border">
                  <View className="flex-row items-start gap-2">
                    <Pressable className="flex-1" onPress={() => toggle(item)}>
                      <Text className="text-sm font-semibold text-text">{item.name}</Text>
                      <Text className="text-xs text-muted">
                        {item.templateKey} · {item.category} · {item.packSize}
                      </Text>
                      <Text className="text-xs text-muted">
                        Suggested MRP ₹{item.suggestedMrp} · as of {item.mrpAsOf}
                      </Text>
                    </Pressable>
                    {item.imported ? <Badge label="Already in your list" color="neutral" /> : null}
                    <Button
                      label={draft ? 'Selected' : 'Select'}
                      size="sm"
                      variant={draft ? 'accent' : 'secondary'}
                      onPress={() => toggle(item)}
                    />
                  </View>
                  {draft ? (
                    <View className={`${isPhone ? '' : 'flex-row'} gap-2 mt-3`}>
                      <View className="flex-1"><Input label="MRP (₹)" value={String(draft.mrp)} keyboardType="decimal-pad" onChangeText={(v) => patch(item.templateKey, { mrp: Number(v) })} /></View>
                      <View className="flex-1"><Input label="Selling price (₹)" value={String(draft.rate)} keyboardType="decimal-pad" onChangeText={(v) => patch(item.templateKey, { rate: Number(v) })} /></View>
                    </View>
                  ) : null}
                </View>
              );
            })}
            {!library.isLoading && !library.data?.items.length ? (
              <View className="py-6 items-center">
                <Text className="text-sm text-muted mb-3">No matching product. Create your own item instead.</Text>
                <Button label="Create your own item" variant="secondary" onPress={() => setCustomOpen(true)} />
              </View>
            ) : null}
              </>
            )}
          </ScrollView>
          {error ? <Text className="text-sm text-danger px-4 pt-2">{error}</Text> : null}
          <View className="p-4 border-t border-border flex-row gap-2">
            <Button label="Cancel" variant="secondary" className="flex-1" onPress={onClose} />
            <Button
              label={customOpen ? 'Create item' : `Add ${selected.length || ''} selected`}
              variant="accent"
              className="flex-1"
              loading={importItems.isPending}
              disabled={!customOpen && !selected.length}
              onPress={() => void (customOpen ? submitCustom() : submit())}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
