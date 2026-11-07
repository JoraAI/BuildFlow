/**
 * Auditor pack workspace — Summary, Sales, Purchases, HSN, Bank, Journals, Notes.
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
import { useAuthStore } from '@/stores/auth.store';
import { useViewport } from '@/hooks/useViewport';
import { Button, toast } from '@/components/ui';

function inr(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export default function AuditorPackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const packId = typeof id === 'string' ? id : id?.[0];
  const { data, isLoading, refetch } = useAuditorPack(packId);
  const updateStatus = useUpdateAuditorPackStatus(packId ?? '');
  const addEntry = useAddAuditorManualEntry(packId ?? '');
  const user = useAuthStore((s) => s.user);
  const switchCompany = useAuthStore((s) => s.switchCompany);
  const memberships = user?.auditorMemberships ?? [];
  const { isDesktop } = useViewport();
  const [tab, setTab] = useState<string>('Summary');
  const [narration, setNarration] = useState('');
  const [amount, setAmount] = useState('');
  const [entryType, setEntryType] = useState<'JOURNAL' | 'BANK_NOTE' | 'GST_NOTE'>('GST_NOTE');
  const [switching, setSwitching] = useState(false);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const onSwitchShop = async (companyId: string) => {
    if (companyId === user?.companyId) return;
    setSwitching(true);
    try {
      await switchCompany(companyId);
      toast.success('Switched shop');
      router.replace('/inventory/auditor');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not switch shop');
    } finally {
      setSwitching(false);
    }
  };

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

  const gst = data.gst;
  const taxCode = data.taxCode ?? { short: 'HSN/SAC', field: 'HSN/SAC code', missing: 'Missing HSN/SAC' };
  const tabs = ['Summary', 'Sales', 'Purchases', taxCode.short, 'Bank', 'Journals', 'Notes'] as const;

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ padding: isDesktop ? 24 : 16, paddingBottom: 64 }}
    >
      <Pressable onPress={() => router.back()} className="mb-3 self-start">
        <Text className="text-primary text-sm font-semibold">← Inbox</Text>
      </Pressable>

      {memberships.length > 1 ? (
        <View className="flex-row flex-wrap gap-2 mb-4">
          {memberships.map((m) => {
            const active = m.companyId === user?.companyId;
            return (
              <Pressable
                key={m.companyId}
                disabled={switching || active}
                onPress={() => onSwitchShop(m.companyId)}
                className={`px-2.5 py-1.5 rounded-lg border ${
                  active ? 'bg-primary border-primary' : 'bg-card border-border'
                }`}
              >
                <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-text'}`}>
                  {m.companyName}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View className={isDesktop ? 'flex-row gap-6' : ''}>
        <View className={isDesktop ? 'w-[32%]' : 'mb-4'}>
          <Text className="text-xs text-muted">{user?.companyName}</Text>
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
          <View className="mt-4 bg-card border border-border rounded-2xl p-3 gap-1">
            <Text className="text-xs text-muted">Outward GST</Text>
            <Text className="text-base font-semibold text-text">{inr(gst.invoiceGst)}</Text>
            <Text className="text-xs text-muted mt-2">Inward GST</Text>
            <Text className="text-base font-semibold text-text">{inr(gst.billGst)}</Text>
            <Text className="text-xs text-muted mt-2">B2B / B2C</Text>
            <Text className="text-sm font-semibold text-text">
              {gst.b2bCount ?? 0} / {gst.b2cCount ?? 0}
            </Text>
            {(gst.missingHsnLines ?? 0) > 0 ? (
              <Text className="text-xs text-warning mt-2">
                {gst.missingHsnLines} lines {taxCode.missing.toLowerCase()}
              </Text>
            ) : null}
          </View>
        </View>

        <View className={isDesktop ? 'flex-1' : ''}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
            <View className="flex-row gap-2">
              {tabs.map((t) => (
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

          {tab === 'Summary' ? (
            <View className="gap-2">
              <View className="bg-card border border-border rounded-xl p-3">
                <Text className="text-sm font-bold text-text mb-1">GST overview</Text>
                <Text className="text-xs text-muted">
                  Invoices {gst.invoiceCount} · Bills {gst.billCount}
                </Text>
                <Text className="text-sm text-text mt-1">
                  Taxable {inr(gst.invoiceTaxable)} · CGST {inr(gst.invoiceCgst)} · SGST{' '}
                  {inr(gst.invoiceSgst)} · IGST {inr(gst.invoiceIgst)}
                </Text>
                <Text className="text-sm text-text mt-1">Bank total {inr(data.bankTotal)}</Text>
              </View>
              {(gst.rateWise ?? []).map((r) => (
                <View key={r.rate} className="bg-card border border-border rounded-xl p-3">
                  <Text className="text-sm font-semibold text-text">{r.rate}% · {r.count} lines</Text>
                  <Text className="text-xs text-muted">
                    Taxable {inr(r.taxable)} · Tax {inr(r.tax)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {tab === 'Sales' ? (
            <View className="gap-2">
              {gst.invoices.length === 0 ? (
                <Text className="text-sm text-muted">No sales invoices in this period.</Text>
              ) : (
                gst.invoices.map((i: GstPackDetail['gst']['invoices'][number]) => (
                  <View key={i.id} className="bg-card border border-border rounded-xl p-3">
                    <Text className="text-sm font-semibold text-text">
                      {i.number} · {inr(i.total)}
                      {i.bucket ? ` · ${i.bucket}` : ''}
                    </Text>
                    <Text className="text-xs text-muted">
                      {i.date}
                      {i.clientName ? ` · ${i.clientName}` : ''}
                      {i.clientGstin ? ` · ${i.clientGstin}` : ''}
                    </Text>
                    <Text className="text-xs text-muted mt-1">
                      Taxable {inr(i.taxable)} · C/S/I {inr(i.cgst)}/{inr(i.sgst)}/{inr(i.igst)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          ) : null}

          {tab === 'Purchases' ? (
            <View className="gap-2">
              {gst.bills.length === 0 ? (
                <Text className="text-sm text-muted">No purchase bills in this period.</Text>
              ) : (
                gst.bills.map((b: GstPackDetail['gst']['bills'][number]) => (
                  <View key={b.id} className="bg-card border border-border rounded-xl p-3">
                    <Text className="text-sm font-semibold text-text">
                      {b.number} · {inr(b.total)}
                    </Text>
                    <Text className="text-xs text-muted">
                      {b.date}
                      {b.vendorName ? ` · ${b.vendorName}` : ''}
                      {b.vendorGstin ? ` · ${b.vendorGstin}` : ''}
                    </Text>
                    <Text className="text-xs text-muted mt-1">
                      Taxable {inr(b.taxable ?? 0)} · GST {inr(b.gst)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          ) : null}

          {tab === taxCode.short ? (
            <View className="gap-2">
              {(gst.hsnSummary ?? []).length === 0 ? (
                <Text className="text-sm text-muted">No {taxCode.short} lines in this period.</Text>
              ) : (
                (gst.hsnSummary ?? []).map((h) => (
                  <View key={h.hsn} className="bg-card border border-border rounded-xl p-3">
                    <Text className="text-sm font-semibold text-text">
                      {h.hsn === '(missing)' ? taxCode.missing : h.hsn} · {h.lineCount} lines
                    </Text>
                    <Text className="text-xs text-muted">
                      Qty {h.qty} · Taxable {inr(h.taxable)} · Tax {inr(h.tax)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          ) : null}

          {tab === 'Bank' ? (
            <View className="gap-2">
              {data.bank.length === 0 ? (
                <Text className="text-sm text-muted">No cash-book rows in this period.</Text>
              ) : (
                data.bank.map((row) => (
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

          {tab === 'Journals' ? (
            <View className="gap-2">
              {data.journals.length === 0 ? (
                <Text className="text-sm text-muted">No journal entries in this period.</Text>
              ) : (
                data.journals.map((j) => (
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

          {tab === 'Notes' ? (
            <View className="gap-3">
              <View className="bg-card border border-border rounded-2xl p-4">
                <Text className="text-sm font-bold text-text mb-2">Add auditor note</Text>
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
                  placeholder={`e.g. ${taxCode.missing} on invoice …`}
                  className="border border-border rounded-xl px-3 py-2 text-text mb-2 bg-bg"
                />
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="Amount (optional)"
                  keyboardType="decimal-pad"
                  className="border border-border rounded-xl px-3 py-2 text-text mb-3 bg-bg"
                />
                <Button label="Save note" onPress={onAddManual} loading={addEntry.isPending} fullWidth />
              </View>
              {data.manualEntries.length === 0 ? (
                <Text className="text-sm text-muted">No notes yet. Add filing comments for the owner.</Text>
              ) : (
                data.manualEntries.map((m) => (
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
                ))
              )}
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}
