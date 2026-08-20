/**
 * BuildFlow - Create Daily Report wizard (4 steps).
 *
 * Step 1: Basic info (date, weather, workers, site status)
 * Step 2: Work done (multi-line text + optional task progress)
 * Step 3: Materials used (resource picker + quantity rows with
 *         searchable Task / BOQ dropdowns)
 * Step 4: Photos & issues (camera/gallery + issues text + submit)
 *
 * Responsive: full-width on mobile, max-width container on tablet/web.
 */
import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  Card,
  Button,
  DateField,
  Input,
  Select,
  Badge,
  ProgressBar,
  type SelectOption,
} from '@/components/ui';
import { FormScreenHeader } from '@/components/layout/ScreenHeader';
import { dismissTo, DISMISS } from '@/utils/navigation';
import { todayDateOnly } from '@/utils/date-field';
import { alertAsync } from '@/utils/confirm';
import { useAppStore } from '@/stores/app.store';
import { useViewport } from '@/hooks/useViewport';
import {
  useProjects,
  useTasks,
  type ProjectListItem,
  type TaskRow,
} from '@/services/project.queries';
import { apiFetch } from '@/lib/api-client';
import type { ResolvedMaterialRate } from '@buildflow/shared';
import { MaterialPicker, type ProjectMaterial } from '@/components/materials/MaterialPicker';
import { type Resource } from '@/services/estimate.queries';
import { useBoq, type BoqItem } from '@/services/boq.queries';
import { useCreateReport, useUploadReportPhoto } from '@/services/report.queries';
import { useStockSummary } from '@/services/expansion.queries';
import type { Weather, SiteStatus } from '@buildflow/shared';

interface MaterialRow {
  resourceId: string;
  resourceName: string;
  unit: string;
  type: 'MATERIAL' | 'LABOUR' | 'EQUIPMENT' | 'SUBCONTRACTOR';
  rate: number;
  rateSource?: string;
  quantityUsed: string;
  taskId?: string;
  boqItemId?: string;
  postToBoqMeasurement?: boolean;
}

const RESOURCE_TYPE_BADGE: Record<MaterialRow['type'], { label: string; color: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' }> = {
  MATERIAL: { label: 'Material', color: 'primary' },
  LABOUR: { label: 'Labour', color: 'success' },
  EQUIPMENT: { label: 'Equipment', color: 'warning' },
  SUBCONTRACTOR: { label: 'Subcontract', color: 'neutral' },
};

interface TaskProgressDraft {
  taskId: string;
  taskName: string;
  status: string;
  progressPct: string;
  selected: boolean;
}

interface PhotoItem {
  uri: string;
  filename: string;
  contentType: string;
}

const WEATHERS: { label: string; value: Weather; icon: string }[] = [
  { label: 'Sunny', value: 'SUNNY', icon: '☀️' },
  { label: 'Cloudy', value: 'CLOUDY', icon: '☁️' },
  { label: 'Rain', value: 'RAIN', icon: '🌧️' },
  { label: 'Storm', value: 'STORM', icon: '⛈️' },
  { label: 'Fog', value: 'FOG', icon: '🌫️' },
];

const SITE_STATUSES: { label: string; value: SiteStatus; color: string }[] = [
  { label: 'On Schedule', value: 'ON_SCHEDULE', color: 'bg-success' },
  { label: 'Delayed', value: 'DELAYED', color: 'bg-warning' },
  { label: 'Blocked', value: 'BLOCKED', color: 'bg-danger' },
];

/** Human-readable label + badge colour for a task status enum value. */
function statusMeta(status: string): { label: string; color: 'success' | 'warning' | 'danger' | 'primary' | 'neutral' } {
  switch (status) {
    case 'COMPLETED':
      return { label: 'Completed', color: 'success' };
    case 'IN_PROGRESS':
      return { label: 'In Progress', color: 'primary' };
    case 'DELAYED':
      return { label: 'Delayed', color: 'warning' };
    case 'ON_HOLD':
      return { label: 'On Hold', color: 'neutral' };
    case 'NOT_STARTED':
    default:
      return { label: 'Not Started', color: 'neutral' };
  }
}

/** Map a list of tasks to SelectOption[] grouped by status. */
function tasksToOptions(tasks: TaskRow[]): SelectOption[] {
  return tasks.map((t) => {
    const meta = statusMeta(t.status);
    return {
      value: t.id,
      title: t.name,
      subtitle: [meta.label, t.assignee?.name].filter(Boolean).join(' · '),
      meta: `${t.progressPct}%`,
      groupKey: meta.label,
      tone: meta.color === 'neutral' ? 'muted' : meta.color,
    };
  });
}

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  MATERIAL: 'Material',
  LABOUR: 'Labour',
  EQUIPMENT: 'Equipment',
  SUBCONTRACTOR: 'Subcontract',
  MISC: 'Misc',
};

