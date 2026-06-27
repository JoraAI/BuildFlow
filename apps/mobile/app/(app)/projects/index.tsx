import React, { useState } from 'react';
import { View, Text, FlatList, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Card, Badge, ProgressBar, FAB, EmptyState, LoadingSkeleton } from '@/components/ui';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { useProjects, type ProjectListItem } from '@/services/project.queries';
import { formatINRCompact, formatDate, daysBetween } from '@/utils/format';

type Filter = 'ALL' | 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED';

const FILTERS: { label: string; value: Filter }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Active', value: 'IN_PROGRESS' },
  { label: 'Planning', value: 'PLANNING' },
  { label: 'Completed', value: 'COMPLETED' },
];

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'neutral'> = {
  PLANNING: 'primary',
  IN_PROGRESS: 'warning',
  ON_HOLD: 'neutral',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

const TYPE_COLOR: Record<string, 'danger' | 'warning' | 'primary' | 'neutral'> = {
  HEAVY: 'danger',
  LARGE: 'warning',
  MID: 'primary',
  MINI: 'neutral',
};

export default function ProjectsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('ALL');
  const { data: projects, isLoading, isFetching, refetch } = useProjects();

  const filtered = (projects ?? []).filter(
    (p: ProjectListItem) => filter === 'ALL' || p.status === filter,
  );

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <OfflineBanner />

      {/* Header */}
      <View className="px-4 pt-4 pb-2">
        <Text className="text-2xl font-bold text-text">Projects</Text>
        <Text className="text-sm text-muted">
          {projects?.length ?? 0} project{(projects?.length ?? 0) === 1 ? '' : 's'}
        </Text>
      </View>

      {/* Filter chips */}
      <View className="flex-row px-4 pb-2 gap-2">
        {FILTERS.map((f) => (
          <Pressable
            key={f.value}
            onPress={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-full border ${
              filter === f.value
                ? 'bg-primary border-primary'
                : 'bg-card border-border'
            }`}
          >
            <Text
              className={`text-xs font-medium ${
                filter === f.value ? 'text-white' : 'text-muted'
              }`}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        contentContainerClassName="px-4 pb-24 pt-2"
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListEmptyComponent={
          isLoading ? (
            <View className="gap-3">
              {[1, 2, 3].map((i) => (
                <LoadingSkeleton key={i} className="h-32 rounded-xl" />
              ))}
            </View>
          ) : (
            <EmptyState
              title="No projects yet"
              description="Create your first project to start planning, scheduling, and tracking costs."
            />
          )
        }
        renderItem={({ item }) => <ProjectCard item={item} onPress={() => router.push(`/projects/${item.id}`)} />}
      />

      <FAB label="Create" onPress={() => router.push('/projects/create')} />
    </SafeAreaView>
  );
}

function ProjectCard({ item, onPress }: { item: ProjectListItem; onPress: () => void }) {
  const budget = parseFloat(item.budget ?? '0');
  const daysLeft = item.endDate ? daysBetween(new Date(), item.endDate) : null;

  return (
    <Card onPress={onPress}>
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1 mr-2">
          <Text className="text-base font-semibold text-text" numberOfLines={1}>
            {item.name}
          </Text>
          <Text className="text-xs text-muted font-mono">{item.code}</Text>
        </View>
        <View className="flex-row gap-1">
          <Badge color={TYPE_COLOR[item.type] ?? 'neutral'} label={item.type} />
          <Badge color={STATUS_COLOR[item.status] ?? 'neutral'} label={item.status.replace('_', ' ')} />
        </View>
      </View>

      <Text className="text-sm text-muted mb-3" numberOfLines={1}>
        {item.clientName}
      </Text>

      {/* Budget + progress row */}
      <View className="flex-row justify-between items-center mb-2">
        <View>
          <Text className="text-xs text-muted">Budget</Text>
          <Text className="text-sm font-semibold text-text">{formatINRCompact(budget)}</Text>
        </View>
        {daysLeft !== null && (
          <View className="items-end">
            <Text className="text-xs text-muted">Days left</Text>
            <Text className={`text-sm font-semibold ${daysLeft < 0 ? 'text-danger' : daysLeft < 30 ? 'text-warning' : 'text-text'}`}>
              {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d`}
            </Text>
          </View>
        )}
      </View>

      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <ProgressBar value={0} color="#1E3A5F" />
        </View>
        {item._count?.tasks !== undefined && (
          <Text className="text-xs text-muted">{item._count.tasks} tasks</Text>
        )}
      </View>

      {item.endDate && (
        <Text className="text-xs text-muted mt-2">Due {formatDate(item.endDate)}</Text>
      )}
    </Card>
  );
}