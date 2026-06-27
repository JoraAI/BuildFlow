import React from 'react';
import { View, Text, FlatList, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Card, Badge, ProgressBar, EmptyState, LoadingSkeleton } from '@/components/ui';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { useProjects, useProjectSummary, type ProjectListItem } from '@/services/project.queries';
import { daysBetween, formatDate } from '@/utils/format';

export default function PlanningScreen() {
  const router = useRouter();
  const { data: projects, isLoading, isFetching, refetch } = useProjects();

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <OfflineBanner />
      <View className="px-4 pt-4 pb-2">
        <Text className="text-2xl font-bold text-text">Planning</Text>
        <Text className="text-sm text-muted">Schedules, Gantt charts & critical paths</Text>
      </View>

      <FlatList
        data={projects ?? []}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        contentContainerClassName="px-4 pb-24 pt-2"
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListEmptyComponent={
          isLoading ? (
            <View className="gap-3">
              {[1, 2].map((i) => (
                <LoadingSkeleton key={i} className="h-28 rounded-xl" />
              ))}
            </View>
          ) : (
            <EmptyState
              title="No projects to plan"
              description="Create a project first, then add tasks and dependencies to build schedules."
            />
          )
        }
        renderItem={({ item }: { item: ProjectListItem }) => (
          <PlanningCard
            item={item}
            onPress={() => router.push(`/projects/${item.id}`)}
          />
        )}
      />
    </SafeAreaView>
  );
}

function PlanningCard({ item, onPress }: { item: ProjectListItem; onPress: () => void }) {
  const { data: summary } = useProjectSummary(item.id);

  const daysLeft = item.endDate ? daysBetween(new Date(), item.endDate) : null;
  const variance = summary?.scheduleVarianceDays;

  return (
    <Card onPress={onPress}>
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1 mr-2">
          <Text className="text-base font-semibold text-text" numberOfLines={1}>
            {item.name}
          </Text>
          <Text className="text-xs text-muted font-mono">{item.code}</Text>
        </View>
        {variance !== undefined && (
          <Badge
            color={variance === 0 ? 'success' : variance > 0 ? 'danger' : 'warning'}
            label={
              variance === 0
                ? 'On Track'
                : variance > 0
                ? `${variance}d Behind`
                : `${Math.abs(variance)}d Ahead`
            }
          />
        )}
      </View>

      {/* Progress */}
      {summary && (
        <View className="mb-2">
          <View className="flex-row justify-between mb-1">
            <Text className="text-xs text-muted">Progress</Text>
            <Text className="text-xs font-medium text-text">
              {summary.actualProgress.toFixed(0)}% / {summary.plannedProgress.toFixed(0)}% planned
            </Text>
          </View>
          <ProgressBar
            value={summary.actualProgress}
            color={summary.scheduleVarianceDays > 0 ? '#EF4444' : '#10B981'}
          />
        </View>
      )}

      <View className="flex-row justify-between items-center">
        <Text className="text-xs text-muted">
          {summary ? `${summary.tasksOverdueCount} overdue` : '—'}
        </Text>
        {daysLeft !== null && (
          <Text
            className={`text-xs font-medium ${
              daysLeft < 0 ? 'text-danger' : daysLeft < 30 ? 'text-warning' : 'text-muted'
            }`}
          >
            {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
          </Text>
        )}
      </View>
    </Card>
  );
}