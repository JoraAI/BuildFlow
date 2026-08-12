/**
 * BuildFlow - Create Bill / Record vendor bill
 * Route: /accounting/create-bill?projectId=<id>&purchaseOrderId=<id>&vendorName=...
 *
 * PROC-B1/B4: When opened from procurement (purchaseOrderId present), the title
 * becomes "Record vendor bill", vendor details are pre-filled from the PO, and
 * a PO context card is shown. The bill is linked to the PO via purchaseOrderId.
 */
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Card, Button, Input, DateField, EmptyState } from '@/components/ui';
import { FormScreenHeader } from '@/components/layout/ScreenHeader';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ActionBar } from '@/components/layout/ActionBar';
import { useViewport } from '@/hooks/useViewport';
import { dismissTo, DISMISS } from '@/utils/navigation';
import { alertAsync } from '@/utils/confirm';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { useCreateBill, useExtractBill, type BillExtractDraft } from '@/services/accounting.queries';
import { useProjects, type ProjectListItem } from '@/services/project.queries';
import { useRequisitions, type PurchaseOrderSummary } from '@/services/expansion.queries';
import { usePermission } from '@/hooks/usePermission';
import { formatINR } from '@/utils/format';

const CATEGORIES = ['MATERIAL', 'LABOUR', 'EQUIPMENT', 'SUBCONTRACTOR', 'OTHER'] as const;
type Category = (typeof CATEGORIES)[number];

