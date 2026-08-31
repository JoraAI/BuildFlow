/**
 * BuildFlow - Site Petty Cash & Live Float Management (Module 1).
 * Responsive 2-column on desktop, bottom-sheet / card feed on mobile.
 */
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Card, Button, Badge, LoadingSkeleton, EmptyState, Input } from '@/components/ui';
import { AdaptiveSheet } from '@/components/layout/AdaptiveSheet';
import { useViewport } from '@/hooks/useViewport';
import { useAuthStore } from '@/stores/auth.store';
import { usePermission } from '@/hooks/usePermission';
import { useTranslation } from '@/hooks/useTranslation';
import {
  usePettyCashEntries,
  usePettyCashSummary,
  useCreatePettyCash,
  useUpdatePettyCash,
  useDeletePettyCash,
  type PettyCashEntry,
} from '@/services/petty-cash.queries';
import { formatINR, formatDate } from '@/utils/format';
import { alertAsync, confirmAsync } from '@/utils/confirm';
import { generateWhatsAppPettyCashShare } from '@/utils/whatsapp-share';

const CATEGORIES = [
  { id: 'Fuel/DG', label: 'Fuel / DG', icon: 'speedometer-outline', color: '#EF4444' },
  { id: 'Tea/Meals', label: 'Tea / Meals', icon: 'cafe-outline', color: '#F59E0B' },
  { id: 'Hardware', label: 'Hardware', icon: 'build-outline', color: '#3B82F6' },
  { id: 'Travel', label: 'Travel', icon: 'car-outline', color: '#8B5CF6' },
  { id: 'Urgent Labor', label: 'Urgent Labor', icon: 'people-outline', color: '#10B981' },
  { id: 'Materials', label: 'Materials', icon: 'cube-outline', color: '#06B6D4' },
  { id: 'Misc', label: 'Misc', icon: 'ellipsis-horizontal-circle-outline', color: '#64748B' },
] as const;

interface PettyCashTabProps {
  projectId: string;
}

