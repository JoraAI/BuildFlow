/**
 * Auditor pack workspace — responsive GST review desk.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import {
  downloadGstPackExport,
  useAddAuditorManualEntry,
  useAuditorPack,
  useUpdateAuditorPackStatus,
  type GstPackDetail,
} from '@/services/auditor.queries';
import { useAuthStore } from '@/stores/auth.store';
import { useViewport } from '@/hooks/useViewport';
import { Badge, Button, toast } from '@/components/ui';
import { SegmentedTabs } from '@/components/inventory/SegmentedTabs';
import { SafeAreaView } from 'react-native-safe-area-context';

function inr(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function statusBadge(status: string): 'primary' | 'warning' | 'success' | 'neutral' {
  if (status === 'SENT') return 'primary';
  if (status === 'IN_PROGRESS') return 'warning';
  if (status === 'FILED') return 'success';
  return 'neutral';
}

function Kpi({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: string;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <View className="bg-card border border-border rounded-2xl px-4 py-3 flex-1 min-w-[140px]">
      <Text className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</Text>
      <Text className={`text-xl font-bold mt-1 ${warn ? 'text-warning' : 'text-text'}`} numberOfLines={1}>
        {value}
      </Text>
      {hint ? <Text className="text-[11px] text-muted mt-1">{hint}</Text> : null}
    </View>
  );
}

function RowCard({
  title,
  subtitle,
  meta,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
}) {
  return (
    <View className="bg-card border border-border rounded-xl px-4 py-3">
      <Text className="text-sm font-semibold text-text">{title}</Text>
      {subtitle ? <Text className="text-xs text-muted mt-1">{subtitle}</Text> : null}
      {meta ? <Text className="text-xs text-text mt-1.5">{meta}</Text> : null}
    </View>
  );
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
  const { isDesktop, isPhone } = useViewport();
  const [tab, setTab] = useState<string>('Summary');
  const [narration, setNarration] = useState('');
  const [amount, setAmount] = useState('');
  const [entryType, setEntryType] = useState<'JOURNAL' | 'BANK_NOTE' | 'GST_NOTE'>('GST_NOTE');
  const [switching, setSwitching] = useState(false);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const pad = isDesktop ? 28 : 16;

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
      <SafeAreaView className="flex-1 bg-bg items-center justify-center p-6">
        <Text className="text-muted">{isLoading ? 'Loading pack…' : 'Pack not found'}</Text>
        <Pressable onPress={() => router.replace('/inventory/auditor')} className="mt-4">
          <Text className="text-primary font-semibold">Back to inbox</Text>
        </Pressable>
      </SafeAreaView>
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
      toast.success('Note saved');
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save entry');
    }
  };

  const gst = data.gst;
  const taxCode = data.taxCode ?? { short: 'HSN/SAC', field: 'HSN/SAC code', missing: 'Missing HSN/SAC' };
  const creditNotes = gst.creditNotes ?? [];
  const debitNotes = gst.debitNotes ?? [];
  const tabItems = [
    { value: 'Summary', label: 'Summary' },
    { value: 'Sales', label: 'Sales' },
    { value: 'Purchases', label: 'Purchases' },
    { value: 'CN/DN', label: 'CN/DN' },
    { value: taxCode.short, label: taxCode.short },
    { value: 'Bank', label: 'Bank' },
    { value: 'Journals', label: 'Journals' },
    { value: 'Notes', label: 'Notes' },
  ] as const;

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: pad,
          paddingBottom: 72,
          maxWidth: 1100,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        <Pressable onPress={() => router.replace('/inventory/auditor')} className="self-start mb-4">
          <Text className="text-primary text-sm font-semibold">← Inbox</Text>
        </Pressable>

        {memberships.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, marginBottom: 16 }}
            contentContainerStyle={{ gap: 8, flexDirection: 'row' }}
          >
            {memberships.map((m) => {
              const active = m.companyId === user?.companyId;
              return (
                <Pressable
                  key={m.companyId}
                  disabled={switching || active}
                  onPress={() => onSwitchShop(m.companyId)}
                  className={`px-3 py-2 rounded-lg border ${
                    active ? 'bg-primary border-primary' : 'bg-card border-border'
                  }`}
                >
                  <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-text'}`}>
                    {m.companyName}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {/* Header */}
        <View className={isDesktop ? 'flex-row items-start justify-between gap-4 mb-5' : 'mb-4'}>
          <View className="flex-1 min-w-0">
            <Text className="text-xs text-muted mb-1" numberOfLines={1}>
              {user?.companyName}
            </Text>
            <View className="flex-row flex-wrap items-center gap-2 mb-1">
              <Text className="text-2xl font-bold text-text">{data.label}</Text>
              <Badge label={data.status.replace('_', ' ')} color={statusBadge(data.status)} />
            </View>
            <Text className="text-sm text-muted">
              {data.periodStart} → {data.periodEnd}
            </Text>
            {data.notes ? <Text className="text-sm text-text mt-2">{data.notes}</Text> : null}
          </View>
          <View className={`flex-row flex-wrap gap-2 ${isPhone ? 'mt-3' : ''}`}>
            <Button
              label="GSTR-1 JSON"
              variant="secondary"
              size="sm"
              onPress={() => void downloadGstPackExport(packId!, 'gstr1-json')}
            />
            <Button
              label="CSV"
              variant="secondary"
              size="sm"
              onPress={() => void downloadGstPackExport(packId!, 'csv')}
            />
            {data.status !== 'FILED' ? (
              <>
                <Button
                  label="In progress"
                  variant="secondary"
                  size="sm"
                  onPress={() => onMark('IN_PROGRESS')}
                  loading={updateStatus.isPending}
                />
                <Button
                  label="Mark filed"
                  size="sm"
                  onPress={() => onMark('FILED')}
                  loading={updateStatus.isPending}
                />
              </>
            ) : null}
          </View>
        </View>

        {/* KPI strip */}
        <View className={`gap-3 mb-4 ${isDesktop ? 'flex-row' : 'flex-row flex-wrap'}`}>
          <Kpi label="Outward GST" value={inr(gst.invoiceGst)} hint={`${gst.invoiceCount} invoices`} />
          <Kpi label="Inward GST" value={inr(gst.billGst)} hint={`${gst.billCount} bills`} />
          <Kpi
            label="CN / DN"
            value={`${gst.creditNoteCount ?? creditNotes.length} / ${gst.debitNoteCount ?? debitNotes.length}`}
            hint={`GST ${inr(gst.creditNoteGst ?? 0)} / ${inr(gst.debitNoteGst ?? 0)}`}
          />
          <Kpi
            label="B2B / B2C"
            value={`${gst.b2bCount ?? 0} / ${gst.b2cCount ?? 0}`}
            hint="Sales split"
          />
          <Kpi label="Bank total" value={inr(data.bankTotal)} />
        </View>

        {(gst.missingHsnLines ?? 0) > 0 ? (
          <View className="mb-4 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3">
            <Text className="text-sm font-semibold text-text">
              {gst.missingHsnLines} line{(gst.missingHsnLines ?? 0) === 1 ? '' : 's'}{' '}
              {taxCode.missing.toLowerCase()}
            </Text>
            <Text className="text-xs text-muted mt-0.5">
              Ask the shop owner to fill {taxCode.short} on catalog items or invoice lines, then note it under Notes.
            </Text>
          </View>
        ) : null}

        <View className="mb-4 border-b border-border pb-1">
          <SegmentedTabs
            tabs={tabItems}
            value={tab}
            onChange={setTab}
            contentContainerClassName="gap-2 pb-2 items-center flex-row px-0"
          />
        </View>

        {tab === 'Summary' ? (
          <View className="gap-3">
            <View className="bg-card border border-border rounded-2xl px-4 py-4">
              <Text className="text-base font-bold text-text mb-3">GST overview</Text>
              <View className={isDesktop ? 'flex-row flex-wrap gap-x-8 gap-y-3' : 'gap-3'}>
                <View>
                  <Text className="text-[11px] text-muted uppercase font-semibold">Taxable (sales)</Text>
                  <Text className="text-lg font-bold text-text">{inr(gst.invoiceTaxable)}</Text>
                </View>
                <View>
                  <Text className="text-[11px] text-muted uppercase font-semibold">CGST</Text>
                  <Text className="text-lg font-bold text-text">{inr(gst.invoiceCgst)}</Text>
                </View>
                <View>
                  <Text className="text-[11px] text-muted uppercase font-semibold">SGST</Text>
                  <Text className="text-lg font-bold text-text">{inr(gst.invoiceSgst)}</Text>
                </View>
                <View>
                  <Text className="text-[11px] text-muted uppercase font-semibold">IGST</Text>
                  <Text className="text-lg font-bold text-text">{inr(gst.invoiceIgst)}</Text>
                </View>
              </View>
            </View>
            {(gst.rateWise ?? []).length > 0 ? (
              <View className={isDesktop ? 'flex-row flex-wrap gap-3' : 'gap-3'}>
                {(gst.rateWise ?? []).map((r) => (
                  <View
                    key={r.rate}
                    className={`bg-card border border-border rounded-2xl px-4 py-3 ${
                      isDesktop ? 'min-w-[200px] flex-1' : ''
                    }`}
                  >
                    <Text className="text-base font-bold text-text">{r.rate}% GST</Text>
                    <Text className="text-xs text-muted mt-0.5">{r.count} lines</Text>
                    <Text className="text-sm text-text mt-2">
                      Taxable {inr(r.taxable)} · Tax {inr(r.tax)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {tab === 'Sales' ? (
          <View className="gap-2">
            {gst.invoices.length === 0 ? (
              <Text className="text-sm text-muted py-6 text-center">No sales invoices in this period.</Text>
            ) : (
              gst.invoices.map((i: GstPackDetail['gst']['invoices'][number]) => (
                <RowCard
                  key={i.id}
                  title={`${i.number} · ${inr(i.total)}${i.bucket ? ` · ${i.bucket}` : ''}`}
                  subtitle={`${i.date}${i.clientName ? ` · ${i.clientName}` : ''}${i.clientGstin ? ` · ${i.clientGstin}` : ''}`}
                  meta={`Taxable ${inr(i.taxable)} · C/S/I ${inr(i.cgst)}/${inr(i.sgst)}/${inr(i.igst)}`}
                />
              ))
            )}
          </View>
        ) : null}

        {tab === 'Purchases' ? (
          <View className="gap-2">
            {gst.bills.length === 0 ? (
              <Text className="text-sm text-muted py-6 text-center">No purchase bills in this period.</Text>
            ) : (
              gst.bills.map((b: GstPackDetail['gst']['bills'][number]) => {
                const missingPurchaseHsn = (b.lines ?? []).filter((l) => !l.hsn?.trim()).length;
                return (
                  <RowCard
                    key={b.id}
                    title={`${b.number} · ${inr(b.total)}`}
                    subtitle={`${b.date}${b.vendorName ? ` · ${b.vendorName}` : ''}${b.vendorGstin ? ` · ${b.vendorGstin}` : ''}`}
                    meta={`Taxable ${inr(b.taxable ?? 0)} · GST ${inr(b.gst)}${
                      missingPurchaseHsn > 0 ? ` · ${missingPurchaseHsn} lines missing ${taxCode.short}` : ''
                    }`}
                  />
                );
              })
            )}
          </View>
        ) : null}

        {tab === 'CN/DN' ? (
          <View className="gap-4">
            <View className="gap-2">
              <Text className="text-sm font-bold text-text">Credit notes</Text>
              {creditNotes.length === 0 ? (
                <Text className="text-sm text-muted py-2">No credit notes in this period.</Text>
              ) : (
                creditNotes.map((n) => (
                  <RowCard
                    key={n.id}
                    title={`${n.number} · ${inr(n.total)}`}
                    subtitle={`${n.date} · ${n.partyName}${n.partyGstin ? ` · ${n.partyGstin}` : ''}`}
                    meta={`Taxable ${inr(n.taxable)} · C/S/I ${inr(n.cgst)}/${inr(n.sgst)}/${inr(n.igst)}`}
                  />
                ))
              )}
            </View>
            <View className="gap-2">
              <Text className="text-sm font-bold text-text">Debit notes</Text>
              {debitNotes.length === 0 ? (
                <Text className="text-sm text-muted py-2">No debit notes in this period.</Text>
              ) : (
                debitNotes.map((n) => (
                  <RowCard
                    key={n.id}
                    title={`${n.number} · ${inr(n.total)}`}
                    subtitle={`${n.date} · ${n.partyName}${n.partyGstin ? ` · ${n.partyGstin}` : ''}`}
                    meta={`Taxable ${inr(n.taxable)} · GST ${inr(n.gst)}`}
                  />
                ))
              )}
            </View>
          </View>
        ) : null}

        {tab === taxCode.short ? (
          <View className="gap-2">
            {(gst.hsnSummary ?? []).length === 0 ? (
              <Text className="text-sm text-muted py-6 text-center">
                No {taxCode.short} lines in this period.
              </Text>
            ) : (
              (gst.hsnSummary ?? []).map((h) => (
                <RowCard
                  key={h.hsn}
                  title={`${h.hsn === '(missing)' ? taxCode.missing : h.hsn} · ${h.lineCount} lines`}
                  meta={`Qty ${h.qty} · Taxable ${inr(h.taxable)} · Tax ${inr(h.tax)}`}
                />
              ))
            )}
          </View>
        ) : null}

        {tab === 'Bank' ? (
          <View className="gap-2">
            {data.bank.length === 0 ? (
              <Text className="text-sm text-muted py-6 text-center">No cash-book rows in this period.</Text>
            ) : (
              data.bank.map((row) => (
                <RowCard
                  key={row.id}
                  title={`${row.paymentMode} · ${inr(row.amount)}`}
                  subtitle={`${row.entryDate} · ${row.direction} · ${row.entryType}`}
                  meta={row.description}
                />
              ))
            )}
          </View>
        ) : null}

        {tab === 'Journals' ? (
          <View className="gap-2">
            {data.journals.length === 0 ? (
              <Text className="text-sm text-muted py-6 text-center">No journal entries in this period.</Text>
            ) : (
              data.journals.map((j) => (
                <RowCard
                  key={j.id}
                  title={inr(j.amount)}
                  subtitle={`${j.entryDate} · ${j.debitAccount} → ${j.creditAccount}`}
                  meta={j.description ?? undefined}
                />
              ))
            )}
          </View>
        ) : null}

        {tab === 'Notes' ? (
          <View className="gap-4">
            <View className="bg-card border border-border rounded-2xl p-4">
              <Text className="text-base font-bold text-text mb-3">Add note for the owner</Text>
              <View className="flex-row flex-wrap gap-2 mb-3">
                {(['GST_NOTE', 'BANK_NOTE', 'JOURNAL'] as const).map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setEntryType(t)}
                    className={`px-3 py-1.5 rounded-lg border ${
                      entryType === t ? 'bg-primary border-primary' : 'bg-bg border-border'
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
                placeholder={`e.g. ${taxCode.missing} on invoice…`}
                className="border border-border rounded-xl px-3 py-3 text-text mb-2 bg-bg"
                multiline
              />
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="Amount (optional)"
                keyboardType="decimal-pad"
                className="border border-border rounded-xl px-3 py-3 text-text mb-3 bg-bg"
              />
              <Button label="Save note" onPress={onAddManual} loading={addEntry.isPending} fullWidth />
            </View>
            {data.manualEntries.length === 0 ? (
              <Text className="text-sm text-muted text-center py-4">
                No notes yet. Use notes for filing comments or missing {taxCode.short} follow-ups.
              </Text>
            ) : (
              data.manualEntries.map((m) => (
                <RowCard
                  key={m.id}
                  title={`${m.entryType.replace('_', ' ')}${m.amount != null ? ` · ${inr(m.amount)}` : ''}`}
                  subtitle={`${m.entryDate} · ${m.createdByName}`}
                  meta={m.narration}
                />
              ))
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
