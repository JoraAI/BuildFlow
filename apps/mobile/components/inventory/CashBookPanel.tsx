/**
 * ICE_CREAM cash book + daily sales summary (Sales sub-tab).
 */
import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, Modal, Pressable, ScrollView } from 'react-native';
import { Button, Card, EmptyState, Input, LoadingSkeleton, Select, toast, useBusy } from '@/components/ui';
import { useViewport } from '@/hooks/useViewport';
import {
  useCashBookDay,
  useCreateCashBookEntry,
  useDailySalesSummary,
  useDeleteCashBookEntry,
  type CashBookEntry,
} from '@/services/ice-cream.queries';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CashBookPanel() {
  const { isPhone } = useViewport();
  const { busy, run } = useBusy();
  const [date, setDate] = useState(todayIso());
  const [entryOpen, setEntryOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const dayQ = useCashBookDay(date);
  const summaryQ = useDailySalesSummary(date, summaryOpen);
  const createEntry = useCreateCashBookEntry();
  const deleteEntry = useDeleteCashBookEntry();

  const entries: CashBookEntry[] = dayQ.data?.entries ?? [];

  const header = useMemo(
    () => (
      <View className="gap-3 mb-3">
        <View className={`flex-row flex-wrap gap-2 ${isPhone ? '' : 'items-end'}`}>
          <View className={isPhone ? 'w-full' : 'w-44'}>
            <Input label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
          </View>
          <Button label="Add entry" size="sm" variant="accent" onPress={() => setEntryOpen(true)} />
          <Button label="Daily summary" size="sm" variant="secondary" onPress={() => setSummaryOpen(true)} />
        </View>
        <View className="flex-row flex-wrap gap-2">
          <Stat label="Opening" value={dayQ.data?.opening} />
          <Stat label="In" value={dayQ.data?.inTotal} />
          <Stat label="Out" value={dayQ.data?.outTotal} />
          <Stat label="Closing" value={dayQ.data?.closing} />
        </View>
      </View>
    ),
    [date, dayQ.data, isPhone],
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
          data={entries}
          keyExtractor={(e) => e.id}
          ListHeaderComponent={header}
          ListEmptyComponent={<EmptyState title="No cash entries" description="Add opening, expense, or deposit for this day." />}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item }) => (
            <Card className="mb-2 p-3">
              <View className="flex-row justify-between gap-2">
                <View className="flex-1 min-w-0">
                  <Text className="text-sm font-semibold text-text" numberOfLines={2}>
                    {item.description}
                  </Text>
                  <Text className="text-[11px] text-muted mt-0.5">
                    {item.entryType.replace(/_/g, ' ')} · {item.paymentMode} · {item.direction}
                  </Text>
                </View>
                <View className="items-end">
                  <Text
                    className={`text-sm font-bold ${item.direction === 'IN' ? 'text-success' : 'text-danger'}`}
                  >
                    {item.direction === 'IN' ? '+' : '-'}₹{item.amount.toFixed(2)}
                  </Text>
                  {item.entryType !== 'SALE_COLLECTION' ? (
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
        onClose={() => setEntryOpen(false)}
        onSave={async (body) => {
          await run(async () => {
            await createEntry.mutateAsync(body);
            toast.success('Entry saved');
            setEntryOpen(false);
          });
        }}
      />

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

function CashEntryModal({
  open,
  date,
  busy,
  onClose,
  onSave,
}: {
  open: boolean;
  date: string;
  busy: boolean;
  onClose: () => void;
  onSave: (body: {
    entryDate: string;
    direction: 'IN' | 'OUT';
    entryType: 'OPENING' | 'EXPENSE' | 'DEPOSIT' | 'ADJUSTMENT';
    paymentMode: 'CASH' | 'UPI' | 'BANK' | 'OTHER';
    amount: number;
    description: string;
    reference?: string;
  }) => Promise<void>;
}) {
  const { isPhone } = useViewport();
  const [entryType, setEntryType] = useState<'OPENING' | 'EXPENSE' | 'DEPOSIT' | 'ADJUSTMENT'>('EXPENSE');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'BANK' | 'OTHER'>('CASH');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');

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
      });
      setAmount('');
      setDescription('');
      setReference('');
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
