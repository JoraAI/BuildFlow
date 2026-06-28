import React from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Badge, ProgressBar, EmptyState, LoadingSkeleton } from '@/components/ui';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { MobileScreenHeader } from '@/components/layout/ScreenHeader';
import { useViewport } from '@/hooks/useViewport';
import { useProjects, useProjectSummary, type ProjectListItem } from '@/services/project.queries';
import { BRAND_IMAGES } from '@/constants/navigation';
import { daysBetween } from '@/utils/format';

export default function PlanningScreen() {
  const router = useRouter();
  const { isDesktop, isWideDesktop } = useViewport();
  const { data: projects, isLoading, isFetching, refetch } = useProjects();

  const onTrack = projects?.filter((p: ProjectListItem) => p.status === 'IN_PROGRESS').length ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={[]}>
      <ScreenContainer scrollable={isDesktop}>
        {isDesktop ? (
          <>
            <ImageBackground
              source={{ uri: BRAND_IMAGES.planningHero }}
              className="rounded-2xl overflow-hidden mb-6"
              imageStyle={{ borderRadius: 16 }}
            >
              <View className="bg-primary/88 px-8 py-10">
                <Text className="text-3xl font-bold text-white tracking-tight">
                  Project Planning
                </Text>
                <Text className="text-base text-white/75 mt-1 max-w-2xl">
                  Schedules, Gantt charts, critical paths, and schedule variance tracking.
                </Text>
                <View className="flex-row flex-wrap gap-3 mt-5">
                  <HeroStat label="Projects" value={String(projects?.length ?? 0)} />
                  <HeroStat label="Active" value={String(onTrack)} />
                  <HeroStat label="CPM Engine" value="Live" />
                </View>
              </View>
            </ImageBackground>
          </>
        ) : (
          <MobileScreenHeader
            title="Planning"
            subtitle="Schedules, Gantt charts & critical paths"
          />
        )}

        <FlatList
          data={projects ?? []}
          keyExtractor={(item) => item.id}
          scrollEnabled={!isDesktop}
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
          contentContainerClassName={isDesktop ? 'pb-8' : 'px-4 pb-28 pt-2'}
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
                    className={`h-36 rounded-xl ${isDesktop ? 'flex-1 min-w-[30%]' : ''}`}
                  />
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
            <View className={isDesktop ? 'flex-1' : undefined}>
              <PlanningCard
                item={item}
                onPress={() => router.push(`/projects/${item.id}`)}
              />
            </View>
          )}
        />
      </ScreenContainer>
    </SafeAreaView>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View className="bg-white/12 rounded-xl px-4 py-2.5 border border-white/20">
      <Text className="text-white/60 text-xs font-medium">{label}</Text>
      <Text className="text-white text-lg font-bold mt-0.5">{value}</Text>
    </View>
  );
}

function PlanningCard({ item, onPress }: { item: ProjectListItem; onPress: () => void }) {
  const { data: summary } = useProjectSummary(item.id);

  const daysLeft = item.endDate ? daysBetween(new Date(), item.endDate) : null;
  const variance = summary?.scheduleVarianceDays;
  const plannedPct = Math.min(summary?.plannedProgressPct ?? 0, 100);
  const actualPct = summary?.actualProgressPct ?? 0;

  return (
    <Card onPress={onPress} className="h-full">
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-1 mr-2">
          <Text className="text-base font-semibold text-text" numberOfLines={1}>
            {item.name}
          </Text>
          <Text className="text-xs text-muted font-mono mt-0.5">{item.code}</Text>
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

      {summary && (
        <View className="mb-3">
          <View className="flex-row justify-between mb-1.5">
            <Text className="text-xs text-muted">Progress</Text>
            <Text className="text-xs font-medium text-text">
              {actualPct.toFixed(0)}% / {plannedPct.toFixed(0)}% planned
            </Text>
          </View>
          <ProgressBar
            value={actualPct}
            color={summary.scheduleVarianceDays > 0 ? '#EF4444' : '#10B981'}
          />
        </View>
      )}

      <View className="flex-row justify-between items-center pt-2 border-t border-border mt-auto">
        <View className="flex-row items-center gap-1">
          <Ionicons name="alert-circle-outline" size={12} color="#64748B" />
          <Text className="text-xs text-muted">
            {summary ? `${summary.tasksOverdueCount} overdue` : '—'}
          </Text>
        </View>
        {daysLeft !== null && (
          <Text
            className={`text-xs font-semibold ${
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
