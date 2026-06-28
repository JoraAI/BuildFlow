/**
 * BuildFlow — Reports screen (Phase 3)
 * Shows a project picker, monthly calendar of reports, and list of recent reports.
 */
import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Card, Badge, EmptyState, Button, FAB, LoadingSkeleton } from '@/components/ui';
import { MobileScreenHeader } from '@/components/layout/ScreenHeader';
import { mobileListBottomPadding } from '@/components/layout/fab-layout';
import { useAppStore } from '@/stores/app.store';
import { useProjects } from '@/services/project.queries';
import {
  useReports,
  useReportCalendar,
  type ReportListItem,
  type CalendarEntry,
} from '@/services/report.queries';
import type { ProjectListItem } from '@/services/project.queries';
import { formatINR, formatDate } from '@/utils/format';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function ReportsScreen() {
  const router = useRouter();
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const setActiveProject = useAppStore((s) => s.setActiveProject);
  const { data: projects } = useProjects();

  const [pickerOpen, setPickerOpen] = useState(false);
  const projectId = activeProjectId ?? projects?.[0]?.id ?? '';
  const month = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const reportsQ = useReports(projectId);
  const calendarQ = useReportCalendar(projectId, month);

  const reportDays = useMemo(() => {
    const set = new Set<string>();
    calendarQ.data?.forEach((c: CalendarEntry) => set.add(c.date));
    return set;
  }, [calendarQ.data]);

  // --- Build calendar grid for current month ---
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const startWeekday = firstDay.getDay();
  const grid: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);

  const hasProject = !!projectId;
  const loading = reportsQ.isLoading || calendarQ.isLoading;

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <MobileScreenHeader
        title="Reports"
        subtitle="Daily site reports"
        actions={
          hasProject ? (
            <Pressable
              onPress={() => setPickerOpen((v) => !v)}
              className="flex-row items-center gap-1 px-3 py-1.5 rounded-lg bg-card border border-border"
            >
              <Text className="text-sm font-medium text-text">
                {projects?.find((p: ProjectListItem) => p.id === projectId)?.name ?? 'Select'}
              </Text>
              <Text className="text-xs text-muted">▾</Text>
            </Pressable>
          ) : undefined
        }
      />

      {pickerOpen && (
        <View className="mx-4 mb-2 rounded-lg border border-border bg-card overflow-hidden">
          {projects?.map((p: ProjectListItem) => (
            <Pressable
              key={p.id}
              onPress={() => {
                setActiveProject(p.id);
                setPickerOpen(false);
              }}
              className="px-4 py-3 border-b border-border"
            >
              <Text className="text-sm text-text">{p.name}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {!hasProject ? (
        <EmptyState
          title="No project selected"
          description="Create or select a project first to start logging daily reports."
          action={<Button label="Go to Projects" onPress={() => router.push('/(app)/projects')} />}
        />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: mobileListBottomPadding(true) }}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => {
                reportsQ.refetch();
                calendarQ.refetch();
              }}
            />
          }
        >
          {/* Calendar */}
          <View className="px-4 mb-3">
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
                  if (day === null)
                    return <View key={idx} className="w-[14.28%] h-9" />;
                  const dateStr = `${month}-${String(day).padStart(2, '0')}`;
                  const hasReport = reportDays.has(dateStr);
                  const isToday = day === today.getDate();
                  return (
                    <View
                      key={idx}
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
                    </View>
                  );
                })}
              </View>
              <View className="flex-row gap-3 mt-2">
                <View className="flex-row items-center gap-1">
                  <View className="w-2.5 h-2.5 rounded-full bg-success" />
                  <Text className="text-xs text-muted">Report filed</Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <View className="w-2.5 h-2.5 rounded-full bg-accent" />
                  <Text className="text-xs text-muted">Today</Text>
                </View>
              </View>
            </Card>
          </View>

          {/* Reports list */}
          <View className="px-4">
            <Text className="text-sm font-semibold text-text mb-2">Recent Reports</Text>
            {loading ? (
              <LoadingSkeleton />
            ) : reportsQ.data && reportsQ.data.length > 0 ? (
              <FlatList
                data={reportsQ.data}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                renderItem={({ item }) => <ReportRow item={item} onPress={() => router.push(`/reports/${item.id}`)} />}
              />
            ) : (
              <EmptyState
                title="No reports yet"
                description="Tap the + button to create the first daily report for this project."
                action={<Button label="New Daily Report" onPress={() => router.push('/reports/create')} />}
              />
            )}
          </View>
        </ScrollView>
      )}

      {hasProject && <FAB onPress={() => router.push('/reports/create')} />}
    </SafeAreaView>
  );
}

function ReportRow({ item, onPress }: { item: ReportListItem; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Card className="p-3 mb-2">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-sm font-semibold text-text">
            {formatDate(item.reportDate)}
          </Text>
          <Badge
            label={item.siteStatus ?? '—'}
            color={
              item.siteStatus === 'ON_SCHEDULE'
                ? 'success'
                : item.siteStatus === 'DELAYED'
                  ? 'warning'
                  : item.siteStatus === 'BLOCKED'
                    ? 'danger'
                    : 'neutral'
            }
          />
        </View>
        {item.workDone ? (
          <Text className="text-xs text-muted" numberOfLines={2}>
            {item.workDone}
          </Text>
        ) : null}
        <View className="flex-row gap-3 mt-2">
          <Text className="text-xs text-muted">
            👷 {item.workersCount} workers
          </Text>
          <Text className="text-xs text-muted">
            📷 {item.photos.length} photos
          </Text>
          <Text className="text-xs text-muted">
            📝 {item.reportedByUser.name}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}