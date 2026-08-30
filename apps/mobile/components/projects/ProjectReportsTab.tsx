import React, { useMemo } from 'react';
import { View, Text, Pressable, RefreshControl, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Badge, Button, EmptyState, LoadingSkeleton } from '@/components/ui';
import { useAppStore } from '@/stores/app.store';
import { useViewport } from '@/hooks/useViewport';
import {
  useReports,
  useReportCalendar,
  type ReportListItem,
  type CalendarEntry,
} from '@/services/report.queries';
import { formatDate } from '@/utils/format';
import { createReportHref, reportDetailHref, projectTabHref } from '@/utils/navigation';
import { todayDateOnly } from '@/utils/date-field';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface ProjectReportsTabProps {
  projectId: string;
}

function siteStatusColor(
  status: string | null | undefined,
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'ON_SCHEDULE') return 'success';
  if (status === 'DELAYED') return 'warning';
  if (status === 'BLOCKED') return 'danger';
  return 'neutral';
}

export function ProjectReportsTab({ projectId }: ProjectReportsTabProps) {
  const router = useRouter();
  const { isDesktop } = useViewport();
  const setActiveProject = useAppStore((s) => s.setActiveProject);
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

  const loading = reportsQ.isLoading || calendarQ.isLoading;
  const reports = reportsQ.data ?? [];
  const hasReports = reports.length > 0;
  const todayReportId = reportByDate.get(todayStr);

  const openCreate = (date?: string) => {
    setActiveProject(projectId);
    router.push(createReportHref(projectId, date ? { date } : undefined) as never);
  };

  const openDay = (dateStr: string) => {
    const existingId = reportByDate.get(dateStr);
    if (existingId) {
      router.push(
        reportDetailHref(existingId, projectTabHref(projectId, 'reports')) as never,
      );
      return;
    }
    if (dateStr <= todayStr) openCreate(dateStr);
  };

  return (
    <ScrollView
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
      <View className={`gap-3 ${isDesktop ? 'max-w-5xl' : ''}`}>
        {/* Today status - single primary action for today */}
        <Card
          className={`p-3 ${
            todayReportId ? 'border-success/30 bg-success/5' : 'border-accent/30 bg-accent/5'
          }`}
        >
          <View className={`flex-row items-center gap-3 ${isDesktop ? '' : 'flex-wrap'}`}>
            <View className="flex-1 min-w-0">
              <Text className="text-sm font-semibold text-text">
                {todayReportId ? 'Today’s report is filed' : 'No report for today yet'}
              </Text>
              <Text className="text-xs text-muted mt-0.5">
                {todayReportId
                  ? 'Open it to review work logged on site.'
                  : 'Log work, materials, and site status for today.'}
              </Text>
            </View>
            {todayReportId ? (
              <Button
                label="View today"
                variant="secondary"
                size="sm"
                onPress={() =>
                  router.push(
                    reportDetailHref(todayReportId, projectTabHref(projectId, 'reports')) as never,
                  )
                }
              />
            ) : (
              <Button label="Log today" size="sm" onPress={() => openCreate(todayStr)} />
            )}
          </View>
        </Card>

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
          <Text className="text-[11px] text-muted mt-2">
            Tap a filed day to open · tap an open past/today cell to create
          </Text>
        </Card>

        <View className="flex-row items-center justify-between gap-2">
          <Text className="text-sm font-semibold text-text">Recent reports</Text>
          {/* Only when list has items - empty state owns the create CTA */}
          {hasReports ? (
            <Button label="New report" variant="secondary" size="sm" onPress={() => openCreate()} />
          ) : null}
        </View>

        {loading ? (
          <LoadingSkeleton className="h-24 rounded-xl" />
        ) : hasReports ? (
          reports.map((item: ReportListItem) => (
            <ReportRow
              key={item.id}
              item={item}
              onPress={() =>
                router.push(
                  reportDetailHref(item.id, projectTabHref(projectId, 'reports')) as never,
                )
              }
            />
          ))
        ) : (
          <EmptyState
            title="No reports yet"
            description="Log daily work, materials used, and site photos for this project."
            action={<Button label="New daily report" onPress={() => openCreate()} />}
          />
        )}
      </View>
    </ScrollView>
  );
}

function ReportRow({ item, onPress }: { item: ReportListItem; onPress: () => void }) {
  const weatherIcon = item.weather === 'SUNNY'
    ? '☀️'
    : item.weather === 'CLOUDY'
    ? '☁️'
    : item.weather === 'RAIN'
    ? '🌧️'
    : item.weather === 'STORM'
    ? '⛈️'
    : item.weather === 'FOG'
    ? '🌫️'
    : item.weather
    ? '🌤️'
    : null;

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card className="p-3 mb-2">
        <View className="flex-row items-center justify-between mb-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-sm font-semibold text-text">{formatDate(item.reportDate)}</Text>
            {weatherIcon ? <Text className="text-sm">{weatherIcon}</Text> : null}
          </View>
          <Badge label={item.siteStatus ?? 'LOGGED'} color={siteStatusColor(item.siteStatus)} />
        </View>
        {item.workDone ? (
          <Text className="text-xs text-muted" numberOfLines={2}>
            {item.workDone}
          </Text>
        ) : null}
        <View className="flex-row flex-wrap gap-x-3 gap-y-1 mt-2">
          <Text className="text-xs text-muted font-medium">👥 {item.workersCount} workers</Text>
          {item.materialUsages?.length ? (
            <Text className="text-xs text-muted">📦 {item.materialUsages.length} materials</Text>
          ) : null}
          {item.photos?.length ? (
            <Text className="text-xs text-muted">📷 {item.photos.length} photos</Text>
          ) : null}
          <Text className="text-xs text-muted">👤 {item.reportedByUser?.name}</Text>
        </View>
      </Card>
    </Pressable>
  );
}
