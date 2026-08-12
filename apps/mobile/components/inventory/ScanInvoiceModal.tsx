/**
 * BuildFlow - "Scan / upload invoice" modal (INVENTORY_HORIZONTAL_PLATFORM Phase 7.1).
 *
 * Uploads a purchase invoice (PDF/Excel/text — images without OCR get a clear
 * note) and runs it through the shared content-LLM document pipeline to build a
 * DRAFT vendor bill (vendor, number, date, lines with GST/HSN), matched against
 * the company's PO/GRN + catalog. Review, then "Create draft bill".
 */
import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView } from 'react-native';
import { Button, Badge, toast } from '@/components/ui';
import { useViewport } from '@/hooks/useViewport';
import { useExtractInvoiceBill, useCreateBillFromDraft, type InventoryBillDraft } from '@/services/inventory-ai.queries';
import { formatINR } from '@/utils/format';

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
          filename: asset.name || 'invoice.pdf',
          contentType: asset.mimeType || 'application/pdf',
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    } catch (e) {
      reject(e);
    }
  });
}

export function ScanInvoiceModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { isPhone } = useViewport();
  const extractBill = useExtractInvoiceBill();
  const createBill = useCreateBillFromDraft();
  const [working, setWorking] = useState(false);
  const [draft, setDraft] = useState<InventoryBillDraft | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(null);
      setNotes(null);
      setError(null);
    }
  }, [open]);

  const pickAndExtract = async () => {
    setError(null);
    setWorking(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { getDocumentAsync } = require('expo-document-picker');
      const result = await getDocumentAsync({ multiple: false, type: ['application/pdf', 'image/*'] });
      if (result.canceled || !result.assets?.length) return;
      const file = await readFileAsBase64(result.assets[0]);
      const res = await extractBill.mutateAsync(file);
      setNotes(res.notes);
      setDraft(res.draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the uploaded file.');
    } finally {
      setWorking(false);
    }
  };

  const createDraftBill = async () => {
    if (!draft) return;
    setWorking(true);
    try {
      await createBill.mutateAsync({ draft });
      toast.success(`Draft bill created for ${draft.vendorName}`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the bill.');
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
            isPhone ? 'rounded-t-2xl max-h-[92%] p-4' : 'rounded-2xl max-w-lg max-h-[85%] p-4'
          }`}
        >
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-lg font-bold text-text">Scan / upload invoice</Text>
            <Pressable onPress={working ? undefined : onClose} className="p-1">
              <Text className="text-muted text-xl">×</Text>
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text className="text-sm text-muted mb-3">
              Upload a supplier tax invoice (PDF, Excel, text or a photo of a scan) — AI extracts the vendor
              bill and matches it against your POs, GRNs and catalog. Scanned images are read server-side by OCR
              (Tesseract) before the same extraction pipeline.
            </Text>

            {!draft ? (
              <Button
                label={working ? 'Extracting…' : 'Upload invoice'}
                variant="accent"
                onPress={() => void pickAndExtract()}
                loading={working}
                fullWidth
              />
            ) : null}

            {notes && !draft ? <Text className="text-sm text-muted mt-3">{notes}</Text> : null}
            {error ? <Text className="text-sm text-danger mt-3">{error}</Text> : null}

            {draft ? (
              <View className="mt-3 gap-3">
                <View className="rounded-xl border border-border bg-surface p-3 gap-1">
                  <Text className="text-base font-bold text-text">{draft.vendorName}</Text>
                  <Text className="text-xs text-muted">
                    {[draft.vendorGstin, draft.billNumber, draft.billDate].filter(Boolean).join(' · ')}
                  </Text>
                  <View className="flex-row flex-wrap gap-1.5 mt-1">
                    {draft.matchedPO ? (
                      <Badge color="success" label={`PO ${draft.matchedPO.poNumber}`} />
                    ) : null}
                    {draft.matchedGRN ? (
                      <Badge color="success" label={`GRN ${draft.matchedGRN.grnNumber}`} />
                    ) : null}
                    <Badge
                      color={draft.confidence > 0.7 ? 'success' : 'warning'}
                      label={`Confidence ${Math.round(draft.confidence * 100)}%`}
                    />
                  </View>
                </View>

                {draft.lines.length > 0 ? (
                  <View className="rounded-xl border border-border bg-surface p-3">
                    <Text className="text-xs font-semibold text-muted mb-1.5 uppercase">Items ({draft.lines.length})</Text>
                    {draft.lines.map((l, i) => (
                      <View key={`${l.description}-${i}`} className="py-1 border-b border-border/60 last:border-b-0">
                        <Text className="text-sm text-text" numberOfLines={1}>
                          {l.description}
                        </Text>
                        <Text className="text-xs text-muted">
                          {[l.quantity, l.unit, `₹${l.rate}`, l.gstRate ? `${l.gstRate}%` : null, l.hsn ? `HSN ${l.hsn}` : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View className="flex-row flex-wrap gap-2">
                  <View className="flex-1 min-w-[120px] rounded-xl border border-border bg-surface p-2">
                    <Text className="text-xs text-muted">Subtotal</Text>
                    <Text className="text-sm font-bold text-text">{formatINR(draft.subtotal)}</Text>
                  </View>
                  <View className="flex-1 min-w-[120px] rounded-xl border border-border bg-surface p-2">
                    <Text className="text-xs text-muted">GST</Text>
                    <Text className="text-sm font-bold text-text">{formatINR(draft.gstAmount)}</Text>
                  </View>
                  <View className="flex-1 min-w-[120px] rounded-xl border border-border bg-surface p-2">
                    <Text className="text-xs text-muted">Total</Text>
                    <Text className="text-sm font-bold text-text">{formatINR(draft.total)}</Text>
                  </View>
                </View>

                {notes ? <Text className="text-xs text-muted">{notes}</Text> : null}

                <View className="flex-row gap-2 mt-1">
                  <Button
                    label="Re-upload"
                    variant="secondary"
                    className="flex-1"
                    disabled={working}
                    onPress={() => {
                      setDraft(null);
                      setNotes(null);
                      void pickAndExtract();
                    }}
                  />
                  <Button
                    label={working ? 'Creating…' : 'Create draft bill'}
                    variant="accent"
                    className="flex-1"
                    loading={working}
                    onPress={() => void createDraftBill()}
                  />
                </View>
              </View>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
