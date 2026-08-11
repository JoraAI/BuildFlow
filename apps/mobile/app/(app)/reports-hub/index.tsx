/**
 * BuildFlow - Reports Hub
 * Financial reports, PDF downloads, and scheduled report management.
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Button, LoadingSkeleton, EmptyState, Input, Badge } from '@/components/ui';
import { FormScreenHeader } from '@/components/layout/ScreenHeader';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ResponsiveGrid } from '@/components/layout/ResponsiveGrid';
import { useViewport } from '@/hooks/useViewport';
import { dismissTo, DISMISS } from '@/utils/navigation';
import { alertAsync } from '@/utils/confirm';
import { useAuthStore } from '@/stores/auth.store';
import { useProjects, type ProjectListItem } from '@/services/project.queries';
import {
  useGstReport,
  useTdsReport,
  useEstimateVsActual,
} from '@/services/accounting.queries';
import {
  useReportSchedules,
  useCreateReportSchedule,
  type ReportSchedule,
} from '@/services/expansion.queries';
import { downloadReportPdf, downloadTallyXml, reportPaths } from '@/services/report-download';
import { COLORS } from '@/constants';
import { formatINR } from '@/utils/format';
import { usePermission } from '@/hooks/usePermission';

export default function ReportsHubScreen() {
  const { isDesktop } = useViewport();
  const user = useAuthStore((s) => s.user);
  const canFinancials = user?.role === 'OWNER' || user?.role === 'ACCOUNTANT';
  const canExportTally = usePermission('tally.export');

  const { data: projects } = useProjects();
  const [selectedProject, setSelectedProject] = useState('');
  const gstQ = useGstReport();
  const tdsQ = useTdsReport();
  const evaQ = useEstimateVsActual(selectedProject);
  const schedulesQ = useReportSchedules();
  const createSchedule = useCreateReportSchedule();

  const [cronExpr, setCronExpr] = useState('0 9 * * 1');
  const [recipient, setRecipient] = useState(user?.email ?? '');
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const onCreateSchedule = () => {
    if (!recipient.trim()) {
      setScheduleError('Enter at least one recipient email.');
      void alertAsync('Email required', 'Enter at least one recipient email.');
      return;
    }
    setScheduleError(null);
    createSchedule.mutate(
      {
        reportType: 'GST_SUMMARY',
        cronExpr: cronExpr.trim() || '0 9 * * 1',
        recipients: [recipient.trim()],
      },
      {
        onSuccess: async () => {
          await alertAsync('Scheduled', 'Report schedule created.');
        },
        onError: async (e: Error) => {
          setScheduleError(e.message);
          await alertAsync('Error', e.message);
        },
      },
    );
  };

  const content = (
    <View className="gap-4">
      {/* Company reports */}
      {canFinancials && (
        <Card>
          <Text className="text-base font-bold text-text mb-3">Company Financial Reports</Text>
          <ResponsiveGrid gap={8} columns={isDesktop ? 2 : 1}>
            <ReportLink
              label="GST Summary"
              sub={gstQ.data ? `${formatINR(gstQ.data.totalTax)} total tax` : 'Loading…'}
              onPress={() => downloadReportPdf(reportPaths.gstSummary(), 'gst-summary.pdf')}
            />
            <ReportLink
              label="TDS Report"
              sub={tdsQ.data ? `${formatINR(tdsQ.data.totalTdsDeducted)} deducted` : 'Loading…'}
              onPress={() => downloadReportPdf(reportPaths.tds(), 'tds-report.pdf')}
            />
          </ResponsiveGrid>
          {(gstQ.isLoading || tdsQ.isLoading) && <LoadingSkeleton className="h-8 mt-2" />}
        </Card>
      )}

      {/* Company-level material price history (no project required) */}
      <Card>
        <Text className="text-base font-bold text-text mb-3">Company Reports</Text>
        <ResponsiveGrid gap={8} columns={isDesktop ? 2 : 1}>
          <ReportLink
            label="Material Price History"
            sub="Rate trends across all projects"
            onPress={() => downloadReportPdf(reportPaths.materialPriceHistory(), 'material-price-history.pdf')}
          />
        </ResponsiveGrid>
      </Card>

      {/* Project reports - improved selector + report cards */}
      <Card>
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-base font-bold text-text">Project Reports</Text>
          {projects ? (
            <Badge label={`${projects.length} project${projects.length === 1 ? '' : 's'}`} color="neutral" />
          ) : null}
        </View>
        <Text className="text-xs text-muted mb-3">
          Select a project to download progress, P&L, BOQ variance, estimate vs actual, and resource utilization.
          Measurement book and abstract sheet are available on the project's BOQ tab.
        </Text>

        {/* Project selector - status dots + names */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
          <View className="flex-row gap-2">
            {(projects ?? []).map((p: ProjectListItem) => {
              const selected = selectedProject === p.id;
              const status = projectStatusColor(p.status);
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setSelectedProject(p.id)}
                  className={`px-3 py-2 rounded-lg border flex-row items-center gap-2 ${
                    selected ? 'bg-primary/10 border-primary' : 'border-border'
                  }`}
                >
                  <View
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: status.dot }}
                  />
                  <Text
                    className={`text-sm ${selected ? 'text-primary font-semibold' : 'text-text'}`}
                    numberOfLines={1}
                  >
                    {p.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {selectedProject ? (
          <View className="gap-3">
            {/* Selected project context bar */}
            {(() => {
              const proj = (projects ?? []).find((p: ProjectListItem) => p.id === selectedProject);
              if (!proj) return null;
              const status = projectStatusColor(proj.status);
              return (
                <View className="flex-row items-center justify-between rounded-lg bg-surface px-3 py-2.5 border border-border/60">
                  <View className="flex-1 mr-3">
                    <Text className="text-sm font-bold text-text" numberOfLines={1}>
                      {proj.name}
                    </Text>
                    <Text className="text-xs text-muted" numberOfLines={1}>
                      {proj.code} · {proj.clientName}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Badge label={formatStatusLabel(proj.status)} color={status.badge} />
                    <Text className="text-xs font-semibold text-text">
                      {formatINR(Number(proj.budget))}
                    </Text>
                  </View>
                </View>
              );
            })()}

            {/* Reports grid - responsive: 3 cols desktop, 1 col mobile */}
            <ResponsiveGrid gap={8} columns={isDesktop ? 3 : 1}>
              {/* RPT-UI1b-hub: Project progress */}
              <ProjectReportCard
                accent={COLORS.primary}
                tag="PRG"
                title="Project Progress"
                description="Task status & milestones"
                onPress={() =>
                  downloadReportPdf(reportPaths.projectProgress(selectedProject), `progress-${selectedProject}.pdf`)
                }
              />
              {/* RPT-UI1b-hub: P&L */}
              <ProjectReportCard
                accent={COLORS.primary}
                tag="P&L"
                title="Profit & Loss"
                description="Revenue, costs & margin"
                onPress={() =>
                  downloadReportPdf(reportPaths.profitLoss(selectedProject), 'profit-loss.pdf')
                }
              />
              {/* RPT-UI1b-hub: BOQ vs Actual */}
              <ProjectReportCard
                accent={COLORS.success}
                tag="BOQ"
                title="BOQ vs Actual"
                description="Quantity & cost variance"
                meta={evaQ.data ? `${evaQ.data.completionPct.toFixed(0)}% complete` : undefined}
                onPress={() =>
                  downloadReportPdf(reportPaths.boqVsActual(selectedProject), 'boq-vs-actual.pdf')
                }
              />
              {/* RPT-UI1b-hub: Estimate vs Actual */}
              <ProjectReportCard
                accent={COLORS.warning}
                tag="EVA"
                title="Estimate vs Actual"
                description="Budget vs actual spend"
                onPress={() =>
                  downloadReportPdf(reportPaths.estimateVsActual(selectedProject), 'estimate-vs-actual.pdf')
                }
              />
              {/* RPT-UI1b-hub: Resource utilization */}
              <ProjectReportCard
                accent={COLORS.accent}
                tag="RES"
                title="Resource Utilization"
                description="Planned vs used quantities"
                onPress={() =>
                  downloadReportPdf(reportPaths.resourceUtilization(selectedProject), 'resource-utilization.pdf')
                }
              />
              {/* RPT-UI1b-hub: Material rate sheet */}
              <ProjectReportCard
                accent={COLORS.accent}
                tag="₹"
                title="Material Rate Sheet"
                description="Planned vs last PO rate"
                onPress={() =>
                  downloadReportPdf(reportPaths.materialRates(selectedProject), 'material-rates.pdf')
                }
              />
              {canExportTally ? (
                <ProjectReportCard
                  accent={COLORS.primary}
                  tag="XML"
                  title="Export to Tally"
                  description="Invoices & bills as Tally Prime XML"
                  onPress={() => void downloadTallyXml(selectedProject)}
                />
              ) : null}
            </ResponsiveGrid>

            {evaQ.isLoading ? <LoadingSkeleton className="h-4" /> : null}
          </View>
        ) : (
          <EmptyState
            title="Select a project"
            description="Choose a project above to view its reports."
          />
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
          {scheduleError ? (
            <View className="mb-3 px-3 py-2 rounded-lg bg-danger/10 border border-danger/30">
              <Text className="text-sm text-danger">{scheduleError}</Text>
            </View>
          ) : null}
          <Button
            label="Schedule GST report"
            variant="secondary"
            loading={createSchedule.isPending}
            disabled={createSchedule.isPending}
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
      className="p-3 rounded-lg border border-border active:bg-surface h-full"
    >
      <Text className="text-sm font-semibold text-primary">{label}</Text>
      <Text className="text-xs text-muted mt-0.5">{sub}</Text>
    </Pressable>
  );
}

/** Maps a project status to a badge color + dot color. */
function projectStatusColor(status: string): {
  badge: 'success' | 'warning' | 'danger' | 'primary' | 'neutral';
  dot: string;
} {
  switch (status) {
    case 'IN_PROGRESS':
      return { badge: 'primary', dot: COLORS.primary };
    case 'COMPLETED':
      return { badge: 'success', dot: COLORS.success };
    case 'ON_HOLD':
      return { badge: 'warning', dot: COLORS.warning };
    case 'CANCELLED':
      return { badge: 'danger', dot: COLORS.danger };
    default:
      return { badge: 'neutral', dot: COLORS.muted };
  }
}

/** Human-readable status label: "IN_PROGRESS" -> "IN PROGRESS". */
function formatStatusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

/** Rich report card with a colored icon tile, title, description, and meta. */
function ProjectReportCard({
  accent,
  tag,
  title,
  description,
  meta,
  onPress,
}: {
  accent: string;
  tag: string;
  title: string;
  description: string;
  meta?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="p-3 rounded-lg border border-border active:bg-surface flex-row items-center gap-3 h-full"
    >
      <View
        className="w-11 h-11 rounded-lg items-center justify-center"
        style={{ backgroundColor: accent + '1A' }}
      >
        <Text className="text-sm font-bold" style={{ color: accent }}>
          {tag}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-text">{title}</Text>
        <Text className="text-xs text-muted mt-0.5">{description}</Text>
        {meta ? (
          <Text className="text-xs font-semibold mt-1" style={{ color: accent }}>
            {meta}
          </Text>
        ) : null}
      </View>
      <Text className="text-lg text-muted">↓</Text>
    </Pressable>
  );
}