/** Map a list of BOQ items to SelectOption[] grouped by section.
 *
 * All BOQ lines are shown (a resource can legitimately link to a rate-analysis
 * work item like "Emulsion paint" or a labour line). When `resourceId` is
 * provided, BOQ lines whose linked estimate item references that catalog
 * resource are sorted to the top so the best match is surfaced first - without
 * hiding everything else. */
function boqToOptions(items: BoqItem[], resourceId?: string): SelectOption[] {
  const toOption = (b: BoqItem): SelectOption => {
    const qtyNum = parseFloat(b.quantity);
    const executed = b.executedQty ?? 0;
    const balance = b.balanceQty ?? Math.max(0, qtyNum - executed);
    const typeLabel = RESOURCE_TYPE_LABELS[b.category ?? 'MATERIAL'] ?? b.category ?? '';
    return {
      value: b.id,
      title: b.description || b.itemCode,
      subtitle: [b.itemCode, b.section, typeLabel].filter(Boolean).join(' · '),
      meta: balance > 0 ? `${balance} ${b.unit} left` : `${b.unit}`,
      groupKey: b.section ?? 'Ungrouped',
      tone: balance > 0 ? 'success' : 'muted',
    };
  };

  if (!resourceId) return items.map(toOption);

  // Prioritize: matching lines first, then the rest.
  const matched = items.filter((b) => b.resourceId === resourceId).map(toOption);
  const others = items.filter((b) => b.resourceId !== resourceId).map(toOption);
  return [...matched, ...others];
}

