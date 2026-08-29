/**
 * BuildFlow - Gang Labor Muster & Saturday Wage Settlement Suite (Module 6).
 * Morning muster steppers, overtime tracking, and 1-click Saturday weekly payroll ledger.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button, Badge, EmptyState, Input } from '@/components/ui';
import { AdaptiveSheet } from '@/components/layout/AdaptiveSheet';
import { useViewport } from '@/hooks/useViewport';
import { usePermission } from '@/hooks/usePermission';
import { useLaborMusterStore } from '@/stores/labor-muster.store';
import { useTranslation } from '@/hooks/useTranslation';
import { todayDateOnly } from '@/utils/date-field';
import { formatINR } from '@/utils/format';
import { alertAsync, confirmAsync } from '@/utils/confirm';
import { generateWhatsAppLaborWageShare } from '@/utils/whatsapp-share';

interface TradeMuster {
  id: string;
  trade: string;
  icon: string;
  headcount: number;
  otHours: number;
  dailyRate: number;
  color: string;
}

interface WorkerWageLine {
  id: string;
  name: string;
  trade: string;
  daysWorked: number;
  dailyRate: number;
  otHours: number;
  otRate: number;
  advance: number;
  status: 'PENDING' | 'PAID';
}

const INITIAL_TRADES: TradeMuster[] = [
  { id: '1', trade: 'Masons / Barbenders', icon: 'hammer-outline', headcount: 0, otHours: 0.0, dailyRate: 950, color: '#F59E0B' },
  { id: '2', trade: 'Carpenters & Shuttering', icon: 'construct-outline', headcount: 0, otHours: 0.0, dailyRate: 900, color: '#3B82F6' },
  { id: '3', trade: 'Helpers / General Labor', icon: 'people-outline', headcount: 0, otHours: 0.0, dailyRate: 600, color: '#10B981' },
  { id: '4', trade: 'Electricians & MEP', icon: 'flash-outline', headcount: 0, otHours: 0.0, dailyRate: 1000, color: '#8B5CF6' },
  { id: '5', trade: 'Plumbers', icon: 'water-outline', headcount: 0, otHours: 0.0, dailyRate: 950, color: '#06B6D4' },
  { id: '6', trade: 'Painters & Polishers', icon: 'color-palette-outline', headcount: 0, otHours: 0.0, dailyRate: 850, color: '#EC4899' },
];

const INITIAL_WAGES: WorkerWageLine[] = [];

interface LaborWagesTabProps {
  projectId: string;
}

export function LaborWagesTab({ projectId }: LaborWagesTabProps) {
  const router = useRouter();
  const { isDesktop, isTablet } = useViewport();
  const { t } = useTranslation();
  const canEditMuster = usePermission('labor.muster_edit');
  const canSettleWages = usePermission('labor.wage_settle');
  const [activeSubTab, setActiveSubTab] = useState<'muster' | 'wages'>('muster');

  const today = todayDateOnly();
  const existingMuster = useLaborMusterStore((s) => s.getMuster(projectId, today));
  const setMusterStore = useLaborMusterStore((s) => s.setMuster);

  const [trades, setTrades] = useState<TradeMuster[]>(() => {
    if (existingMuster?.trades?.length) {
      return existingMuster.trades as TradeMuster[];
    }
    return INITIAL_TRADES;
  });

  const [wageLines, setWageLines] = useState<WorkerWageLine[]>(INITIAL_WAGES);
  const [savingMuster, setSavingMuster] = useState(false);
  const [syncingDpr, setSyncingDpr] = useState(false);

  // Rate Editing State
  const [editingTrade, setEditingTrade] = useState<TradeMuster | null>(null);
  const [editDailyRate, setEditDailyRate] = useState('');

  // Add Custom Trade State
  const [showAddTradeModal, setShowAddTradeModal] = useState(false);
  const [newTradeName, setNewTradeName] = useState('');
  const [newDailyRate, setNewDailyRate] = useState('');

  // Add Worker Wage Line State
  const [showAddWageModal, setShowAddWageModal] = useState(false);
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerTrade, setNewWorkerTrade] = useState('Masons');
  const [newDaysWorked, setNewDaysWorked] = useState('6');
  const [newWorkerDailyRate, setNewWorkerDailyRate] = useState('950');
  const [newWorkerOtHours, setNewWorkerOtHours] = useState('0');
  const [newWorkerOtRate, setNewWorkerOtRate] = useState('120');
  const [newWorkerAdvance, setNewWorkerAdvance] = useState('0');

  useEffect(() => {
    if (existingMuster?.trades?.length) {
      setTrades(existingMuster.trades as TradeMuster[]);
    }
  }, [existingMuster]);

  const totalHeadcount = trades.reduce((sum, t) => sum + t.headcount, 0);
  const totalDailyEstimate = trades.reduce((sum, t) => sum + t.headcount * t.dailyRate, 0);
  const totalOtHours = trades.reduce((sum, t) => sum + t.otHours * t.headcount, 0);

  const updateTrade = (id: string, deltaHeadcount: number) => {
    setTrades((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, headcount: Math.max(0, t.headcount + deltaHeadcount) } : t,
      ),
    );
  };

  const updateTradeOt = (id: string, otHours: number) => {
    setTrades((prev) =>
      prev.map((t) => (t.id === id ? { ...t, otHours: Math.max(0, otHours) } : t)),
    );
  };

  const openRateModal = (trade: TradeMuster) => {
    setEditingTrade(trade);
    setEditDailyRate(String(trade.dailyRate));
  };

  const saveRateChange = () => {
    if (!editingTrade) return;
    const rateNum = parseFloat(editDailyRate) || 0;
    if (rateNum <= 0) {
      void alertAsync('Invalid Rate', 'Please enter a valid daily wage rate.');
      return;
    }
    setTrades((prev) =>
      prev.map((t) => (t.id === editingTrade.id ? { ...t, dailyRate: rateNum } : t)),
    );
    setEditingTrade(null);
  };

  const handleAddTrade = () => {
    if (!newTradeName.trim()) {
      void alertAsync('Required Field', 'Please enter a trade/role name.');
      return;
    }
    const rateNum = parseFloat(newDailyRate) || 0;
    if (rateNum <= 0) {
      void alertAsync('Invalid Rate', 'Please enter a valid daily rate.');
      return;
    }
    const newTrade: TradeMuster = {
      id: `trade-${Date.now()}`,
      trade: newTradeName.trim(),
      icon: 'construct-outline',
      headcount: 0,
      otHours: 0.0,
      dailyRate: rateNum,
      color: '#6366F1',
    };
    setTrades((prev) => [...prev, newTrade]);
    setNewTradeName('');
    setNewDailyRate('');
    setShowAddTradeModal(false);
  };

  const handleAddWageLine = () => {
    if (!newWorkerName.trim()) {
      void alertAsync('Required Field', 'Please enter worker or gang name.');
      return;
    }
    const days = parseFloat(newDaysWorked) || 0;
    const rate = parseFloat(newWorkerDailyRate) || 0;
    const otH = parseFloat(newWorkerOtHours) || 0;
    const otR = parseFloat(newWorkerOtRate) || 0;
    const adv = parseFloat(newWorkerAdvance) || 0;

    const newLine: WorkerWageLine = {
      id: `wage-${Date.now()}`,
      name: newWorkerName.trim(),
      trade: newWorkerTrade,
      daysWorked: days,
      dailyRate: rate,
      otHours: otH,
      otRate: otR,
      advance: adv,
      status: 'PENDING',
    };

    setWageLines((prev) => [...prev, newLine]);
    setNewWorkerName('');
    setShowAddWageModal(false);
  };

  const handleSaveMuster = async () => {
    setSavingMuster(true);
    try {
      await setMusterStore({
        projectId,
        date: today,
        totalHeadcount,
        totalOtHours,
        totalEstimatedWage: totalDailyEstimate,
        trades,
        updatedAt: new Date().toISOString(),
      });
      await alertAsync(
        'Muster Recorded & Synced',
        `Morning muster of ${totalHeadcount} workers across ${
          trades.filter((t) => t.headcount > 0).length
        } trades has been saved and linked to today's site attendance & Daily Progress Report (DPR).`,
      );
    } catch {
      await alertAsync('Error', 'Failed to save muster locally.');
    } finally {
      setSavingMuster(false);
    }
  };

  const handleSyncToDpr = async () => {
    setSyncingDpr(true);
    try {
      await setMusterStore({
        projectId,
        date: today,
        totalHeadcount,
        totalOtHours,
        totalEstimatedWage: totalDailyEstimate,
        trades,
        updatedAt: new Date().toISOString(),
      });
      const createNow = await confirmAsync(
        'Synced to Daily Progress Report',
        `Headcount of ${totalHeadcount} workers and ${totalOtHours.toFixed(
          1,
        )} OT hours is synced to today's DPR. Would you like to create / review today's Daily Report now?`,
      );
      if (createNow) {
        router.push({
          pathname: '/reports/create',
          params: { projectId, date: today },
        });
      }
    } catch {
      await alertAsync('Error', 'Failed to sync muster to DPR.');
    } finally {
      setSyncingDpr(false);
    }
  };

  const handlePayWage = async (wage: WorkerWageLine) => {
    const net = wage.daysWorked * wage.dailyRate + wage.otHours * wage.otRate - wage.advance;
    const ok = await confirmAsync(
      'Confirm Wage Settlement',
      `Approve & settle payout of ${formatINR(net)} to ${wage.name}?`,
    );
    if (!ok) return;

    setWageLines((prev) =>
      prev.map((w) => (w.id === wage.id ? { ...w, status: 'PAID' } : w)),
    );
    await alertAsync('Settled', `Payment recorded for ${wage.name}.`);
  };

  const musterView = (
    <View className="gap-4">
      {/* Hero Summary */}
      <View className="rounded-2xl bg-primary p-5 shadow-sm">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-xs uppercase tracking-wider text-white/60 font-medium">
              {t("Today's Site Muster")}
            </Text>
            <Text className="text-3xl font-bold text-white mt-0.5">
              {totalHeadcount} {t('Workers')}
            </Text>
            <Text className="text-xs text-white/70">
              {t('Estimated Daily Wage')}: {formatINR(totalDailyEstimate)}
            </Text>
          </View>
          <View className="w-12 h-12 rounded-xl bg-white/10 items-center justify-center">
            <Ionicons name="people" size={24} color="#F59E0B" />
          </View>
        </View>

        <View className="flex-row gap-3 pt-3 border-t border-white/10">
          <View className="flex-1 bg-white/5 rounded-xl p-3">
            <Text className="text-[11px] text-white/60 font-medium">{t('Overtime Logged')}</Text>
            <Text className="text-base font-bold text-amber-400 mt-0.5">
              {totalOtHours.toFixed(1)} hrs
            </Text>
          </View>
          <View className="flex-1 bg-white/5 rounded-xl p-3">
            <Text className="text-[11px] text-white/60 font-medium">{t('Active Trades')}</Text>
            <Text className="text-base font-bold text-emerald-400 mt-0.5">
              {trades.filter((t) => t.headcount > 0).length} gangs
            </Text>
          </View>
        </View>
      </View>

      {/* Stepper Cards */}
      <View className="flex-row justify-between items-center mb-1">
        <Text className="text-sm font-bold text-text">{t('Trade Muster Headcounts & Rates')}</Text>
        {canEditMuster ? (
          <Button
            label={t('Add Trade')}
            size="sm"
            variant="ghost"
            icon={<Ionicons name="add" size={14} color="#1E3A5F" />}
            onPress={() => setShowAddTradeModal(true)}
          />
        ) : null}
      </View>

      <View className={isDesktop || isTablet ? 'grid grid-cols-2 lg:grid-cols-3 gap-4' : 'gap-3'}>
        {trades.map((trade) => (
          <Card key={trade.id}>
            <View className="flex-row justify-between items-center mb-3">
              <View className="flex-row items-center gap-2 flex-1 mr-2">
                <View
                  style={{ backgroundColor: `${trade.color}20` }}
                  className="w-8 h-8 rounded-lg items-center justify-center"
                >
                  <Ionicons name={trade.icon as never} size={16} color={trade.color} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-text" numberOfLines={1}>{trade.trade}</Text>
                  <Pressable
                    onPress={() => canEditMuster && openRateModal(trade)}
                    className="flex-row items-center gap-1 mt-0.5"
                  >
                    <Text className="text-[11px] text-primary font-semibold">
                      Rate: {formatINR(trade.dailyRate)}/day
                    </Text>
                    {canEditMuster ? (
                      <Ionicons name="pencil" size={10} color="#1E3A5F" />
                    ) : null}
                  </Pressable>
                </View>
              </View>
              <Badge label={`${trade.headcount * trade.dailyRate} ₹`} color="neutral" />
            </View>

            {/* Stepper Controls */}
            <View className="flex-row items-center justify-between pt-2 border-t border-border">
              <View className="flex-row items-center gap-2">
                <Pressable
                  onPress={() => updateTrade(trade.id, -1)}
                  className="w-9 h-9 rounded-xl bg-surface border border-border items-center justify-center active:bg-border/60"
                >
                  <Ionicons name="remove" size={18} color="#1E3A5F" />
                </Pressable>

                <View className="w-12 items-center">
                  <Text className="text-lg font-bold text-text">{trade.headcount}</Text>
                </View>

                <Pressable
                  onPress={() => updateTrade(trade.id, 1)}
                  className="w-9 h-9 rounded-xl bg-primary items-center justify-center active:opacity-90"
                >
                  <Ionicons name="add" size={18} color="#FFFFFF" />
                </Pressable>
              </View>

              {/* OT Hours */}
              <View className="flex-row items-center gap-1.5 bg-surface px-2.5 py-1.5 rounded-xl border border-border">
                <Text className="text-[11px] font-semibold text-muted">OT Hrs:</Text>
                <TextInput
                  value={String(trade.otHours)}
                  onChangeText={(val) => updateTradeOt(trade.id, parseFloat(val) || 0)}
                  keyboardType="numeric"
                  className="w-10 text-xs font-bold text-text text-center bg-card rounded px-1 py-0.5 border border-border"
                />
              </View>
            </View>
          </Card>
        ))}
      </View>

      {canEditMuster ? (
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button
              label={t('Save Morning Muster')}
              size="lg"
              fullWidth
              onPress={handleSaveMuster}
              loading={savingMuster}
              icon={<Ionicons name="checkmark-done" size={18} color="#fff" />}
            />
          </View>
          <View className="flex-1">
            <Button
              label={t('Push Headcount to DPR')}
              size="lg"
              variant="secondary"
              fullWidth
              onPress={handleSyncToDpr}
              loading={syncingDpr}
              icon={<Ionicons name="sync" size={18} color="#1E3A5F" />}
            />
          </View>
        </View>
      ) : null}
    </View>
  );

  const wagesView = (
    <View className="gap-4">
      <View className="flex-row justify-between items-center">
        <View className="flex-1 mr-2">
          <Text className="text-base font-bold text-text">{t('Saturday Wage Settlement Sheet')}</Text>
          <Text className="text-xs text-muted">Weekly payroll breakdown and 1-click WhatsApp slips</Text>
        </View>
        {canSettleWages ? (
          <Button
            label={t('Log Worker Payout')}
            size="sm"
            variant="secondary"
            icon={<Ionicons name="add" size={14} color="#1E3A5F" />}
            onPress={() => setShowAddWageModal(true)}
          />
        ) : null}
      </View>

      {wageLines.length === 0 ? (
        <EmptyState
          title="No wage entries recorded"
          description="Weekly wage records can be logged using '+ Log Worker Payout' or generated after site shifts."
        />
      ) : (
        <View className={isDesktop || isTablet ? 'grid grid-cols-2 gap-4' : 'gap-3'}>
          {wageLines.map((line) => {
            const gross = line.daysWorked * line.dailyRate + line.otHours * line.otRate;
            const net = gross - line.advance;
            const isPaid = line.status === 'PAID';

            return (
              <Card key={line.id}>
                <View className="flex-row justify-between items-start mb-2">
                  <View>
                    <Text className="text-base font-semibold text-text">{line.name}</Text>
                    <Text className="text-xs text-muted">{line.trade} · {line.daysWorked} days worked</Text>
                  </View>
                  <Badge label={line.status} color={isPaid ? 'success' : 'warning'} />
                </View>

                <View className="bg-surface rounded-xl p-3 border border-border flex-row justify-between my-2">
                  <View>
                    <Text className="text-[10px] text-muted">Days × Rate</Text>
                    <Text className="text-xs font-semibold text-text">{formatINR(line.daysWorked * line.dailyRate)}</Text>
                  </View>
                  <View>
                    <Text className="text-[10px] text-muted">Overtime ({line.otHours}h)</Text>
                    <Text className="text-xs font-semibold text-amber-600">+{formatINR(line.otHours * line.otRate)}</Text>
                  </View>
                  <View>
                    <Text className="text-[10px] text-muted">Advance Paid</Text>
                    <Text className="text-xs font-semibold text-rose-600">-{formatINR(line.advance)}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-[10px] text-muted font-bold">Net Payout</Text>
                    <Text className="text-sm font-bold text-primary">{formatINR(net)}</Text>
                  </View>
                </View>

                <View className="flex-row justify-between items-center pt-2 border-t border-border">
                  <Button
                    label="WhatsApp Slip"
                    size="sm"
                    variant="ghost"
                    icon={<Ionicons name="logo-whatsapp" size={14} color="#10B981" />}
                    onPress={() =>
                      generateWhatsAppLaborWageShare({
                        projectName: 'Site Project',
                        workerName: line.name,
                        trade: line.trade,
                        daysWorked: line.daysWorked,
                        dailyRate: line.dailyRate,
                        otHours: line.otHours,
                        netPay: net,
                        weekEnding: 'Saturday',
                      })
                    }
                  />

                  {!isPaid && canSettleWages ? (
                    <Button
                      label="Approve & Pay"
                      size="sm"
                      onPress={() => handlePayWage(line)}
                      icon={<Ionicons name="cash-outline" size={14} color="#fff" />}
                    />
                  ) : !isPaid ? (
                    <Badge label="Pending Approval" color="warning" />
                  ) : (
                    <View className="flex-row items-center gap-1">
                      <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                      <Text className="text-xs font-semibold text-emerald-600">Paid on Saturday</Text>
                    </View>
                  )}
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
      {/* Subtab Segmented Switcher */}
      <View className="flex-row bg-surface p-1 rounded-xl border border-border">
        <Pressable
          onPress={() => setActiveSubTab('muster')}
          className={`flex-1 py-2 rounded-lg items-center ${
            activeSubTab === 'muster' ? 'bg-primary shadow-sm' : ''
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              activeSubTab === 'muster' ? 'text-white' : 'text-text'
            }`}
          >
            {t('Morning Muster')} ({totalHeadcount})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveSubTab('wages')}
          className={`flex-1 py-2 rounded-lg items-center ${
            activeSubTab === 'wages' ? 'bg-primary shadow-sm' : ''
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              activeSubTab === 'wages' ? 'text-white' : 'text-text'
            }`}
          >
            {t('Weekly Wage Payroll')}
          </Text>
        </Pressable>
      </View>

      {activeSubTab === 'muster' ? musterView : wagesView}

      {/* Edit Trade Rate Modal */}
      <AdaptiveSheet
        visible={!!editingTrade}
        onClose={() => setEditingTrade(null)}
        title="Edit Daily Wage Rate"
        subtitle={editingTrade ? `Trade: ${editingTrade.trade}` : ''}
        footer={
          <View className="flex-row gap-3">
            <Button
              label="Cancel"
              variant="secondary"
              className="flex-1"
              onPress={() => setEditingTrade(null)}
            />
            <Button
              label="Update Rate"
              className="flex-1"
              onPress={saveRateChange}
            />
          </View>
        }
      >
        <View className="gap-3.5">
          <Input
            label="Daily Rate (₹ per worker/day)"
            value={editDailyRate}
            onChangeText={setEditDailyRate}
            keyboardType="numeric"
            placeholder="e.g. 950"
          />
        </View>
      </AdaptiveSheet>

      {/* Add Custom Trade Modal */}
      <AdaptiveSheet
        visible={showAddTradeModal}
        onClose={() => setShowAddTradeModal(false)}
        title="Add Trade / Role"
        subtitle="Add a specialized gang or trade rate to site muster"
        footer={
          <View className="flex-row gap-3">
            <Button
              label="Cancel"
              variant="secondary"
              className="flex-1"
              onPress={() => setShowAddTradeModal(false)}
            />
            <Button
              label="Add Trade"
              className="flex-1"
              onPress={handleAddTrade}
            />
          </View>
        }
      >
        <View className="gap-3.5">
          <Input
            label="Trade / Role Name"
            value={newTradeName}
            onChangeText={setNewTradeName}
            placeholder="e.g. Scaffolding Gang, Welders, Tile Fitters"
          />
          <Input
            label="Daily Rate (₹ per worker/day)"
            value={newDailyRate}
            onChangeText={setNewDailyRate}
            keyboardType="numeric"
            placeholder="e.g. 900"
          />
        </View>
      </AdaptiveSheet>

      {/* Add Worker Wage Line Modal */}
      <AdaptiveSheet
        visible={showAddWageModal}
        onClose={() => setShowAddWageModal(false)}
        title="Log Worker / Gang Payout"
        subtitle="Add payroll line for weekly wage settlement"
        footer={
          <View className="flex-row gap-3">
            <Button
              label="Cancel"
              variant="secondary"
              className="flex-1"
              onPress={() => setShowAddWageModal(false)}
            />
            <Button
              label="Add Wage Record"
              className="flex-1"
              onPress={handleAddWageLine}
            />
          </View>
        }
      >
        <View className="gap-3.5">
          <Input
            label="Worker / Gang Name"
            value={newWorkerName}
            onChangeText={setNewWorkerName}
            placeholder="e.g. Ramesh Kumar Gang (4)"
          />
          <Input
            label="Trade / Skill"
            value={newWorkerTrade}
            onChangeText={setNewWorkerTrade}
            placeholder="e.g. Masons, Shuttering, Helpers"
          />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Input
                label="Days Worked"
                value={newDaysWorked}
                onChangeText={setNewDaysWorked}
                keyboardType="numeric"
                placeholder="6"
              />
            </View>
            <View className="flex-1">
              <Input
                label="Daily Rate (₹)"
                value={newWorkerDailyRate}
                onChangeText={setNewWorkerDailyRate}
                keyboardType="numeric"
                placeholder="950"
              />
            </View>
          </View>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Input
                label="Overtime (Hours)"
                value={newWorkerOtHours}
                onChangeText={setNewWorkerOtHours}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>
            <View className="flex-1">
              <Input
                label="OT Rate (₹/hr)"
                value={newWorkerOtRate}
                onChangeText={setNewWorkerOtRate}
                keyboardType="numeric"
                placeholder="120"
              />
            </View>
          </View>
          <Input
            label="Advance Deductions (₹)"
            value={newWorkerAdvance}
            onChangeText={setNewWorkerAdvance}
            keyboardType="numeric"
            placeholder="0"
          />
        </View>
      </AdaptiveSheet>
    </View>
  );
}
