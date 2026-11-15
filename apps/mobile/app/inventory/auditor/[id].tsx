/**
 * GST pack desk — auditor inbox + owner draft review (?mode=owner).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import {
  downloadGstPackExport,
  useAddAuditorManualEntry,
  useAuditorPack,
  useDeleteGstPack,
  useSendGstPack,
  useUpdateAuditorPackStatus,
  useUpdateGstPackDraft,
  type GstPackDetail,
} from '@/services/auditor.queries';
import { useAuthStore } from '@/stores/auth.store';
import { useViewport } from '@/hooks/useViewport';
import { Button, Input, OverflowMenu, toast } from '@/components/ui';
import { SegmentedTabsInline, SegmentedTrack } from '@/components/inventory/SegmentedTabs';
import { FormScreenHeader } from '@/components/layout/ScreenHeader';
import { NavBackButton } from '@/components/layout/NavBackButton';
import { AuditorShopSwitcher } from '@/components/auditor/AuditorShopSwitcher';
import { SafeAreaView } from 'react-native-safe-area-context';

function inr(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
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

function DeskTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<{ key: string; cells: string[] }>;
}) {
  return (
    <View className="border border-border rounded-xl overflow-hidden bg-card">
      <View className="flex-row bg-surface border-b border-border px-3 py-2">
        {headers.map((h) => (
          <Text key={h} className="flex-1 text-[11px] font-bold uppercase text-muted">
            {h}
          </Text>
        ))}
      </View>
      {rows.map((r) => (
        <View key={r.key} className="flex-row px-3 py-2.5 border-b border-border/60">
          {r.cells.map((c, i) => (
            <Text key={`${r.key}-${i}`} className="flex-1 text-xs text-text" numberOfLines={2}>
              {c}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

type PrimarySeg = 'GST' | 'Books' | 'Notes';

export default function AuditorPackScreen() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const packId = typeof id === 'string' ? id : id?.[0];
  const isOwnerMode = mode === 'owner';
  const { data, isLoading, refetch } = useAuditorPack(packId, { asOwner: isOwnerMode });
  const updateStatus = useUpdateAuditorPackStatus(packId ?? '');
  const addEntry = useAddAuditorManualEntry(packId ?? '');
  const updateDraft = useUpdateGstPackDraft(packId ?? '');
  const sendPack = useSendGstPack();
  const deletePack = useDeleteGstPack();
  const user = useAuthStore((s) => s.user);
  const { isDesktop, isPhone } = useViewport();
  const [primary, setPrimary] = useState<PrimarySeg>('GST');
  const [gstTab, setGstTab] = useState('Summary');
  const [booksTab, setBooksTab] = useState('Bank');
  const [narration, setNarration] = useState('');
  const [amount, setAmount] = useState('');
  const [entryType, setEntryType] = useState<'JOURNAL' | 'BANK_NOTE' | 'GST_NOTE'>('GST_NOTE');
  const [openingInput, setOpeningInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const pad = isDesktop ? 28 : 16;
  const backHref = isOwnerMode ? '/inventory/settings' : '/inventory/auditor';
  const exportAsOwner = isOwnerMode;

  useEffect(() => {
    if (!data || !isOwnerMode) return;
    const opening =
      data.openingCashBalance != null
        ? data.openingCashBalance
        : data.suggestedOpeningCashBalance != null
          ? data.suggestedOpeningCashBalance
          : null;
    setOpeningInput(opening == null ? '' : String(opening));
    setNotesInput(data.notes ?? '');
  }, [data?.id, data?.openingCashBalance, data?.suggestedOpeningCashBalance, data?.notes, isOwnerMode]);

  if (isLoading || !data) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center p-6">
        <Text className="text-muted mb-4">{isLoading ? 'Loading pack…' : 'Pack not found'}</Text>
        <NavBackButton
          label={isOwnerMode ? 'Back to settings' : 'Back to inbox'}
          onPress={() => router.replace(backHref)}
        />
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

  const saveDraftMeta = async () => {
    const openingRaw = openingInput.trim();
    const openingCashBalance =
      openingRaw === '' ? null : Number(openingRaw.replace(/,/g, ''));
    if (openingRaw !== '' && !Number.isFinite(openingCashBalance)) {
      toast.error('Opening cash/bank must be a number');
      return false;
    }
    try {
      await updateDraft.mutateAsync({
        notes: notesInput.trim() || null,
        openingCashBalance,
      });
      await refetch();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save draft');
      return false;
    }
  };

  const onSendDraft = async () => {
    if (openingInput.trim() === '') {
      toast.error('Enter opening cash/bank for the period start');
      return;
    }
    const okSave = await saveDraftMeta();
    if (!okSave) return;
    try {
      const sent = await sendPack.mutateAsync(packId!);
      if (sent.hsnWarning) toast.warning(sent.hsnWarning);
      else toast.success('Pack sent to auditors');
      router.replace('/inventory/settings');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not send pack');
    }
  };

  const onDeleteDraft = async () => {
    try {
      await deletePack.mutateAsync(packId!);
      toast.success('Draft deleted');
      router.replace('/inventory/settings');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete');
    }
  };

  const gst = data.gst;
  const taxCode = data.taxCode ?? { short: 'HSN/SAC', field: 'HSN/SAC code', missing: 'Missing HSN/SAC' };
  const creditNotes = gst.creditNotes ?? [];
  const debitNotes = gst.debitNotes ?? [];
  const bankIn = data.bankIn ?? 0;
  const bankOut = data.bankOut ?? 0;
  const openingShown =
    data.openingCashBalance != null
      ? data.openingCashBalance
      : isOwnerMode && openingInput.trim() !== '' && Number.isFinite(Number(openingInput))
        ? Number(openingInput)
        : null;
  const bankClosing =
    data.bankClosing != null
      ? data.bankClosing
      : openingShown == null
        ? data.bankNet ?? data.bankTotal ?? 0
        : openingShown + bankIn - bankOut;

  const canExport = data.status !== 'DRAFT';
  const primaryTabs: Array<{ value: PrimarySeg; label: string }> = isOwnerMode
    ? [
        { value: 'GST', label: 'GST' },
        { value: 'Books', label: 'Books' },
      ]
    : [
        { value: 'GST', label: 'GST' },
        { value: 'Books', label: 'Books' },
        { value: 'Notes', label: 'Notes' },
      ];

  const gstSecondary = [
    { value: 'Summary', label: 'Summary' },
    { value: 'Sales', label: 'Sales' },
    { value: 'Purchases', label: 'Purchases' },
    { value: 'CN/DN', label: 'CN/DN' },
    { value: taxCode.short, label: taxCode.short },
  ];
  const booksSecondary = [
    { value: 'Bank', label: 'Bank' },
    { value: 'Journals', label: 'Journals' },
    { value: 'Groups', label: 'Groups' },
    { value: 'P&L', label: 'P&L' },
    { value: 'BS', label: 'BS' },
  ];

  const bankGroups =
    data.bankByMode ??
    (() => {
      const map = new Map<string, typeof data.bank>();
      for (const row of data.bank) {
        const mode = (row.paymentMode || 'OTHER').toUpperCase();
        const list = map.get(mode) ?? [];
        list.push(row);
        map.set(mode, list);
      }
      return [...map.entries()].map(([paymentMode, rows]) => {
        let inn = 0;
        let out = 0;
        for (const r of rows) {
          if (r.entryType === 'OPENING') continue;
          if (r.direction === 'IN') inn += r.amount;
          else out += r.amount;
        }
        return { paymentMode, in: inn, out, net: inn - out, rows };
      });
    })();

  const actionButtons = (
    <View className={`flex-row flex-wrap items-center gap-2 ${isPhone ? 'w-full' : ''}`}>
      {canExport ? (
        <>
          <OverflowMenu
            label="GSTR-1"
            trigger="button"
            title="Download GSTR-1"
            accessibilityLabel="Download GSTR-1"
            items={[
              {
                key: 'xlsx',
                label: 'Download as Excel',
                icon: 'document-outline',
                onPress: () =>
                  void downloadGstPackExport(packId!, 'xlsx', { asOwner: exportAsOwner }),
              },
              {
                key: 'json',
                label: 'Download as JSON',
                icon: 'code-slash-outline',
                onPress: () =>
                  void downloadGstPackExport(packId!, 'gstr1-json', {
                    asOwner: exportAsOwner,
                  }),
              },
            ]}
          />
          <OverflowMenu
            title="Downloads"
            accessibilityLabel="More downloads"
            trigger="outline"
            items={[
              {
                key: 'bank',
                label: 'Bank Excel',
                icon: 'cash-outline',
                onPress: () =>
                  void downloadGstPackExport(packId!, 'bank-xlsx', {
                    asOwner: exportAsOwner,
                  }),
              },
              {
                key: 'pnl',
                label: 'P&L Excel',
                icon: 'stats-chart-outline',
                onPress: () =>
                  void downloadGstPackExport(packId!, 'pnl-xlsx', {
                    asOwner: exportAsOwner,
                  }),
              },
              {
                key: 'books',
                label: 'Books Excel (Bank/P&L/BS/Groups)',
                icon: 'folder-outline',
                onPress: () =>
                  void downloadGstPackExport(packId!, 'books-xlsx', {
                    asOwner: exportAsOwner,
                  }),
              },
              {
                key: 'csv',
                label: 'Offline CSV zip',
                icon: 'archive-outline',
                onPress: () =>
                  void downloadGstPackExport(packId!, 'csv', { asOwner: exportAsOwner }),
              },
            ]}
          />
        </>
      ) : null}
      {!isOwnerMode ? (
        data.status !== 'FILED' ? (
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
        ) : null
      ) : data.status === 'DRAFT' ? (
        <>
          <Button
            label="Delete"
            variant="secondary"
            size="sm"
            onPress={() => void onDeleteDraft()}
            loading={deletePack.isPending}
          />
          <Button
            label="Send to auditor"
            size="sm"
            onPress={() => void onSendDraft()}
            loading={sendPack.isPending || updateDraft.isPending}
            fullWidth={isPhone}
          />
        </>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      <FormScreenHeader
        title={data.label}
        subtitle={`${data.periodStart} → ${data.periodEnd} · ${data.status.replace('_', ' ')}${
          user?.companyName ? ` · ${user.companyName}` : ''
        }`}
        cancelLabel={isOwnerMode ? 'Settings' : 'Inbox'}
        onCancel={() => router.replace(backHref)}
        showBack
        right={!isPhone ? actionButtons : undefined}
      />

      {/* Thin shop + mobile actions strip (keeps FormScreenHeader to one row) */}
      {(!isOwnerMode || isPhone) ? (
        <View
          className="border-b border-border bg-surface shrink-0"
          style={{ paddingHorizontal: pad, paddingVertical: 6 }}
        >
          <View
            className={
              isDesktop
                ? 'flex-row items-center gap-3 max-w-[1100px] w-full self-center'
                : 'gap-2 max-w-[1100px] w-full self-center'
            }
          >
            {!isOwnerMode ? (
              <View className="flex-1 min-w-0 max-w-md">
                <AuditorShopSwitcher
                  compact
                  onSwitched={() => router.replace('/inventory/auditor')}
                />
              </View>
            ) : null}
            {isPhone ? actionButtons : null}
          </View>
        </View>
      ) : null}

      <ScrollView
        className="flex-1 bg-surface"
        contentContainerStyle={{
          paddingBottom: 48,
          paddingHorizontal: pad,
          paddingTop: 12,
          maxWidth: 1100,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        <View>
          {!isOwnerMode && data.notes ? (
            <View className="mb-3 rounded-xl border border-border bg-card px-3 py-2.5">
              <Text className="text-[11px] font-semibold uppercase text-muted mb-0.5">
                Owner notes
              </Text>
              <Text className="text-sm text-text">{data.notes}</Text>
            </View>
          ) : null}

          {isOwnerMode && data.status === 'DRAFT' ? (
            <View className="mb-4 rounded-2xl border border-border bg-card px-4 py-4 gap-3">
              <Text className="text-sm text-muted">
                Set opening cash/bank for period start, check figures, then send.
              </Text>
              <Input
                label="Opening cash/bank (₹)"
                value={openingInput}
                onChangeText={setOpeningInput}
                onBlur={() => void saveDraftMeta()}
                keyboardType="decimal-pad"
                placeholder={
                  data.suggestedOpeningCashBalance != null
                    ? `Suggested ${data.suggestedOpeningCashBalance}`
                    : '0'
                }
                compact
                fullWidth
              />
              <Input
                label="Notes for auditor (optional)"
                value={notesInput}
                onChangeText={setNotesInput}
                onBlur={() => void saveDraftMeta()}
                placeholder="Anything the CA should know…"
                compact
                fullWidth
              />
            </View>
          ) : null}

          <View className="gap-3 mb-4 flex-row flex-wrap">
            <Kpi label="Outward GST" value={inr(gst.invoiceGst)} hint={`${gst.invoiceCount} invoices`} />
            <Kpi label="Inward GST" value={inr(gst.billGst)} hint={`${gst.billCount} bills`} />
            <Kpi
              label="Opening"
              value={openingShown == null ? '—' : inr(openingShown)}
              hint="Period start"
              warn={isOwnerMode && openingShown == null}
            />
            <Kpi label="Cash in" value={inr(bankIn)} />
            <Kpi label="Cash out" value={inr(bankOut)} />
            <Kpi label="Closing" value={inr(bankClosing)} hint="Opening + in − out" />
          </View>

          {(gst.missingHsnLines ?? 0) > 0 ? (
            <View className="mb-4 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3">
              <Text className="text-sm font-semibold text-text">
                {gst.missingHsnLines} line{(gst.missingHsnLines ?? 0) === 1 ? '' : 's'}{' '}
                {taxCode.missing.toLowerCase()}
              </Text>
              <Text className="text-xs text-muted mt-0.5">
                {isOwnerMode
                  ? `Fill ${taxCode.short} on catalog items or invoice lines, then refresh this review.`
                  : `Ask the shop owner to fill ${taxCode.short} on catalog items or invoice lines, then note it under Notes.`}
              </Text>
            </View>
          ) : null}

          <View className="mb-3">
            <SegmentedTrack
              tabs={primaryTabs}
              value={primary}
              onChange={(v) => setPrimary(v)}
            />
          </View>

          {primary === 'GST' ? (
            <View className="mb-4">
              <SegmentedTabsInline
                tabs={gstSecondary}
                value={gstTab}
                onChange={setGstTab}
                className="gap-2 mb-3"
              />

              {gstTab === 'Summary' ? (
                <View className="gap-3">
                  <View className="bg-card border border-border rounded-2xl px-4 py-4">
                    <Text className="text-base font-bold text-text mb-3">GST overview</Text>
                    <View className={isDesktop ? 'flex-row flex-wrap gap-x-8 gap-y-3' : 'gap-3'}>
                      <View>
                        <Text className="text-[11px] text-muted uppercase font-semibold">
                          Taxable (sales)
                        </Text>
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
                      {(gst.rateWise ?? []).map(
                        (r: NonNullable<GstPackDetail['gst']['rateWise']>[number]) => (
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
                        ),
                      )}
                    </View>
                  ) : null}
                </View>
              ) : null}

              {gstTab === 'Sales' ? (
                <View className="gap-2">
                  {gst.invoices.length === 0 ? (
                    <Text className="text-sm text-muted py-6 text-center">
                      No sales invoices in this period.
                    </Text>
                  ) : isDesktop ? (
                    <DeskTable
                      headers={['Invoice', 'Date', 'Party', 'Total', 'Tax']}
                      rows={gst.invoices.map((i: GstPackDetail['gst']['invoices'][number]) => ({
                        key: i.id,
                        cells: [
                          `${i.number}${i.bucket ? ` (${i.bucket})` : ''}`,
                          i.date,
                          i.clientName ?? '—',
                          inr(i.total),
                          `C/S/I ${inr(i.cgst)}/${inr(i.sgst)}/${inr(i.igst)}`,
                        ],
                      }))}
                    />
                  ) : (
                    gst.invoices.map((i: GstPackDetail['gst']['invoices'][number]) => (
                      <RowCard
                        key={i.id}
                        title={`${i.number} · ${inr(i.total)}${i.bucket ? ` · ${i.bucket}` : ''}`}
                        subtitle={`${i.date}${i.clientName ? ` · ${i.clientName}` : ''}${
                          i.clientGstin ? ` · ${i.clientGstin}` : ''
                        }`}
                        meta={`Taxable ${inr(i.taxable)} · C/S/I ${inr(i.cgst)}/${inr(i.sgst)}/${inr(i.igst)}`}
                      />
                    ))
                  )}
                </View>
              ) : null}

              {gstTab === 'Purchases' ? (
                <View className="gap-2">
                  {gst.bills.length === 0 ? (
                    <Text className="text-sm text-muted py-6 text-center">
                      No purchase bills in this period.
                    </Text>
                  ) : isDesktop ? (
                    <DeskTable
                      headers={['Bill', 'Date', 'Vendor', 'Total', 'GST']}
                      rows={gst.bills.map((b: GstPackDetail['gst']['bills'][number]) => ({
                        key: b.id,
                        cells: [
                          b.number,
                          b.date,
                          b.vendorName ?? '—',
                          inr(b.total),
                          inr(b.gst),
                        ],
                      }))}
                    />
                  ) : (
                    gst.bills.map((b: GstPackDetail['gst']['bills'][number]) => {
                      const missingPurchaseHsn = (b.lines ?? []).filter((l) => !l.hsn?.trim()).length;
                      return (
                        <RowCard
                          key={b.id}
                          title={`${b.number} · ${inr(b.total)}`}
                          subtitle={`${b.date}${b.vendorName ? ` · ${b.vendorName}` : ''}${
                            b.vendorGstin ? ` · ${b.vendorGstin}` : ''
                          }`}
                          meta={`Taxable ${inr(b.taxable ?? 0)} · GST ${inr(b.gst)}${
                            missingPurchaseHsn > 0
                              ? ` · ${missingPurchaseHsn} lines missing ${taxCode.short}`
                              : ''
                          }`}
                        />
                      );
                    })
                  )}
                </View>
              ) : null}

              {gstTab === 'CN/DN' ? (
                <View className="gap-4">
                  <View className="gap-2">
                    <Text className="text-sm font-bold text-text">Credit notes (sales / GSTR-1)</Text>
                    {creditNotes.length === 0 ? (
                      <Text className="text-sm text-muted py-2">No credit notes in this period.</Text>
                    ) : (
                      creditNotes.map(
                        (n: NonNullable<GstPackDetail['gst']['creditNotes']>[number]) => (
                          <RowCard
                            key={n.id}
                            title={`${n.number} · ${inr(n.total)}`}
                            subtitle={`${n.date} · ${n.partyName}${
                              n.partyGstin ? ` · ${n.partyGstin}` : ''
                            }${n.againstInvoice ? ` · vs ${n.againstInvoice}` : ''}`}
                            meta={`Taxable ${inr(n.taxable)} · C/S/I ${inr(n.cgst)}/${inr(n.sgst)}/${inr(n.igst)}`}
                          />
                        ),
                      )
                    )}
                  </View>
                  <View className="gap-2">
                    <Text className="text-sm font-bold text-text">
                      Debit notes (purchase · books only)
                    </Text>
                    <Text className="text-xs text-muted">
                      Purchase DNs are shown for review and are not included in GSTR-1 downloads.
                    </Text>
                    {debitNotes.length === 0 ? (
                      <Text className="text-sm text-muted py-2">No debit notes in this period.</Text>
                    ) : (
                      debitNotes.map(
                        (n: NonNullable<GstPackDetail['gst']['debitNotes']>[number]) => (
                          <RowCard
                            key={n.id}
                            title={`${n.number} · ${inr(n.total)}`}
                            subtitle={`${n.date} · ${n.partyName}${
                              n.partyGstin ? ` · ${n.partyGstin}` : ''
                            }${n.againstBill ? ` · vs ${n.againstBill}` : ''}`}
                            meta={`Taxable ${inr(n.taxable)} · C/S/I ${inr(n.cgst ?? 0)}/${inr(n.sgst ?? 0)}/${inr(n.igst ?? 0)}`}
                          />
                        ),
                      )
                    )}
                  </View>
                </View>
              ) : null}

              {gstTab === taxCode.short ? (
                <View className="gap-2">
                  {(gst.hsnSummary ?? []).length === 0 ? (
                    <Text className="text-sm text-muted py-6 text-center">
                      No {taxCode.short} lines in this period.
                    </Text>
                  ) : (
                    (gst.hsnSummary ?? []).map(
                      (h: NonNullable<GstPackDetail['gst']['hsnSummary']>[number]) => (
                        <RowCard
                          key={h.hsn}
                          title={`${h.hsn === '(missing)' ? taxCode.missing : h.hsn} · ${h.lineCount} lines`}
                          meta={`Qty ${h.qty} · Taxable ${inr(h.taxable)} · Tax ${inr(h.tax)}`}
                        />
                      ),
                    )
                  )}
                </View>
              ) : null}
            </View>
          ) : null}

          {primary === 'Books' ? (
            <View className="mb-4">
              <SegmentedTabsInline
                tabs={booksSecondary}
                value={booksTab}
                onChange={setBooksTab}
                className="gap-2 mb-3"
              />

              {booksTab === 'Bank' ? (
                <View className="gap-4">
                  {bankGroups.length === 0 ? (
                    <Text className="text-sm text-muted py-6 text-center">
                      No cash-book rows in this period.
                    </Text>
                  ) : (
                    bankGroups.map(
                      (g: {
                        paymentMode: string;
                        in: number;
                        out: number;
                        net: number;
                        rows: GstPackDetail['bank'];
                      }) => (
                        <View key={g.paymentMode} className="gap-2">
                          <View className="flex-row items-center justify-between">
                            <Text className="text-sm font-bold text-text">{g.paymentMode}</Text>
                            <Text className="text-xs text-muted">
                              In {inr(g.in)} · Out {inr(g.out)} · Net {inr(g.net)}
                            </Text>
                          </View>
                          {g.rows.map((row: GstPackDetail['bank'][number]) => (
                            <RowCard
                              key={row.id}
                              title={`${row.direction} · ${inr(row.amount)}`}
                              subtitle={`${row.entryDate} · ${row.entryType}`}
                              meta={row.description}
                            />
                          ))}
                        </View>
                      ),
                    )
                  )}
                </View>
              ) : null}

              {booksTab === 'Journals' ? (
                <View className="gap-2">
                  {data.journals.length === 0 ? (
                    <Text className="text-sm text-muted py-6 text-center">
                      No journal entries in this period.
                    </Text>
                  ) : (
                    data.journals.map((j: GstPackDetail['journals'][number]) => (
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

              {booksTab === 'Groups' ? (
                <View className="gap-3">
                  {(data.groups?.groups ?? []).length === 0 ? (
                    <Text className="text-sm text-muted py-6 text-center">
                      No mapped account groups yet.
                    </Text>
                  ) : (
                    (data.groups?.groups ?? []).map(
                      (g: NonNullable<GstPackDetail['groups']>['groups'][number]) => (
                        <View
                          key={g.group}
                          className="bg-card border border-border rounded-2xl px-4 py-3"
                        >
                          <Text className="text-sm font-bold text-text">{g.group}</Text>
                          <Text className="text-xs text-muted mt-0.5">
                            Debit {inr(g.debit)} · Credit {inr(g.credit)} · Net {inr(g.net)}
                          </Text>
                          {g.accounts.map(
                            (a: NonNullable<GstPackDetail['groups']>['groups'][number]['accounts'][number]) => (
                              <Text key={a.account} className="text-xs text-text mt-1.5">
                                {a.account}: Dr {inr(a.debit)} / Cr {inr(a.credit)}
                              </Text>
                            ),
                          )}
                        </View>
                      ),
                    )
                  )}
                  {(data.groups?.unmapped ?? []).length > 0 ? (
                    <View className="bg-warning/10 border border-warning/40 rounded-xl px-4 py-3">
                      <Text className="text-sm font-semibold text-text mb-1">Unmapped accounts</Text>
                      {(data.groups?.unmapped ?? []).map((a: string) => (
                        <Text key={a} className="text-xs text-muted">
                          {a}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}

              {booksTab === 'P&L' ? (
                <View className="gap-3">
                  {data.pnl ? (
                    <View className="bg-card border border-border rounded-2xl px-4 py-4 gap-2">
                      <Text className="text-base font-bold text-text">
                        P&L · {data.pnl.from} → {data.pnl.to}
                      </Text>
                      <Text className="text-sm text-text">Sales {inr(data.pnl.sales)}</Text>
                      <Text className="text-sm text-text">COGS {inr(data.pnl.cogs)}</Text>
                      <Text className="text-sm text-text">
                        Gross margin {inr(data.pnl.grossMargin)}
                      </Text>
                      <Text className="text-sm text-text">Expenses {inr(data.pnl.expenses)}</Text>
                      <Text className="text-sm font-bold text-text mt-1">
                        Estimated profit {inr(data.pnl.estimatedProfit)}
                      </Text>
                      {Object.keys(data.pnl.expensesByCategory).length > 0 ? (
                        <View className="mt-2 gap-1">
                          <Text className="text-[11px] font-bold uppercase text-muted">
                            Expenses by category
                          </Text>
                          {Object.entries(data.pnl.expensesByCategory).map(([cat, amt]) => (
                            <Text key={cat} className="text-xs text-text">
                              {cat}: {inr(Number(amt))}
                            </Text>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  ) : (
                    <Text className="text-sm text-muted py-6 text-center">P&L not available.</Text>
                  )}
                </View>
              ) : null}

              {booksTab === 'BS' ? (
                <View className="gap-3">
                  {data.balanceSheet ? (
                    <View className="bg-card border border-border rounded-2xl px-4 py-4 gap-2">
                      <Text className="text-base font-bold text-text">
                        Balance sheet · as of {data.balanceSheet.asOf}
                      </Text>
                      <Text className="text-sm font-semibold text-text mt-1">Assets</Text>
                      <Text className="text-sm text-text">
                        Cash / Bank {inr(data.balanceSheet.assets.cashBank)}
                      </Text>
                      <Text className="text-sm text-text">
                        Receivables {inr(data.balanceSheet.assets.receivables)}
                      </Text>
                      <Text className="text-sm text-text">
                        Stock value {inr(data.balanceSheet.assets.stockValue)}
                      </Text>
                      <Text className="text-sm font-bold text-text">
                        Total assets {inr(data.balanceSheet.assets.total)}
                      </Text>
                      <Text className="text-sm font-semibold text-text mt-2">Liabilities</Text>
                      <Text className="text-sm text-text">
                        Payables {inr(data.balanceSheet.liabilities.payables)}
                      </Text>
                      <Text className="text-sm font-bold text-text mt-2">
                        Equity (balancing) {inr(data.balanceSheet.equity)}
                      </Text>
                    </View>
                  ) : (
                    <Text className="text-sm text-muted py-6 text-center">
                      Balance sheet not available.
                    </Text>
                  )}
                </View>
              ) : null}
            </View>
          ) : null}

          {!isOwnerMode && primary === 'Notes' ? (
            <View className="gap-4 mb-4">
              <View className="bg-card border border-border rounded-2xl p-4">
                <Text className="text-base font-bold text-text mb-3">Add note for the owner</Text>
                <View className="flex-row flex-wrap gap-2 mb-3">
                  {(['GST_NOTE', 'BANK_NOTE', 'JOURNAL'] as const).map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => setEntryType(t)}
                      className={`px-3 py-1.5 rounded-lg border ${
                        entryType === t ? 'bg-primary border-primary' : 'bg-surface border-border'
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          entryType === t ? 'text-white' : 'text-text'
                        }`}
                      >
                        {t.replace('_', ' ')}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  value={narration}
                  onChangeText={setNarration}
                  placeholder={`e.g. ${taxCode.missing} on invoice…`}
                  className="border border-border rounded-xl px-3 py-3 text-text mb-2 bg-surface"
                  multiline
                />
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="Amount (optional)"
                  keyboardType="decimal-pad"
                  className="border border-border rounded-xl px-3 py-3 text-text mb-3 bg-surface"
                />
                <Button label="Save note" onPress={onAddManual} loading={addEntry.isPending} fullWidth />
              </View>
              {data.manualEntries.length === 0 ? (
                <Text className="text-sm text-muted text-center py-4">
                  No notes yet. Use notes for filing comments or missing {taxCode.short} follow-ups.
                </Text>
              ) : (
                data.manualEntries.map((m: GstPackDetail['manualEntries'][number]) => (
                  <RowCard
                    key={m.id}
                    title={`${m.entryType.replace('_', ' ')}${
                      m.amount != null ? ` · ${inr(m.amount)}` : ''
                    }`}
                    subtitle={`${m.entryDate} · ${m.createdByName}`}
                    meta={m.narration}
                  />
                ))
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
