import React, { useState } from 'react';
import { View, Text, FlatList, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Badge, ProgressBar, EmptyState, LoadingSkeleton, Button } from '@/components/ui';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { PageHeader, StatChip } from '@/components/layout/PageHeader';
import { MobileScreenHeader } from '@/components/layout/ScreenHeader';
import { mobileListBottomPadding } from '@/components/layout/fab-layout';
import { useViewport } from '@/hooks/useViewport';
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
  const { isDesktop, isWideDesktop } = useViewport();
  const [filter, setFilter] = useState<Filter>('ALL');
  const { data: projects, isLoading, isFetching, refetch } = useProjects();

  const filtered = (projects ?? []).filter(
    (p: ProjectListItem) => filter === 'ALL' || p.status === filter,
  );

  const activeCount = (projects ?? []).filter((p: ProjectListItem) => p.status === 'IN_PROGRESS').length;

  const filterChips = (
    <View className="flex-row gap-2 flex-wrap">
      {FILTERS.map((f) => (
        <Pressable
          key={f.value}
          onPress={() => setFilter(f.value)}
          className={`px-4 py-2 rounded-lg border ${
            filter === f.value ? 'bg-primary border-primary' : 'bg-card border-border'
          }`}
        >
          <Text
            className={`text-sm font-medium ${filter === f.value ? 'text-white' : 'text-muted'}`}
          >
            {f.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={isDesktop ? [] : ['top']}>
      <ScreenContainer scrollable={isDesktop}>
        {isDesktop ? (
          <PageHeader
            title="Projects"
            subtitle={`${projects?.length ?? 0} total · ${activeCount} active`}
            actions={
              <Button
                label="New Project"
                size="sm"
                onPress={() => router.push('/projects/create')}
                icon={<Ionicons name="add" size={18} color="#fff" />}
              />
            }
            stats={
              <>
                <StatChip label="Total" value={String(projects?.length ?? 0)} />
                <StatChip label="Active" value={String(activeCount)} accent="success" />
                <StatChip
                  label="Planning"
                  value={String((projects ?? []).filter((p: ProjectListItem) => p.status === 'PLANNING').length)}
                  accent="warning"
                />
              </>
            }
          />
        ) : (
          <MobileScreenHeader
            title="Projects"
            subtitle={`${projects?.length ?? 0} project${(projects?.length ?? 0) === 1 ? '' : 's'}`}
            actions={
              <Button
                label="New"
                size="sm"
                onPress={() => router.push('/projects/create')}
                icon={<Ionicons name="add" size={16} color="#fff" />}
              />
            }
          />
        )}

        <View className={isDesktop ? 'mb-5' : 'px-4 pb-2'}>{filterChips}</View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          scrollEnabled={!isDesktop}
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
          contentContainerClassName={
            isDesktop ? 'pb-8' : `px-4 pt-2`
          }
          contentContainerStyle={!isDesktop ? { paddingBottom: mobileListBottomPadding() } : undefined}
          numColumns={isWideDesktop ? 3 : isDesktop ? 2 : 1}
          key={isWideDesktop ? 'grid-3' : isDesktop ? 'grid-2' : 'list'}
          columnWrapperClassName={isDesktop ? 'gap-4' : undefined}
          ItemSeparatorComponent={() => <View className={isDesktop ? 'h-4' : 'h-3'} />}
          ListEmptyComponent={
            isLoading ? (
              <View className="gap-3 flex-row flex-wrap">
                {[1, 2, 3].map((i) => (
                  <LoadingSkeleton
                    key={i}
                    className={`h-40 rounded-xl ${isDesktop ? 'flex-1 min-w-[30%]' : ''}`}
                  />
                ))}
              </View>
            ) : (
              <EmptyState
                title="No projects yet"
                description="Create your first project to start planning, scheduling, and tracking costs."
              />
            )
          }
          renderItem={({ item }) => (
            <View className={isDesktop ? 'flex-1' : undefined}>
              <ProjectCard item={item} onPress={() => router.push(`/projects/${item.id}`)} />
            </View>
          )}
        />
      </ScreenContainer>
    </SafeAreaView>
  );
}

function ProjectCard({ item, onPress }: { item: ProjectListItem; onPress: () => void }) {
  const budget = parseFloat(item.budget ?? '0');
  const daysLeft = item.endDate ? daysBetween(new Date(), item.endDate) : null;

  return (
    <Card onPress={onPress} className="h-full">
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1 mr-2">
          <Text className="text-base font-semibold text-text" numberOfLines={1}>
            {item.name}
          </Text>
          <Text className="text-xs text-muted font-mono mt-0.5">{item.code}</Text>
        </View>
        <View className="flex-row gap-1 flex-wrap justify-end">
          <Badge color={TYPE_COLOR[item.type] ?? 'neutral'} label={item.type} />
          <Badge color={STATUS_COLOR[item.status] ?? 'neutral'} label={item.status.replace('_', ' ')} />
        </View>
      </View>

      <Text className="text-sm text-muted mb-3" numberOfLines={1}>
        {item.clientName}
      </Text>

      <View className="flex-row justify-between items-center mb-2">
        <View>
          <Text className="text-xs text-muted">Budget</Text>
          <Text className="text-sm font-semibold text-text">{formatINRCompact(budget)}</Text>
        </View>
        {daysLeft !== null && (
          <View className="items-end">
            <Text className="text-xs text-muted">Days left</Text>
            <Text
              className={`text-sm font-semibold ${
                daysLeft < 0 ? 'text-danger' : daysLeft < 30 ? 'text-warning' : 'text-text'
              }`}
            >
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
