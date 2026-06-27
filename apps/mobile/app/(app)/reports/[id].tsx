/**
 * BuildFlow — Daily Report detail screen with photo gallery.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  Modal,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Card, Badge, EmptyState, LoadingSkeleton } from '@/components/ui';
import { useReport, useReportPhotos, type ReportListItem } from '@/services/report.queries';
import { formatDate } from '@/utils/format';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function ReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const reportQ = useReport(id);
  const photosQ = useReportPhotos(id);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const report = reportQ.data;
  const photoUrls = photosQ.data?.urls ?? [];
  const loading = reportQ.isLoading;

  return (
    <SafeAreaView className="flex-1 bg-surface">
      {/* Header */}
      <View className="px-4 py-3 flex-row items-center border-b border-border">
        <Pressable onPress={() => router.back()}>
          <Text className="text-sm text-muted">← Back</Text>
        </Pressable>
        <Text className="flex-1 text-center text-base font-bold text-text">Report Detail</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View className="p-4">
          <LoadingSkeleton />
        </View>
      ) : !report ? (
        <EmptyState title="Report not found" description="This report may have been deleted." />
      ) : (
        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl refreshing={reportQ.isFetching} onRefresh={() => reportQ.refetch()} />
          }
        >
          {/* Meta */}
          <View className="px-4 py-3">
            <Card className="p-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-lg font-bold text-text">{formatDate(report.reportDate)}</Text>
                <Badge
                  label={report.siteStatus ?? '—'}
                  color={
                    report.siteStatus === 'ON_SCHEDULE'
                      ? 'success'
                      : report.siteStatus === 'DELAYED'
                        ? 'warning'
                        : report.siteStatus === 'BLOCKED'
                          ? 'danger'
                          : 'neutral'
                  }
                />
              </View>
              <View className="flex-row gap-4">
                {report.weather && (
                  <Text className="text-sm text-muted">Weather: {report.weather}</Text>
                )}
                <Text className="text-sm text-muted">Workers: {report.workersCount}</Text>
              </View>
              <Text className="text-xs text-muted mt-1">By {report.reportedByUser.name}</Text>
            </Card>
          </View>

          {/* Work Done */}
          {report.workDone && (
            <View className="px-4 pb-3">
              <Card className="p-4">
                <Text className="text-sm font-semibold text-text mb-1">Work Done</Text>
                <Text className="text-sm text-text leading-5">{report.workDone}</Text>
              </Card>
            </View>
          )}

          {/* Materials */}
          {report.materialUsages.length > 0 && (
            <View className="px-4 pb-3">
              <Card className="p-4">
                <Text className="text-sm font-semibold text-text mb-2">Materials Used</Text>
                {report.materialUsages.map((m: ReportListItem['materialUsages'][number]) => (
                  <View key={m.id} className="flex-row justify-between py-1.5 border-b border-border">
                    <View className="flex-1">
                      <Text className="text-sm text-text">{m.resource.name}</Text>
                      {m.notes && <Text className="text-xs text-muted">{m.notes}</Text>}
                    </View>
                    <Text className="text-sm text-text">
                      {m.quantityUsed} {m.resource.unit}
                    </Text>
                  </View>
                ))}
              </Card>
            </View>
          )}

          {/* Issues */}
          {report.issues && (
            <View className="px-4 pb-3">
              <Card className="p-4">
                <Text className="text-sm font-semibold text-text mb-1">Issues / Blockers</Text>
                <Text className="text-sm text-text leading-5">{report.issues}</Text>
              </Card>
            </View>
          )}

          {/* Photos */}
          <View className="px-4 pb-8">
            <Text className="text-sm font-semibold text-text mb-2">
              Photos ({photoUrls.length})
            </Text>
            {photosQ.isLoading ? (
              <ActivityIndicator color="#1E3A5F" />
            ) : photoUrls.length > 0 ? (
              <FlatList
                data={photoUrls}
                keyExtractor={(item, idx) => `${idx}-${item}`}
                numColumns={3}
                scrollEnabled={false}
                renderItem={({ item, index }) => (
                  <Pressable onPress={() => setLightboxIdx(index)} className="m-0.5">
                    <Image
                      source={{ uri: item }}
                      className="rounded-md"
                      style={{ width: (SCREEN_WIDTH - 48) / 3, height: (SCREEN_WIDTH - 48) / 3 }}
                      resizeMode="cover"
                    />
                  </Pressable>
                )}
              />
            ) : (
              <Text className="text-xs text-muted">No photos attached.</Text>
            )}
          </View>
        </ScrollView>
      )}

      {/* Lightbox Modal */}
      <Modal visible={lightboxIdx !== null} transparent animationType="fade" onRequestClose={() => setLightboxIdx(null)}>
        <View className="flex-1 bg-black/95 justify-center items-center">
          <Pressable className="absolute top-12 right-4 z-10" onPress={() => setLightboxIdx(null)}>
            <Text className="text-white text-lg font-bold">✕</Text>
          </Pressable>
          {lightboxIdx !== null && photoUrls[lightboxIdx] && (
            <Image
              source={{ uri: photoUrls[lightboxIdx] }}
              className="w-full h-[70%]"
              resizeMode="contain"
            />
          )}
          <View className="flex-row gap-4 mt-4">
            <Pressable
              disabled={lightboxIdx === 0}
              onPress={() => setLightboxIdx((i) => (i !== null ? i - 1 : null))}
              className="px-4 py-2 rounded-md bg-white/10"
            >
              <Text className="text-white">‹ Prev</Text>
            </Pressable>
            <Text className="text-white self-center">
              {(lightboxIdx ?? 0) + 1} / {photoUrls.length}
            </Text>
            <Pressable
              disabled={lightboxIdx === photoUrls.length - 1}
              onPress={() => setLightboxIdx((i) => (i !== null ? i + 1 : null))}
              className="px-4 py-2 rounded-md bg-white/10"
            >
              <Text className="text-white">Next ›</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}