export function PettyCashTab({ projectId }: PettyCashTabProps) {
  const { isDesktop, isTablet } = useViewport();
  const { t } = useTranslation();
  const canApprove = usePermission('petty_cash.approve');
  const canCreate = usePermission('petty_cash.create');

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);

  // Form state
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState<string>('Fuel/DG');
  const [amount, setAmount] = useState('');
  const [paidTo, setPaidTo] = useState('');
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  const openNewExpenseModal = () => {
    setDesc('');
    setCategory('Fuel/DG');
    setAmount('');
    setPaidTo('');
    setReceiptUrl(null);
    setNotes('');
    setUploadingReceipt(false);
    setShowLogModal(true);
  };

  const closeLogModal = () => {
    setShowLogModal(false);
    setUploadingReceipt(false);
    setDesc('');
    setAmount('');
    setPaidTo('');
    setReceiptUrl(null);
    setNotes('');
  };

  const { data: listData, isLoading, refetch } = usePettyCashEntries({
    projectId,
    category: selectedCategory ?? undefined,
    status: selectedStatus ?? undefined,
  });

  const { data: summaryData } = usePettyCashSummary(projectId);
  const createMut = useCreatePettyCash();
  const updateMut = useUpdatePettyCash();
  const deleteMut = useDeletePettyCash();

  const entries = listData?.data ?? [];
  const pendingAmount = summaryData?.byStatus?.['PENDING'] ?? 0;
  const approvedAmount = summaryData?.byStatus?.['APPROVED'] ?? 0;
  const totalSpend = summaryData?.totalAmount ?? 0;
  // Assumed float balance base: ₹50,000 or calculated float minus approved
  const floatAllocated = 50000;
  const floatRemaining = Math.max(0, floatAllocated - approvedAmount);

  const pickImage = async (useCamera: boolean) => {
    try {
      setUploadingReceipt(true);
      const perm = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!perm.granted) {
        setUploadingReceipt(false);
        await alertAsync('Permission required', 'Please enable camera/photo library access in device settings.');
        return;
      }

      const res = useCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, base64: true });

      if (res.canceled) {
        setUploadingReceipt(false);
        return;
      }

      if (res.assets && res.assets[0]?.base64) {
        const dataUrl = `data:image/jpeg;base64,${res.assets[0].base64}`;
        setReceiptUrl(dataUrl);
      }
    } catch {
      await alertAsync('Error', 'Could not capture or load receipt image.');
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleCreate = async () => {
    const numAmount = parseFloat(amount);
    if (!desc.trim()) {
      await alertAsync('Required field', 'Please enter an expense description.');
      return;
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      await alertAsync('Invalid amount', 'Please enter a valid expense amount.');
      return;
    }

    try {
      await createMut.mutateAsync({
        projectId,
        description: desc.trim(),
        category,
        amount: numAmount,
        expenseDate: new Date().toISOString(),
        paidTo: paidTo.trim() || 'Cash',
        receiptUrl,
        notes: notes.trim() || null,
      });

      closeLogModal();
      await alertAsync('Logged', 'Petty cash expense submitted for reconciliation.');
    } catch (e: unknown) {
      await alertAsync('Error', e instanceof Error ? e.message : 'Failed to save expense');
    }
  };

  const handleApprove = async (entry: PettyCashEntry) => {
    try {
      await updateMut.mutateAsync({
        id: entry.id,
        status: 'APPROVED',
      });
    } catch (e: unknown) {
      await alertAsync('Error', e instanceof Error ? e.message : 'Could not approve');
    }
  };

  const handleReject = async (entry: PettyCashEntry) => {
    const ok = await confirmAsync('Reject expense?', `Reject entry ${entry.entryNumber} for Rs ${entry.amount}?`);
    if (!ok) return;
    try {
      await updateMut.mutateAsync({
        id: entry.id,
        status: 'REJECTED',
      });
    } catch (e: unknown) {
      await alertAsync('Error', e instanceof Error ? e.message : 'Could not reject');
    }
  };

  const heroCard = (
    <View className="rounded-2xl bg-primary p-5 shadow-sm mb-4">
      <View className="flex-row items-center justify-between mb-4">
        <View>
          <Text className="text-xs uppercase tracking-wider text-white/60 font-medium">
            Live Site Float
          </Text>
          <Text className="text-2xl font-bold text-white mt-0.5">
            {formatINR(floatRemaining)}
          </Text>
          <Text className="text-xs text-white/70">Remaining in Hand (Float: {formatINR(floatAllocated)})</Text>
        </View>
        <View className="w-12 h-12 rounded-xl bg-white/10 items-center justify-center">
          <Ionicons name="wallet-outline" size={24} color="#F59E0B" />
        </View>
      </View>

      <View className="flex-row gap-3 pt-3 border-t border-white/10">
        <View className="flex-1 bg-white/5 rounded-xl p-3">
          <Text className="text-[11px] text-white/60 font-medium">Pending Approval</Text>
          <Text className="text-base font-bold text-amber-400 mt-0.5">
            {formatINR(pendingAmount)}
          </Text>
        </View>
        <View className="flex-1 bg-white/5 rounded-xl p-3">
          <Text className="text-[11px] text-white/60 font-medium">Approved Spend</Text>
          <Text className="text-base font-bold text-emerald-400 mt-0.5">
            {formatINR(approvedAmount)}
          </Text>
        </View>
        <View className="flex-1 bg-white/5 rounded-xl p-3">
          <Text className="text-[11px] text-white/60 font-medium">Total Entries</Text>
          <Text className="text-base font-bold text-white mt-0.5">
            {summaryData?.count ?? entries.length}
          </Text>
        </View>
      </View>
    </View>
  );

  const categoryFilters = (
    <View className="flex-row flex-wrap items-center gap-1.5 mb-3">
      <Pressable
        onPress={() => setSelectedCategory(null)}
        className={`px-3 py-1.5 rounded-lg border ${
          selectedCategory === null ? 'bg-primary border-primary' : 'bg-card border-border'
        }`}
      >
        <Text
          className={`text-xs font-semibold ${
            selectedCategory === null ? 'text-white' : 'text-text'
          }`}
        >
          {t('All Categories')}
        </Text>
      </Pressable>
      {CATEGORIES.map((cat) => {
        const active = selectedCategory === cat.id;
        return (
          <Pressable
            key={cat.id}
            onPress={() => setSelectedCategory(active ? null : cat.id)}
            className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg border ${
              active ? 'bg-primary border-primary' : 'bg-card border-border'
            }`}
          >
            <Ionicons name={cat.icon as never} size={14} color={active ? '#fff' : cat.color} />
            <Text
              className={`text-xs font-semibold ${
                active ? 'text-white' : 'text-text'
              }`}
            >
              {cat.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const entriesList = (
    <View className="gap-3">
      {isLoading ? (
        <View className={isDesktop || isTablet ? 'grid grid-cols-2 gap-3' : 'gap-3'}>
          <LoadingSkeleton className="h-28 rounded-xl" />
          <LoadingSkeleton className="h-28 rounded-xl" />
          <LoadingSkeleton className="h-28 rounded-xl" />
          <LoadingSkeleton className="h-28 rounded-xl" />
        </View>
      ) : entries.length === 0 ? (
        <EmptyState
          title="No petty cash entries"
          description="Log daily site expenses, fuel slips, hardware purchases, or urgent labor wages using the button above."
        />
      ) : (
        <View className={isDesktop || isTablet ? 'grid grid-cols-2 gap-3' : 'gap-3'}>
          {entries.map((entry: PettyCashEntry) => {
            const isPending = entry.status === 'PENDING';
            const isApproved = entry.status === 'APPROVED';
            return (
              <Card key={entry.id}>
                <View className="flex-row justify-between items-start">
                  <View className="flex-1 pr-3">
                    <View className="flex-row items-center gap-2 mb-1 flex-wrap">
                      <Text className="text-xs font-bold text-primary">
                        {entry.entryNumber}
                      </Text>
                      <Badge
                        label={entry.category}
                        color={entry.category === 'Fuel/DG' ? 'danger' : entry.category === 'Urgent Labor' ? 'success' : 'neutral'}
                      />
                      <Badge
                        label={entry.status}
                        color={isApproved ? 'success' : isPending ? 'warning' : 'danger'}
                      />
                    </View>
                    <Text className="text-base font-semibold text-text">{entry.description}</Text>
                    <Text className="text-xs text-muted mt-0.5">
                      Paid to: <Text className="text-text font-medium">{entry.paidTo}</Text> · {formatDate(entry.expenseDate)}
                    </Text>
                    {entry.notes ? (
                      <Text className="text-xs text-muted italic mt-1">{entry.notes}</Text>
                    ) : null}
                  </View>

                  <View className="items-end shrink-0">
                    <Text className="text-base font-bold text-text">
                      {formatINR(entry.amount)}
                    </Text>
                    {entry.receiptUrl ? (
                      <Pressable
                        onPress={() => setPreviewReceiptUrl(entry.receiptUrl)}
                        className="flex-row items-center gap-1 mt-1 bg-primary/10 px-2 py-0.5 rounded"
                      >
                        <Ionicons name="receipt-outline" size={12} color="#1E3A5F" />
                        <Text className="text-[10px] font-semibold text-primary">Receipt</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                {/* Actions & WhatsApp share */}
                <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-border/60">
                  <Button
                    label="WhatsApp Slip"
                    size="sm"
                    variant="ghost"
                    icon={<Ionicons name="logo-whatsapp" size={14} color="#10B981" />}
                    onPress={() =>
                      generateWhatsAppPettyCashShare({
                        entryNumber: entry.entryNumber,
                        amount: entry.amount,
                        category: entry.category,
                        description: entry.description,
                        paidTo: entry.paidTo,
                        status: entry.status,
                      })
                    }
                  />

                  {canApprove && isPending ? (
                    <View className="flex-row gap-2">
                      <Button
                        label="Reject"
                        size="sm"
                        variant="ghost"
                        onPress={() => handleReject(entry)}
                      />
                      <Button
                        label="Approve"
                        size="sm"
                        onPress={() => handleApprove(entry)}
                        icon={<Ionicons name="checkmark" size={14} color="#fff" />}
                      />
                    </View>
                  ) : null}
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </View>
  );

  return (
    <View className="gap-4">
      {/* Top action row */}
      <View className="flex-row justify-between items-center">
        <View>
          <Text className="text-xl font-bold text-text">{t('Site Petty Cash & Expenses')}</Text>
          <Text className="text-xs text-muted mt-0.5">
            Log site cash float, snap receipts, and 1-tap reconcile with approvals
          </Text>
        </View>
        {canCreate ? (
          <Button
            label={t('Log Expense')}
            size="sm"
            onPress={openNewExpenseModal}
            icon={<Ionicons name="add" size={16} color="#fff" />}
          />
        ) : null}
      </View>

      {/* Dual mode layout */}
      {isDesktop ? (
        <View className="flex-row gap-6 items-start">
          <View className="w-80 shrink-0">
            {heroCard}
            <Card>
              <Text className="text-sm font-bold text-text mb-3">Spend by Category</Text>
              {CATEGORIES.map((c) => {
                const catSpend = summaryData?.byCategory?.[c.id] ?? 0;
                const pct = totalSpend > 0 ? (catSpend / totalSpend) * 100 : 0;
                return (
                  <View key={c.id} className="mb-2.5">
                    <View className="flex-row justify-between items-center mb-1">
                      <View className="flex-row items-center gap-1.5">
                        <Ionicons name={c.icon as never} size={14} color={c.color} />
                        <Text className="text-xs font-medium text-text">{c.label}</Text>
                      </View>
                      <Text className="text-xs font-bold text-text">{formatINR(catSpend)}</Text>
                    </View>
                    <View className="h-1.5 bg-surface-dark rounded-full overflow-hidden">
                      <View
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: c.color }}
                      />
                    </View>
                  </View>
                );
              })}
            </Card>
          </View>

          <View className="flex-1 min-w-0">
            {categoryFilters}
            {entriesList}
          </View>
        </View>
      ) : (
        <View>
          {heroCard}
          {categoryFilters}
          {entriesList}
        </View>
      )}

      {/* Log Expense Modal */}
      <AdaptiveSheet
        visible={showLogModal}
        onClose={closeLogModal}
        title="Log Site Expense"
        subtitle="Instant petty cash voucher entry"
        size="md"
        footer={
          <View className="flex-row gap-2">
            <Button
              label="Cancel"
              variant="ghost"
              className="flex-1"
              onPress={closeLogModal}
            />
            <Button
              label="Submit Expense"
              className="flex-1"
              onPress={handleCreate}
              loading={createMut.isPending}
            />
          </View>
        }
      >
        <View className="gap-2.5">
          <Input
            label="Description *"
            placeholder="e.g. 20L Diesel for DG generator"
            value={desc}
            onChangeText={setDesc}
          />

          <View>
            <Text className="text-xs font-semibold text-text mb-1">Category *</Text>
            <View className="flex-row flex-wrap items-center gap-1.5">
              {CATEGORIES.map((c) => {
                const active = category === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setCategory(c.id)}
                    className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg border ${
                      active ? 'bg-primary border-primary' : 'bg-surface border-border'
                    }`}
                  >
                    <Ionicons name={c.icon as never} size={14} color={active ? '#fff' : c.color} />
                    <Text
                      className={`text-xs font-medium ${
                        active ? 'text-white' : 'text-text'
                      }`}
                    >
                      {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="flex-row gap-2.5">
            <View className="flex-1">
              <Input
                label="Amount (₹) *"
                placeholder="0"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />
            </View>
            <View className="flex-1">
              <Input
                label="Paid To"
                placeholder="e.g. Bharat Petroleum"
                value={paidTo}
                onChangeText={setPaidTo}
              />
            </View>
          </View>

          {/* Receipt capture */}
          <View className="bg-surface rounded-xl p-3 border border-border">
            <Text className="text-xs font-semibold text-text mb-1.5">
              Paper Receipt / Bill Slip Photo
            </Text>
            {receiptUrl ? (
              <View className="relative rounded-lg overflow-hidden h-32 bg-black/5 mb-2">
                <Image source={{ uri: receiptUrl }} className="w-full h-full" resizeMode="cover" />
                <Pressable
                  onPress={() => setReceiptUrl(null)}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 items-center justify-center"
                >
                  <Ionicons name="close" size={14} color="#fff" />
                </Pressable>
              </View>
            ) : (
              <View className="flex-row gap-2">
                <Button
                  label="Snap Camera"
                  size="sm"
                  variant="secondary"
                  icon={<Ionicons name="camera-outline" size={14} color="#1E3A5F" />}
                  onPress={() => pickImage(true)}
                  loading={uploadingReceipt}
                />
                <Button
                  label="Gallery"
                  size="sm"
                  variant="secondary"
                  icon={<Ionicons name="image-outline" size={14} color="#1E3A5F" />}
                  onPress={() => pickImage(false)}
                  loading={uploadingReceipt}
                />
              </View>
            )}
          </View>

          <Input
            label="Notes (Optional)"
            placeholder="Meter reading or purpose"
            value={notes}
            onChangeText={setNotes}
          />
        </View>
      </AdaptiveSheet>

      {/* Receipt Image Preview Modal */}
      <AdaptiveSheet
        visible={!!previewReceiptUrl}
        onClose={() => setPreviewReceiptUrl(null)}
        title="Receipt Preview"
        size="md"
      >
        {previewReceiptUrl ? (
          <View className="w-full h-72 md:h-96 rounded-xl overflow-hidden bg-black/5 items-center justify-center">
            <Image
              source={{ uri: previewReceiptUrl }}
              className="w-full h-full"
              resizeMode="contain"
            />
          </View>
        ) : null}
      </AdaptiveSheet>
    </View>
  );
}
