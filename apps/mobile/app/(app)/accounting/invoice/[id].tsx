/**
 * BuildFlow - Invoice Detail
 * Route: /accounting/invoice/[id]
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Card, Badge, Button, Input, EmptyState, LoadingSkeleton } from '@/components/ui';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { FormScreenHeader } from '@/components/layout/ScreenHeader';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { useViewport } from '@/hooks/useViewport';
import { navigateAppBack, parseReturnTo, DISMISS } from '@/utils/navigation';
import { alertAsync, confirmAsync } from '@/utils/confirm';
import {
  useInvoice,
  useSendInvoice,
  useRecordPayment,
  type InvoiceLineItem,
} from '@/services/accounting.queries';
import { formatINR, formatDate } from '@/utils/format';

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'neutral'> = {
  DRAFT: 'neutral',
  SENT: 'primary',
  PAID: 'success',
  OVERDUE: 'danger',
};

export default function InvoiceDetailScreen() {
  const { isDesktop } = useViewport();
  const { id, returnTo: returnToParam } = useLocalSearchParams<{ id: string; returnTo?: string }>();
  const returnTo = parseReturnTo(returnToParam);
  const goBack = () => navigateAppBack(DISMISS.accounting, returnTo);
  const { data: invoice, isLoading } = useInvoice(id);
  const sendInvoice = useSendInvoice();
  const recordPayment = useRecordPayment();
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
    const ok = await confirmAsync(
      'Send Invoice',
      `Mark invoice ${invoice.invoiceNumber} as sent?`,
    );
    if (!ok) return;
    sendInvoice.mutate(invoice.id, {
      onError: async (e: Error) => alertAsync('Error', e.message),
    });
  };

  const onRecordPayment = () => {
    setFormError(null);
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setFormError('Please enter a valid payment amount.');
      return;
    }
    recordPayment.mutate(
      { id: invoice.id, amount },
      {
        onSuccess: async () => {
          setShowPayment(false);
          setPaymentAmount('');
          setFormError(null);
          await alertAsync('Success', 'Payment recorded successfully.');
        },
        onError: async (e: Error) => {
          setFormError(e.message);
          await alertAsync('Error', e.message);
        },
      },
    );
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
      {invoice.status === 'DRAFT' && (
        <Button
          label={sendInvoice.isPending ? 'Sending...' : 'Send Invoice'}
          variant="primary"
          onPress={onSend}
          disabled={sendInvoice.isPending}
        />
      )}

      {!isFullyPaid && invoice.status !== 'DRAFT' && !showPayment && (
        <Button
          label="Record Payment"
          variant="secondary"
          onPress={() => {
            setPaymentAmount(balanceDue.toString());
            setShowPayment(true);
          }}
        />
      )}

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
            {invoice.clientGstin && (
              <Text className="text-xs text-muted font-mono">GSTIN: {invoice.clientGstin}</Text>
            )}
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
        <Card>
          <Text className="text-sm font-bold text-text mb-2">Line Items</Text>
          {isDesktop && (
            <View className="flex-row py-2 border-b border-border mb-1">
              <Text className="flex-1 text-xs font-semibold text-muted uppercase">Description</Text>
              <Text className="w-28 text-xs font-semibold text-muted uppercase text-right">Qty</Text>
              <Text className="w-32 text-xs font-semibold text-muted uppercase text-right">Amount</Text>
            </View>
          )}
          {invoice.lineItems.map((li: InvoiceLineItem) => (
            <View
              key={li.id}
              className={`py-2 border-b border-border ${isDesktop ? 'flex-row items-center' : 'flex-row justify-between'}`}
            >
              <View className="flex-1 mr-2">
                <Text className="text-sm text-text">{li.description}</Text>
                {!isDesktop && (
                  <Text className="text-xs text-muted">
                    {li.quantity} {li.unit} × {formatINR(li.rate)}
                  </Text>
                )}
              </View>
              {isDesktop && (
                <Text className="w-28 text-xs text-muted text-right">
                  {li.quantity} {li.unit} × {formatINR(li.rate)}
                </Text>
              )}
              <Text className={`text-sm font-semibold text-text ${isDesktop ? 'w-32 text-right' : ''}`}>
                {formatINR(li.amount)}
              </Text>
            </View>
          ))}
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
              <View className="flex-1 max-w-sm min-w-[280px] gap-4">
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