export default function CreateBillScreen() {
  const router = useRouter();
  const { isDesktop } = useViewport();
  const {
    projectId: preselected,
    vendorName: preVendor,
    vendorGstin: preVendorGstin,
    category: preCategory,
    purchaseOrderId: prePurchaseOrderId,
    poNumber: prePoNumber,
    suggestedBillNumber,
    returnTo: returnToParam,
  } = useLocalSearchParams<{
    projectId?: string;
    vendorName?: string;
    vendorGstin?: string;
    category?: string;
    purchaseOrderId?: string;
    poNumber?: string;
    suggestedBillNumber?: string;
    returnTo?: string;
  }>();
  const { data: projects } = useProjects();
  const createBill = useCreateBill();

  const [projectId, setProjectId] = useState(preselected ?? '');
  const [billNumber, setBillNumber] = useState('');
  const [vendorName, setVendorName] = useState(preVendor ?? '');
  const [vendorGstin, setVendorGstin] = useState(preVendorGstin ?? '');
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [subtotal, setSubtotal] = useState('0');
  const [gstAmount, setGstAmount] = useState('0');
  const [tdsEnabled, setTdsEnabled] = useState(false);
  const [category, setCategory] = useState<Category>(
    preCategory && (CATEGORIES as readonly string[]).includes(preCategory)
      ? (preCategory as Category)
      : 'MATERIAL',
  );
  const [formError, setFormError] = useState<string | null>(null);

  // PROC-B1: Dynamic title and save button based on PO context
  const screenTitle = prePurchaseOrderId ? 'Record vendor bill' : 'New Bill';
  const saveLabel = prePurchaseOrderId ? 'Save vendor bill' : 'Save bill';

  // R10-B2: Full permission guard - block screen, not just AI card.
  const canCreateBill = usePermission('bill.create');

  // R10-B3: GRN suggested subtotal from requisitions/PO payload.
  const { data: requisitions } = useRequisitions(preselected || projectId || '');
  const grnSuggestedSubtotal = useMemo(() => {
    if (!prePurchaseOrderId || !requisitions) return null;
    for (const req of requisitions) {
      const po = req.purchaseOrders?.find((p: PurchaseOrderSummary) => p.id === prePurchaseOrderId);
      if (!po) continue;
      // Compute Σ(GRN received qty × PO line rate). PO lines carry rate in the
      // requisition payload snapshot; GRN lines carry received qty per resource.
      const rateByResource = new Map<string, number>();
      for (const line of po.lines ?? []) {
        const existing = rateByResource.get(line.resourceId) ?? 0;
        rateByResource.set(line.resourceId, existing + (parseFloat(String(line.rate ?? 0)) || 0));
      }
      let sum = 0;
      for (const grn of po.goodsReceipts ?? []) {
        for (const gl of grn.lines) {
          const rate = rateByResource.get(gl.resourceId) ?? 0;
          const qty = parseFloat(String(gl.quantity ?? 0)) || 0;
          sum += qty * rate;
        }
      }
      return sum > 0 ? sum : null;
    }
    return null;
  }, [prePurchaseOrderId, requisitions]);

  // R10-B4: Track AI-extracted draft metadata to pass on save.
  const [lastExtractPoHint, setLastExtractPoHint] = useState<string | null>(null);
  const [lastWasExtract, setLastWasExtract] = useState(false);

  // R9-B2: AI extract
  const extractBill = useExtractBill(projectId || preselected || '');
  const [extracting, setExtracting] = useState(false);

  // R10-B2: Block the whole screen without bill.create permission.
  if (!canCreateBill) {
    return (
      <SafeAreaView className="flex-1 bg-surface" edges={isDesktop ? [] : ['bottom']}>
        <OfflineBanner />
        {isDesktop ? (
          <ScreenContainer constrained>
            <FormScreenHeader title="No access" onCancel={() => dismissTo(DISMISS.accounting)} />
            <EmptyState
              title="No permission"
              description="You need bill.create permission to create vendor bills."
            />
          </ScreenContainer>
        ) : (
          <>
            <FormScreenHeader title="No access" onCancel={() => dismissTo(DISMISS.accounting)} />
            <View className="px-4 pt-4">
              <EmptyState
                title="No permission"
                description="You need bill.create permission to create vendor bills."
              />
            </View>
          </>
        )}
      </SafeAreaView>
    );
  }

  const onExtractWithAI = async () => {
    setExtracting(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { getDocumentAsync } = require('expo-document-picker');
      const result = await getDocumentAsync({ multiple: false, type: ['application/pdf', 'image/*'] });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const res = await fetch(asset.uri);
      const blob = await res.blob();
      const reader = new FileReader();
      const base64: string = await new Promise((resolve, reject) => {
        reader.onloadend = () => {
          const str = reader.result as string;
          const comma = str.indexOf(',');
          resolve(comma >= 0 ? str.slice(comma + 1) : str);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const extractResult = await extractBill.mutateAsync({
        fileContent: base64,
        filename: asset.name || 'invoice.pdf',
        contentType: asset.mimeType || 'application/pdf',
      });
      if (extractResult.draft) {
        const d: BillExtractDraft = extractResult.draft;
        if (d.vendorName) setVendorName(d.vendorName);
        if (d.vendorGstin) setVendorGstin(d.vendorGstin);
        if (d.billNumber) setBillNumber(d.billNumber);
        if (d.billDate) setBillDate(d.billDate);
        if (d.subtotal) setSubtotal(String(d.subtotal));
        if (d.gstAmount) setGstAmount(String(d.gstAmount));
        // R10-B4: Track AI-extracted PO hint for save metadata.
        setLastExtractPoHint(d.poNumberHint ?? null);
        setLastWasExtract(true);
        void alertAsync('AI Extract', extractResult.notes || 'Review all fields before saving.');
      } else {
        void alertAsync('AI not available', extractResult.notes || 'Configure AI in Settings → Integrations. Enter manually.');
      }
    } catch (e) {
      void alertAsync('Error', (e as Error).message);
    } finally {
      setExtracting(false);
    }
  };

  // Live TDS + total preview
  const preview = useMemo(() => {
    const sub = parseFloat(subtotal) || 0;
    const gst = parseFloat(gstAmount) || 0;
    const tdsRate = tdsEnabled ? 2 : 0;
    const tdsAmount = tdsEnabled ? (sub * 2) / 100 : 0;
    const total = sub + gst - tdsAmount;
    return { sub, gst, tdsRate, tdsAmount, total };
  }, [subtotal, gstAmount, tdsEnabled]);

  const onSave = () => {
    setFormError(null);
    if (!projectId) {
      setFormError('Please choose a project for this bill.');
      return;
    }
    if (!vendorName.trim()) {
      setFormError('Please enter the vendor name.');
      return;
    }
    if (preview.sub <= 0) {
      setFormError('Bill subtotal must be greater than zero.');
      return;
    }

    createBill.mutate(
      {
        projectId,
        vendorName: vendorName.trim(),
        vendorGstin: vendorGstin.trim() || undefined,
        billDate,
        dueDate: dueDate || undefined,
        subtotal: preview.sub,
        gstAmount: preview.gst,
        tdsRate: preview.tdsRate,
        tdsAmount: preview.tdsAmount,
        category,
        // PROC-B3: Link bill to purchase order
        purchaseOrderId: prePurchaseOrderId || undefined,
        // R10-B4: Pass AI metadata on save - notes flag + PO hint from extract draft.
        notes: lastWasExtract ? 'source:AI_EXTRACT' : undefined,
        poNumberHint: !prePurchaseOrderId && lastExtractPoHint ? lastExtractPoHint : undefined,
      },
      {
        onSuccess: async (bill) => {
          await alertAsync('Success', `Bill ${bill.billNumber} created (status: ${bill.status}).`);
          if (returnToParam) {
            router.dismiss();
            router.push(returnToParam as never);
          } else {
            dismissTo(DISMISS.accounting);
          }
        },
        onError: async (e: unknown) => {
          const message = e instanceof Error ? e.message : 'Failed to create bill';
          setFormError(message);
          await alertAsync('Error', message);
        },
      },
    );
  };

  // PROC-B4: PO context card shown when opened from procurement
  // R10-B3: Add GRN suggested subtotal + one-tap fill + variance hint.
  const grnVariancePct =
    grnSuggestedSubtotal && preview.sub > 0
      ? Math.abs((preview.sub - grnSuggestedSubtotal) / grnSuggestedSubtotal) * 100
      : 0;
  const poContextCard = prePurchaseOrderId ? (
    <Card>
      <View className="flex-row justify-between items-center mb-1">
        <Text className="text-sm font-bold text-text">Linked Purchase Order</Text>
        <Text className="text-xs font-semibold text-primary">{prePoNumber ?? 'PO'}</Text>
      </View>
      <Text className="text-xs text-muted">
        Enter the amounts from the supplier's tax invoice. Vendor details are pre-filled from the PO.
      </Text>
      {grnSuggestedSubtotal ? (
        <View className="mt-3 pt-3 border-t border-border/60">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-1 pr-2">
              <Text className="text-xs font-semibold text-text">Suggested from GRN</Text>
              <Text className="text-xs text-muted">
                {formatINR(grnSuggestedSubtotal)} - received qty × PO line rates
              </Text>
            </View>
            <Button
              label="Fill subtotal"
              size="sm"
              variant="secondary"
              onPress={() => setSubtotal(String(grnSuggestedSubtotal))}
            />
          </View>
          {preview.sub > 0 && grnVariancePct > 1 && (
            <Text className="text-xs text-warning">
              Entered subtotal differs from GRN by {grnVariancePct.toFixed(1)}%. Verify before saving.
            </Text>
          )}
        </View>
      ) : null}
    </Card>
  ) : null;

  const summaryCard = (
    <Card>
      <Text className="text-sm font-bold text-text mb-2">Summary</Text>
      <View className="gap-1.5">
        <PreviewRow label="Subtotal" value={formatINR(preview.sub)} />
        <PreviewRow label="GST" value={formatINR(preview.gst)} muted />
        {preview.tdsAmount > 0 && (
          <PreviewRow label={`TDS (${preview.tdsRate}%)`} value={`- ${formatINR(preview.tdsAmount)}`} danger />
        )}
        <View className="h-px bg-border my-1" />
        <View className="flex-row justify-between">
          <Text className="text-base font-bold text-text">Net Payable</Text>
          <Text className="text-base font-bold text-primary">{formatINR(preview.total)}</Text>
        </View>
      </View>
    </Card>
  );

  const formFields = (
    <>
      {poContextCard}

      {/* R9-B2: Upload + Extract with AI */}
      {canCreateBill && (
        <Card>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-2">
              <Text className="text-sm font-bold text-text">Upload Invoice</Text>
              <Text className="text-xs text-muted">Upload supplier invoice PDF/image. Use AI to auto-extract fields.</Text>
            </View>
            <Button
              label="🤖 Extract with AI"
              size="sm"
              variant="secondary"
              loading={extracting}
              onPress={() => void onExtractWithAI()}
            />
          </View>
        </Card>
      )}

      <Card>
        <Text className="text-sm font-bold text-text mb-2">Project</Text>
        {!preselected && projects ? (
          <View className={`gap-1 ${isDesktop ? 'flex-row flex-wrap' : ''}`}>
            {projects.map((p: ProjectListItem) => (
              <Pressable
                key={p.id}
                onPress={() => setProjectId(p.id)}
                className={`p-2 rounded-lg border ${isDesktop ? 'flex-1 min-w-[200px]' : ''} ${projectId === p.id ? 'bg-primary/10 border-primary' : 'border-border'}`}
              >
                <Text className="text-sm text-text">{p.name}</Text>
                <Text className="text-xs text-muted">{p.clientName}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text className="text-sm text-muted">
            {projects?.find((p: ProjectListItem) => p.id === projectId)?.name ?? projectId}
          </Text>
        )}
      </Card>

      <View className={isDesktop ? 'flex-row gap-4 items-start' : 'gap-4'}>
        <Card className={isDesktop ? 'flex-1' : undefined}>
          <Text className="text-sm font-bold text-text mb-2">Bill Details</Text>
          <Input
            label="Supplier invoice no."
            value={billNumber}
            onChangeText={setBillNumber}
            placeholder="As printed on vendor's tax invoice"
          />
          <Input
            label="Vendor Name"
            value={vendorName}
            onChangeText={setVendorName}
            placeholder="ABC Suppliers"
          />
          <Input
            label="Vendor GSTIN"
            value={vendorGstin}
            onChangeText={setVendorGstin}
            placeholder="36ABCDE1234F1Z5"
            autoCapitalize="characters"
          />
          <View className="flex-row gap-2">
            <View className="flex-1">
              <DateField label="Bill Date" value={billDate} onChange={setBillDate} />
            </View>
            <View className="flex-1">
              <DateField
                label="Due Date (optional)"
                value={dueDate}
                onChange={setDueDate}
                minimumDate={billDate}
              />
            </View>
          </View>
        </Card>

        <Card className={isDesktop ? 'flex-1' : undefined}>
          <Text className="text-sm font-bold text-text mb-2">Category</Text>
          <View className="flex-row flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                className={`px-3 py-2 rounded-lg border ${category === c ? 'bg-primary border-primary' : 'border-border'}`}
              >
                <Text className={`text-xs font-medium ${category === c ? 'text-white' : 'text-muted'}`}>
                  {c}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>
      </View>

      <Card>
        <Text className="text-sm font-bold text-text mb-2">Amounts</Text>
        <View className={isDesktop ? 'flex-row gap-4' : ''}>
          <View className={isDesktop ? 'flex-1' : undefined}>
            <Input
              label="Subtotal (Rs)"
              value={subtotal}
              onChangeText={setSubtotal}
              keyboardType="numeric"
              placeholder="0"
            />
          </View>
          <View className={isDesktop ? 'flex-1' : undefined}>
            <Input
              label="GST Amount (Rs)"
              value={gstAmount}
              onChangeText={setGstAmount}
              keyboardType="numeric"
              placeholder="0"
            />
          </View>
        </View>
        <Pressable
          onPress={() => setTdsEnabled((v) => !v)}
          className={`flex-row items-center gap-2 p-3 rounded-lg border mt-2 ${tdsEnabled ? 'border-primary bg-primary/5' : 'border-border'}`}
        >
          <View
            className={`w-5 h-5 rounded border-2 items-center justify-center ${tdsEnabled ? 'bg-primary border-primary' : 'border-border'}`}
          >
            {tdsEnabled && <Text className="text-white text-xs">✓</Text>}
          </View>
          <Text className="text-sm text-text">Apply TDS 2% (Section 194C)</Text>
        </Pressable>
      </Card>

      {!isDesktop && summaryCard}
    </>
  );

  const formErrorBanner = formError ? (
    <View className="mb-2 px-3 py-2 rounded-lg bg-danger/10 border border-danger/30">
      <Text className="text-sm text-danger">{formError}</Text>
    </View>
  ) : null;

  const saveBar = (
    <Button
      label={saveLabel}
      variant="primary"
      onPress={onSave}
      loading={createBill.isPending}
      disabled={createBill.isPending}
    />
  );

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={isDesktop ? [] : ['bottom']}>
      <OfflineBanner />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {isDesktop ? (
          <ScreenContainer scrollable constrained>
            <FormScreenHeader title={screenTitle} onCancel={() => dismissTo(returnToParam ? decodeURIComponent(returnToParam) : DISMISS.accounting)} />
            <View className="flex-1 flex-row gap-6 items-start">
              <View className="flex-[2] gap-4">
                {formFields}
              </View>
              <View className="flex-1 max-w-sm">{summaryCard}</View>
            </View>
            <ActionBar>
              {formErrorBanner}
              {saveBar}
            </ActionBar>
          </ScreenContainer>
        ) : (
          <>
            <FormScreenHeader title={screenTitle} onCancel={() => dismissTo(returnToParam ? decodeURIComponent(returnToParam) : DISMISS.accounting)} />
            <ScrollView contentContainerClassName="px-4 pb-32 pt-2 gap-4">{formFields}</ScrollView>
            <View className="absolute bottom-0 left-0 right-0 bg-card border-t border-border p-4">
              {formErrorBanner}
              {saveBar}
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PreviewRow({
  label,
  value,
  muted,
  danger,
}: {
  label: string;
  value: string;
  muted?: boolean;
  danger?: boolean;
}) {
  return (
    <View className="flex-row justify-between">
      <Text className={`text-sm ${muted ? 'text-muted' : 'text-text'}`}>{label}</Text>
      <Text className={`text-sm ${danger ? 'text-danger' : muted ? 'text-muted' : 'text-text'}`}>
        {value}
      </Text>
    </View>
  );
}