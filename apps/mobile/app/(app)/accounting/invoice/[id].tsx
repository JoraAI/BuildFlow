/**
 * BuildFlow — Invoice Detail
 * Route: /accounting/invoice/[id]
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Card, Badge, Button, Input, EmptyState, LoadingSkeleton } from '@/components/ui';
import { OfflineBanner } from '@/components/common/OfflineBanner';
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
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: invoice, isLoading } = useInvoice(id);
  const sendInvoice = useSendInvoice();
  const recordPayment = useRecordPayment();
  const [showPayment, setShowPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <OfflineBanner />
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
        <EmptyState title="Invoice not found" description="This invoice may have been deleted." />
      </SafeAreaView>
    );
  }

  const balanceDue = invoice.total - invoice.paidAmount;
  const isFullyPaid = invoice.paidAmount >= invoice.total;

  const onSend = () => {
    Alert.alert(
      'Send Invoice',
      `Mark invoice ${invoice.invoiceNumber} as sent?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', onPress: () => sendInvoice.mutate(invoice.id) },
      ],
    );
  };

  const onRecordPayment = () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid payment amount.');
      return;
    }
    recordPayment.mutate(
      { id: invoice.id, amount },
      {
        onSuccess: () => {
          setShowPayment(false);
          setPaymentAmount('');
          Alert.alert('Success', 'Payment recorded successfully.');
        },
      },
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <OfflineBanner />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView contentContainerClassName="px-4 pb-24 pt-4 gap-4">
          {/* Back */}
          <Pressable onPress={() => router.back()}>
            <Text className="text-primary text-base font-medium">‹ Back</Text>
          </Pressable>

          {/* Header */}
          <Card>
            <View className="flex-row justify-between items-start mb-3">
              <View className="flex-1 mr-2">
                <Text className="text-xl font-bold text-text font-mono">{invoice.invoiceNumber}</Text>
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

          {/* Line items */}
          {invoice.lineItems && invoice.lineItems.length > 0 && (
            <Card>
              <Text className="text-sm font-bold text-text mb-2">Line Items</Text>
              {invoice.lineItems.map((li: InvoiceLineItem, idx: number) => (
                <View key={li.id} className="flex-row justify-between py-2 border-b border-border">
                  <View className="flex-1 mr-2">
                    <Text className="text-sm text-text">{li.description}</Text>
                    <Text className="text-xs text-muted">
                      {li.quantity} {li.unit} × {formatINR(li.rate)}
                    </Text>
                  </View>
                  <Text className="text-sm font-semibold text-text">{formatINR(li.amount)}</Text>
                </View>
              ))}
            </Card>
          )}

          {/* Totals */}
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

          {invoice.notes && (
            <Card>
              <Text className="text-xs text-muted mb-1">Notes</Text>
              <Text className="text-sm text-text">{invoice.notes}</Text>
            </Card>
          )}

          {/* Actions */}
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
                <Input
                  label="Amount (Rs)"
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                  keyboardType="numeric"
                  placeholder={balanceDue.toString()}
                />
                <View className="flex-row gap-2 mt-2">
                  <View className="flex-1">
                    <Button
                      label={recordPayment.isPending ? 'Saving...' : 'Confirm'}
                      variant="primary"
                      onPress={onRecordPayment}
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
        </ScrollView>
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
