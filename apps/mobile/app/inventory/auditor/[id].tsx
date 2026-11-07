/**
 * Auditor pack workspace — Bank, Quotes, Journals, GST + manual entries.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import {
  useAddAuditorManualEntry,
  useAuditorPack,
  useUpdateAuditorPackStatus,
  type GstPackDetail,
} from '@/services/auditor.queries';
import { useViewport } from '@/hooks/useViewport';
import { Button, toast } from '@/components/ui';

const TABS = ['Bank', 'Quotes', 'Journals', 'GST', 'Manual'] as const;

function inr(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export default function AuditorPackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const packId = typeof id === 'string' ? id : id?.[0];
  const { data, isLoading, refetch } = useAuditorPack(packId);
  const updateStatus = useUpdateAuditorPackStatus(packId ?? '');
  const addEntry = useAddAuditorManualEntry(packId ?? '');
  const { isDesktop } = useViewport();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Bank');
  const [narration, setNarration] = useState('');
  const [amount, setAmount] = useState('');
  const [entryType, setEntryType] = useState<'JOURNAL' | 'BANK_NOTE' | 'GST_NOTE'>('GST_NOTE');

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  if (isLoading || !data) {
    return (
      <View className="flex-1 bg-bg items-center justify-center p-6">
        <Text className="text-muted">{isLoading ? 'Loading pack…' : 'Pack not found'}</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-primary font-semibold">Back</Text>
        </Pressable>
      </View>
    );
  }

  const onMark = async (status: 'IN_PROGRESS' | 'FILED') => {
    try {
      await updateStatus.mutateAsync(status);
      toast.success(status === 'FILED' ? 'Marked filed' : 'Marked in progress');
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update status');
    }
  };

  const onAddManual = async () => {
    if (narration.trim().length < 2) {
      toast.error('Enter a short narration');
      return;
    }
    try {
      await addEntry.mutateAsync({
        entryType,
        entryDate: today,
        amount: amount.trim() ? Number(amount) : null,
        narration: narration.trim(),
      });
      setNarration('');
      setAmount('');
      toast.success('Manual entry saved');
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save entry');
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ padding: isDesktop ? 24 : 16, paddingBottom: 64 }}
    >
      <Pressable onPress={() => router.back()} className="mb-3 self-start">
        <Text className="text-primary text-sm font-semibold">← Inbox</Text>
      </Pressable>

      <View className={isDesktop ? 'flex-row gap-6' : ''}>
        <View className={isDesktop ? 'w-[32%]' : 'mb-4'}>
          <Text className="text-2xl font-bold text-text">{data.label}</Text>
          <Text className="text-sm text-muted mt-1">
            {data.periodStart} → {data.periodEnd} · {data.status}
          </Text>
          {data.notes ? <Text className="text-sm text-text mt-2">{data.notes}</Text> : null}
          <View className="flex-row flex-wrap gap-2 mt-4">
            {data.status !== 'FILED' ? (
              <Button
                label="Mark in progress"
                variant="secondary"
                onPress={() => onMark('IN_PROGRESS')}
                loading={updateStatus.isPending}
              />
            ) : null}
            {data.status !== 'FILED' ? (
              <Button label="Mark filed" onPress={() => onMark('FILED')} loading={updateStatus.isPending} />
            ) : null}
          </View>
          <View className="mt-4 bg-card border border-border rounded-2xl p-3">
            <Text className="text-xs text-muted">Bank total</Text>
            <Text className="text-lg font-bold text-text">{inr(data.bankTotal)}</Text>
            <Text className="text-xs text-muted mt-2">GST out (invoices)</Text>
            <Text className="text-base font-semibold text-text">{inr(data.gst.invoiceGst)}</Text>
            <Text className="text-xs text-muted mt-2">GST in (bills)</Text>
            <Text className="text-base font-semibold text-text">{inr(data.gst.billGst)}</Text>
          </View>
        </View>

        <View className={isDesktop ? 'flex-1' : ''}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
            <View className="flex-row gap-2">
              {TABS.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setTab(t)}
                  className={`px-3 py-2 rounded-full border ${
                    tab === t ? 'bg-primary border-primary' : 'bg-card border-border'
                  }`}
                >
                  <Text className={`text-sm font-semibold ${tab === t ? 'text-white' : 'text-text'}`}>
                    {t}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {tab === 'Bank' ? (
            <View className="gap-2">
              {data.bank.length === 0 ? (
                <Text className="text-sm text-muted">No cash-book rows in this period.</Text>
              ) : (
                data.bank.map((row: GstPackDetail['bank'][number]) => (
                  <View key={row.id} className="bg-card border border-border rounded-xl p-3">
                    <Text className="text-sm font-semibold text-text">
                      {row.paymentMode} · {inr(row.amount)}
                    </Text>
                    <Text className="text-xs text-muted">
                      {row.entryDate} · {row.direction} · {row.entryType}
                    </Text>
                    <Text className="text-sm text-text mt-1">{row.description}</Text>
                  </View>
                ))
              )}
            </View>
          ) : null}

          {tab === 'Quotes' ? (
            <View className="gap-2">
              {data.quotes.length === 0 ? (
                <Text className="text-sm text-muted">No quotes in this period.</Text>
              ) : (
                data.quotes.map((q: GstPackDetail['quotes'][number]) => (
                  <View key={q.id} className="bg-card border border-border rounded-xl p-3">
                    <Text className="text-sm font-semibold text-text">
                      {q.quoteNumber} · {inr(q.total)}
                    </Text>
                    <Text className="text-xs text-muted">
                      {q.quoteDate} · {q.status} · {q.customerName}
                    </Text>
                  </View>
                ))
              )}
            </View>
          ) : null}

          {tab === 'Journals' ? (
            <View className="gap-2">
              {data.journals.length === 0 ? (
                <Text className="text-sm text-muted">No journal entries in this period.</Text>
              ) : (
                data.journals.map((j: GstPackDetail['journals'][number]) => (
                  <View key={j.id} className="bg-card border border-border rounded-xl p-3">
                    <Text className="text-sm font-semibold text-text">{inr(j.amount)}</Text>
                    <Text className="text-xs text-muted">
                      {j.entryDate} · {j.debitAccount} → {j.creditAccount}
                    </Text>
                    {j.description ? <Text className="text-sm text-text mt-1">{j.description}</Text> : null}
                  </View>
                ))
              )}
            </View>
          ) : null}

          {tab === 'GST' ? (
            <View className="gap-3">
              <View className="bg-card border border-border rounded-xl p-3">
                <Text className="text-sm font-bold text-text mb-2">Summary</Text>
                <Text className="text-xs text-muted">
                  Invoices {data.gst.invoiceCount} · Bills {data.gst.billCount}
                </Text>
                <Text className="text-sm text-text mt-1">
                  Taxable {inr(data.gst.invoiceTaxable)} · CGST {inr(data.gst.invoiceCgst)} · SGST{' '}
                  {inr(data.gst.invoiceSgst)} · IGST {inr(data.gst.invoiceIgst)}
                </Text>
              </View>
              {data.gst.invoices.map((i: GstPackDetail['gst']['invoices'][number]) => (
                <View key={i.id} className="bg-card border border-border rounded-xl p-3">
                  <Text className="text-sm font-semibold text-text">
                    Inv {i.number} · {inr(i.total)}
                  </Text>
                  <Text className="text-xs text-muted">
                    {i.date} · tax {inr(i.taxable)} · C/S/I {inr(i.cgst)}/{inr(i.sgst)}/{inr(i.igst)}
                  </Text>
                </View>
              ))}
              {data.gst.bills.map((b: GstPackDetail['gst']['bills'][number]) => (
                <View key={b.id} className="bg-card border border-border rounded-xl p-3">
                  <Text className="text-sm font-semibold text-text">
                    Bill {b.number} · {inr(b.total)}
                  </Text>
                  <Text className="text-xs text-muted">
                    {b.date} · GST {inr(b.gst)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {tab === 'Manual' ? (
            <View className="gap-3">
              <View className="bg-card border border-border rounded-2xl p-4">
                <Text className="text-sm font-bold text-text mb-2">Add auditor entry</Text>
                <View className="flex-row flex-wrap gap-2 mb-3">
                  {(['GST_NOTE', 'BANK_NOTE', 'JOURNAL'] as const).map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => setEntryType(t)}
                      className={`px-3 py-1.5 rounded-full border ${
                        entryType === t ? 'bg-primary border-primary' : 'border-border'
                      }`}
                    >
                      <Text className={`text-xs font-semibold ${entryType === t ? 'text-white' : 'text-text'}`}>
                        {t.replace('_', ' ')}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  value={narration}
                  onChangeText={setNarration}
                  placeholder="Narration / filing note"
                  className="border border-border rounded-xl px-3 py-2 text-text mb-2 bg-bg"
                />
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="Amount (optional)"
                  keyboardType="decimal-pad"
                  className="border border-border rounded-xl px-3 py-2 text-text mb-3 bg-bg"
                />
                <Button label="Save entry" onPress={onAddManual} loading={addEntry.isPending} fullWidth />
              </View>
              {data.manualEntries.map((m: GstPackDetail['manualEntries'][number]) => (
                <View key={m.id} className="bg-card border border-border rounded-xl p-3">
                  <Text className="text-sm font-semibold text-text">
                    {m.entryType.replace('_', ' ')}
                    {m.amount != null ? ` · ${inr(m.amount)}` : ''}
                  </Text>
                  <Text className="text-xs text-muted">
                    {m.entryDate} · {m.createdByName}
                  </Text>
                  <Text className="text-sm text-text mt-1">{m.narration}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}
