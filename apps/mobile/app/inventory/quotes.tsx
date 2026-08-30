import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Badge, Button, EmptyState, LoadingSkeleton, toast, BusyOverlay, useBusy } from '@/components/ui';
import { useViewport } from '@/hooks/useViewport';
import {
  useQuotes, useCreateQuote, useQuoteAction, useQuoteToSalesOrder, type Quote,
} from '@/services/inventory-gtm.queries';
import { NewQuoteModal } from '@/components/inventory/TransactionModals';
import { useInventoryLanguage } from '@/components/inventory/InventoryLanguageProvider';
import { downloadReportPdf } from '@/services/report-download';
import { generateWhatsAppQuoteShare } from '@/utils/whatsapp-share';
import { formatINR } from '@/utils/format';
import { Ionicons } from '@expo/vector-icons';

type StatusFilter = 'ALL' | 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED';

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'neutral' | 'danger'> = {
  DRAFT: 'neutral',
  SENT: 'warning',
  ACCEPTED: 'success',
  REJECTED: 'danger',
};

export default function InventoryQuotesScreen() {
  const { translate } = useInventoryLanguage();
  const router = useRouter();
  const { busy, run } = useBusy();
  const { isTablet, isDesktop } = useViewport();
  const tableMode = isTablet || isDesktop;

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [selectedQuoteDetail, setSelectedQuoteDetail] = useState<Quote | null>(null);

  const quotes = useQuotes();
  const createQuote = useCreateQuote();
  const quoteAction = useQuoteAction();
  const quoteToSO = useQuoteToSalesOrder();

  const allQuotes = useMemo(() => quotes.data ?? [], [quotes.data]);

  const filteredQuotes = useMemo(() => {
    let list: Quote[] = allQuotes;
    if (statusFilter !== 'ALL') {
      list = list.filter((q: Quote) => q.status === statusFilter);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((item: Quote) =>
        item.quoteNumber.toLowerCase().includes(q) ||
        item.customerName.toLowerCase().includes(q) ||
        (item.notes ?? '').toLowerCase().includes(q) ||
        item.lines.some((l: { itemName: string }) => l.itemName.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [allQuotes, statusFilter, searchQuery]);

  const metrics = useMemo(() => {
    const totalCount = allQuotes.length;
    const totalValue = allQuotes.reduce((acc: number, q: Quote) => acc + Number(q.total || 0), 0);
    const acceptedValue = allQuotes
      .filter((q: Quote) => q.status === 'ACCEPTED')
      .reduce((acc: number, q: Quote) => acc + Number(q.total || 0), 0);
    const pendingValue = allQuotes
      .filter((q: Quote) => q.status === 'SENT' || q.status === 'DRAFT')
      .reduce((acc: number, q: Quote) => acc + Number(q.total || 0), 0);

    return { totalCount, totalValue, acceptedValue, pendingValue };
  }, [allQuotes]);

  const handleShareWhatsApp = (item: Quote) => {
    generateWhatsAppQuoteShare({
      quoteNumber: item.quoteNumber,
      customerName: item.customerName,
      eventName: item.notes,
      quoteDate: item.quoteDate,
      validUntil: item.validUntil,
      items: item.lines.map((l) => ({
        name: l.itemName,
        qty: Number(l.quantity),
        unit: l.unit,
        rate: Number(l.rate),
        amount: Number(l.amount),
      })),
      total: Number(item.total),
    });
  };

  const renderQuoteItem = ({ item }: { item: Quote }) => {
    const isAccepted = item.status === 'ACCEPTED';
    const hasSalesOrder = Boolean(item.salesOrderId);

    if (tableMode) {
      return (
        <View className="flex-row items-center px-4 py-3 bg-card border-b border-border/60">
          <View className="flex-[1.2] min-w-0 mr-2">
            <Text className="text-sm font-mono font-semibold text-text">{item.quoteNumber}</Text>
            <Text className="text-[11px] text-muted">{item.quoteDate}</Text>
          </View>
          <View className="flex-[1.8] min-w-0 mr-2">
            <Text className="text-sm font-bold text-text" numberOfLines={1}>{item.customerName}</Text>
            {item.notes ? (
              <Text className="text-[11px] text-muted" numberOfLines={1}>
                {item.notes}
              </Text>
            ) : null}
          </View>
          <View className="flex-1">
            <Badge color={STATUS_COLOR[item.status] ?? 'neutral'} label={item.status} />
          </View>
          <View className="flex-1 items-end mr-3">
            <Text className="text-sm font-bold text-text">{formatINR(Number(item.total))}</Text>
            <Text className="text-[11px] text-muted">{item.lines.length} item(s)</Text>
          </View>
          <View className="flex-[2] flex-row flex-wrap justify-end gap-1.5">
            <Button
              label="WhatsApp"
              size="sm"
              variant="secondary"
              onPress={() => handleShareWhatsApp(item)}
            />
            <Button
              label="PDF"
              size="sm"
              variant="ghost"
              onPress={() => void downloadReportPdf(`/inventory/pdf/quote/${item.id}`, `quote-${item.quoteNumber}.pdf`)}
            />
            {item.status === 'DRAFT' ? (
              <Button
                label="Send"
                size="sm"
                variant="secondary"
                disabled={busy}
                onPress={() => void run(async () => {
                  await quoteAction.mutateAsync({ id: item.id, action: 'send' });
                  toast.success(`Quote ${item.quoteNumber} marked as Sent`);
                })}
              />
            ) : null}
            {item.status === 'SENT' ? (
              <>
                <Button
                  label="Accept"
                  size="sm"
                  variant="accent"
                  disabled={busy}
                  onPress={() => void run(async () => {
                    await quoteAction.mutateAsync({ id: item.id, action: 'accept' });
                    toast.success('Quote accepted! Ready to convert to sales order.');
                  })}
                />
                <Button
                  label="Reject"
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onPress={() => void run(async () => {
                    await quoteAction.mutateAsync({ id: item.id, action: 'reject' });
                    toast.info('Quote rejected');
                  })}
                />
              </>
            ) : null}
            {isAccepted && !hasSalesOrder ? (
              <Button
                label="Create SO"
                size="sm"
                variant="accent"
                disabled={busy}
                onPress={() => void run(async () => {
                  await quoteToSO.mutateAsync(item.id);
                  toast.success('Sales order created from quote!');
                  router.push('/inventory/sales' as never);
                })}
              />
            ) : null}
            {hasSalesOrder ? (
              <Button
                label="View in Sales"
                size="sm"
                variant="secondary"
                onPress={() => router.push('/inventory/sales' as never)}
              />
            ) : null}
          </View>
        </View>
      );
    }

    // Mobile Card Mode
    return (
      <Card className="mb-3 p-4">
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1 min-w-0">
            <View className="flex-row items-center gap-2">
              <Text className="text-base font-bold text-text">{item.quoteNumber}</Text>
              <Badge color={STATUS_COLOR[item.status] ?? 'neutral'} label={item.status} />
            </View>
            <Text className="text-sm font-semibold text-text mt-1">{item.customerName}</Text>
            {item.notes ? (
              <Text className="text-xs text-muted mt-0.5" numberOfLines={2}>
                {item.notes}
              </Text>
            ) : null}
            <View className="flex-row items-center gap-2 mt-2 flex-wrap">
              <Text className="text-[11px] text-muted">Date: {item.quoteDate}</Text>
              {item.validUntil ? <Text className="text-[11px] text-muted">· Valid till: {item.validUntil}</Text> : null}
            </View>
          </View>
          <View className="items-end">
            <Text className="text-base font-bold text-primary">{formatINR(Number(item.total))}</Text>
            <Text className="text-xs text-muted">{item.lines.length} items</Text>
          </View>
        </View>

        {/* Line Items Preview */}
        <View className="mt-3 pt-2.5 border-t border-border/60">
          <Text className="text-[11px] font-bold text-muted uppercase mb-1">Items Breakdown</Text>
          {item.lines.slice(0, 3).map((li) => (
            <View key={li.id} className="flex-row items-center justify-between py-0.5">
              <Text className="text-xs text-text flex-1 mr-2" numberOfLines={1}>
                • {li.itemName} ({li.quantity} {li.unit})
              </Text>
              <Text className="text-xs font-medium text-text">{formatINR(Number(li.amount))}</Text>
            </View>
          ))}
          {item.lines.length > 3 ? (
            <Text className="text-[11px] text-accent mt-0.5">+{item.lines.length - 3} more items...</Text>
          ) : null}
        </View>

        {/* Actions Row */}
        <View className="flex-row flex-wrap items-center gap-2 mt-3 pt-2.5 border-t border-border">
          <Button
            label="WhatsApp"
            size="sm"
            variant="secondary"
            onPress={() => handleShareWhatsApp(item)}
          />
          <Button
            label="PDF"
            size="sm"
            variant="ghost"
            onPress={() => void downloadReportPdf(`/inventory/pdf/quote/${item.id}`, `quote-${item.quoteNumber}.pdf`)}
          />
          {item.status === 'DRAFT' ? (
            <Button
              label="Send"
              size="sm"
              variant="secondary"
              disabled={busy}
              onPress={() => void run(async () => {
                await quoteAction.mutateAsync({ id: item.id, action: 'send' });
                toast.success('Quote marked as Sent');
              })}
            />
          ) : null}
          {item.status === 'SENT' ? (
            <>
              <Button
                label="Accept"
                size="sm"
                variant="accent"
                disabled={busy}
                onPress={() => void run(async () => {
                  await quoteAction.mutateAsync({ id: item.id, action: 'accept' });
                  toast.success('Quote accepted! Ready to convert to sales order.');
                })}
              />
              <Button
                label="Reject"
                size="sm"
                variant="secondary"
                disabled={busy}
                onPress={() => void run(async () => {
                  await quoteAction.mutateAsync({ id: item.id, action: 'reject' });
                  toast.info('Quote rejected');
                })}
              />
            </>
          ) : null}
          {isAccepted && !hasSalesOrder ? (
            <Button
              label="Create Sales Order"
              size="sm"
              variant="accent"
              disabled={busy}
              onPress={() => void run(async () => {
                await quoteToSO.mutateAsync(item.id);
                toast.success('Sales order created from quote!');
                router.push('/inventory/sales' as never);
              })}
            />
          ) : null}
          {hasSalesOrder ? (
            <Button
              label="Go to Sales"
              size="sm"
              variant="secondary"
              onPress={() => router.push('/inventory/sales' as never)}
            />
          ) : null}
        </View>
      </Card>
    );
  };

  return (
    <View className="flex-1 bg-surface">
      <BusyOverlay visible={busy} title="Quotes & Event Estimates" />

      {/* Header */}
      <View className="px-4 pt-4 pb-2 flex-row flex-wrap items-center justify-between gap-2">
        <View className="flex-1 min-w-[200px] mr-2">
          <Text className="text-2xl font-bold text-text">Quotes & Event Estimates</Text>
          <Text className="text-sm text-muted mt-0.5">
            Prepare itemized quotations for events, lighting setups, and client proposals. Convert accepted quotes directly to Sales Orders.
          </Text>
        </View>
        <Button
          label="+ New Event Quote"
          variant="accent"
          size="sm"
          disabled={busy}
          onPress={() => setQuoteModalOpen(true)}
        />
      </View>

      {/* KPI Cards Strip */}
      <View className="px-4 py-2 flex-row flex-wrap gap-2">
        <Card className="flex-1 min-w-[140px] p-3">
          <Text className="text-xs text-muted">Total Quotes</Text>
          <Text className="text-lg font-bold text-text mt-0.5">{metrics.totalCount}</Text>
          <Text className="text-[11px] text-muted mt-0.5">{formatINR(metrics.totalValue)} total</Text>
        </Card>
        <Card className="flex-1 min-w-[140px] p-3 border-success/30 bg-success/5">
          <Text className="text-xs text-success font-medium">Accepted Pipeline</Text>
          <Text className="text-lg font-bold text-success mt-0.5">{formatINR(metrics.acceptedValue)}</Text>
          <Text className="text-[11px] text-muted mt-0.5">Ready for dispatch</Text>
        </Card>
        <Card className="flex-1 min-w-[140px] p-3 border-warning/30 bg-warning/5">
          <Text className="text-xs text-warning font-medium">Open Proposals</Text>
          <Text className="text-lg font-bold text-warning mt-0.5">{formatINR(metrics.pendingValue)}</Text>
          <Text className="text-[11px] text-muted mt-0.5">Draft & Sent</Text>
        </Card>
      </View>

      {/* Search & Filter Bar */}
      <View className="px-4 py-2 flex-row flex-wrap items-center gap-2">
        <View className="flex-1 min-w-[220px] relative">
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by client, event, quote #, or item..."
            placeholderTextColor="#94A3B8"
            className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-text"
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery('')} className="absolute right-3 top-2.5">
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </Pressable>
          ) : null}
        </View>

        <View className="flex-row gap-1.5 flex-wrap">
          {(['ALL', 'DRAFT', 'SENT', 'ACCEPTED', 'REJECTED'] as const).map((st) => (
            <Pressable
              key={st}
              onPress={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg border ${statusFilter === st ? 'bg-primary border-primary' : 'bg-card border-border'}`}
            >
              <Text className={`text-xs font-semibold ${statusFilter === st ? 'text-white' : 'text-muted'}`}>
                {st === 'ALL' ? 'All' : st}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Main List */}
      {quotes.isLoading ? (
        <View className="px-4 gap-3 mt-2">
          {[1, 2, 3].map((i) => <LoadingSkeleton key={i} className="rounded-xl h-24" />)}
        </View>
      ) : (
        <FlatList
          className="flex-1 px-4 mt-2"
          data={filteredQuotes}
          keyExtractor={(item) => item.id}
          renderItem={renderQuoteItem}
          ListEmptyComponent={
            <EmptyState
              title={searchQuery ? 'No matching quotes found' : 'No quotes yet'}
              description={
                searchQuery
                  ? 'Try searching with different keywords or clear the filter.'
                  : 'Create an event estimate or lighting quotation for your client, share it on WhatsApp, and convert it to a Sales Order when approved.'
              }
            />
          }
          contentContainerStyle={{ paddingBottom: 24 }}
          ListHeaderComponent={
            tableMode && filteredQuotes.length > 0 ? (
              <View className="flex-row items-center px-4 py-2 bg-surface border-b border-border">
                <Text className="flex-[1.2] text-[11px] font-bold text-muted uppercase">Quote #</Text>
                <Text className="flex-[1.8] text-[11px] font-bold text-muted uppercase">Client / Event</Text>
                <Text className="flex-1 text-[11px] font-bold text-muted uppercase">Status</Text>
                <Text className="flex-1 text-[11px] font-bold text-muted uppercase text-right">Total</Text>
                <Text className="flex-[2] text-[11px] font-bold text-muted uppercase text-right">Actions</Text>
              </View>
            ) : null
          }
        />
      )}

      {/* New Event Quote Modal */}
      {quoteModalOpen ? (
        <NewQuoteModal
          open={quoteModalOpen}
          onClose={() => setQuoteModalOpen(false)}
          onSubmit={async (input) => {
            await run(async () => {
              await createQuote.mutateAsync(input);
              toast.success('Event quote created successfully');
              setQuoteModalOpen(false);
            });
          }}
        />
      ) : null}
    </View>
  );
}
