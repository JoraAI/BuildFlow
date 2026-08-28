/**
 * BuildFlow - Quick POS Return Scan Modal
 *
 * Fast barcode/camera scanner workflow for lighting, equipment, and goods distributors.
 * Scans returned items, matches them against past sales dispatches, calculates max returnable
 * quantities, allows condition tagging (GOOD / DAMAGED), targets a restocking warehouse,
 * and builds a clean return voucher with real-time financial reconciliation.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Platform, Alert, Modal, Pressable } from 'react-native';
import { Input, Button, Badge } from '@/components/ui';
import { useViewport } from '@/hooks/useViewport';
import { BarcodeScannerOverlay } from '@/components/inventory/BarcodeScannerOverlay';
import { useInvoices } from '@/services/accounting.queries';
import { useWarehouses, type Warehouse } from '@/services/warehouse.queries';
import {
  useValidateReturnScan,
  useCreateSalesReturn,
  type ValidatedScanResult,
} from '@/services/sales.queries';
import { Ionicons } from '@expo/vector-icons';

interface ReturnCartLine {
  key: string;
  resourceId: string;
  name: string;
  unit: string;
  barcode?: string | null;
  sku?: string | null;
  dispatchedQty: number;
  returnQty: number;
  rate: number;
  gstRate: number;
  returnKind: 'GOOD' | 'DAMAGED';
  invoiceLineItemId?: string;
  maxReturnable: number;
}

export function QuickReturnScanModal({
  open,
  projectId,
  onClose,
  onSuccess,
}: {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onSuccess?: (returnNumber: string) => void;
}) {
  const { isDesktop, isPhone } = useViewport();
  const { data: invoices } = useInvoices(projectId);
  const { data: warehouses } = useWarehouses();

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [scanBuffer, setScanBuffer] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('Unconsumed site return');
  const [returnLines, setReturnLines] = useState<ReturnCartLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [scanSuccessToast, setScanSuccessToast] = useState('');

  const validateScan = useValidateReturnScan();
  const createReturn = useCreateSalesReturn();

  // Initialize default warehouse
  useEffect(() => {
    if (open && warehouses && warehouses.length > 0 && !selectedLocationId) {
      const def = (warehouses as Warehouse[]).find((w: Warehouse) => w.isDefault) ?? warehouses[0];
      setSelectedLocationId(def.id);
    }
  }, [open, warehouses, selectedLocationId]);

  // Reset state on open
  useEffect(() => {
    if (open) {
      setReturnLines([]);
      setScanBuffer('');
      setError('');
      setScanSuccessToast('');
    }
  }, [open]);

  // Eligible invoices for return
  const eligibleInvoices = useMemo(() => {
    return (invoices ?? []).filter((inv: { id: string; status: string; invoiceNumber: string; clientName: string }) =>
      ['SENT', 'PAID', 'OVERDUE'].includes(inv.status),
    );
  }, [invoices]);

  const activeInvoice = useMemo(() => {
    return eligibleInvoices.find((i: { id: string }) => i.id === selectedInvoiceId);
  }, [eligibleInvoices, selectedInvoiceId]);

  // Handle scanned barcode / text lookup
  const handleProcessBarcode = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setError('');
    setScanSuccessToast('');

    try {
      const result = await validateScan.mutateAsync({
        barcode: trimmed,
        invoiceId: selectedInvoiceId || undefined,
      });

      if (!result.isValidDispatch || result.matchingLines.length === 0) {
        setError(`"${result.resource.name}" was not found in active dispatches.`);
        return;
      }

      // If user hasn't selected an invoice yet, lock to the first matching invoice
      if (!selectedInvoiceId && result.matchingLines.length > 0) {
        setSelectedInvoiceId(result.matchingLines[0].invoiceId);
      }

      const match = result.matchingLines[0];

      setReturnLines((prev) => {
        const existingIdx = prev.findIndex((l) => l.resourceId === result.resource.id);
        if (existingIdx >= 0) {
          const current = prev[existingIdx];
          const nextQty = Math.min(current.returnQty + 1, result.maxReturnable);
          if (nextQty === current.returnQty && current.returnQty >= result.maxReturnable) {
            setError(`Max returnable limit (${result.maxReturnable} ${result.resource.unit}) reached for "${result.resource.name}".`);
            return prev;
          }
          const updated = [...prev];
          updated[existingIdx] = { ...current, returnQty: nextQty };
          return updated;
        }

        const initialQty = Math.min(1, result.maxReturnable);
        return [
          ...prev,
          {
            key: `${result.resource.id}-${Date.now()}`,
            resourceId: result.resource.id,
            name: result.resource.name,
            unit: result.resource.unit,
            barcode: result.resource.barcode,
            sku: result.resource.sku,
            dispatchedQty: match.dispatchedQty,
            returnQty: initialQty,
            rate: match.rate,
            gstRate: match.gstRate,
            returnKind: 'GOOD',
            invoiceLineItemId: match.invoiceLineItemId,
            maxReturnable: result.maxReturnable,
          },
        ];
      });

      setScanSuccessToast(`Added 1× ${result.resource.name}`);
      setScanBuffer('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Item verification failed');
    }
  };

  // Hardware scanner key listener on Web
  useEffect(() => {
    if (!open || Platform.OS !== 'web' || typeof window === 'undefined') return;

    let buffer = '';
    let lastKeyTime = Date.now();

    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing inside an active input element
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;

      const now = Date.now();
      if (now - lastKeyTime > 100) buffer = '';
      lastKeyTime = now;

      if (e.key === 'Enter') {
        if (buffer.length >= 2) {
          void handleProcessBarcode(buffer);
          buffer = '';
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, selectedInvoiceId]);

  // Financial calculations
  const totals = useMemo(() => {
    let subtotal = 0;
    let gstAmount = 0;
    for (const l of returnLines) {
      const lineSub = l.returnQty * l.rate;
      const lineGst = lineSub * (l.gstRate / 100);
      subtotal += lineSub;
      gstAmount += lineGst;
    }
    const total = subtotal + gstAmount;
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      gstAmount: Math.round(gstAmount * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }, [returnLines]);

  // Update line quantity
  const updateLineQty = (resourceId: string, delta: number) => {
    setReturnLines((prev) =>
      prev
        .map((l) => {
          if (l.resourceId !== resourceId) return l;
          const next = Math.max(0, Math.min(l.returnQty + delta, l.maxReturnable));
          return { ...l, returnQty: next };
        })
        .filter((l) => l.returnQty > 0),
    );
  };

  // Toggle return condition (GOOD / DAMAGED)
  const toggleCondition = (resourceId: string) => {
    setReturnLines((prev) =>
      prev.map((l) =>
        l.resourceId === resourceId
          ? { ...l, returnKind: l.returnKind === 'GOOD' ? 'DAMAGED' : 'GOOD' }
          : l,
      ),
    );
  };

  const handleSubmitReturn = async (asApproval = false) => {
    if (!selectedInvoiceId) {
      setError('Select an invoice or scan an item from the dispatch.');
      return;
    }
    if (returnLines.length === 0) {
      setError('Scan or add at least one item to return.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const result = await createReturn.mutateAsync({
        invoiceId: selectedInvoiceId,
        returnDate: new Date().toISOString().slice(0, 10),
        reason: returnReason,
        targetLocationId: selectedLocationId || undefined,
        status: asApproval ? 'PENDING_APPROVAL' : 'ISSUED',
        lines: returnLines.map((l) => ({
          resourceId: l.resourceId,
          quantity: l.returnQty,
          unit: l.unit,
          rate: l.rate,
          gstRate: l.gstRate,
          returnKind: l.returnKind,
          invoiceLineItemId: l.invoiceLineItemId,
        })),
      });

      if (onSuccess) {
        onSuccess(result.salesReturn.returnNumber);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record return');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <Modal
        visible={open}
        animationType={isPhone ? 'slide' : 'fade'}
        transparent
        onRequestClose={onClose}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-end sm:justify-center sm:items-center p-0 sm:p-4"
          onPress={onClose}
        >
          <Pressable
            className="bg-surface rounded-t-2xl sm:rounded-2xl w-full max-w-4xl max-h-[92vh] sm:max-h-[85vh] flex-col overflow-hidden"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="px-5 py-3.5 border-b border-border flex-row items-center justify-between">
              <View>
                <Text className="text-base font-bold text-text">POS Scan & Return (Unconsumed Items)</Text>
                <Text className="text-xs text-muted mt-0.5">
                  Verify returned items against past dispatches, choose restocking warehouse, and reconcile invoices.
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} className="p-1 rounded-lg hover:bg-card">
                <Ionicons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View className="flex-1 p-4 pb-4">
          {/* Top Bar: Reference Dispatch Selector & Warehouse */}
          <View className="bg-card border border-border rounded-xl p-3.5 mb-3">
            <View className={isDesktop ? 'flex-row gap-4' : 'gap-3'}>
              <View className="flex-1">
                <Text className="text-xs font-semibold text-text mb-1">Target Sales Invoice / Dispatch</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => setSelectedInvoiceId('')}
                      className={`px-3 py-1.5 rounded-lg border ${
                        !selectedInvoiceId ? 'bg-primary border-primary' : 'bg-surface border-border'
                      }`}
                    >
                      <Text className={`text-xs font-medium ${!selectedInvoiceId ? 'text-white' : 'text-text'}`}>
                        Auto-detect on Scan
                      </Text>
                    </TouchableOpacity>
                    {eligibleInvoices.map((inv: { id: string; invoiceNumber: string; clientName: string }) => (
                      <TouchableOpacity
                        key={inv.id}
                        onPress={() => setSelectedInvoiceId(inv.id)}
                        className={`px-3 py-1.5 rounded-lg border ${
                          selectedInvoiceId === inv.id ? 'bg-primary border-primary' : 'bg-surface border-border'
                        }`}
                      >
                        <Text className={`text-xs font-medium ${selectedInvoiceId === inv.id ? 'text-white' : 'text-text'}`}>
                          {inv.invoiceNumber} · {inv.clientName}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View className={isDesktop ? 'w-64' : 'w-full'}>
                <Text className="text-xs font-semibold text-text mb-1">Restock Destination Warehouse</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                  <View className="flex-row gap-2">
                    {(warehouses ?? []).map((w: Warehouse) => (
                      <TouchableOpacity
                        key={w.id}
                        onPress={() => setSelectedLocationId(w.id)}
                        className={`px-3 py-1.5 rounded-lg border ${
                          selectedLocationId === w.id ? 'bg-accent border-accent' : 'bg-surface border-border'
                        }`}
                      >
                        <Text className={`text-xs font-medium ${selectedLocationId === w.id ? 'text-white' : 'text-text'}`}>
                          {w.name} {w.isDefault ? '(Main)' : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>
          </View>

          {/* Barcode & Scanner Input Row */}
          <View className="flex-row items-center gap-2 mb-3">
            <View className="flex-1">
              <Input
                placeholder="Scan or type barcode, SKU, or item code..."
                value={scanBuffer}
                onChangeText={setScanBuffer}
                onSubmitEditing={() => void handleProcessBarcode(scanBuffer)}
                compact
              />
            </View>
            <Button
              label="Lookup"
              size="sm"
              variant="secondary"
              loading={validateScan.isPending}
              onPress={() => void handleProcessBarcode(scanBuffer)}
            />
            <Button
              label="Camera"
              size="sm"
              variant="primary"
              icon={<Ionicons name="barcode-outline" size={16} color="#FFFFFF" />}
              onPress={() => setScannerOpen(true)}
            />
          </View>

          {/* Feedback Toasts & Errors */}
          {scanSuccessToast ? (
            <View className="bg-success/10 border border-success/30 rounded-lg px-3 py-2 mb-2 flex-row items-center justify-between">
              <Text className="text-xs font-semibold text-success">{scanSuccessToast}</Text>
              <TouchableOpacity onPress={() => setScanSuccessToast('')}>
                <Text className="text-xs text-success font-bold">×</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {error ? (
            <View className="bg-danger/10 border border-danger/30 rounded-lg px-3 py-2 mb-2">
              <Text className="text-xs text-danger font-medium">{error}</Text>
            </View>
          ) : null}

          {/* Main Table / Line Cards */}
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            {returnLines.length === 0 ? (
              <View className="py-12 items-center justify-center border-2 border-dashed border-border rounded-xl">
                <Ionicons name="scan-outline" size={40} color="#94A3B8" />
                <Text className="text-sm font-semibold text-text mt-2">Ready to Scan Returned Items</Text>
                <Text className="text-xs text-muted text-center max-w-xs mt-1">
                  Point mobile camera or hardware barcode reader at lighting/fixture boxes to verify past outward shipments.
                </Text>
              </View>
            ) : (
              <View className="gap-2">
                {returnLines.map((l) => (
                  <View key={l.key} className="bg-card border border-border rounded-xl p-3">
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1 mr-2">
                        <Text className="text-sm font-bold text-text">{l.name}</Text>
                        <Text className="text-xs text-muted mt-0.5">
                          Rate: ₹{l.rate} · GST: {l.gstRate}% · Code: {l.sku || l.barcode || 'N/A'}
                        </Text>
                        <View className="flex-row items-center gap-2 mt-1.5">
                          <Badge
                            label={`Dispatched: ${l.dispatchedQty} ${l.unit}`}
                            color="neutral"
                          />
                          <Badge
                            label={`Net Sold: ${l.dispatchedQty - l.returnQty} ${l.unit}`}
                            color="primary"
                          />
                        </View>
                      </View>

                      {/* Stepper & Condition Toggle */}
                      <View className="items-end gap-1.5">
                        <View className="flex-row items-center bg-surface border border-border rounded-lg">
                          <TouchableOpacity
                            onPress={() => updateLineQty(l.resourceId, -1)}
                            className="px-2.5 py-1"
                          >
                            <Text className="text-sm font-bold text-text">−</Text>
                          </TouchableOpacity>
                          <Text className="px-2 text-sm font-semibold text-text">
                            {l.returnQty} {l.unit}
                          </Text>
                          <TouchableOpacity
                            onPress={() => updateLineQty(l.resourceId, 1)}
                            className="px-2.5 py-1"
                          >
                            <Text className="text-sm font-bold text-text">＋</Text>
                          </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                          onPress={() => toggleCondition(l.resourceId)}
                          className={`px-2 py-0.5 rounded border ${
                            l.returnKind === 'GOOD'
                              ? 'bg-success/10 border-success/30'
                              : 'bg-danger/10 border-danger/30'
                          }`}
                        >
                          <Text
                            className={`text-[11px] font-bold ${
                              l.returnKind === 'GOOD' ? 'text-success' : 'text-danger'
                            }`}
                          >
                            {l.returnKind === 'GOOD' ? '✓ GOOD (Restock)' : '⚠ DAMAGED (Scrap)'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Sticky Financial Settlement Footer */}
          {returnLines.length > 0 ? (
            <View className="bg-card border border-border rounded-xl p-3.5 mt-2">
              <View className="flex-row justify-between items-center mb-1">
                <Text className="text-xs text-muted">Return Subtotal (Excl. Tax):</Text>
                <Text className="text-xs font-semibold text-text">₹{totals.subtotal.toFixed(2)}</Text>
              </View>
              <View className="flex-row justify-between items-center mb-1.5">
                <Text className="text-xs text-muted">GST Credit (Input Tax Adjustment):</Text>
                <Text className="text-xs font-semibold text-text">₹{totals.gstAmount.toFixed(2)}</Text>
              </View>
              <View className="flex-row justify-between items-center pt-1.5 border-t border-border mb-3">
                <Text className="text-sm font-bold text-text">Credit Note Value:</Text>
                <Text className="text-base font-bold text-accent">₹{totals.total.toFixed(2)}</Text>
              </View>

              <View className="flex-row gap-2">
                <Button
                  label="Cancel"
                  variant="secondary"
                  className="flex-1"
                  disabled={submitting}
                  onPress={onClose}
                />
                <Button
                  label={submitting ? 'Saving…' : 'Save for Approval'}
                  variant="secondary"
                  className="flex-1"
                  loading={submitting}
                  onPress={() => void handleSubmitReturn(true)}
                />
                <Button
                  label={submitting ? 'Restocking…' : 'Approve & Restock'}
                  variant="accent"
                  className="flex-1"
                  loading={submitting}
                  onPress={() => void handleSubmitReturn(false)}
                />
              </View>
            </View>
          ) : null}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Barcode Camera Scanner Overlay */}
      {scannerOpen ? (
        <BarcodeScannerOverlay
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onScanned={(code) => {
            setScannerOpen(false);
            void handleProcessBarcode(code);
          }}
        />
      ) : null}
    </>
  );
}
