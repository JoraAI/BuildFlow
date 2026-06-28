/**
 * BuildFlow — Reports Hub
 * Financial reports, PDF downloads, and scheduled report management.
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Button, LoadingSkeleton, EmptyState, Input, Badge } from '@/components/ui';
import { FormScreenHeader } from '@/components/layout/ScreenHeader';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { useViewport } from '@/hooks/useViewport';
import { dismissTo, DISMISS } from '@/utils/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useProjects, type ProjectListItem } from '@/services/project.queries';
import {
  useGstReport,
  useTdsReport,
  useProfitLoss,
  useEstimateVsActual,
} from '@/services/accounting.queries';
import {
  useReportSchedules,
  useCreateReportSchedule,
  type ReportSchedule,
} from '@/services/expansion.queries';
import { apiDownload } from '@/lib/api-client';
import { formatINR } from '@/utils/format';
import * as Sharing from 'expo-sharing';

export default function ReportsHubScreen() {
  const { isDesktop } = useViewport();
  const user = useAuthStore((s) => s.user);
  const canFinancials = user?.role === 'OWNER' || user?.role === 'ACCOUNTANT';

  const { data: projects } = useProjects();
  const [selectedProject, setSelectedProject] = useState('');
  const gstQ = useGstReport();
  const tdsQ = useTdsReport();
  const plQ = useProfitLoss(selectedProject);
  const evaQ = useEstimateVsActual(selectedProject);
  const schedulesQ = useReportSchedules();
  const createSchedule = useCreateReportSchedule();

  const [cronExpr, setCronExpr] = useState('0 9 * * 1');
  const [recipient, setRecipient] = useState(user?.email ?? '');

  const downloadPdf = async (path: string, filename: string) => {
    try {
      const uri = await apiDownload(path, filename, 'application/pdf');
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert('Saved', 'Report downloaded.');
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Download failed');
    }
  };

  const onCreateSchedule = () => {
    if (!recipient.trim()) {
      Alert.alert('Email required', 'Enter at least one recipient email.');
      return;
    }
    createSchedule.mutate(
      {
        reportType: 'GST_SUMMARY',
        cronExpr: cronExpr.trim() || '0 9 * * 1',
        recipients: [recipient.trim()],
      },
      {
        onSuccess: () => Alert.alert('Scheduled', 'Report schedule created.'),
        onError: (e: Error) => Alert.alert('Error', e.message),
      },
    );
  };

  const content = (
    <View className="gap-4">
      {/* Company reports */}
      {canFinancials && (
        <Card>
          <Text className="text-base font-bold text-text mb-3">Company Financial Reports</Text>
          <View className={`gap-2 ${isDesktop ? 'flex-row flex-wrap' : ''}`}>
            <ReportLink
              label="GST Summary"
              sub={gstQ.data ? `${formatINR(gstQ.data.totalTax)} total tax` : 'Loading…'}
              onPress={() => downloadPdf('/reports/pdf/gst-summary', 'gst-summary.pdf')}
            />
            <ReportLink
              label="TDS Report"
              sub={tdsQ.data ? `${formatINR(tdsQ.data.totalTdsDeducted)} deducted` : 'Loading…'}
              onPress={() => downloadPdf('/reports/pdf/tds', 'tds-report.pdf')}
            />
          </View>
          {(gstQ.isLoading || tdsQ.isLoading) && <LoadingSkeleton className="h-8 mt-2" />}
        </Card>
      )}

      {/* Project reports */}
      <Card>
        <Text className="text-base font-bold text-text mb-2">Project Reports</Text>
        <Text className="text-xs text-muted mb-3">Select a project for P&L and BOQ vs actual.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
          <View className="flex-row gap-2">
            {(projects ?? []).map((p: ProjectListItem) => (
              <Pressable
                key={p.id}
                onPress={() => setSelectedProject(p.id)}
                className={`px-3 py-2 rounded-lg border ${
                  selectedProject === p.id ? 'bg-primary/10 border-primary' : 'border-border'
                }`}
              >
                <Text className="text-sm text-text">{p.name}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
        {selectedProject ? (
          <View className="gap-2">
            <ReportLink
              label="Profit & Loss (PDF)"
              sub="Download project P&L"
              onPress={() =>
                downloadPdf(
                  `/reports/pdf/projects/${selectedProject}/profit-loss`,
                  'profit-loss.pdf',
                )
              }
            />
            <ReportLink
              label="BOQ vs Actual (PDF)"
              sub={
                evaQ.data
                  ? `${evaQ.data.completionPct.toFixed(0)}% complete`
                  : 'Variance analysis'
              }
              onPress={() =>
                downloadPdf(
                  `/reports/pdf/projects/${selectedProject}/boq-vs-actual`,
                  'boq-vs-actual.pdf',
                )
              }
            />
            {plQ.data && typeof plQ.data === 'object' && plQ.data !== null && (
              <Text className="text-xs text-muted mt-1">
                P&L data loaded — use PDF for full report.
              </Text>
            )}
          </View>
        ) : (
          <EmptyState title="Select a project" description="Choose a project above to view reports." />
        )}
      </Card>

      {/* Report schedules */}
      {canFinancials && (
        <Card>
          <Text className="text-base font-bold text-text mb-3">Scheduled Reports</Text>
          {schedulesQ.isLoading ? (
            <LoadingSkeleton className="h-16" />
          ) : (schedulesQ.data ?? []).length === 0 ? (
            <Text className="text-sm text-muted mb-3">No schedules yet.</Text>
          ) : (
            (schedulesQ.data ?? []).map((s: ReportSchedule) => (
              <View key={s.id} className="flex-row justify-between items-center py-2 border-b border-border/50">
                <View>
                  <Text className="text-sm font-semibold text-text">{s.reportType}</Text>
                  <Text className="text-xs text-muted">{s.cronExpr}</Text>
                </View>
                <Badge color="neutral" label={`${s.recipients.length} recipients`} />
              </View>
            ))
          )}
          <Input label="Cron expression" value={cronExpr} onChangeText={setCronExpr} placeholder="0 9 * * 1" />
          <Input label="Recipient email" value={recipient} onChangeText={setRecipient} keyboardType="email-address" />
          <Button
            label="Schedule GST report"
            variant="secondary"
            loading={createSchedule.isPending}
            onPress={onCreateSchedule}
          />
        </Card>
      )}
    </View>
  );

  if (isDesktop) {
    return (
      <SafeAreaView className="flex-1 bg-surface" edges={[]}>
        <ScreenContainer scrollable>
          <FormScreenHeader title="Reports Hub" onCancel={() => dismissTo(DISMISS.dashboard)} cancelLabel="Back" />
          {content}
        </ScreenContainer>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <FormScreenHeader title="Reports Hub" onCancel={() => dismissTo(DISMISS.dashboard)} cancelLabel="Back" />
      <ScrollView contentContainerClassName="p-4 pb-8">{content}</ScrollView>
    </SafeAreaView>
  );
}

function ReportLink({
  label,
  sub,
  onPress,
}: {
  label: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 min-w-[200px] p-3 rounded-lg border border-border active:bg-surface"
    >
      <Text className="text-sm font-semibold text-primary">{label}</Text>
      <Text className="text-xs text-muted mt-0.5">{sub}</Text>
    </Pressable>
  );
}
