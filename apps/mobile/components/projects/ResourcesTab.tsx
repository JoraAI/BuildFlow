import React, { useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { Card, EmptyState, LoadingSkeleton, ProgressBar, Badge, Button } from '@/components/ui';
import { useResourceUtilization, type ResourceUtilRow } from '@/services/boq.queries';
import { useMaterialRateVariance } from '@/services/project.queries';
import { formatINR } from '@/utils/format';
import { RATE_VARIANCE_ALERT_PCT, type MaterialRateVarianceRow } from '@buildflow/shared';
import { downloadReportPdf, reportPaths } from '@/services/report-download';

interface ResourcesTabProps {
  projectId: string;
}

const PLANNED_SOURCE_LABEL: Record<string, string> = {
  PROJECT: 'Project override',
  BOQ: 'BOQ',
  ESTIMATE: 'Estimate',
  REGION: 'Regional',
  CATALOG: 'Catalog',
};

export function ResourcesTab({ projectId }: ResourcesTabProps) {
  const utilQ = useResourceUtilization(projectId);
  const varianceQ = useMaterialRateVariance(projectId);
  const [downloading, setDownloading] = useState(false);

  const downloadRateSheet = async () => {
    setDownloading(true);
    try {
      await downloadReportPdf(
        reportPaths.materialRates(projectId),
        `material-rates-${projectId}.pdf`,
      );
    } finally {
      setDownloading(false);
    }
  };

  if (utilQ.isLoading || varianceQ.isLoading) {
    return <LoadingSkeleton className="h-48 rounded-xl" />;
  }

  const rows = utilQ.data ?? [];
  const rateRows = varianceQ.data ?? [];
  const alertCount = rateRows.filter((r: MaterialRateVarianceRow) => r.overThreshold).length;

  if (rows.length === 0 && rateRows.length === 0) {
    return (
      <EmptyState
        title="No resource data yet"
        description="Planned quantities come from task resources. Rate variance appears once materials are on indents or POs."
      />
    );
  }

  return (
    <ScrollView>
      <View className="gap-3">
        {rateRows.length > 0 && (
          <>
            <Card>
              <View className="flex-row justify-between items-start mb-1">
                <View className="flex-1 mr-2">
                  <Text className="text-sm font-bold text-text">Material rate variance</Text>
                  {alertCount > 0 ? (
                    <Badge color="danger" label={`${alertCount} over ${RATE_VARIANCE_ALERT_PCT}%`} />
                  ) : (
                    <Badge color="success" label="On plan" />
                  )}
                </View>
                <Button
                  label="PDF"
                  size="sm"
                  variant="secondary"
                  loading={downloading}
                  onPress={() => void downloadRateSheet()}
                />
              </View>
              <Text className="text-xs text-muted">
                Planned rate vs last PO on this project. Alert when actual buy price exceeds plan by
                more than {RATE_VARIANCE_ALERT_PCT}%.
              </Text>
            </Card>
            {rateRows.map((row: MaterialRateVarianceRow) => (
              <Card key={row.resourceId}>
                <View className="flex-row justify-between items-start mb-2">
                  <View className="flex-1 mr-2">
                    <Text className="text-sm font-semibold text-text">{row.name}</Text>
                    <Text className="text-xs text-muted">{row.unit}</Text>
                  </View>
                  {row.overThreshold ? (
                    <Badge color="danger" label="Over plan" />
                  ) : row.variancePct != null && row.variancePct <= 0 ? (
                    <Badge color="success" label="Under plan" />
                  ) : null}
                </View>
                <View className="flex-row justify-between mb-1">
                  <Text className="text-xs text-muted">
                    Planned: {formatINR(row.plannedRate)} ({PLANNED_SOURCE_LABEL[row.plannedSource] ?? row.plannedSource})
                  </Text>
                  <Text className="text-xs text-muted">Catalog: {formatINR(row.catalogRate)}</Text>
                </View>
                <View className="flex-row justify-between mb-1">
                  <Text className="text-xs text-text">
                    Last PO:{' '}
                    {row.lastPoRate != null
                      ? `${formatINR(row.lastPoRate)}${row.lastPoRef ? ` (${row.lastPoRef})` : ''}`
                      : '-'}
                  </Text>
                  {row.variancePct != null ? (
                    <Text
                      className={`text-xs font-semibold ${
                        row.overThreshold ? 'text-danger' : row.variancePct <= 0 ? 'text-success' : 'text-muted'
                      }`}
                    >
                      {row.variancePct > 0 ? '+' : ''}
                      {row.variancePct}% vs plan
                    </Text>
                  ) : null}
                </View>
              </Card>
            ))}
          </>
        )}

        {rows.length > 0 && (
          <>
            <Card>
              <Text className="text-sm font-bold text-text mb-1">Planned vs used (qty)</Text>
              <Text className="text-xs text-muted">
                Compare schedule-planned resources with materials logged on daily reports.
              </Text>
            </Card>
            {rows.map((row: ResourceUtilRow) => (
              <Card key={row.resourceId}>
                <View className="flex-row justify-between items-start mb-2">
                  <View className="flex-1 mr-2">
                    <Text className="text-sm font-semibold text-text">{row.name}</Text>
                    <Text className="text-xs text-muted">{row.type}</Text>
                  </View>
                  <Text
                    className={`text-xs font-bold ${
                      row.variance > 0 ? 'text-danger' : 'text-success'
                    }`}
                  >
                    {row.usedPct}% used
                  </Text>
                </View>
                <View className="flex-row justify-between mb-1">
                  <Text className="text-xs text-muted">
                    Planned: {row.planned.toFixed(2)} {row.unit}
                  </Text>
                  <Text className="text-xs text-muted">
                    Used: {row.used.toFixed(2)} {row.unit}
                  </Text>
                </View>
                <ProgressBar
                  value={Math.min(row.usedPct, 100)}
                  color={row.variance > 0 ? '#EF4444' : '#10B981'}
                />
                {row.variance !== 0 && (
                  <Text className="text-xs text-muted mt-1">
                    Variance: {row.variance > 0 ? '+' : ''}
                    {row.variance.toFixed(2)} {row.unit}
                  </Text>
                )}
              </Card>
            ))}
          </>
        )}
      </View>
    </ScrollView>
  );
}
