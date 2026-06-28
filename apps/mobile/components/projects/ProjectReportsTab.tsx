import React, { useMemo } from 'react';
import { View, Text, Pressable, RefreshControl, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Badge, Button, EmptyState, LoadingSkeleton } from '@/components/ui';
import { useAppStore } from '@/stores/app.store';
import {
  useReports,
  useReportCalendar,
  type ReportListItem,
  type CalendarEntry,
} from '@/services/report.queries';
import { formatDate } from '@/utils/format';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface ProjectReportsTabProps {
  projectId: string;
}

export function ProjectReportsTab({ projectId }: ProjectReportsTabProps) {
  const router = useRouter();
  const setActiveProject = useAppStore((s) => s.setActiveProject);
  const month = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const reportsQ = useReports(projectId);
  const calendarQ = useReportCalendar(projectId, month);

  const reportDays = useMemo(() => {
    const set = new Set<string>();
    calendarQ.data?.forEach((c: CalendarEntry) => set.add(c.date));
    return set;
  }, [calendarQ.data]);

  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const startWeekday = firstDay.getDay();
  const grid: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);

  const loading = reportsQ.isLoading || calendarQ.isLoading;

  const openCreate = () => {
    setActiveProject(projectId);
    router.push('/reports/create' as never);
  };

  return (
    <ScrollView
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
      <View className="gap-3">
        <Button label="New daily report" onPress={openCreate} fullWidth />

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
              const hasReport = reportDays.has(dateStr);
              const isToday = day === today.getDate();
              return (
                <View key={idx} className="w-[14.28%] h-9 items-center justify-center">
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
        </Card>

        <Text className="text-sm font-semibold text-text">Recent reports</Text>
        {loading ? (
          <LoadingSkeleton className="h-24 rounded-xl" />
        ) : reportsQ.data && reportsQ.data.length > 0 ? (
          reportsQ.data.map((item: ReportListItem) => (
            <ReportRow
              key={item.id}
              item={item}
              onPress={() => router.push(`/reports/${item.id}` as never)}
            />
          ))
        ) : (
          <EmptyState
            title="No reports yet"
            description="Log daily work, materials used, and site photos for this project."
            action={<Button label="New daily report" onPress={openCreate} />}
          />
        )}
      </View>
    </ScrollView>
  );
}

function ReportRow({ item, onPress }: { item: ReportListItem; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Card className="p-3 mb-2">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-sm font-semibold text-text">{formatDate(item.reportDate)}</Text>
          <Badge
            label={item.siteStatus ?? 'LOGGED'}
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
          <Text className="text-xs text-muted">{item.workersCount} workers</Text>
          <Text className="text-xs text-muted">{item.materialUsages.length} materials</Text>
          <Text className="text-xs text-muted">{item.photos.length} photos</Text>
        </View>
      </Card>
    </Pressable>
  );
}
