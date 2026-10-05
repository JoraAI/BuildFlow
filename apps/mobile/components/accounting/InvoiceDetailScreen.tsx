/**
 * Invoice detail body - used by construction (/accounting/invoice/[id])
 * and inventory (/inventory/invoices/[id]) route wrappers.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Card, Badge, Button, Input, EmptyState, LoadingSkeleton, toast, BusyOverlay, useBusy } from '@/components/ui';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { FormScreenHeader } from '@/components/layout/ScreenHeader';
import { useViewport } from '@/hooks/useViewport';
import { navigateAppBack, parseReturnTo } from '@/utils/navigation';
import { alertAsync, confirmAsync } from '@/utils/confirm';
import {
  useInvoice,
  useSendInvoice,
  useRecordPayment,
  type InvoiceLineItem,
} from '@/services/accounting.queries';
import { useRemindInvoice } from '@/services/inventory-gtm.queries';
import { useAuthStore } from '@/stores/auth.store';
import { formatINR, formatDate } from '@/utils/format';
import { downloadReportPdf, reportPaths } from '@/services/report-download';

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'neutral'> = {
  DRAFT: 'neutral',
  SENT: 'primary',
  PAID: 'success',
  OVERDUE: 'danger',
};

export function InvoiceDetailScreen({ fallbackBackHref }: { fallbackBackHref: string }) {
  const { busy, run } = useBusy();
  const { isDesktop } = useViewport();
  const { id, returnTo: returnToParam } = useLocalSearchParams<{ id: string; returnTo?: string }>();
  const returnTo = parseReturnTo(returnToParam);
  const goBack = () => navigateAppBack(fallbackBackHref, returnTo);
  const { data: invoice, isLoading } = useInvoice(id);
  const sendInvoice = useSendInvoice();
  const recordPayment = useRecordPayment();
  const remindInvoice = useRemindInvoice();
  const isInventoryShell =
    useAuthStore((s) => s.user?.subscriptionPlan === 'INVENTORY') ||
    fallbackBackHref.startsWith('/inventory');
  const [showPayment, setShowPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <OfflineBanner />
        <FormScreenHeader title="Invoice" cancelLabel="Back" onCancel={goBack} />
        <View className="px-4 pt-4">
          <LoadingSkeleton className="h-64 rounded-xl" />
        </View>
      </SafeAreaView>
    );
  }

  if (!invoice) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <OfflineBanner />
        <FormScreenHeader title="Invoice not found" cancelLabel="Back" onCancel={goBack} />
        <EmptyState title="Invoice not found" description="This invoice may have been deleted." />
      </SafeAreaView>
    );
  }

  const balanceDue = invoice.total - invoice.paidAmount;
  const isFullyPaid = invoice.paidAmount >= invoice.total;

  const onSend = async () => {
    if (!isInventoryShell) {
      const ok = await confirmAsync(
        'Send Invoice',
        `Mark invoice ${invoice.invoiceNumber} as sent?`,
      );
      if (!ok) return;
    }
    try {
      await run(async () => {
        await sendInvoice.mutateAsync(invoice.id);
      });
      if (isInventoryShell) toast.success('Sale confirmed and invoice marked as sent');
    } catch (e) {
      await alertAsync('Error', e instanceof Error ? e.message : 'Could not send');
    }
  };

  const onRecordFullPayment = async () => {
    const ok = await confirmAsync(
      'Record full payment',
      `Confirm receipt of ${formatINR(balanceDue)} for invoice ${invoice.invoiceNumber}?`,
    );
    if (!ok) return;
    try {
      await run(async () => {
        await recordPayment.mutateAsync({ id: invoice.id, amount: balanceDue });
      });
      toast.success('Full payment recorded');
    } catch (e) {
      await alertAsync('Error', e instanceof Error ? e.message : 'Could not record payment');
    }
  };

  const onRecordPayment = () => {
    setFormError(null);
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setFormError('Please enter a valid payment amount.');
      return;
    }
    void (async () => {
      try {
        await run(async () => {
          await recordPayment.mutateAsync({ id: invoice.id, amount });
        });
        setShowPayment(false);
        setPaymentAmount('');
        setFormError(null);
        await alertAsync('Success', 'Payment recorded successfully.');
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not record payment';
        setFormError(msg);
        await alertAsync('Error', msg);
      }
    })();
  };

  const totalsCard = (
    <Card>
      <View className="gap-2">
        <Row label="Subtotal" value={formatINR(invoice.subtotal)} />
        {invoice.cgstAmount > 0 && <Row label="CGST" value={formatINR(invoice.cgstAmount)} muted />}
        {invoice.sgstAmount > 0 && <Row label="SGST" value={formatINR(invoice.sgstAmount)} muted />}
        {invoice.igstAmount > 0 && <Row label="IGST" value={formatINR(invoice.igstAmount)} muted />}
        {invoice.tdsAmount > 0 && (
          <Row label={`TDS (${invoice.tdsRate}%)`} value={`- ${formatINR(invoice.tdsAmount)}`} danger />
        )}
        <View className="h-px bg-border my-1" />
        <Row label="Total" value={formatINR(invoice.total)} bold />
        {invoice.paidAmount > 0 && (
          <>
            <Row label="Paid" value={formatINR(invoice.paidAmount)} success />
            <View className="h-px bg-border my-1" />
            <Row label="Balance Due" value={formatINR(balanceDue)} bold danger={balanceDue > 0} />
          </>
        )}
      </View>
    </Card>
  );

  const actionsBlock = (
    <View className="gap-3">
      {/* RPT-UI1b-invoice: Download PDF */}
      <Button
        label="Download PDF"
        variant="secondary"
        onPress={() => void downloadReportPdf(reportPaths.invoice(id), `invoice-${invoice.invoiceNumber}.pdf`)}
      />
      {invoice.status === 'DRAFT' && (
        <Button
          label={
            sendInvoice.isPending || busy
              ? 'Confirming...'
              : isInventoryShell
                ? 'Mark as sent'
                : 'Send Invoice'
          }
          variant="primary"
          onPress={onSend}
          disabled={sendInvoice.isPending || busy}
        />
      )}

      {!isFullyPaid && invoice.status !== 'DRAFT' && !showPayment && (
        <>
          {isInventoryShell ? (
            <Button
              label={`Record full payment (${formatINR(balanceDue)})`}
              variant="primary"
              onPress={onRecordFullPayment}
              disabled={recordPayment.isPending || busy}
            />
          ) : null}
          <Button
            label={isInventoryShell ? 'Record partial payment' : 'Record Payment'}
            variant="secondary"
            onPress={() => {
              setPaymentAmount(isInventoryShell ? '' : balanceDue.toString());
              setShowPayment(true);
            }}
          />
        </>
      )}

      {/* INVENTORY_HORIZONTAL_PLATFORM (Phase 9.4): manual payment reminder (inventory only). */}
      {isInventoryShell && !isFullyPaid && invoice.status !== 'DRAFT' ? (
        <Button
          label={remindInvoice.isPending ? 'Sending reminder…' : 'Send payment reminder'}
          variant="ghost"
          disabled={remindInvoice.isPending}
          onPress={() => {
            void (async () => {
              try {
                await run(async () => {
                  await remindInvoice.mutateAsync(invoice.id);
                });
                toast.success('Payment reminder sent to store owners');
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Could not send reminder');
              }
            })();
          }}
        />
      ) : null}

      {showPayment && (
        <Card>
          <Text className="text-sm font-bold text-text mb-2">Record Payment</Text>
          {formError ? (
            <View className="mb-2 px-3 py-2 rounded-lg bg-danger/10 border border-danger/30">
              <Text className="text-sm text-danger">{formError}</Text>
            </View>
          ) : null}
          <Input
            label="Amount (Rs)"
            value={paymentAmount}
            onChangeText={setPaymentAmount}
            keyboardType="numeric"
            placeholder={balanceDue.toString()}
            error={formError ?? undefined}
          />
          <View className="flex-row gap-2 mt-2">
            <View className="flex-1">
              <Button
                label="Confirm"
                variant="primary"
                onPress={onRecordPayment}
                loading={recordPayment.isPending}
                disabled={recordPayment.isPending}
              />
            </View>
            <View className="flex-1">
              <Button label="Cancel" variant="ghost" onPress={() => setShowPayment(false)} />
            </View>
          </View>
        </Card>
      )}
    </View>
  );

  const mainContent = (
    <>
      <Card>
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1 mr-2">
            <Text className={`font-bold text-text font-mono ${isDesktop ? 'text-2xl' : 'text-xl'}`}>
              {invoice.invoiceNumber}
            </Text>
            <Text className="text-sm text-muted mt-1">{invoice.clientName}</Text>
            {invoice.clientPhone ? (
              <Text className="text-xs text-muted">Phone: {invoice.clientPhone}</Text>
            ) : null}
            {invoice.clientGstin && (
              <Text className="text-xs text-muted font-mono">GSTIN: {invoice.clientGstin}</Text>
            )}
            {invoice.clientAddress ? (
              <Text className="text-xs text-muted mt-0.5">{invoice.clientAddress}</Text>
            ) : null}
          </View>
          <Badge color={STATUS_COLOR[invoice.status] ?? 'neutral'} label={invoice.status} />
        </View>
        <View className="flex-row justify-between">
          <View>
            <Text className="text-xs text-muted">Invoice Date</Text>
            <Text className="text-sm text-text">{formatDate(invoice.invoiceDate)}</Text>
          </View>
          <View className="items-end">
            <Text className="text-xs text-muted">Due Date</Text>
            <Text className="text-sm text-text">{formatDate(invoice.dueDate)}</Text>
          </View>
        </View>
      </Card>

      {invoice.lineItems && invoice.lineItems.length > 0 && (
        <Card className="overflow-hidden !p-0">
          <View className="px-4 pt-3 pb-2">
            <Text className="text-sm font-bold text-text">Billing items</Text>
            <Text className="text-[11px] text-muted mt-0.5">
              Tax invoice format — HSN, qty, rate, CGST / SGST (or IGST)
            </Text>
          </View>
          <TaxInvoiceLineTable
            lines={invoice.lineItems}
            useIgst={Number(invoice.igstAmount) > 0 && Number(invoice.cgstAmount) <= 0}
          />
        </Card>
      )}

      {invoice.notes && (
        <Card>
          <Text className="text-xs text-muted mb-1">Notes</Text>
          <Text className="text-sm text-text">{invoice.notes}</Text>
        </Card>
      )}

      {!isDesktop && totalsCard}
      {!isDesktop && actionsBlock}
    </>
  );

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={isDesktop ? [] : ['bottom']}>
      <BusyOverlay visible={busy} title="Updating invoice…" />
      <OfflineBanner />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {isDesktop ? (
          <ScrollView className="flex-1 min-h-0" contentContainerClassName="items-center px-8 py-6 pb-32" showsVerticalScrollIndicator>
            <FormScreenHeader
              title={invoice.invoiceNumber}
              subtitle={invoice.clientName}
              cancelLabel="Back"
              onCancel={goBack}
            />
            <View className="w-full max-w-6xl">
              <View className="flex-row gap-6 items-start">
              <View className="flex-[2] min-w-0 gap-4">{mainContent}</View>
              {/* FIX (UI-H3): Remove min-w so panes don't collapse at 768px */}
              <View className="flex-1 max-w-sm gap-4">
                {totalsCard}
                {actionsBlock}
              </View>
            </View>
            </View>
          </ScrollView>
        ) : (
          <>
            <FormScreenHeader
              title={invoice.invoiceNumber}
              subtitle={invoice.clientName}
              cancelLabel="Back"
              onCancel={goBack}
            />
            <ScrollView contentContainerClassName="px-4 pb-24 pt-2 gap-4">{mainContent}</ScrollView>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  bold,
  muted,
  danger,
  success,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
  danger?: boolean;
  success?: boolean;
}) {
  return (
    <View className="flex-row justify-between">
      <Text className={`text-sm ${muted ? 'text-muted' : 'text-text'} ${bold ? 'font-bold' : ''}`}>
        {label}
      </Text>
      <Text
        className={`text-sm ${bold ? 'font-bold' : ''} ${
          danger ? 'text-danger' : success ? 'text-success' : 'text-text'
        }`}
      >
        {value}
      </Text>
  </View>
  );
}

