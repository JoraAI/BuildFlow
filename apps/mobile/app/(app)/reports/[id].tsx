/**
 * BuildFlow - Daily Report detail screen with photo gallery.
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
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Badge, EmptyState, LoadingSkeleton } from '@/components/ui';
import { FormScreenHeader } from '@/components/layout/ScreenHeader';
import { DISMISS, parseReturnTo, navigateAppBack } from '@/utils/navigation';
import { useReport, useReportPhotos, type ReportListItem } from '@/services/report.queries';
import { useLaborMusterStore } from '@/stores/labor-muster.store';
import { usePettyCashEntries, type PettyCashEntry } from '@/services/petty-cash.queries';
import { downloadReportPdf, reportPaths } from '@/services/report-download';
import { formatDate, formatINR } from '@/utils/format';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function ReportDetailScreen() {
  const { id, returnTo: returnToParam } = useLocalSearchParams<{ id: string; returnTo?: string }>();
  const returnTo = parseReturnTo(returnToParam);
  const goBack = () => navigateAppBack(DISMISS.reports, returnTo);
  const reportQ = useReport(id);
  const photosQ = useReportPhotos(id);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const report = reportQ.data;
  const photoUrls = photosQ.data?.urls ?? [];
  const loading = reportQ.isLoading;

  const reportDateStr = report?.reportDate
    ? new Date(report.reportDate).toISOString().slice(0, 10)
    : '';

  const muster = useLaborMusterStore((s) =>
    report?.projectId && reportDateStr ? s.getMuster(report.projectId, reportDateStr) : null
  );

  const pettyCashQ = usePettyCashEntries(
    report?.projectId ? { projectId: report.projectId } : undefined
  );

  const dayExpenses = (pettyCashQ.data?.rows ?? []).filter((e: PettyCashEntry) => {
    if (!reportDateStr) return false;
    const eDate = e.expenseDate ? e.expenseDate.slice(0, 10) : '';
    return eDate === reportDateStr;
  });

  const totalDayExpense = dayExpenses.reduce((sum: number, e: PettyCashEntry) => sum + Number(e.amount), 0);

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <FormScreenHeader
        title="Report Detail"
        cancelLabel="Back"
        onCancel={goBack}
      />

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
                  label={report.siteStatus ?? '-'}
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
              {report.project && (
                <Text className="text-sm font-medium text-text mb-1">
                  {report.project.name}{' '}
                  <Text className="text-muted font-normal">({report.project.code})</Text>
                </Text>
              )}
              {/* Weather & Site Metrics */}
              <View className="flex-row flex-wrap gap-2 my-2 pt-2 border-t border-border/50">
                {report.weather && (
                  <View className="flex-row items-center gap-1.5 bg-surface px-2.5 py-1.5 rounded-lg border border-border">
                    <Text className="text-sm">
                      {report.weather === 'SUNNY'
                        ? '☀️'
                        : report.weather === 'CLOUDY'
                        ? '☁️'
                        : report.weather === 'RAIN'
                        ? '🌧️'
                        : report.weather === 'STORM'
                        ? '⛈️'
                        : report.weather === 'FOG'
                        ? '🌫️'
                        : '🌤️'}
                    </Text>
                    <Text className="text-xs font-semibold text-text">
                      {report.weather.charAt(0) + report.weather.slice(1).toLowerCase()}
                    </Text>
                  </View>
                )}
                <View className="flex-row items-center gap-1.5 bg-surface px-2.5 py-1.5 rounded-lg border border-border">
                  <Ionicons name="people" size={14} color="#1E3A5F" />
                  <Text className="text-xs font-semibold text-text">
                    {report.workersCount} Workers
                  </Text>
                </View>
                {dayExpenses.length > 0 && (
                  <View className="flex-row items-center gap-1.5 bg-surface px-2.5 py-1.5 rounded-lg border border-border">
                    <Ionicons name="cash" size={14} color="#10B981" />
                    <Text className="text-xs font-semibold text-emerald-600">
                      {formatINR(totalDayExpense)} Expense
                    </Text>
                  </View>
                )}
              </View>

              <Text className="text-xs text-muted mt-1">By {report.reportedByUser.name}</Text>
              {/* RPT-UI1b-daily: Download PDF button */}
              <View className="mt-3 pt-3 border-t border-border/60">
                <Pressable
                  onPress={() => downloadReportPdf(reportPaths.dailyReport(id), `daily-report-${id}.pdf`)}
                  className="flex-row items-center justify-center gap-2 py-2.5 rounded-lg border border-primary/30 bg-primary/5 active:bg-surface"
                >
                  <Ionicons name="download-outline" size={16} color="#1E3A5F" />
                  <Text className="text-sm font-semibold text-primary">Download PDF</Text>
                </Pressable>
              </View>
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

          {/* Labor & Muster Section */}
          <View className="px-4 pb-3">
            <Card className="p-4">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="people-outline" size={18} color="#1E3A5F" />
                  <Text className="text-sm font-semibold text-text">Labor & Gang Muster</Text>
                </View>
                <Badge
                  label={`${report.workersCount ?? muster?.totalHeadcount ?? 0} Workers`}
                  color="primary"
                />
              </View>

              {muster && muster.trades && muster.trades.length > 0 ? (
                <View className="gap-2 mt-1">
                  <View className="flex-row gap-2 bg-surface p-2 rounded-lg border border-border">
                    <View className="flex-1">
                      <Text className="text-[10px] text-muted">Active Gangs</Text>
                      <Text className="text-xs font-bold text-text">
                        {muster.trades.filter((t) => t.headcount > 0).length} Trades
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-[10px] text-muted">Overtime (OT)</Text>
                      <Text className="text-xs font-bold text-amber-600">
                        {muster.totalOtHours?.toFixed(1) ?? '0.0'} hrs
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-[10px] text-muted">Est. Daily Wage</Text>
                      <Text className="text-xs font-bold text-emerald-600">
                        {formatINR(muster.totalEstimatedWage ?? 0)}
                      </Text>
                    </View>
                  </View>

                  <View className="gap-1.5 mt-1">
                    {muster.trades
                      .filter((t) => t.headcount > 0)
                      .map((t) => (
                        <View
                          key={t.id}
                          className="flex-row items-center justify-between py-1 border-b border-border/50"
                        >
                          <Text className="text-xs text-text">{t.trade}</Text>
                          <View className="flex-row items-center gap-2">
                            <Text className="text-xs font-semibold text-text">
                              {t.headcount} workers
                            </Text>
                            {t.otHours > 0 ? (
                              <Text className="text-[10px] text-amber-600 font-medium">
                                ({t.otHours}h OT)
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      ))}
                  </View>
                </View>
              ) : (
                <Text className="text-xs text-muted">
                  Total {report.workersCount ?? 0} site workers logged for this date.
                </Text>
              )}
            </Card>
          </View>

          {/* Site Expenses & Petty Cash Section */}
          <View className="px-4 pb-3">
            <Card className="p-4">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="cash-outline" size={18} color="#1E3A5F" />
                  <Text className="text-sm font-semibold text-text">Site Expenses (Petty Cash)</Text>
                </View>
                {dayExpenses.length > 0 ? (
                  <Badge label={formatINR(totalDayExpense)} color="success" />
                ) : null}
              </View>

              {dayExpenses.length > 0 ? (
                <View className="gap-1.5 mt-1">
                  {dayExpenses.map((exp: PettyCashEntry) => (
                    <View
                      key={exp.id}
                      className="flex-row items-center justify-between py-2 border-b border-border/60"
                    >
                      <View className="flex-1 mr-2">
                        <Text className="text-xs font-semibold text-text" numberOfLines={1}>
                          {exp.description}
                        </Text>
                        <View className="flex-row items-center gap-2 mt-0.5">
                          <Text className="text-[10px] text-muted">Paid to: {exp.paidTo}</Text>
                          <Text className="text-[10px] text-muted">·</Text>
                          <Text className="text-[10px] font-medium text-primary">
                            {exp.category}
                          </Text>
                        </View>
                      </View>
                      <View className="items-end">
                        <Text className="text-xs font-bold text-text">
                          {formatINR(Number(exp.amount))}
                        </Text>
                        <Badge
                          label={exp.status}
                          color={
                            exp.status === 'APPROVED' || exp.status === 'RECONCILED'
                              ? 'success'
                              : exp.status === 'REJECTED'
                              ? 'danger'
                              : 'warning'
                          }
                        />
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="text-xs text-muted">
                  No site petty cash expenses logged for this date.
                </Text>
              )}
            </Card>
          </View>

          {/* Schedule updates */}
          {report.taskUpdates && report.taskUpdates.length > 0 && (
            <View className="px-4 pb-3">
              <Card className="p-4">
                <Text className="text-sm font-semibold text-text mb-2">Schedule Updates</Text>
                {report.taskUpdates.map(
                  (tu: NonNullable<ReportListItem['taskUpdates']>[number]) => (
                    <View
                      key={tu.id}
                      className="flex-row justify-between py-1.5 border-b border-border"
                    >
                      <Text className="text-sm text-text flex-1">{tu.task.name}</Text>
                      <Text className="text-sm text-muted">{tu.progressPct}%</Text>
                    </View>
                  ),
                )}
              </Card>
            </View>
          )}

          {/* Materials */}
          {report.materialUsages.length > 0 && (
            <View className="px-4 pb-3">
              <Card className="p-4">
                <Text className="text-sm font-semibold text-text mb-2">Materials Used</Text>
                {report.materialUsages.map((m: ReportListItem['materialUsages'][number]) => (
                  <View key={m.id} className="py-1.5 border-b border-border">
                    <View className="flex-row justify-between">
                      <View className="flex-1">
                        <Text className="text-sm text-text">{m.resource.name}</Text>
                        {m.notes && <Text className="text-xs text-muted">{m.notes}</Text>}
                        {m.task && (
                          <Text className="text-xs text-primary mt-0.5">Task: {m.task.name}</Text>
                        )}
                        {m.boqItem && (
                          <Text className="text-xs text-accent mt-0.5">
                            BOQ: {m.boqItem.itemCode} - {m.boqItem.description}
                          </Text>
                        )}
                      </View>
                      <Text className="text-sm text-text">
                        {m.quantityUsed} {m.resource.unit}
                      </Text>
                    </View>
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