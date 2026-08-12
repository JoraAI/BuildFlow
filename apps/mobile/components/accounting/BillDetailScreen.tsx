/**
 * Bill detail body - used by construction (/accounting/bill/[id])
 * and inventory (/inventory/bills/[id]) route wrappers.
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Pressable, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Badge, Button, Input, EmptyState, LoadingSkeleton, ProgressBar } from '@/components/ui';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { FormScreenHeader } from '@/components/layout/ScreenHeader';
import { useViewport } from '@/hooks/useViewport';
import { usePermission } from '@/hooks/usePermission';
import { navigateAppBack, parseReturnTo, projectTabHref } from '@/utils/navigation';
import { alertAsync } from '@/utils/confirm';
import { Linking } from 'react-native';
import {
  useBill,
  useApproveBill,
  useRecordBillPayment,
  usePayBill,
  type Bill,
} from '@/services/accounting.queries';
import { formatINR, formatDate } from '@/utils/format';

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'neutral'> = {
  DRAFT: 'neutral',
  PENDING: 'warning',
  APPROVED: 'primary',
  PAID: 'success',
  REJECTED: 'danger',
};

const CATEGORY_COLOR: Record<string, 'primary' | 'warning' | 'success' | 'danger' | 'neutral'> = {
  MATERIAL: 'primary',
  LABOUR: 'success',
  EQUIPMENT: 'warning',
  SUBCONTRACTOR: 'danger',
  OTHER: 'neutral',
};

const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  MATERIAL: 'cube-outline',
  LABOUR: 'people-outline',
  EQUIPMENT: 'construct-outline',
  SUBCONTRACTOR: 'briefcase-outline',
  OTHER: 'receipt-outline',
};

export function BillDetailScreen({
  fallbackBackHref,
  /** When true, never fall back to construction project tab paths. */
  inventoryMode = false,
}: {
  fallbackBackHref: string;
  inventoryMode?: boolean;
}) {
  const router = useRouter();
  const { isDesktop } = useViewport();
  // R10-B2: Replace role checks with granular permissions.
  const canApprove = usePermission('bill.approve');
  const canPay = usePermission('bill.record_payment');

  const { id, returnTo: returnToParam } = useLocalSearchParams<{ id: string; returnTo?: string }>();
  const returnTo = parseReturnTo(returnToParam);
  const { data: bill, isLoading } = useBill(id ?? '');
  // Build a project-based return path if returnTo wasn't passed (defensive fallback).
  const resolvedReturnTo =
    returnTo ??
    (inventoryMode
      ? fallbackBackHref
      : bill?.projectId
        ? projectTabHref(bill.projectId, 'bills')
        : null);
  const goBack = () => navigateAppBack(fallbackBackHref, resolvedReturnTo);
  const approveBill = useApproveBill();
  const recordPayment = useRecordBillPayment();
  const payBill = usePayBill();
  const [showPayment, setShowPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <OfflineBanner />
        <FormScreenHeader title="Bill" cancelLabel="Back" onCancel={goBack} />
        <View className="px-4 pt-4 gap-3">
          <LoadingSkeleton className="h-36 rounded-2xl" />
          <LoadingSkeleton className="h-48 rounded-2xl" />
        </View>
      </SafeAreaView>
    );
  }

  if (!bill) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <OfflineBanner />
        <FormScreenHeader title="Bill not found" cancelLabel="Back" onCancel={goBack} />
        <EmptyState title="Bill not found" description="This bill may have been deleted." />
      </SafeAreaView>
    );
  }

  const balanceDue = Math.max(0, bill.total - bill.paidAmount);
  const isFullyPaid = bill.paidAmount >= bill.total - 0.01;
  const paidPct = bill.total > 0 ? Math.min(100, Math.round((bill.paidAmount / bill.total) * 100)) : 0;
  const canRecordPay =
    canPay && (bill.status === 'APPROVED' || (bill.status === 'PAID' && balanceDue > 0.01));

  const onApprove = () => {
    approveBill.mutate(bill.id, {
      onSuccess: async () => await alertAsync('Approved', 'Bill approved for payment.'),
      onError: (e: Error) => void alertAsync('Error', e.message),
    });
  };

  const onRecordPayment = () => {
    setFormError(null);
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setFormError('Please enter a valid payment amount.');
      return;
    }
    if (amount > balanceDue + 0.01) {
      setFormError(`Amount cannot exceed balance due (${formatINR(balanceDue)}).`);
      return;
    }
    recordPayment.mutate(
      { id: bill.id, amount },
      {
        onSuccess: async () => {
          setShowPayment(false);
          setPaymentAmount('');
          await alertAsync('Success', 'Payment recorded successfully.');
        },
        onError: (e: Error) => {
          setFormError(e.message);
          void alertAsync('Error', e.message);
        },
      },
    );
  };

  const onPayFull = () => {
    payBill.mutate(bill.id, {
      onSuccess: async () => await alertAsync('Paid', 'Bill marked as fully paid.'),
      onError: (e: Error) => void alertAsync('Error', e.message),
    });
  };

  const heroCard = <BillHeroCard bill={bill} balanceDue={balanceDue} paidPct={paidPct} isFullyPaid={isFullyPaid} />;
  const metaCard = (
    <BillMetaCard
      bill={bill}
      onOpenWorkOrder={
        inventoryMode || !bill.workOrderId ? undefined : () => openWorkOrder(router, bill)
      }
    />
  );
  const breakdownCard = <BillBreakdownCard bill={bill} balanceDue={balanceDue} />;
  const actionsBlock = (
    <BillActions
      bill={bill}
      canApprove={canApprove}
      canRecordPay={canRecordPay}
      isFullyPaid={isFullyPaid}
      balanceDue={balanceDue}
      showPayment={showPayment}
      paymentAmount={paymentAmount}
      formError={formError}
      approvePending={approveBill.isPending}
      payPending={payBill.isPending}
      recordPending={recordPayment.isPending}
      onApprove={onApprove}
      onPayFull={onPayFull}
      onShowPayment={() => {
        setPaymentAmount(String(balanceDue));
        setShowPayment(true);
      }}
      onHidePayment={() => setShowPayment(false)}
      onPaymentAmountChange={setPaymentAmount}
      onRecordPayment={onRecordPayment}
    />
  );

  const body = (
    <View className="gap-4">
      {returnTo?.includes('subcontracts') && (
        <View className="flex-row items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
          <Ionicons name="arrow-back-circle-outline" size={18} color="#1E3A5F" />
          <Text className="text-xs text-primary flex-1">Opened from project Subcontracts - Back returns there</Text>
        </View>
      )}
      <BillContextBanner bill={bill} />
      {heroCard}
      {metaCard}
      {breakdownCard}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-surface min-h-0" edges={isDesktop ? [] : ['bottom']}>
      <OfflineBanner />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 min-h-0"
      >
        {isDesktop ? (
          <ScrollView
            className="flex-1 min-h-0"
            contentContainerClassName="items-center px-8 py-6 pb-32"
            showsVerticalScrollIndicator
          >
            <View className="w-full max-w-6xl">
              <FormScreenHeader
                title={bill.billNumber}
                subtitle={bill.vendorName}
                cancelLabel="Back"
                onCancel={goBack}
              />
              <View className="flex-row gap-6 items-start">
                <View className="flex-[2] min-w-0 gap-4">{body}</View>
                {/* FIX (UI-H3): Remove min-w so panes don't collapse at 768px */}
                <View className="flex-1 max-w-sm gap-4">{actionsBlock}</View>
              </View>
            </View>
          </ScrollView>
        ) : (
          <View className="flex-1 min-h-0">
            <FormScreenHeader
              title={bill.billNumber}
              subtitle={bill.vendorName}
              cancelLabel="Back"
              onCancel={goBack}
            />
            <ScrollView
              className="flex-1 min-h-0"
              style={Platform.OS === 'web' ? ({ overflow: 'scroll', flex: 1 } as ViewStyle) : { flex: 1 }}
              contentContainerClassName="px-4 pb-32 pt-2 gap-4"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {body}
              {actionsBlock}
            </ScrollView>
            {!showPayment && (canApprove || canRecordPay) && bill.status !== 'REJECTED' && !isFullyPaid && (
              <View className="px-4 pb-4 pt-3 bg-surface border-t border-border">
                <BillStickyActions
                  bill={bill}
                  canApprove={canApprove}
                  canRecordPay={canRecordPay}
                  isFullyPaid={isFullyPaid}
                  approvePending={approveBill.isPending}
                  onApprove={onApprove}
                  onShowPayment={() => {
                    setPaymentAmount(String(balanceDue));
                    setShowPayment(true);
                  }}
                />
              </View>
            )}
            {showPayment && (
              <View className="px-4 pb-4 pt-3 bg-surface border-t border-border">{actionsBlock}</View>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function openWorkOrder(router: ReturnType<typeof useRouter>, bill: Bill) {
  if (!bill.workOrderId || !bill.projectId) return;
  router.push(projectTabHref(bill.projectId, 'subcontracts') as never);
}

function BillContextBanner({ bill }: { bill: Bill }) {
  let message: string;
  if (bill.isRetentionRelease) {
    message = 'Retention release - final payment of withheld retention after the work order was completed.';
  } else if (bill.measurementId) {
    message = 'From subcontract measurement - created when a measurement sheet was approved. Approve here, then record payment.';
  } else {
    message = 'Vendor bill - recorded directly in Accounts (materials, labour, or other costs).';
  }

  return (
    <View className="px-3 py-2.5 rounded-xl bg-card border border-border">
      <Text className="text-xs text-muted leading-4">{message}</Text>
    </View>
  );
}

function BillHeroCard({
  bill,
  balanceDue,
  paidPct,
  isFullyPaid,
}: {
  bill: Bill;
  balanceDue: number;
  paidPct: number;
  isFullyPaid: boolean;
}) {
  const icon = CATEGORY_ICON[bill.category] ?? 'receipt-outline';
  const headline = isFullyPaid ? 'Fully paid' : bill.status === 'PENDING' ? 'Awaiting approval' : 'Balance due';
  const headlineAmount = isFullyPaid ? bill.total : bill.status === 'PENDING' ? bill.total : balanceDue;

  return (
    <Card className="overflow-hidden p-0">
      <View className="bg-primary px-4 py-5">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-row items-center gap-3 flex-1">
            <View className="w-11 h-11 rounded-xl bg-white/15 items-center justify-center">
              <Ionicons name={icon} size={22} color="#F59E0B" />
            </View>
            <View className="flex-1">
              <Text className="text-white/70 text-xs font-medium uppercase tracking-wide">{headline}</Text>
              <Text className="text-white text-3xl font-bold mt-0.5">{formatINR(headlineAmount)}</Text>
            </View>
          </View>
          <Badge color={STATUS_COLOR[bill.status] ?? 'neutral'} label={bill.status} />
        </View>
        {bill.paidAmount > 0 && (
          <View className="mt-4">
            <View className="flex-row justify-between mb-1.5">
              <Text className="text-white/70 text-xs">Paid {formatINR(bill.paidAmount)}</Text>
              <Text className="text-white/70 text-xs">{paidPct}%</Text>
            </View>
            <ProgressBar value={paidPct} color="#F59E0B" height={6} />
          </View>
        )}
      </View>
      <View className="px-4 py-3 flex-row flex-wrap gap-2 bg-card">
        <Badge color={CATEGORY_COLOR[bill.category] ?? 'neutral'} label={bill.category} />
        {bill.isRetentionRelease && <Badge color="warning" label="Retention release" />}
        {bill.measurementId && <Badge color="neutral" label="From measurement" />}
      </View>
    </Card>
  );
}

function BillMetaCard({
  bill,
  onOpenWorkOrder,
}: {
  bill: Bill;
  onOpenWorkOrder?: () => void;
}) {
  return (
    <Card>
      <Text className="text-xs font-bold text-muted uppercase tracking-wide mb-3">Bill details</Text>
      <View className="gap-3">
        <MetaRow icon="document-text-outline" label="Bill number" value={bill.billNumber} mono />
        <MetaRow icon="business-outline" label="Vendor" value={bill.vendorName} />
        {bill.vendorGstin ? (
          <MetaRow icon="finger-print-outline" label="Vendor GSTIN" value={bill.vendorGstin} mono />
        ) : null}
        <MetaRow icon="calendar-outline" label="Bill date" value={formatDate(bill.billDate)} />
        {bill.dueDate ? <MetaRow icon="time-outline" label="Due date" value={formatDate(bill.dueDate)} /> : null}
        {bill.paidAt ? (
          <MetaRow icon="checkmark-circle-outline" label="Last paid" value={formatDate(bill.paidAt)} success />
        ) : null}
        {bill.workOrderId && onOpenWorkOrder ? (
          <Pressable
            onPress={onOpenWorkOrder}
            className="flex-row items-center justify-between py-2 px-3 rounded-xl bg-primary/5 border border-primary/20 active:opacity-80"
          >
            <View className="flex-row items-center gap-2">
              <Ionicons name="link-outline" size={18} color="#1E3A5F" />
              <Text className="text-sm font-medium text-primary">View linked work order</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#1E3A5F" />
          </Pressable>
        ) : null}
        {/* R10-B4: Show "View supplier invoice" when attachment is present. */}
        {bill.attachmentUrl ? (
          <Pressable
            onPress={() => {
              const url = bill.attachmentUrl!;
              // bfstore:// is the in-app storage scheme; otherwise open externally.
              if (url.startsWith('bfstore://')) {
                void alertAsync('Attachment', 'Open the supplier invoice from the file store.');
              } else {
                void Linking.openURL(url).catch(() =>
                  void alertAsync('Error', 'Could not open attachment.'),
                );
              }
            }}
            className="flex-row items-center justify-between py-2 px-3 rounded-xl bg-primary/5 border border-primary/20 active:opacity-80"
          >
            <View className="flex-row items-center gap-2">
              <Ionicons name="document-attach-outline" size={18} color="#1E3A5F" />
              <Text className="text-sm font-medium text-primary">View supplier invoice</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#1E3A5F" />
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

function BillBreakdownCard({ bill, balanceDue }: { bill: Bill; balanceDue: number }) {
  const hasDeductions =
    bill.retentionAmount > 0 || bill.advanceRecoveryAmount > 0 || bill.tdsAmount > 0;

  return (
    <Card>
      <Text className="text-xs font-bold text-muted uppercase tracking-wide mb-3">Amount breakdown</Text>
      <View className="gap-2">
        <AmountRow label="Gross (subtotal)" value={formatINR(bill.subtotal)} />
        {bill.gstAmount > 0 && <AmountRow label="GST" value={formatINR(bill.gstAmount)} muted />}
      </View>
      {hasDeductions && (
        <>
          <View className="h-px bg-border my-3" />
          <Text className="text-xs font-semibold text-muted mb-2">Deductions</Text>
          <View className="gap-2">
            {bill.retentionAmount > 0 && (
              <AmountRow label="Retention held" value={`- ${formatINR(bill.retentionAmount)}`} danger />
            )}
            {bill.advanceRecoveryAmount > 0 && (
              <AmountRow label="Advance recovery" value={`- ${formatINR(bill.advanceRecoveryAmount)}`} danger />
            )}
            {bill.tdsAmount > 0 && (
              <AmountRow label={`TDS (${bill.tdsRate}%)`} value={`- ${formatINR(bill.tdsAmount)}`} danger />
            )}
          </View>
        </>
      )}
      <View className="h-px bg-border my-3" />
      <AmountRow label="Net payable" value={formatINR(bill.total)} bold />
      {bill.paidAmount > 0 && (
        <>
          <View className="mt-2 gap-2">
            <AmountRow label="Paid to date" value={formatINR(bill.paidAmount)} success />
            <AmountRow
              label="Balance due"
              value={formatINR(balanceDue)}
              bold
              danger={balanceDue > 0.01}
            />
          </View>
        </>
      )}
    </Card>
  );
}

function BillActions({
  bill,
  canApprove,
  canRecordPay,
  isFullyPaid,
  balanceDue,
  showPayment,
  paymentAmount,
  formError,
  approvePending,
  payPending,
  recordPending,
  onApprove,
  onPayFull,
  onShowPayment,
  onHidePayment,
  onPaymentAmountChange,
  onRecordPayment,
}: {
  bill: Bill;
  canApprove: boolean;
  canRecordPay: boolean;
  isFullyPaid: boolean;
  balanceDue: number;
  showPayment: boolean;
  paymentAmount: string;
  formError: string | null;
  approvePending: boolean;
  payPending: boolean;
  recordPending: boolean;
  onApprove: () => void;
  onPayFull: () => void;
  onShowPayment: () => void;
  onHidePayment: () => void;
  onPaymentAmountChange: (v: string) => void;
  onRecordPayment: () => void;
}) {
  if (bill.status === 'REJECTED') {
    return (
      <Card className="border-danger/30 bg-danger/5">
        <Text className="text-sm text-danger font-medium">This bill was rejected and cannot be paid.</Text>
      </Card>
    );
  }

  if (isFullyPaid) {
    return (
      <Card className="border-success/30 bg-success/5">
        <View className="flex-row items-center gap-2">
          <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
          <Text className="text-sm text-success font-semibold">This bill is fully paid.</Text>
        </View>
      </Card>
    );
  }

  return (
    <View className="gap-3">
      <Text className="text-xs font-bold text-muted uppercase tracking-wide">Actions</Text>
      {canApprove && (bill.status === 'PENDING' || bill.status === 'DRAFT') && (
        <Button
          label={bill.status === 'DRAFT' ? 'Confirm draft bill' : 'Approve for payment'}
          onPress={onApprove}
          loading={approvePending}
        />
      )}
      {canRecordPay && !showPayment && (
        <>
          <Button label={`Pay full ${formatINR(balanceDue)}`} onPress={onPayFull} loading={payPending} />
          <Button label="Record partial payment" variant="secondary" onPress={onShowPayment} />
        </>
      )}
      {showPayment && (
        <Card className="border-primary/20">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm font-bold text-text">Record payment</Text>
            <Pressable onPress={onHidePayment} hitSlop={8}>
              <Ionicons name="close" size={20} color="#64748B" />
            </Pressable>
          </View>
          <Text className="text-xs text-muted mb-3">
            Balance due: {formatINR(balanceDue)}
          </Text>
          {formError ? (
            <View className="mb-3 px-3 py-2 rounded-lg bg-danger/10 border border-danger/30">
              <Text className="text-sm text-danger">{formError}</Text>
            </View>
          ) : null}
          <Input
            label="Payment amount (₹)"
            value={paymentAmount}
            onChangeText={onPaymentAmountChange}
            keyboardType="numeric"
            placeholder={String(balanceDue)}
          />
          <View className="flex-row gap-2 mt-3">
            <View className="flex-1">
              <Button label="Confirm" onPress={onRecordPayment} loading={recordPending} />
            </View>
            <View className="flex-1">
              <Button label="Cancel" variant="ghost" onPress={onHidePayment} />
            </View>
          </View>
        </Card>
      )}
    </View>
  );
}

function BillStickyActions({
  bill,
  canApprove,
  canRecordPay,
  isFullyPaid,
  approvePending,
  onApprove,
  onShowPayment,
}: {
  bill: Bill;
  canApprove: boolean;
  canRecordPay: boolean;
  isFullyPaid: boolean;
  approvePending: boolean;
  onApprove: () => void;
  onShowPayment: () => void;
}) {
  if (isFullyPaid) return null;

  if (canApprove && (bill.status === 'PENDING' || bill.status === 'DRAFT')) {
    return (
      <Button
        label={bill.status === 'DRAFT' ? 'Confirm draft' : 'Approve bill'}
        onPress={onApprove}
        loading={approvePending}
      />
    );
  }

  if (canRecordPay) {
    return (
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button label="Record payment" onPress={onShowPayment} />
        </View>
      </View>
    );
  }

  return null;
}

function MetaRow({
  icon,
  label,
  value,
  mono,
  success,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  mono?: boolean;
  success?: boolean;
}) {
  return (
    <View className="flex-row items-start gap-3">
      <Ionicons name={icon} size={18} color="#94A3B8" style={{ marginTop: 2 }} />
      <View className="flex-1">
        <Text className="text-xs text-muted">{label}</Text>
        <Text
          className={`text-sm mt-0.5 ${mono ? 'font-mono' : ''} ${success ? 'text-success font-semibold' : 'text-text font-medium'}`}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function AmountRow({
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
    <View className="flex-row justify-between items-center py-0.5">
      <Text className={`text-sm ${muted ? 'text-muted' : 'text-text'} ${bold ? 'font-bold' : ''}`}>{label}</Text>
      <Text
        className={`text-sm ${bold ? 'font-bold text-base' : ''} ${
          danger ? 'text-danger' : success ? 'text-success' : 'text-text'
        }`}
      >
        {value}
      </Text>
    </View>
  );
}