/** Indian tax-invoice line table (matches printed Tax Invoice billing columns). */
function TaxInvoiceLineTable({
  lines,
  useIgst,
}: {
  lines: InvoiceLineItem[];
  useIgst: boolean;
}) {
  const fmt = (n: number) =>
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const col = (width: number, label: string, align: 'left' | 'right' = 'left') => (
    <Text
      className={`text-[10px] font-bold text-white uppercase ${align === 'right' ? 'text-right' : ''}`}
      style={{ width }}
    >
      {label}
    </Text>
  );

  const IGST_W = {
    sr: 36,
    item: 200,
    hsn: 72,
    qty: 56,
    unit: 52,
    rate: 72,
    tPct: 52,
    tAmt: 80,
    amt: 88,
  } as const;
  const CGST_W = {
    sr: 36,
    item: 180,
    hsn: 72,
    qty: 52,
    unit: 48,
    rate: 68,
    cPct: 44,
    cAmt: 72,
    sPct: 44,
    sAmt: 72,
    amt: 88,
  } as const;

  const minWidth = useIgst
    ? IGST_W.sr + IGST_W.item + IGST_W.hsn + IGST_W.qty + IGST_W.unit + IGST_W.rate + IGST_W.tPct + IGST_W.tAmt + IGST_W.amt
    : CGST_W.sr + CGST_W.item + CGST_W.hsn + CGST_W.qty + CGST_W.unit + CGST_W.rate + CGST_W.cPct + CGST_W.cAmt + CGST_W.sPct + CGST_W.sAmt + CGST_W.amt;

  const cell = (
    width: number,
    text: string,
    opts?: { right?: boolean; bold?: boolean; muted?: boolean },
  ) => (
    <Text
      className={`text-[11px] ${opts?.bold ? 'font-semibold text-text' : opts?.muted ? 'text-muted' : 'text-text'} ${
        opts?.right ? 'text-right' : ''
      }`}
      style={{ width }}
      numberOfLines={2}
    >
      {text}
    </Text>
  );

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ minWidth }}>
      <View>
        {useIgst ? (
          <>
            <View className="flex-row items-center bg-primary px-2 py-2 gap-1">
              {col(IGST_W.sr, 'Sr')}
              {col(IGST_W.item, 'Item & Description')}
              {col(IGST_W.hsn, 'HSN/SAC')}
              {col(IGST_W.qty, 'Qty', 'right')}
              {col(IGST_W.unit, 'Units')}
              {col(IGST_W.rate, 'Rate', 'right')}
              {col(IGST_W.tPct, 'IGST %', 'right')}
              {col(IGST_W.tAmt, 'IGST Amt', 'right')}
              {col(IGST_W.amt, 'Amount', 'right')}
            </View>
            {lines.map((li, idx) => {
              const taxable = Number(li.amount) || Number(li.quantity) * Number(li.rate);
              const gstRate = Number(li.gstRate) || 0;
              const igstAmt = (taxable * gstRate) / 100;
              return (
                <View
                  key={li.id}
                  className={`flex-row items-start px-2 py-2.5 gap-1 border-b border-border ${
                    idx % 2 === 1 ? 'bg-surface' : 'bg-card'
                  }`}
                >
                  {cell(IGST_W.sr, String(idx + 1), { muted: true })}
                  {cell(IGST_W.item, li.description)}
                  {cell(IGST_W.hsn, li.hsnSacCode?.trim() || '—', { muted: true })}
                  {cell(IGST_W.qty, fmt(Number(li.quantity)), { right: true })}
                  {cell(IGST_W.unit, li.unit || '—')}
                  {cell(IGST_W.rate, fmt(Number(li.rate)), { right: true })}
                  {cell(IGST_W.tPct, gstRate ? String(gstRate) : '—', { right: true, muted: true })}
                  {cell(IGST_W.tAmt, fmt(igstAmt), { right: true })}
                  {cell(IGST_W.amt, fmt(taxable), { right: true, bold: true })}
                </View>
              );
            })}
          </>
        ) : (
          <>
            <View className="flex-row items-center bg-primary px-2 py-2 gap-1">
              {col(CGST_W.sr, 'Sr')}
              {col(CGST_W.item, 'Item & Description')}
              {col(CGST_W.hsn, 'HSN/SAC')}
              {col(CGST_W.qty, 'Qty', 'right')}
              {col(CGST_W.unit, 'Units')}
              {col(CGST_W.rate, 'Rate', 'right')}
              {col(CGST_W.cPct, 'CGST %', 'right')}
              {col(CGST_W.cAmt, 'CGST Amt', 'right')}
              {col(CGST_W.sPct, 'SGST %', 'right')}
              {col(CGST_W.sAmt, 'SGST Amt', 'right')}
              {col(CGST_W.amt, 'Amount', 'right')}
            </View>
            {lines.map((li, idx) => {
              const taxable = Number(li.amount) || Number(li.quantity) * Number(li.rate);
              const gstRate = Number(li.gstRate) || 0;
              const half = gstRate / 2;
              const cgstAmt = (taxable * half) / 100;
              const sgstAmt = (taxable * half) / 100;
              return (
                <View
                  key={li.id}
                  className={`flex-row items-start px-2 py-2.5 gap-1 border-b border-border ${
                    idx % 2 === 1 ? 'bg-surface' : 'bg-card'
                  }`}
                >
                  {cell(CGST_W.sr, String(idx + 1), { muted: true })}
                  {cell(CGST_W.item, li.description)}
                  {cell(CGST_W.hsn, li.hsnSacCode?.trim() || '—', { muted: true })}
                  {cell(CGST_W.qty, fmt(Number(li.quantity)), { right: true })}
                  {cell(CGST_W.unit, li.unit || '—')}
                  {cell(CGST_W.rate, fmt(Number(li.rate)), { right: true })}
                  {cell(CGST_W.cPct, gstRate ? String(half) : '—', { right: true, muted: true })}
                  {cell(CGST_W.cAmt, fmt(cgstAmt), { right: true })}
                  {cell(CGST_W.sPct, gstRate ? String(half) : '—', { right: true, muted: true })}
                  {cell(CGST_W.sAmt, fmt(sgstAmt), { right: true })}
                  {cell(CGST_W.amt, fmt(taxable), { right: true, bold: true })}
                </View>
              );
            })}
          </>
        )}
      </View>
    </ScrollView>
  );
}
