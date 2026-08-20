/**
 * BuildFlow - Reports screen
 * Project picker, monthly calendar, and recent daily reports.
 * Desktop: header CTA only (no FAB). Mobile: FAB when list has items; empty-state CTA when empty.
 */
import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Card, Badge, EmptyState, Button, FAB, LoadingSkeleton } from '@/components/ui';
import { PageHeader, StatChip } from '@/components/layout/PageHeader';
import { MobileScreenHeader } from '@/components/layout/ScreenHeader';
import { mobileListBottomPadding } from '@/components/layout/fab-layout';
import { useAppStore } from '@/stores/app.store';
import { useViewport } from '@/hooks/useViewport';
import { useProjects } from '@/services/project.queries';
import {
  useReports,
  useReportCalendar,
  type ReportListItem,
  type CalendarEntry,
} from '@/services/report.queries';
import type { ProjectListItem } from '@/services/project.queries';
import { formatDate } from '@/utils/format';
import { createReportHref, reportDetailHref } from '@/utils/navigation';
import { todayDateOnly } from '@/utils/date-field';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function siteStatusColor(
  status: string | null | undefined,
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'ON_SCHEDULE') return 'success';
  if (status === 'DELAYED') return 'warning';
  if (status === 'BLOCKED') return 'danger';
  return 'neutral';
}

