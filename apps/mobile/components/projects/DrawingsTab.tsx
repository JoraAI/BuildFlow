/**
 * BuildFlow - Project Drawings & Blueprints Management Tab (Module 4).
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Card, Button, Badge, LoadingSkeleton, EmptyState, Input } from '@/components/ui';
import { AdaptiveSheet } from '@/components/layout/AdaptiveSheet';
import { useViewport } from '@/hooks/useViewport';
import { usePermission } from '@/hooks/usePermission';
import { useTranslation } from '@/hooks/useTranslation';
import {
  useDrawings,
  useDrawing,
  useCreateDrawing,
  useAddDrawingVersion,
  useUpdateDrawing,
  useReplaceDrawingPins,
  type Drawing,
  type DrawingPin,
} from '@/services/drawing.queries';
import { DrawingViewer } from '@/components/drawings/DrawingViewer';
import { alertAsync, confirmAsync } from '@/utils/confirm';

const DISCIPLINES = ['ARCHITECTURAL', 'STRUCTURAL', 'MEP', 'CIVIL', 'OTHER'] as const;

interface DrawingsTabProps {
  projectId: string;
}

function normalizePins(raw: unknown): DrawingPin[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (p): p is DrawingPin =>
      !!p &&
      typeof p === 'object' &&
      typeof (p as DrawingPin).id === 'string' &&
      typeof (p as DrawingPin).xPct === 'number' &&
      typeof (p as DrawingPin).yPct === 'number',
  );
}

export function DrawingsTab({ projectId }: DrawingsTabProps) {
  const { isDesktop, isTablet } = useViewport();
  const { t } = useTranslation();
  const canUpload = usePermission('drawing.upload');
  const canManage = usePermission('drawing.manage');

  const [selectedDiscipline, setSelectedDiscipline] = useState<string | null>(null);
  const [activeDrawingId, setActiveDrawingId] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);

  const [drawingNo, setDrawingNo] = useState('');
  const [title, setTitle] = useState('');
  const [discipline, setDiscipline] = useState<string>('ARCHITECTURAL');
  const [category, setCategory] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [pickingImage, setPickingImage] = useState(false);

  const [versionLabel, setVersionLabel] = useState('');
  const [versionNotes, setVersionNotes] = useState('');
  const [versionFileUrl, setVersionFileUrl] = useState('');

  const [localPins, setLocalPins] = useState<DrawingPin[]>([]);

  const openNewDrawingModal = () => {
    setDrawingNo('');
    setTitle('');
    setDiscipline('ARCHITECTURAL');
    setCategory('');
    setFileUrl('');
    setShowUploadModal(true);
  };

  const closeUploadModal = () => {
    setShowUploadModal(false);
    setDrawingNo('');
    setTitle('');
    setCategory('');
    setFileUrl('');
  };

  const openVersionModal = () => {
    setVersionLabel('');
    setVersionNotes('');
    setVersionFileUrl('');
    setShowVersionModal(true);
  };

  const closeVersionModal = () => {
    setShowVersionModal(false);
    setVersionLabel('');
    setVersionNotes('');
    setVersionFileUrl('');
  };

  const { data: listData, isLoading } = useDrawings({
    projectId,
    discipline: selectedDiscipline ?? undefined,
  });

  const detailQ = useDrawing(activeDrawingId);
  const activeDrawing = detailQ.data ?? null;

  const createMut = useCreateDrawing();
  const versionMut = useAddDrawingVersion();
  const updateMut = useUpdateDrawing();
  const pinsMut = useReplaceDrawingPins();
  const drawings = listData?.data ?? [];

  useEffect(() => {
    if (activeDrawing) {
      setLocalPins(normalizePins(activeDrawing.pins));
    } else {
      setLocalPins([]);
    }
  }, [activeDrawing?.id, activeDrawing?.pins]);

  const persistPins = async (next: DrawingPin[]) => {
    if (!activeDrawingId) return;
    setLocalPins(next);
    try {
      await pinsMut.mutateAsync({ id: activeDrawingId, pins: next });
    } catch (e: unknown) {
      await alertAsync('Error', e instanceof Error ? e.message : 'Failed to save pins');
      if (activeDrawing) setLocalPins(normalizePins(activeDrawing.pins));
    }
  };

  const pickPlanImage = async (setter: (url: string) => void) => {
    try {
      setPickingImage(true);
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        await alertAsync('Permission required', 'Allow photo library access to attach a plan sheet.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        quality: 0.55,
        base64: true,
      });
      if (res.canceled || !res.assets?.[0]?.base64) return;
      setter(`data:image/jpeg;base64,${res.assets[0].base64}`);
    } catch {
      await alertAsync('Error', 'Could not load plan image.');
    } finally {
      setPickingImage(false);
    }
  };

  const handleCreateDrawing = async () => {
    if (!drawingNo.trim() || !title.trim()) {
      await alertAsync('Required fields', 'Please enter Drawing Number and Title.');
      return;
    }

    try {
      const created = await createMut.mutateAsync({
        projectId,
        drawingNo: drawingNo.trim(),
        title: title.trim(),
        discipline,
        category: category.trim() || null,
      });

      if (fileUrl.trim()) {
        await versionMut.mutateAsync({
          id: created.id,
          versionLabel: 'Rev-01',
          fileUrl: fileUrl.trim(),
        });
      }

      closeUploadModal();
      await alertAsync('Success', 'Drawing registered in project archive.');
    } catch (e: unknown) {
      await alertAsync('Error', e instanceof Error ? e.message : 'Failed to register drawing');
    }
  };

  const handleAddVersion = async () => {
    if (!activeDrawingId) return;
    if (!versionLabel.trim()) {
      await alertAsync('Required field', 'Please enter a revision tag (e.g. Rev-02).');
      return;
    }
    if (!versionFileUrl.trim()) {
      await alertAsync('Required field', 'Attach a plan image or paste an image URL.');
      return;
    }

    try {
      await versionMut.mutateAsync({
        id: activeDrawingId,
        versionLabel: versionLabel.trim(),
        fileUrl: versionFileUrl.trim(),
        notes: versionNotes.trim() || null,
      });

      closeVersionModal();
      await alertAsync('Success', 'New revision uploaded and marked as current.');
    } catch (e: unknown) {
      await alertAsync('Error', e instanceof Error ? e.message : 'Failed to upload revision');
    }
  };

  const handleAddPin = (pin: { xPct: number; yPct: number }) => {
    const newPin: DrawingPin = {
      id: `pin-${Date.now()}`,
      xPct: pin.xPct,
      yPct: pin.yPct,
      title: `Defect Pin at (${Math.round(pin.xPct)}%, ${Math.round(pin.yPct)}%)`,
      severity: 'HIGH',
      status: 'OPEN',
      assignee: 'Unassigned',
    };
    void persistPins([...localPins, newPin]);
  };

  const handleUpdatePin = (updatedPin: DrawingPin) => {
    void persistPins(localPins.map((p) => (p.id === updatedPin.id ? updatedPin : p)));
  };

  const handleDeletePin = async (pinId: string) => {
    const ok = await confirmAsync('Delete Pin', 'Remove this pin from the sheet?');
    if (!ok) return;
    await persistPins(localPins.filter((p) => p.id !== pinId));
  };

  const handleStatus = async (status: Drawing['status']) => {
    if (!activeDrawingId) return;
    try {
      await updateMut.mutateAsync({ id: activeDrawingId, status });
    } catch (e: unknown) {
      await alertAsync('Error', e instanceof Error ? e.message : 'Failed to update status');
    }
  };

  if (activeDrawingId) {
    return (
      <View className="gap-3">
        <View className="flex-row items-center justify-between flex-wrap gap-2">
          <Button
            label="Back to Drawings"
            size="sm"
            variant="ghost"
            icon={<Ionicons name="arrow-back" size={16} color="#1E3A5F" />}
            onPress={() => setActiveDrawingId(null)}
          />
          <View className="flex-row flex-wrap gap-2">
            {canManage && activeDrawing?.status === 'DRAFT' ? (
              <Button
                label="Send for review"
                size="sm"
                variant="secondary"
                onPress={() => handleStatus('IN_REVIEW')}
                loading={updateMut.isPending}
              />
            ) : null}
            {canManage && (activeDrawing?.status === 'DRAFT' || activeDrawing?.status === 'IN_REVIEW') ? (
              <Button
                label="Approve"
                size="sm"
                onPress={() => handleStatus('APPROVED')}
                loading={updateMut.isPending}
              />
            ) : null}
            {canUpload ? (
              <Button
                label="+ Upload New Revision"
                size="sm"
                variant="secondary"
                onPress={openVersionModal}
              />
            ) : null}
          </View>
        </View>

        {detailQ.isLoading || !activeDrawing ? (
          <LoadingSkeleton className="h-64 rounded-xl" />
        ) : (
          <DrawingViewer
            drawing={activeDrawing}
            pins={localPins}
            onAddPin={handleAddPin}
            onUpdatePin={handleUpdatePin}
            onDeletePin={handleDeletePin}
          />
        )}

        <AdaptiveSheet
          visible={showVersionModal}
          onClose={closeVersionModal}
          title="Upload Revision"
          subtitle="Add updated blueprint version or revision sheet"
          size="sm"
          footer={
            <View className="flex-row gap-2">
              <Button label="Cancel" variant="ghost" className="flex-1" onPress={closeVersionModal} />
              <Button
                label="Submit Revision"
                className="flex-1"
                onPress={handleAddVersion}
                loading={versionMut.isPending}
              />
            </View>
          }
        >
          <View className="gap-2.5">
            <Input
              label="Revision Label *"
              placeholder="e.g. Rev-02 (GFC / Approved)"
              value={versionLabel}
              onChangeText={setVersionLabel}
            />
            <Input
              label="Blueprint Image URL"
              placeholder="https://… or pick from gallery"
              value={versionFileUrl}
              onChangeText={setVersionFileUrl}
            />
            <Button
              label="Pick plan from gallery"
              size="sm"
              variant="secondary"
              loading={pickingImage}
              onPress={() => pickPlanImage(setVersionFileUrl)}
            />
            <Input
              label="Revision Notes"
              placeholder="e.g. Revised beam reinforcement as per consultant"
              value={versionNotes}
              onChangeText={setVersionNotes}
              multiline
            />
          </View>
        </AdaptiveSheet>
      </View>
    );
  }

  return (
    <View className="gap-3.5">
      <View className="flex-row justify-between items-start gap-2 flex-wrap">
        <View className="flex-1 min-w-[180px] pr-2">
          <Text className="text-lg md:text-xl font-bold text-text">{t('Drawing & Blueprint Suite')}</Text>
          <Text className="text-xs text-muted mt-0.5">
            Architectural, structural & MEP plans with revision controls and defect pins
          </Text>
        </View>
        {canUpload ? (
          <Button
            label={t('Upload Drawing')}
            size="sm"
            onPress={openNewDrawingModal}
            icon={<Ionicons name="add" size={16} color="#fff" />}
          />
        ) : null}
      </View>

      <View className="flex-row flex-wrap items-center gap-1.5">
        <Pressable
          onPress={() => setSelectedDiscipline(null)}
          className={`px-3 py-1.5 rounded-lg border ${
            selectedDiscipline === null ? 'bg-primary border-primary' : 'bg-card border-border'
          }`}
        >
          <Text className={`text-xs font-semibold ${selectedDiscipline === null ? 'text-white' : 'text-text'}`}>
            All Disciplines
          </Text>
        </Pressable>
        {DISCIPLINES.map((d) => {
          const active = selectedDiscipline === d;
          return (
            <Pressable
              key={d}
              onPress={() => setSelectedDiscipline(active ? null : d)}
              className={`px-3 py-1.5 rounded-lg border ${
                active ? 'bg-primary border-primary' : 'bg-card border-border'
              }`}
            >
              <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-text'}`}>
                {d}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <View className={isDesktop || isTablet ? 'grid grid-cols-2 lg:grid-cols-3 gap-3' : 'gap-2.5'}>
          <LoadingSkeleton className="h-20 rounded-xl" />
          <LoadingSkeleton className="h-20 rounded-xl" />
          <LoadingSkeleton className="h-20 rounded-xl" />
        </View>
      ) : drawings.length === 0 ? (
        <EmptyState
          title="No drawings uploaded"
          description={
            canUpload
              ? 'Archive GFC architectural, structural and MEP drawings with interactive revision controls using the button above.'
              : 'No drawings have been uploaded for this project yet.'
          }
        />
      ) : (
        <View className={isDesktop || isTablet ? 'grid grid-cols-2 lg:grid-cols-3 gap-3' : 'gap-2.5'}>
          {drawings.map((d: Drawing) => {
            const revCount = d._count?.versions ?? (d.versions?.length || (d.currentVersion ? 1 : 0));
            const pinCount = normalizePins(d.pins).length;
            return (
              <Card key={d.id} className="p-3" onPress={() => setActiveDrawingId(d.id)}>
                <View className="flex-row justify-between items-start">
                  <View className="flex-1 pr-2">
                    <View className="flex-row items-center gap-1.5 mb-1 flex-wrap">
                      <Text className="text-xs font-bold text-primary">{d.drawingNo}</Text>
                      <Badge label={d.discipline} color="primary" />
                      <Badge label={d.status} color={d.status === 'APPROVED' ? 'success' : 'neutral'} />
                    </View>
                    <Text className="text-sm md:text-base font-semibold text-text" numberOfLines={1}>{d.title}</Text>
                    <Text className="text-[11px] text-muted mt-0.5">
                      {d.category ?? 'General'} · {revCount} revision{revCount === 1 ? '' : 's'}
                      {pinCount > 0 ? ` · ${pinCount} pin${pinCount === 1 ? '' : 's'}` : ''}
                    </Text>
                  </View>
                  <View className="w-8 h-8 rounded-lg bg-primary/10 items-center justify-center">
                    <Ionicons name="open-outline" size={16} color="#1E3A5F" />
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      )}

      <AdaptiveSheet
        visible={showUploadModal}
        onClose={closeUploadModal}
        title="Register Project Drawing"
        subtitle="Architectural, structural & MEP drawing sheet"
        size="md"
        footer={
          <View className="flex-row gap-2">
            <Button label="Cancel" variant="ghost" className="flex-1" onPress={closeUploadModal} />
            <Button
              label="Register Plan"
              className="flex-1"
              onPress={handleCreateDrawing}
              loading={createMut.isPending || versionMut.isPending}
            />
          </View>
        }
      >
        <View className="gap-2.5">
          <Input
            label="Drawing Number *"
            placeholder="e.g. AR-01-A, ST-UG-02"
            value={drawingNo}
            onChangeText={setDrawingNo}
          />
          <Input
            label="Drawing Title *"
            placeholder="e.g. Ground Floor Column Layout"
            value={title}
            onChangeText={setTitle}
          />
          <View>
            <Text className="text-xs font-semibold text-text mb-1">Discipline *</Text>
            <View className="flex-row flex-wrap items-center gap-1.5">
              {DISCIPLINES.map((d) => {
                const active = discipline === d;
                return (
                  <Pressable
                    key={d}
                    onPress={() => setDiscipline(d)}
                    className={`px-3 py-1.5 rounded-lg border ${
                      active ? 'bg-primary border-primary' : 'bg-surface border-border'
                    }`}
                  >
                    <Text className={`text-xs font-medium ${active ? 'text-white' : 'text-text'}`}>
                      {d}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Input
            label="Category / Sub-system"
            placeholder="e.g. Foundations, HVAC, Plumbing"
            value={category}
            onChangeText={setCategory}
          />
          <Input
            label="Initial Plan Image URL (Optional)"
            placeholder="https://… or pick from gallery"
            value={fileUrl}
            onChangeText={setFileUrl}
          />
          <Button
            label="Pick plan from gallery"
            size="sm"
            variant="secondary"
            loading={pickingImage}
            onPress={() => pickPlanImage(setFileUrl)}
          />
        </View>
      </AdaptiveSheet>
    </View>
  );
}
