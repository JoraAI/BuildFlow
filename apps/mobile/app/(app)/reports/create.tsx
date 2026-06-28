/**
 * BuildFlow — Create Daily Report wizard (4 steps).
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
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Card, Button, Badge } from '@/components/ui';
import { FormScreenHeader } from '@/components/layout/ScreenHeader';
import { dismissTo, DISMISS } from '@/utils/navigation';
import { useAppStore } from '@/stores/app.store';
import { useProjects } from '@/services/project.queries';
import { useResources } from '@/services/estimate.queries';
import { useCreateReport, useUploadReportPhoto } from '@/services/report.queries';
import type { Weather, SiteStatus } from '@buildflow/shared';
import type { Resource } from '@/services/estimate.queries';

interface MaterialRow {
  resourceId: string;
  resourceName: string;
  unit: string;
  rate: number;
  quantityUsed: string;
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
  const { data: projects } = useProjects();
  const projectId = activeProjectId ?? projects?.[0]?.id ?? '';

  const createMut = useCreateReport(projectId);
  const [createdReportId, setCreatedReportId] = useState<string | null>(null);
  const uploadMut = useUploadReportPhoto(createdReportId ?? '');

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [weather, setWeather] = useState<Weather | null>(null);
  const [workersCount, setWorkersCount] = useState('');
  const [siteStatus, setSiteStatus] = useState<SiteStatus | null>(null);

  // Step 2
  const [workDone, setWorkDone] = useState('');

  // Step 3
  const [materials, setMaterials] = useState<MaterialRow[]>([]);

  // Step 4
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [issues, setIssues] = useState('');

  const canNext = () => {
    if (step === 1) return !!reportDate;
    return true;
  };

  const handleSubmit = async () => {
    try {
      const created = await createMut.mutateAsync({
        reportDate,
        weather: weather ?? undefined,
        siteStatus: siteStatus ?? undefined,
        workDone: workDone || undefined,
        issues: issues || undefined,
        workersCount: workersCount ? parseInt(workersCount, 10) : undefined,
        materialUsages: materials
          .filter((m) => m.quantityUsed && parseFloat(m.quantityUsed) > 0)
          .map((m) => ({
            resourceId: m.resourceId,
            quantityUsed: parseFloat(m.quantityUsed),
          })),
      });

      setCreatedReportId(created.id);

      // Upload photos sequentially
      for (const photo of photos) {
        await uploadMut.mutateAsync({
          uri: photo.uri,
          filename: photo.filename,
          contentType: photo.contentType,
        });
      }

      Alert.alert('Success', 'Daily report submitted successfully.', [
        { text: 'OK', onPress: () => router.replace('/(app)/reports') },
      ]);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to submit report');
    }
  };

  const pickPhotos = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please grant photo library access.');
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
      Alert.alert('Permission needed', 'Please grant camera access.');
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
                <Text className="text-sm font-semibold text-text mb-2">Report Date</Text>
                <TextInput
                  value={reportDate}
                  onChangeText={setReportDate}
                  placeholder="YYYY-MM-DD"
                  className="border border-border rounded-md px-3 py-2 text-text"
                />
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
          )}

          {/* STEP 3: Materials Used */}
          {step === 3 && <MaterialsStep materials={materials} setMaterials={setMaterials} />}

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
                  label={isSubmitting ? 'Submitting...' : 'Submit Report'}
                  onPress={handleSubmit}
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
  materials,
  setMaterials,
}: {
  materials: MaterialRow[];
  setMaterials: React.Dispatch<React.SetStateAction<MaterialRow[]>>;
}) {
  const { data } = useResources();
  const resources: Resource[] = data?.data ?? [];
  const [showPicker, setShowPicker] = useState(false);

  const addMaterial = (res: Resource) => {
    setMaterials((prev) => [
      ...prev,
      {
        resourceId: res.id,
        resourceName: res.name,
        unit: res.unit,
        rate: parseFloat(res.rate),
        quantityUsed: '',
      },
    ]);
    setShowPicker(false);
  };

  const removeMaterial = (idx: number) => {
    setMaterials((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateQty = (idx: number, qty: string) => {
    setMaterials((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, quantityUsed: qty } : m)),
    );
  };

  return (
    <View className="space-y-3">
      <Card className="p-4">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-sm font-semibold text-text">Materials Used</Text>
          <Pressable onPress={() => setShowPicker((v) => !v)} className="px-3 py-1.5 rounded-md bg-primary">
            <Text className="text-xs text-white font-semibold">+ Add</Text>
          </Pressable>
        </View>

        {showPicker && (
          <ScrollView className="max-h-48 mb-2 border border-border rounded-md">
            {resources.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => addMaterial(r)}
                className="px-3 py-2 border-b border-border"
              >
                <Text className="text-sm text-text">{r.name}</Text>
                <Text className="text-xs text-muted">
                  {r.unit} · Rs {r.rate}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {materials.length === 0 ? (
          <Text className="text-xs text-muted">No materials added. Tap "+ Add" to add usage.</Text>
        ) : (
          materials.map((m, idx) => (
            <View key={idx} className="flex-row items-center gap-2 py-2 border-b border-border">
              <View className="flex-1">
                <Text className="text-sm text-text">{m.resourceName}</Text>
                <Text className="text-xs text-muted">{m.unit}</Text>
              </View>
              <TextInput
                value={m.quantityUsed}
                onChangeText={(v) => updateQty(idx, v.replace(/[^0-9.]/g, ''))}
                placeholder="Qty"
                keyboardType="numeric"
                className="w-20 border border-border rounded-md px-2 py-1.5 text-text text-center"
              />
              {m.quantityUsed && (
                <Text className="text-xs text-muted w-20">
                  Rs {(parseFloat(m.quantityUsed) * m.rate).toFixed(0)}
                </Text>
              )}
              <Pressable onPress={() => removeMaterial(idx)}>
                <Text className="text-danger text-sm">✕</Text>
              </Pressable>
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