export default function ReportsScreen() {
  const router = useRouter();
  const { isDesktop } = useViewport();
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const setActiveProject = useAppStore((s) => s.setActiveProject);
  const { data: projects } = useProjects();

  const [pickerOpen, setPickerOpen] = useState(false);
  const projectId = activeProjectId ?? projects?.[0]?.id ?? '';
  const month = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const todayStr = todayDateOnly();

  const reportsQ = useReports(projectId);
  const calendarQ = useReportCalendar(projectId, month);

  const reportByDate = useMemo(() => {
    const map = new Map<string, string>();
    calendarQ.data?.forEach((c: CalendarEntry) => map.set(c.date, c.id));
    return map;
  }, [calendarQ.data]);

  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const startWeekday = firstDay.getDay();
  const grid: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);

  const hasProject = !!projectId;
  const loading = reportsQ.isLoading || calendarQ.isLoading;
  const reports = reportsQ.data ?? [];
  const hasReports = reports.length > 0;
  const todayReportId = reportByDate.get(todayStr);
  const filedThisMonth = reportByDate.size;

  const openCreate = (date?: string) => {
    if (!projectId) return;
    router.push(createReportHref(projectId, date ? { date } : undefined) as never);
  };

  const openDay = (dateStr: string) => {
    const existingId = reportByDate.get(dateStr);
    if (existingId) {
      router.push(reportDetailHref(existingId) as never);
      return;
    }
    // Only allow creating for today or past dates in the current month view
    if (dateStr <= todayStr) openCreate(dateStr);
  };

  const projectName =
    projects?.find((p: ProjectListItem) => p.id === projectId)?.name ?? 'Select project';

  const projectToggle = (
    <Pressable
      onPress={() => setPickerOpen((v) => !v)}
      className={`flex-row items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-border ${
        isDesktop ? 'min-w-[200px]' : ''
      }`}
    >
      <Text className="text-sm font-medium text-text flex-1" numberOfLines={1}>
        {projectName}
      </Text>
      <Text className="text-xs text-muted">{pickerOpen ? '▴' : '▾'}</Text>
    </Pressable>
  );

  const projectMenu = pickerOpen ? (
    <View
      className={`rounded-lg border border-border bg-card overflow-hidden ${
        isDesktop ? 'absolute top-full left-0 right-0 z-20 mt-1 shadow-md' : 'mx-4 mb-2'
      }`}
    >
      {(projects ?? []).map((p: ProjectListItem) => (
        <Pressable
          key={p.id}
          onPress={() => {
            setActiveProject(p.id);
            setPickerOpen(false);
          }}
          className={`px-4 py-3 border-b border-border ${p.id === projectId ? 'bg-primary/5' : ''}`}
        >
          <Text className={`text-sm ${p.id === projectId ? 'text-primary font-semibold' : 'text-text'}`}>
            {p.name}
          </Text>
        </Pressable>
      ))}
    </View>
  ) : null;

  const todayBanner = hasProject ? (
    <Card className={`p-3 mb-3 ${todayReportId ? 'border-success/30 bg-success/5' : 'border-accent/30 bg-accent/5'}`}>
      <View className={`flex-row items-center gap-3 ${isDesktop ? '' : 'flex-wrap'}`}>
        <View className="flex-1 min-w-0">
          <Text className="text-sm font-semibold text-text">
            {todayReportId ? 'Today’s report is filed' : 'No report for today yet'}
          </Text>
          <Text className="text-xs text-muted mt-0.5">
            {todayReportId
              ? 'Open it to review work, materials, and photos.'
              : 'Log site status, work done, materials, and photos.'}
          </Text>
        </View>
        {todayReportId ? (
          <Button
            label="View today"
            variant="secondary"
            size="sm"
            onPress={() => router.push(reportDetailHref(todayReportId) as never)}
          />
        ) : (
          <Button label="Log today" size="sm" onPress={() => openCreate(todayStr)} />
        )}
      </View>
    </Card>
  ) : null;

  const calendarCard = (
    <Card className="p-3">
      <Text className="text-xs font-semibold text-muted uppercase mb-2">
        {today.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
      </Text>
      <View className="flex-row justify-between mb-1">
        {WEEKDAYS.map((d, i) => (
          <Text key={i} className="flex-1 text-center text-xs text-muted">
            {d}
          </Text>
        ))}
      </View>
      <View className="flex-row flex-wrap">
        {grid.map((day, idx) => {
          if (day === null) return <View key={idx} className="w-[14.28%] h-9" />;
          const dateStr = `${month}-${String(day).padStart(2, '0')}`;
          const hasReport = reportByDate.has(dateStr);
          const isToday = dateStr === todayStr;
          const canTap = hasReport || dateStr <= todayStr;
          return (
            <Pressable
              key={idx}
              disabled={!canTap}
              onPress={() => openDay(dateStr)}
              accessibilityRole="button"
              accessibilityLabel={
                hasReport
                  ? `Open report for ${dateStr}`
                  : `Create report for ${dateStr}`
              }
              className="w-[14.28%] h-9 items-center justify-center"
            >
              <View
                className={`w-7 h-7 rounded-full items-center justify-center ${
                  hasReport ? 'bg-success' : isToday ? 'bg-accent' : ''
                }`}
              >
                <Text
                  className={`text-xs ${
                    hasReport || isToday ? 'text-white font-bold' : 'text-text'
                  }`}
                >
                  {day}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <View className="flex-row flex-wrap gap-3 mt-2">
        <View className="flex-row items-center gap-1">
          <View className="w-2.5 h-2.5 rounded-full bg-success" />
          <Text className="text-xs text-muted">Report filed · tap to open</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <View className="w-2.5 h-2.5 rounded-full bg-accent" />
          <Text className="text-xs text-muted">Today</Text>
        </View>
      </View>
    </Card>
  );

  const reportsList = (
    <View>
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-sm font-semibold text-text">Recent reports</Text>
        {hasReports && !isDesktop ? (
          <Text className="text-xs text-muted">{reports.length} total</Text>
        ) : null}
      </View>
      {loading ? (
        <View className="gap-2">
          <LoadingSkeleton className="h-20 rounded-xl" />
          <LoadingSkeleton className="h-20 rounded-xl" />
        </View>
      ) : hasReports ? (
        reports.map((item: ReportListItem) => (
          <ReportRow
            key={item.id}
            item={item}
            onPress={() => router.push(reportDetailHref(item.id) as never)}
          />
        ))
      ) : (
        <EmptyState
          title="No reports yet"
          description="Create the first daily report for this project. One report per day."
          action={
            // Mobile empty: primary CTA here (no FAB). Desktop uses header button.
            !isDesktop ? (
              <Button label="New daily report" onPress={() => openCreate()} />
            ) : undefined
          }
        />
      )}
    </View>
  );

  const body = !hasProject ? (
    <EmptyState
      title="No project selected"
      description="Create or select a project first to start logging daily reports."
      action={<Button label="Go to Projects" onPress={() => router.push('/(app)/projects')} />}
    />
  ) : (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{
        paddingBottom: isDesktop ? 40 : mobileListBottomPadding(hasReports),
      }}
      contentContainerClassName={isDesktop ? 'items-center' : undefined}
      refreshControl={
        <RefreshControl
          refreshing={loading && (reportsQ.isFetching || calendarQ.isFetching)}
          onRefresh={() => {
            reportsQ.refetch();
            calendarQ.refetch();
          }}
        />
      }
    >
      <View className={isDesktop ? 'w-full max-w-7xl px-8 py-6' : 'px-4'}>
        {isDesktop ? (
          <PageHeader
            title="Reports"
            subtitle="Daily site reports"
            actions={
              <View className="flex-row items-center gap-2 relative z-30">
                <View className="relative">
                  {projectToggle}
                  {projectMenu}
                </View>
                <Button label="New report" onPress={() => openCreate()} />
              </View>
            }
            stats={
              <>
                <StatChip label="This month" value={String(filedThisMonth)} accent="success" />
                <StatChip
                  label="Today"
                  value={todayReportId ? 'Filed' : 'Open'}
                  accent={todayReportId ? 'success' : 'warning'}
                />
              </>
            }
          />
        ) : null}

        {todayBanner}

        {isDesktop ? (
          <View className="flex-row gap-6 items-start">
            <View className="w-[340px] shrink-0">{calendarCard}</View>
            <View className="flex-1 min-w-0">{reportsList}</View>
          </View>
        ) : (
          <>
            <View className="mb-3">{calendarCard}</View>
            {reportsList}
          </>
        )}
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={isDesktop ? [] : ['bottom']}>
      {!isDesktop ? (
        <MobileScreenHeader
          title="Reports"
          subtitle="Daily site reports"
          actions={hasProject ? projectToggle : undefined}
        />
      ) : null}

      {!isDesktop && hasProject ? projectMenu : null}

      {body}

      {/* Mobile only: FAB when there are reports (empty state already has the create button). Never on desktop. */}
      {hasProject && !isDesktop && hasReports ? (
        <FAB label="New report" onPress={() => openCreate()} />
      ) : null}
    </SafeAreaView>
  );
}

function ReportRow({ item, onPress }: { item: ReportListItem; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card className="p-3 mb-2">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-sm font-semibold text-text">{formatDate(item.reportDate)}</Text>
          <Badge label={item.siteStatus ?? 'LOGGED'} color={siteStatusColor(item.siteStatus)} />
        </View>
        {item.workDone ? (
          <Text className="text-xs text-muted" numberOfLines={2}>
            {item.workDone}
          </Text>
        ) : null}
        <View className="flex-row flex-wrap gap-x-3 gap-y-1 mt-2">
          <Text className="text-xs text-muted">{item.workersCount} workers</Text>
          <Text className="text-xs text-muted">{item.photos.length} photos</Text>
          <Text className="text-xs text-muted">{item.reportedByUser.name}</Text>
        </View>
      </Card>
    </Pressable>
  );
}
