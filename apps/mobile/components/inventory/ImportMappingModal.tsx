/**
 * BuildFlow - "Import CSV / Excel" mapping modal (INVENTORY_HORIZONTAL_PLATFORM Phase 7.2).
 *
 * Uploads a catalog or opening-stock CSV/XLSX, previews the AI/heuristic column
 * mapping, lets the user fix the mapping, then confirms the import. CATALOG mode
 * creates resources and skips name / SKU / barcode / item-code duplicates.
 * OPENING mode reuses the Phase 1 opening-stock import.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView } from 'react-native';
import * as Sharing from 'expo-sharing';
import { Button, Select, Badge, toast } from '@/components/ui';
import { useViewport } from '@/hooks/useViewport';
import { saveDownloadBlob } from '@/lib/api-client';
import { useImportPreview, useImportConfirm, type ImportMappingPreview } from '@/services/inventory-ai.queries';

const FIELDS: Array<{ key: keyof ImportMappingPreview['mapping']; label: string; hint: string; required?: boolean }> = [
  { key: 'name', label: 'Item name', hint: 'Required - matched or created', required: true },
  { key: 'qty', label: 'Qty / opening qty', hint: 'Opening stock only' },
  { key: 'unit', label: 'Unit', hint: 'e.g. bag, kg' },
  { key: 'rate', label: 'Rate / price', hint: 'Catalog rate (₹)' },
  { key: 'gstRate', label: 'GST %', hint: 'e.g. 18' },
  { key: 'hsn', label: 'HSN code', hint: 'e.g. 2523' },
  { key: 'sku', label: 'SKU', hint: 'Optional identifier' },
  { key: 'itemCode', label: 'Item code', hint: 'Optional' },
  { key: 'barcode', label: 'Barcode', hint: 'Optional' },
  { key: 'reorderPoint', label: 'Reorder point', hint: 'Low-stock threshold' },
];

/** Headers match the server synonym map so mapping is automatic. */
const ITEMS_TEMPLATE_CSV = [
  'Item name,SKU,Item code,Barcode,Unit,Rate,GST %,HSN,Reorder point,Opening qty',
  'Vanilla cup,VAN-CUP,,890123456001,nos,25,5,21050010,20,',
  'Chocolate scoop,CHC-SCP,,890123456002,nos,30,5,21050010,15,',
].join('\n');

