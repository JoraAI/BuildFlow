/**
 * BuildFlow - Create Daily Report wizard (4 steps).
 *
 * Step 1: Basic info (date, weather, workers, site status)
 * Step 2: Work done (multi-line text)
 * Step 3: Materials used (resource picker + quantity rows)
 * Step 4: Photos & issues (camera/gallery + issues text + submit)
 */
import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Card, Button, DateField } from '@/components/ui';
import { FormScreenHeader } from '@/components/layout/ScreenHeader';
import { dismissTo, DISMISS } from '@/utils/navigation';
import { todayDateOnly } from '@/utils/date-field';
import { alertAsync } from '@/utils/confirm';
import { useAppStore } from '@/stores/app.store';
import { useProjects, useTasks, type ProjectListItem, type TaskRow } from '@/services/project.queries';
import { apiFetch } from '@/lib/api-client';
import type { ResolvedMaterialRate } from '@buildflow/shared';
import { MaterialPicker } from '@/components/materials/MaterialPicker';
import { useMaterials, type Resource } from '@/services/estimate.queries';
import { useBoq, type BoqItem } from '@/services/boq.queries';
import { useCreateReport, useUploadReportPhoto } from '@/services/report.queries';
import type { Weather, SiteStatus } from '@buildflow/shared';

interface MaterialRow {
  resourceId: string;
  resourceName: string;
  unit: string;
  rate: number;
  rateSource?: string;
  quantityUsed: string;
  taskId?: string;
  boqItemId?: string;
  postToBoqMeasurement?: boolean;
}