export default function CreateReportScreen() {
  const router = useRouter();
  const { isDesktop } = useViewport();
  const { projectId: routeProjectId, reset: resetKey, date: routeDate } = useLocalSearchParams<{
    projectId?: string | string[];
    reset?: string | string[];
    date?: string | string[];
  }>();
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const setActiveProject = useAppStore((s) => s.setActiveProject);
  const { data: projects, isLoading: projectsLoading } = useProjects();

  const routeId =
    typeof routeProjectId === 'string' ? routeProjectId : routeProjectId?.[0];
  const resetToken =
    typeof resetKey === 'string' ? resetKey : resetKey?.[0];
  const initialDate =
    typeof routeDate === 'string' ? routeDate : routeDate?.[0];
  const isProjectLocked = Boolean(routeId);

  const [selectedProjectId, setSelectedProjectId] = useState('');

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [formError, setFormError] = useState<string | null>(null);

  // Step 1
  const [reportDate, setReportDate] = useState(todayDateOnly());
  const [weather, setWeather] = useState<Weather | null>(null);
  const [workersCount, setWorkersCount] = useState('');
  const [siteStatus, setSiteStatus] = useState<SiteStatus | null>(null);

  // Step 2
  const [workDone, setWorkDone] = useState('');
  const [taskSearch, setTaskSearch] = useState('');
  const [taskDrafts, setTaskDrafts] = useState<TaskProgressDraft[]>([]);

  // Step 3
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [deductStock, setDeductStock] = useState(true);

  // Step 4
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [issues, setIssues] = useState('');

  const resetForm = useCallback((projectIdForForm: string, dateOverride?: string) => {
    setStep(1);
    setFormError(null);
    setReportDate(dateOverride && /^\d{4}-\d{2}-\d{2}$/.test(dateOverride) ? dateOverride : todayDateOnly());
    setWeather(null);
    setWorkersCount('');
    setSiteStatus(null);
    setWorkDone('');
    setTaskSearch('');
    setMaterials([]);
    setDeductStock(true);
    setPhotos([]);
    setIssues('');
    setTaskDrafts([]);
    setSelectedProjectId(projectIdForForm);
  }, []);

  // Fresh form every time user opens create (reset token in URL from navigation)
  const lastResetRef = useRef<string | null>(null);
  React.useEffect(() => {
    const pid = routeId ?? activeProjectId ?? projects?.[0]?.id ?? '';

    if (resetToken) {
      if (lastResetRef.current === resetToken) return;
      lastResetRef.current = resetToken;
      resetForm(routeId ?? pid, initialDate);
      if (routeId) setActiveProject(routeId);
      return;
    }

    if (lastResetRef.current || !pid) return;
    lastResetRef.current = 'initial';
    resetForm(pid, initialDate);
    if (routeId) setActiveProject(routeId);
  }, [resetToken, routeId, projects, activeProjectId, resetForm, setActiveProject, initialDate]);

  const projectId = isProjectLocked ? routeId! : selectedProjectId;

  const createMut = useCreateReport(projectId);
  const uploadMut = useUploadReportPhoto();
  const { data: projectTasks } = useTasks(projectId);
  const { data: projectBoq } = useBoq(projectId);
  const { data: stockSummary } = useStockSummary(projectId);

  React.useEffect(() => {
    if (projectTasks?.length) {
      setTaskDrafts(
        projectTasks.map((t: TaskRow) => ({
          taskId: t.id,
          taskName: t.name,
          status: t.status,
          progressPct: String(t.progressPct),
          selected: false,
        })),
      );
    } else {
      setTaskDrafts([]);
    }
  }, [projectTasks]);

  const projectOptions: SelectOption[] = useMemo(
    () =>
      (projects ?? []).map((p: ProjectListItem) => ({
        value: p.id,
        title: p.name,
        subtitle: [p.code, p.status].filter(Boolean).join(' · '),
        meta: p.clientName,
      })),
    [projects],
  );

  const projectName =
    projects?.find((p: ProjectListItem) => p.id === projectId)?.name ??
    (projectsLoading ? 'Loading…' : 'Select project');

  const handleProjectSelect = (pId: string | undefined) => {
    if (!pId) return;
    setFormError(null);
    setSelectedProjectId(pId);
    setActiveProject(pId);
    setMaterials([]);
    setTaskDrafts([]);
  };

  const canNext = () => {
    if (step === 1) return !!reportDate && !!projectId;
    return true;
  };

  const handleSubmit = async () => {
    setFormError(null);

    if (!projectId) {
      setFormError('Select a project before submitting.');
      await alertAsync('No project', 'Select a project on Step 1 before submitting.');
      return;
    }

    const usageLines = materials
      .filter((m) => m.quantityUsed && parseFloat(m.quantityUsed) > 0)
      .map((m) => ({
        resourceId: m.resourceId,
        quantityUsed: parseFloat(m.quantityUsed),
        taskId: m.taskId,
        boqItemId: m.boqItemId,
        postToBoqMeasurement: m.postToBoqMeasurement && !!m.boqItemId,
      }));

    if (deductStock && usageLines.length > 0 && stockSummary) {
      for (const line of usageLines) {
        const row = stockSummary.find((s: { resourceId: string; balance: number }) => s.resourceId === line.resourceId);
        const onHand = row?.balance ?? 0;
        const name = materials.find((m) => m.resourceId === line.resourceId)?.resourceName ?? 'Material';
        const unit = materials.find((m) => m.resourceId === line.resourceId)?.unit ?? '';
        if (onHand === 0) {
          const msg = `${name}: no site stock on this project - receive via GRN first.`;
          setFormError(msg);
          await alertAsync('Insufficient stock', msg);
          return;
        }
        if (line.quantityUsed > onHand) {
          const msg = `${name}: only ${onHand} ${unit} on hand, requested ${line.quantityUsed} ${unit}.`;
          setFormError(msg);
          await alertAsync('Insufficient stock', msg);
          return;
        }
      }
    }

    try {
      const created = await createMut.mutateAsync({
        reportDate,
        weather: weather ?? undefined,
        siteStatus: siteStatus ?? undefined,
        workDone: workDone || undefined,
        issues: issues || undefined,
        workersCount: workersCount ? parseInt(workersCount, 10) : undefined,
        taskUpdates: taskDrafts
          .filter((t) => t.selected)
          .map((t) => ({
            taskId: t.taskId,
            progressPct: Math.min(100, Math.max(0, parseInt(t.progressPct, 10) || 0)),
          })),
        deductStock,
        materialUsages: usageLines.length ? usageLines : undefined,
      });

      let photoUploadFailures = 0;
      for (const photo of photos) {
        try {
          await uploadMut.mutateAsync({
            reportId: created.id,
            uri: photo.uri,
            filename: photo.filename,
            contentType: photo.contentType,
          });
        } catch {
          photoUploadFailures += 1;
        }
      }

      const stockNote =
        created.stockDeductionApplied && usageLines.length ? ' Site stock was updated.' : '';
      const photoNote =
        photoUploadFailures > 0
          ? ` ${photoUploadFailures} photo(s) were not uploaded - file storage is not configured on this server.`
          : '';
      await alertAsync(
        'Success',
        `Daily report submitted successfully.${stockNote}${photoNote}`,
      );
      router.replace('/(app)/reports');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit report';
      setFormError(message);
      await alertAsync('Error', message);
    }
  };

  const pickPhotos = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      await alertAsync('Permission needed', 'Please grant photo library access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.7,
    });
    if (!result.canceled && result.assets) {
      const newPhotos: PhotoItem[] = result.assets.map(
        (a: { uri: string; fileName?: string | null; mimeType?: string | null }) => ({
          uri: a.uri,
          filename: a.fileName ?? `photo-${Date.now()}.jpg`,
          contentType: (a.mimeType as PhotoItem['contentType']) ?? 'image/jpeg',
        }),
      );
      setPhotos((prev) => [...prev, ...newPhotos].slice(0, 10));
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      await alertAsync('Permission needed', 'Please grant camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setPhotos((prev) => [
        ...prev,
        {
          uri: a.uri,
          filename: a.fileName ?? `photo-${Date.now()}.jpg`,
          contentType: (a.mimeType as PhotoItem['contentType']) ?? 'image/jpeg',
        },
      ].slice(0, 10));
    }
  };

  const isSubmitting = createMut.isPending || uploadMut.isPending;

  // Filtered task drafts for Step 2 (searchable)
  const filteredTaskDrafts = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    if (!q) return taskDrafts;
    return taskDrafts.filter((t) => t.taskName.toLowerCase().includes(q));
  }, [taskDrafts, taskSearch]);

  // Responsive wrapper width on tablet/web
  const stepWrapper = isDesktop ? 'w-full max-w-2xl mx-auto' : 'w-full';

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FormScreenHeader
          title="New Daily Report"
          subtitle={projectName}
          onCancel={() => dismissTo(DISMISS.reports)}
        />

        {/* Step indicator */}
        <View className="px-4 py-3 flex-row items-center">
          {[1, 2, 3, 4].map((s) => (
            <React.Fragment key={s}>
              <View
                className={`w-7 h-7 rounded-full items-center justify-center ${
                  s <= step ? 'bg-primary' : 'bg-border'
                }`}
              >
                <Text className={`text-xs font-bold ${s <= step ? 'text-white' : 'text-muted'}`}>
                  {s}
                </Text>
              </View>
              {s < 4 && (
                <View className={`flex-1 h-0.5 ${s < step ? 'bg-primary' : 'bg-border'}`} />
              )}
            </React.Fragment>
          ))}
        </View>

        <ScrollView className="flex-1 px-4 pb-4">
          <View className={stepWrapper}>
            {/* STEP 1: Basic Info */}
            {step === 1 && (
              <View className="space-y-4">
                <Card className="p-4">
                  {isProjectLocked ? (
                    <View>
                      <Text className="text-sm font-semibold text-text mb-1.5">Project</Text>
                      <View className="border border-border rounded-md px-3 py-2.5 bg-surface">
                        <Text className="text-sm text-text">{projectName}</Text>
                        {projectId ? (
                          <Text className="text-xs text-muted mt-0.5">
                            {projects?.find((p: ProjectListItem) => p.id === projectId)?.code ?? ''}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ) : (
                    <Select
                      label="Project"
                      value={projectId}
                      options={projectOptions}
                      onChange={handleProjectSelect}
                      placeholder={projectsLoading ? 'Loading…' : 'Select project'}
                      title="Select project"
                      searchPlaceholder="Search projects…"
                      clearable={false}
                    />
                  )}
                </Card>

                <Card className="p-4">
                  <DateField label="Report Date" value={reportDate} onChange={setReportDate} />
                </Card>

                <Card className="p-4">
                  <Text className="text-sm font-semibold text-text mb-2">Weather</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {WEATHERS.map((w) => (
                      <Pressable
                        key={w.value}
                        onPress={() => setWeather(w.value)}
                        className={`px-3 py-2 rounded-md flex-row items-center gap-1.5 ${
                          weather === w.value ? 'bg-primary' : 'bg-surface border border-border'
                        }`}
                      >
                        <Text className="text-base">{w.icon}</Text>
                        <Text className={`text-xs ${weather === w.value ? 'text-white' : 'text-text'}`}>
                          {w.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </Card>

                <Card className="p-4">
                  <Text className="text-sm font-semibold text-text mb-2">Site Status</Text>
                  <View className="flex-row gap-2">
                    {SITE_STATUSES.map((s) => (
                      <Pressable
                        key={s.value}
                        onPress={() => setSiteStatus(s.value)}
                        className={`flex-1 px-3 py-2.5 rounded-md items-center ${
                          siteStatus === s.value ? s.color : 'bg-surface border border-border'
                        }`}
                      >
                        <Text
                          className={`text-xs font-semibold ${
                            siteStatus === s.value ? 'text-white' : 'text-text'
                          }`}
                        >
                          {s.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </Card>

                <Card className="p-4">
                  <Input
                    label="Workers Count"
                    value={workersCount}
                    onChangeText={(v) => setWorkersCount(v.replace(/[^0-9]/g, ''))}
                    keyboardType="numeric"
                    fullWidth
                    placeholder="e.g. 45"
                    helper="Total workers on site today."
                  />
                </Card>
              </View>
            )}

            {/* STEP 2: Work Done + Task Progress */}
            {step === 2 && (
              <View className="space-y-4">
                <Card className="p-4">
                  <Input
                    label="Work Done Today"
                    value={workDone}
                    onChangeText={setWorkDone}
                    placeholder="Describe the work completed today..."
                    multiline
                    fullWidth
                  />
                </Card>

                {taskDrafts.length > 0 && (
                  <Card className="p-4">
                    <Text className="text-sm font-semibold text-text mb-1">
                      Update schedule progress (optional)
                    </Text>
                    <Text className="text-xs text-muted mb-3">
                      Select tasks to update progress % when this report is submitted.
                    </Text>

                    {taskDrafts.length > 6 && (
                      <View className="mb-3">
                        <Input
                          value={taskSearch}
                          onChangeText={setTaskSearch}
                          placeholder="Search tasks…"
                          fullWidth
                        />
                      </View>
                    )}

                    <View className="gap-2">
                      {filteredTaskDrafts.length === 0 ? (
                        <Text className="text-xs text-muted text-center py-4">
                          No tasks match “{taskSearch}”.
                        </Text>
                      ) : (
                        filteredTaskDrafts.map((t) => {
                          const meta = statusMeta(t.status);
                          const pct = Math.min(100, Math.max(0, parseInt(t.progressPct, 10) || 0));
                          return (
                            // FIX: Card container is a View (not Pressable) so the
                            // nested TextInput touch does not propagate to the toggle.
                            <View
                              key={t.taskId}
                              className={`rounded-lg border p-3 ${
                                t.selected ? 'border-primary bg-primary/5' : 'border-border bg-card'
                              }`}
                            >
                              {/* Toggle area - only this part toggles selection */}
                              <Pressable
                                onPress={() =>
                                  setTaskDrafts((prev) =>
                                    prev.map((x) =>
                                      x.taskId === t.taskId ? { ...x, selected: !x.selected } : x,
                                    ),
                                  )
                                }
                              >
                                <View className="flex-row items-center gap-2 mb-2">
                                  <View
                                    className={`w-5 h-5 rounded border items-center justify-center ${
                                      t.selected ? 'bg-primary border-primary' : 'border-border'
                                    }`}
                                  >
                                    {t.selected ? <Text className="text-white text-[10px]">✓</Text> : null}
                                  </View>
                                  <Text className="text-sm text-text flex-1 font-medium" numberOfLines={2}>
                                    {t.taskName}
                                  </Text>
                                  <Badge label={meta.label} color={meta.color} />
                                </View>
                                <View className="flex-row items-center gap-2 mb-2">
                                  <ProgressBar value={pct} height={6} className="flex-1" />
                                  <Text className="text-xs text-muted w-9 text-right">{pct}%</Text>
                                </View>
                              </Pressable>
                              {/* Progress input - sibling of the toggle Pressable,
                                  so tapping it cannot deselect the task */}
                              {t.selected && (
                                <View className="mt-1">
                                  <Text className="text-xs text-muted mb-1">New progress %</Text>
                                  <TextInput
                                    value={t.progressPct}
                                    onChangeText={(v) =>
                                      setTaskDrafts((prev) =>
                                        prev.map((x) =>
                                          x.taskId === t.taskId
                                            ? { ...x, progressPct: v.replace(/[^0-9]/g, '') }
                                            : x,
                                        ),
                                      )
                                    }
                                    placeholder="Progress %"
                                    keyboardType="numeric"
                                    className="border border-border rounded-md px-3 py-2 text-text"
                                  />
                                </View>
                              )}
                            </View>
                          );
                        })
                      )}
                    </View>
                  </Card>
                )}
              </View>
            )}

            {/* STEP 3: Materials Used */}
            {step === 3 && (
              <MaterialsStep
                projectId={projectId}
                materials={materials}
                setMaterials={setMaterials}
                tasks={projectTasks ?? []}
                boqItems={projectBoq?.items ?? []}
                deductStock={deductStock}
                setDeductStock={setDeductStock}
                stockSummary={stockSummary ?? []}
              />
            )}

            {/* STEP 4: Photos & Issues */}
            {step === 4 && (
              <View className="space-y-4">
                <Card className="p-4">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-sm font-semibold text-text">
                      Photos ({photos.length}/10)
                    </Text>
                    <View className="flex-row gap-2">
                      <Pressable onPress={takePhoto} className="px-3 py-1.5 rounded-md bg-primary">
                        <Text className="text-xs text-white font-semibold">Camera</Text>
                      </Pressable>
                      <Pressable onPress={pickPhotos} className="px-3 py-1.5 rounded-md bg-accent">
                        <Text className="text-xs text-white font-semibold">Gallery</Text>
                      </Pressable>
                    </View>
                  </View>
                  {photos.length > 0 ? (
                    <View className="flex-row flex-wrap gap-2">
                      {photos.map((p, idx) => (
                        <View key={idx} className="relative">
                          <Image source={{ uri: p.uri }} className="w-24 h-24 rounded-md" />
                          <Pressable
                            onPress={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-danger items-center justify-center"
                          >
                            <Text className="text-white text-xs font-bold">✕</Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text className="text-xs text-muted">No photos added yet.</Text>
                  )}
                </Card>

                <Card className="p-4">
                  <Input
                    label="Issues / Blockers"
                    value={issues}
                    onChangeText={setIssues}
                    placeholder="Any issues, delays, or blockers?"
                    multiline
                    fullWidth
                  />
                </Card>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Footer Nav */}
        {formError ? (
          <View className="mx-4 mb-2 px-3 py-2 rounded-lg bg-danger/10 border border-danger/30">
            <Text className="text-sm text-danger">{formError}</Text>
          </View>
        ) : null}
        <View className="px-4 py-3 border-t border-border flex-row gap-2">
          {step > 1 && (
            <Button
              label="Back"
              variant="secondary"
              onPress={() => setStep((s) => (s - 1) as typeof s)}
            />
          )}
          {step < 4 ? (
            <View className="flex-1">
              <Button label="Next" onPress={() => canNext() && setStep((s) => (s + 1) as typeof s)} />
            </View>
          ) : (
            <View className="flex-1 flex-row items-center gap-2">
              {isSubmitting && <ActivityIndicator color="#1E3A5F" />}
              <View className="flex-1">
                <Button
                  label="Submit Report"
                  onPress={handleSubmit}
                  loading={isSubmitting}
                  disabled={isSubmitting || !projectId}
                />
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/* Step 3: Materials Used                                              */
/* ------------------------------------------------------------------ */
function MaterialsStep({
  projectId,
  materials,
  setMaterials,
  tasks,
  boqItems,
  deductStock,
  setDeductStock,
  stockSummary,
}: {
  projectId: string;
  materials: MaterialRow[];
  setMaterials: React.Dispatch<React.SetStateAction<MaterialRow[]>>;
  tasks: TaskRow[];
  boqItems: BoqItem[];
  deductStock: boolean;
  setDeductStock: (v: boolean) => void;
  stockSummary: Array<{ resourceId: string; name: string; unit: string; balance: number }>;
}) {
  const { isDesktop } = useViewport();
  const [showPicker, setShowPicker] = useState(false);
  const qtyRefs = React.useRef<Record<string, TextInput | null>>({});

  const taskOptions = useMemo(() => tasksToOptions(tasks), [tasks]);

  // Project-relevant materials: union of (a) on-hand stock at the site store
  // and (b) materials linked to BOQ lines. Surfaced first in the picker so a
  // supervisor sees what's actually committed to this project before digging
  // into the full catalog (aligns with Procore / Fieldwire behaviour).
  const projectMaterials = useMemo<ProjectMaterial[]>(() => {
    const map = new Map<string, ProjectMaterial>();
    for (const s of stockSummary) {
      const boq = boqItems.find((b) => b.resourceId === s.resourceId);
      map.set(s.resourceId, {
        id: s.resourceId,
        name: s.name,
        unit: s.unit,
        type: 'MATERIAL',
        balance: s.balance,
        category: boq?.section,
      });
    }
    for (const b of boqItems) {
      if (b.resourceId && !map.has(b.resourceId)) {
        map.set(b.resourceId, {
          id: b.resourceId,
          name: b.description || b.itemCode,
          unit: b.unit,
          type: 'MATERIAL',
          category: b.section,
        });
      }
    }
    return Array.from(map.values());
  }, [stockSummary, boqItems]);

  const fetchResolvedRate = async (resourceId: string, boqItemId?: string) => {
    if (!projectId) return null;
    const qs = boqItemId ? `?boqItemId=${encodeURIComponent(boqItemId)}` : '';
    try {
      return await apiFetch<ResolvedMaterialRate>(
        `/projects/${projectId}/resources/${resourceId}/rate${qs}`,
      );
    } catch {
      return null;
    }
  };

  const addMaterial = async (res: Resource) => {
    if (materials.some((m) => m.resourceId === res.id)) {
      setShowPicker(false);
      qtyRefs.current[res.id]?.focus();
      return;
    }
    const resolved = await fetchResolvedRate(res.id);
    // Auto-suggest the BOQ material line linked to this catalog resource
    // (if any) so the supervisor doesn't have to find it manually.
    const suggestedBoqItem = boqItems.find((b) => b.resourceId === res.id);
    setMaterials((prev) => [
      ...prev,
      {
        resourceId: res.id,
        resourceName: res.name,
        unit: res.unit,
        type: (res.type ?? 'MATERIAL') as MaterialRow['type'],
        rate: resolved?.rate ?? parseFloat(res.rate),
        rateSource: resolved?.source,
        quantityUsed: '',
        boqItemId: suggestedBoqItem?.id,
      },
    ]);
    setShowPicker(false);
    setTimeout(() => qtyRefs.current[res.id]?.focus(), 50);
  };

  const removeMaterial = (resourceId: string) => {
    setMaterials((prev) => prev.filter((m) => m.resourceId !== resourceId));
    delete qtyRefs.current[resourceId];
  };

  const updateQty = (resourceId: string, qty: string) => {
    setMaterials((prev) =>
      prev.map((m) => (m.resourceId === resourceId ? { ...m, quantityUsed: qty } : m)),
    );
  };

  const updateLink = (
    resourceId: string,
    field: 'taskId' | 'boqItemId',
    value: string | undefined,
  ) => {
    setMaterials((prev) =>
      prev.map((m) => (m.resourceId === resourceId ? { ...m, [field]: value } : m)),
    );
    if (field === 'boqItemId' && projectId) {
      void fetchResolvedRate(resourceId, value).then((resolved) => {
        if (!resolved) return;
        setMaterials((prev) =>
          prev.map((m) =>
            m.resourceId === resourceId
              ? { ...m, rate: resolved.rate, rateSource: resolved.source }
              : m,
          ),
        );
      });
    }
  };

  return (
    <View className="space-y-3">
      <Card className="p-4">
        <Pressable
          onPress={() => setDeductStock(!deductStock)}
          className="flex-row items-center gap-2 mb-3"
        >
          <View
            className={`w-5 h-5 rounded border ${
              deductStock ? 'bg-primary border-primary' : 'border-border'
            }`}
          />
          <Text className="text-sm text-text flex-1">
            Deduct from site stock (after GRN receipt)
          </Text>
        </Pressable>
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-sm font-semibold text-text">Resources Used</Text>
          <Pressable
            onPress={() => setShowPicker((v) => !v)}
            className="px-3 py-1.5 rounded-md bg-primary"
          >
            <Text className="text-xs text-white font-semibold">+ Add resource</Text>
          </Pressable>
        </View>

        {showPicker && (
          <View className="mb-3 border border-border rounded-md overflow-hidden p-3">
            <Text className="text-xs font-semibold text-muted mb-2">
              Tap a resource to add it, then enter quantity. Materials, labour, equipment & subcontractors are all supported.
            </Text>
            <MaterialPicker
              projectMaterials={projectMaterials}
              onSelect={(r) => {
                void addMaterial(r);
              }}
              maxHeight={192}
            />
          </View>
        )}

        {materials.length === 0 ? (
          <Text className="text-xs text-muted">
            No resources added. Tap "+ Add resource" to pick materials, labour, equipment or subcontractors.
          </Text>
        ) : (
          materials.map((m) => {
            const isMaterial = m.type === 'MATERIAL';
            const onHand = stockSummary.find((s: { resourceId: string; balance: number }) => s.resourceId === m.resourceId)?.balance;
            const qty = m.quantityUsed ? parseFloat(m.quantityUsed) : 0;
            // Stock validation only applies to materials (labour/equipment/subcontractors aren't stocked via GRN).
            const overStock = deductStock && isMaterial && onHand !== undefined && qty > onHand;
            const noStock = deductStock && isMaterial && onHand === 0;
            const typeBadge = RESOURCE_TYPE_BADGE[m.type] ?? RESOURCE_TYPE_BADGE.MATERIAL;
            return (
              <View key={m.resourceId} className="py-3 border-b border-border">
                {/* Top row: resource info + qty + cost + remove */}
                <View className="flex-row items-start gap-2">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-sm font-medium text-text flex-1" numberOfLines={1}>{m.resourceName}</Text>
                      <Badge label={typeBadge.label} color={typeBadge.color} />
                    </View>
                    <Text className="text-xs text-muted">{m.unit}</Text>
                    {isMaterial && deductStock && onHand !== undefined && (
                      <Text
                        className={`text-xs mt-0.5 ${
                          noStock || overStock ? 'text-danger font-medium' : 'text-muted'
                        }`}
                      >
                        On hand: {onHand} {m.unit}
                        {noStock ? ' - receive via GRN first' : ''}
                        {overStock && !noStock ? ' - exceeds on hand' : ''}
                      </Text>
                    )}
                  </View>

                  <View className="items-end">
                    <Text className="text-[10px] text-muted mb-0.5 uppercase tracking-wide">
                      Qty
                    </Text>
                    <TextInput
                      ref={(el) => {
                        qtyRefs.current[m.resourceId] = el;
                      }}
                      value={m.quantityUsed}
                      onChangeText={(v) => updateQty(m.resourceId, v.replace(/[^0-9.]/g, ''))}
                      placeholder="0"
                      keyboardType="decimal-pad"
                      selectTextOnFocus
                      className="w-24 border border-primary/40 rounded-md px-2 py-1.5 text-text text-center bg-white"
                    />
                  </View>

                  {m.quantityUsed ? (
                    <View className="w-16 items-end">
                      <Text className="text-xs text-muted text-right">
                        Rs {(parseFloat(m.quantityUsed) * m.rate).toFixed(0)}
                      </Text>
                      {m.rateSource ? (
                        <Text className="text-[9px] text-primary text-right">{m.rateSource}</Text>
                      ) : null}
                    </View>
                  ) : (
                    <View className="w-16" />
                  )}

                  <Pressable
                    onPress={() => removeMaterial(m.resourceId)}
                    hitSlop={8}
                    className="w-8 h-8 items-center justify-center rounded-full active:bg-danger/10"
                  >
                    <Text className="text-danger text-base font-bold">×</Text>
                  </Pressable>
                </View>

                {/* Link row: task + BOQ dropdowns (responsive) */}
                {(tasks.length > 0 || boqItems.length > 0) && (
                  <View
                    className={`mt-3 gap-2 ${isDesktop ? 'flex-row' : 'flex-col'}`}
                  >
                    {tasks.length > 0 && (
                      <View className={isDesktop ? 'flex-1' : ''}>
                        <Select
                          label="Link to task"
                          value={m.taskId}
                          options={taskOptions}
                          onChange={(v) => updateLink(m.resourceId, 'taskId', v)}
                          placeholder="No task"
                          title="Select a task"
                          searchPlaceholder="Search tasks…"
                          clearable
                          compact
                        />
                      </View>
                    )}
                    {boqItems.length > 0 && (
                      <View className={isDesktop ? 'flex-1' : ''}>
                        <Select
                          label="Link to BOQ item"
                          value={m.boqItemId}
                          options={boqToOptions(boqItems, m.resourceId)}
                          onChange={(v) => updateLink(m.resourceId, 'boqItemId', v)}
                          placeholder="No BOQ item"
                          title="Select a BOQ item"
                          searchPlaceholder="Search BOQ items…"
                          clearable
                          compact
                        />
                      </View>
                    )}
                  </View>
                )}

                {m.boqItemId ? (
                  <Pressable
                    onPress={() =>
                      setMaterials((prev) =>
                        prev.map((row) =>
                          row.resourceId === m.resourceId
                            ? { ...row, postToBoqMeasurement: !row.postToBoqMeasurement }
                            : row,
                        ),
                      )
                    }
                    className="flex-row items-center gap-2 mt-2"
                  >
                    <View
                      className={`w-4 h-4 rounded border ${
                        m.postToBoqMeasurement ? 'bg-primary border-primary' : 'border-border'
                      }`}
                    />
                    <Text className="text-xs text-muted">
                      Post qty to BOQ measurement book on submit
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })
        )}

        {materials.some((m) => m.quantityUsed) && (
          <Text className="text-sm font-semibold text-text mt-2">
            Est. Cost: Rs{' '}
            {materials
              .reduce(
                (sum, m) => sum + (m.quantityUsed ? parseFloat(m.quantityUsed) * m.rate : 0),
                0,
              )
              .toFixed(0)}
          </Text>
        )}
      </Card>
    </View>
  );
}