function readFileAsBase64(asset: { uri: string; name?: string; mimeType?: string }) {
  return new Promise<{ fileContent: string; filename: string; contentType: string }>(async (resolve, reject) => {
    try {
      const res = await fetch(asset.uri);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const str = reader.result as string;
        const comma = str.indexOf(',');
        resolve({
          fileContent: comma >= 0 ? str.slice(comma + 1) : str,
          filename: asset.name || 'import.csv',
          contentType: asset.mimeType || 'text/csv',
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    } catch (e) {
      reject(e);
    }
  });
}

export function ImportMappingModal({
  open,
  onClose,
  defaultPurpose = 'CATALOG',
}: {
  open: boolean;
  onClose: () => void;
  defaultPurpose?: 'CATALOG' | 'OPENING';
}) {
  const { isPhone } = useViewport();
  const importPreview = useImportPreview();
  const importConfirm = useImportConfirm();
  const [purpose, setPurpose] = useState<'CATALOG' | 'OPENING'>(defaultPurpose);
  const [working, setWorking] = useState(false);
  const [preview, setPreview] = useState<ImportMappingPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPurpose(defaultPurpose);
      setPreview(null);
      setMapping({});
      setError(null);
    }
  }, [open, defaultPurpose]);

  const downloadTemplate = async () => {
    setError(null);
    try {
      const blob = new Blob([`${ITEMS_TEMPLATE_CSV}\n`], { type: 'text/csv;charset=utf-8' });
      const uri = await saveDownloadBlob(blob, 'buildflow-items-template.csv');
      if (uri && (await Sharing.isAvailableAsync())) {
        try {
          await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Items CSV template' });
        } catch (shareErr) {
          const msg = shareErr instanceof Error ? shareErr.message : '';
          if (!/cancel|dismiss/i.test(msg)) throw shareErr;
        }
      }
      toast.success('Template ready — fill it and upload.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not download the template.');
    }
  };

  const pickAndPreview = async () => {
    setError(null);
    setWorking(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { getDocumentAsync } = require('expo-document-picker');
      const result = await getDocumentAsync({
        multiple: false,
        type: ['text/*', 'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      });
      if (result.canceled || !result.assets?.length) return;
      const file = await readFileAsBase64(result.assets[0]);
      const res = await importPreview.mutateAsync({ ...file, purpose });
      setPreview(res);
      setMapping(res.mapping);
      if (res.headers.length === 0) setError(res.notes);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the uploaded file.');
    } finally {
      setWorking(false);
    }
  };

  const confirm = async () => {
    if (!preview) return;
    if (!mapping.name) {
      setError('Map the item-name column before confirming.');
      return;
    }
    const rows = preview.rows?.length ? preview.rows : preview.sampleRows;
    if (!rows.length) {
      setError('No data rows found in the file.');
      return;
    }
    setWorking(true);
    try {
      const res = await importConfirm.mutateAsync({
        mode: purpose,
        mapping,
        rows,
      });
      toast.success(
        purpose === 'CATALOG'
          ? `Added ${res.created ?? 0} new item(s). Skipped ${res.skipped ?? 0} duplicate or empty row(s).`
          : `Opening stock applied for ${res.applied ?? 0} item(s).`,
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType={isPhone ? 'slide' : 'fade'}
      onRequestClose={working ? undefined : onClose}
    >
      <Pressable
        className={`flex-1 bg-black/40 ${isPhone ? 'justify-end' : 'items-center justify-center p-4'}`}
        onPress={working ? undefined : onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className={`bg-card w-full ${
            isPhone ? 'rounded-t-2xl max-h-[92%] p-4' : 'rounded-2xl max-w-xl max-h-[85%] p-4'
          }`}
        >
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-lg font-bold text-text">Import items</Text>
            <Pressable onPress={working ? undefined : onClose} className="p-1">
              <Text className="text-muted text-xl">×</Text>
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text className="text-sm text-muted mb-3">
              Download the template, fill your items, then upload the CSV or Excel file. New items
              are added to your list. Rows that match an existing name, SKU, barcode, or item code
              are skipped.
            </Text>

            {!preview ? (
              <>
                <Select
                  label="Import type"
                  value={purpose}
                  onChange={(v) => v && setPurpose(v as 'CATALOG' | 'OPENING')}
                  options={[
                    { title: 'Add items to catalog', value: 'CATALOG' },
                    { title: 'Opening stock only', value: 'OPENING' },
                  ]}
                />
                <View className="flex-row flex-wrap gap-2 mt-3">
                  <View className="flex-1 min-w-[140px]">
                    <Button
                      label="Download template"
                      variant="secondary"
                      onPress={() => void downloadTemplate()}
                      disabled={working}
                      fullWidth
                    />
                  </View>
                  <View className="flex-1 min-w-[140px]">
                    <Button
                      label={working ? 'Reading file…' : 'Upload file'}
                      variant="accent"
                      onPress={() => void pickAndPreview()}
                      loading={working}
                      fullWidth
                    />
                  </View>
                </View>
              </>
            ) : null}

            {error ? <Text className="text-sm text-danger mt-3">{error}</Text> : null}

            {preview && preview.headers.length > 0 ? (
              <View className="mt-3 gap-3">
                {preview.notes ? <Text className="text-xs text-muted">{preview.notes}</Text> : null}
                <View className="flex-row flex-wrap gap-1.5">
                  <Badge color="neutral" label={`${preview.headers.length} columns`} />
                  <Badge color="neutral" label={`${preview.rowCount} data rows`} />
                  <Badge
                    color={preview.mapping.name ? 'success' : 'warning'}
                    label={purpose === 'CATALOG' ? 'Add to catalog' : 'Opening stock'}
                  />
                </View>

                <View className="rounded-xl border border-border bg-surface p-3 gap-2">
                  <Text className="text-xs font-semibold text-muted uppercase">Column mapping</Text>
                  {FIELDS.map((f) => (
                    <Select
                      key={f.key}
                      label={`${f.label}${f.required ? ' *' : ''}`}
                      value={mapping[f.key]}
                      onChange={(v) => setMapping((m) => ({ ...m, [f.key]: v ?? '' }))}
                      options={preview.headers.map((h) => ({ title: h, value: h }))}
                      placeholder={f.hint}
                    />
                  ))}
                </View>

                <View className="rounded-xl border border-border bg-surface p-3">
                  <Text className="text-xs font-semibold text-muted mb-1.5 uppercase">Preview (first rows)</Text>
                  {preview.sampleRows.map((row, i) => (
                    <View key={i} className="py-1 border-b border-border/60 last:border-b-0">
                      <Text className="text-sm text-text" numberOfLines={1}>
                        {row[mapping.name || preview.headers[0] || ''] || '-'}
                      </Text>
                      <Text className="text-xs text-muted" numberOfLines={1}>
                        {Object.entries(row)
                          .filter(([k, v]) => k !== (mapping.name || preview.headers[0]) && v)
                          .slice(0, 4)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' · ')}
                      </Text>
                    </View>
                  ))}
                </View>

                <View className="flex-row flex-wrap gap-2 mt-1">
                  <View className="flex-1 min-w-[120px]">
                    <Button
                      label="Choose another"
                      variant="secondary"
                      disabled={working}
                      fullWidth
                      onPress={() => {
                        setPreview(null);
                        setError(null);
                      }}
                    />
                  </View>
                  <View className="flex-1 min-w-[120px]">
                    <Button
                      label={working ? 'Importing…' : 'Confirm import'}
                      variant="accent"
                      loading={working}
                      fullWidth
                      onPress={() => void confirm()}
                    />
                  </View>
                </View>
              </View>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