interface TaskProgressDraft {
  taskId: string;
  taskName: string;
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

export default function CreateReportScreen() {
  const router = useRouter();
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const projectId = activeProjectId ?? projects?.[0]?.id ?? '';
  const projectName =
    projects?.find((p: ProjectListItem) => p.id === projectId)?.name ??
    (projectsLoading ? 'Loading…' : 'No project');

  const createMut = useCreateReport(projectId);
  const uploadMut = useUploadReportPhoto();
  const { data: projectTasks } = useTasks(projectId);
  const { data: projectBoq } = useBoq(projectId);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [formError, setFormError] = useState<string | null>(null);

  // Step 1
  const [reportDate, setReportDate] = useState(todayDateOnly());
  const [weather, setWeather] = useState<Weather | null>(null);
  const [workersCount, setWorkersCount] = useState('');
  const [siteStatus, setSiteStatus] = useState<SiteStatus | null>(null);

  // Step 2
  const [workDone, setWorkDone] = useState('');
  const [taskDrafts, setTaskDrafts] = useState<TaskProgressDraft[]>([]);

  // Step 3
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [deductStock, setDeductStock] = useState(true);

  // Step 4
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [issues, setIssues] = useState('');

  React.useEffect(() => {
    if (projectTasks?.length) {
      setTaskDrafts(
        projectTasks.map((t: TaskRow) => ({
          taskId: t.id,
          taskName: t.name,
          progressPct: String(t.progressPct),
          selected: false,
        })),
      );
    } else {
      setTaskDrafts([]);
    }
  }, [projectTasks]);

  const canNext = () => {
    if (step === 1) return !!reportDate;
    return true;
  };

  const handleSubmit = async () => {
    setFormError(null);

    if (!projectId) {
      setFormError('Select a project on the Reports screen before submitting.');
      await alertAsync('No project', 'Select a project on the Reports screen before submitting.');
      return;
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
        materialUsages: materials
          .filter((m) => m.quantityUsed && parseFloat(m.quantityUsed) > 0)
          .map((m) => ({
            resourceId: m.resourceId,
            quantityUsed: parseFloat(m.quantityUsed),
            taskId: m.taskId,
            boqItemId: m.boqItemId,
            postToBoqMeasurement: m.postToBoqMeasurement && !!m.boqItemId,
          })),
      });

      for (const photo of photos) {
        await uploadMut.mutateAsync({
          reportId: created.id,
          uri: photo.uri,
          filename: photo.filename,
          contentType: photo.contentType,
        });
      }

      await alertAsync('Success', 'Daily report submitted successfully.');
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
                <Text
                  className={`text-xs font-bold ${
                    s <= step ? 'text-white' : 'text-muted'
                  }`}
                >
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
          {/* STEP 1: Basic Info */}
          {step === 1 && (
            <View className="space-y-4">
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
                      <Text
                        className={`text-xs ${weather === w.value ? 'text-white' : 'text-text'}`}
                      >
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
                <Text className="text-sm font-semibold text-text mb-2">Workers Count</Text>
                <TextInput
                  value={workersCount}
                  onChangeText={(v) => setWorkersCount(v.replace(/[^0-9]/g, ''))}
                  placeholder="e.g. 45"
                  keyboardType="numeric"
                  className="border border-border rounded-md px-3 py-2 text-text"
                />
              </Card>
            </View>
          )}

          {/* STEP 2: Work Done */}
          {step === 2 && (
            <View className="space-y-4">
              <Card className="p-4">
                <Text className="text-sm font-semibold text-text mb-2">Work Done Today</Text>
                <TextInput
                  value={workDone}
                  onChangeText={setWorkDone}
                  placeholder="Describe the work completed today..."
                  multiline
                  numberOfLines={8}
                  textAlignVertical="top"
                  className="border border-border rounded-md px-3 py-2 text-text min-h-[160px]"
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
                  {taskDrafts.map((t) => (
                    <View key={t.taskId} className="mb-3 pb-3 border-b border-border">
                      <Pressable
                        onPress={() =>
                          setTaskDrafts((prev) =>
                            prev.map((x) =>
                              x.taskId === t.taskId ? { ...x, selected: !x.selected } : x,
                            ),
                          )
                        }
                        className="flex-row items-center gap-2 mb-2"
                      >
                        <View
                          className={`w-5 h-5 rounded border ${
                            t.selected ? 'bg-primary border-primary' : 'border-border'
                          }`}
                        />
                        <Text className="text-sm text-text flex-1">{t.taskName}</Text>
                      </Pressable>
                      {t.selected && (
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
                      )}
                    </View>
                  ))}
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
            />
          )}

          {/* STEP 4: Photos & Issues */}
          {step === 4 && (
            <View className="space-y-4">
              <Card className="p-4">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-sm font-semibold text-text">Photos ({photos.length}/10)</Text>
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={takePhoto}
                      className="px-3 py-1.5 rounded-md bg-primary"
                    >
                      <Text className="text-xs text-white font-semibold">Camera</Text>
                    </Pressable>
                    <Pressable
                      onPress={pickPhotos}
                      className="px-3 py-1.5 rounded-md bg-accent"
                    >
                      <Text className="text-xs text-white font-semibold">Gallery</Text>
                    </Pressable>
                  </View>
                </View>
                {photos.length > 0 ? (
                  <View className="flex-row flex-wrap gap-2">
                    {photos.map((p, idx) => (
                      <View key={idx} className="relative">
                        <Image
                          source={{ uri: p.uri }}
                          className="w-24 h-24 rounded-md"
                        />
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
                <Text className="text-sm font-semibold text-text mb-2">Issues / Blockers</Text>
                <TextInput
                  value={issues}
                  onChangeText={setIssues}
                  placeholder="Any issues, delays, or blockers?"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  className="border border-border rounded-md px-3 py-2 text-text min-h-[100px]"
                />
              </Card>
            </View>
          )}
        </ScrollView>

        {/* Footer Nav */}
        {formError ? (
          <View className="mx-4 mb-2 px-3 py-2 rounded-lg bg-danger/10 border border-danger/30">
            <Text className="text-sm text-danger">{formError}</Text>
          </View>
        ) : null}
        <View className="px-4 py-3 border-t border-border flex-row gap-2">
          {step > 1 && (
            <Button label="Back" variant="secondary" onPress={() => setStep((s) => (s - 1) as typeof s)} />
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
}: {
  projectId: string;
  materials: MaterialRow[];
  setMaterials: React.Dispatch<React.SetStateAction<MaterialRow[]>>;
  tasks: TaskRow[];
  boqItems: BoqItem[];
  deductStock: boolean;
  setDeductStock: (v: boolean) => void;
}) {
  useMaterials({ limit: 200 });
  const [showPicker, setShowPicker] = useState(false);
  const qtyRefs = React.useRef<Record<string, TextInput | null>>({});

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
    setMaterials((prev) => [
      ...prev,
      {
        resourceId: res.id,
        resourceName: res.name,
        unit: res.unit,
        rate: resolved?.rate ?? parseFloat(res.rate),
        rateSource: resolved?.source,
        quantityUsed: '',
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
          <Text className="text-sm font-semibold text-text">Materials Used</Text>
          <Pressable onPress={() => setShowPicker((v) => !v)} className="px-3 py-1.5 rounded-md bg-primary">
            <Text className="text-xs text-white font-semibold">+ Add material</Text>
          </Pressable>
        </View>

        {showPicker && (
          <View className="mb-3 border border-border rounded-md overflow-hidden p-3">
            <Text className="text-xs font-semibold text-muted mb-2">
              Tap a material to add it, then enter quantity
            </Text>
            <MaterialPicker
              onSelect={(r) => {
                void addMaterial(r);
              }}
              maxHeight={192}
            />
          </View>
        )}

        {materials.length === 0 ? (
          <Text className="text-xs text-muted">No materials added. Tap "+ Add material" to pick from your library.</Text>
        ) : (
          materials.map((m) => (
            <View key={m.resourceId} className="py-2 border-b border-border">
              <View className="flex-row items-center gap-2">
                <View className="flex-1" pointerEvents="none">
                  <Text className="text-sm font-medium text-text">{m.resourceName}</Text>
                  <Text className="text-xs text-muted">{m.unit}</Text>
                </View>
                <View className="items-end">
                  <Text className="text-[10px] text-muted mb-0.5 uppercase tracking-wide">Qty</Text>
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
                  <View className="w-16 items-end" pointerEvents="none">
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
              {(tasks.length > 0 || boqItems.length > 0) && (
                <View className="mt-2 gap-1">
                  {tasks.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View className="flex-row gap-1">
                        <Pressable
                          onPress={() => updateLink(m.resourceId, 'taskId', undefined)}
                          className={`px-2 py-1 rounded-full border ${
                            !m.taskId ? 'bg-primary border-primary' : 'border-border'
                          }`}
                        >
                          <Text className={`text-[10px] ${!m.taskId ? 'text-white' : 'text-muted'}`}>
                            No task
                          </Text>
                        </Pressable>
                        {tasks.map((t) => (
                          <Pressable
                            key={t.id}
                            onPress={() => updateLink(m.resourceId, 'taskId', t.id)}
                            className={`px-2 py-1 rounded-full border ${
                              m.taskId === t.id ? 'bg-primary border-primary' : 'border-border'
                            }`}
                          >
                            <Text
                              className={`text-[10px] ${
                                m.taskId === t.id ? 'text-white' : 'text-muted'
                              }`}
                              numberOfLines={1}
                            >
                              {t.name}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </ScrollView>
                  )}
                  {boqItems.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View className="flex-row gap-1">
                        <Pressable
                          onPress={() => updateLink(m.resourceId, 'boqItemId', undefined)}
                          className={`px-2 py-1 rounded-full border ${
                            !m.boqItemId ? 'bg-accent border-accent' : 'border-border'
                          }`}
                        >
                          <Text className={`text-[10px] ${!m.boqItemId ? 'text-white' : 'text-muted'}`}>
                            No BOQ
                          </Text>
                        </Pressable>
                        {boqItems.slice(0, 12).map((b) => (
                          <Pressable
                            key={b.id}
                            onPress={() => updateLink(m.resourceId, 'boqItemId', b.id)}
                            className={`px-2 py-1 rounded-full border ${
                              m.boqItemId === b.id ? 'bg-accent border-accent' : 'border-border'
                            }`}
                          >
                            <Text
                              className={`text-[10px] ${
                                m.boqItemId === b.id ? 'text-white' : 'text-muted'
                              }`}
                            >
                              {b.itemCode}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </ScrollView>
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
                      className="flex-row items-center gap-2 mt-1"
                    >
                      <View
                        className={`w-4 h-4 rounded border ${m.postToBoqMeasurement ? 'bg-primary border-primary' : 'border-border'}`}
                      />
                      <Text className="text-xs text-muted">Post qty to BOQ measurement book on submit</Text>
                    </Pressable>
                  ) : null}
                </View>
              )}
            </View>
          ))
        )}

        {materials.some((m) => m.quantityUsed) && (
          <Text className="text-sm font-semibold text-text mt-2">
            Est. Cost: Rs{' '}
            {materials
              .reduce((sum, m) => sum + (m.quantityUsed ? parseFloat(m.quantityUsed) * m.rate : 0), 0)
              .toFixed(0)}
          </Text>
        )}
      </Card>
    </View>
  );
}