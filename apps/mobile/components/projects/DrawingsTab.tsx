/**
 * BuildFlow - Project Drawings & Blueprints Management Tab (Module 4).
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button, Badge, LoadingSkeleton, EmptyState, Input } from '@/components/ui';
import { AdaptiveSheet } from '@/components/layout/AdaptiveSheet';
import { useViewport } from '@/hooks/useViewport';
import { useAuthStore } from '@/stores/auth.store';
import { usePermission } from '@/hooks/usePermission';
import { useTranslation } from '@/hooks/useTranslation';
import {
  useDrawings,
  useCreateDrawing,
  useAddDrawingVersion,
  type Drawing,
} from '@/services/drawing.queries';
import { DrawingViewer, type DrawingPin } from '@/components/drawings/DrawingViewer';
import { alertAsync, confirmAsync } from '@/utils/confirm';

const DISCIPLINES = ['ARCHITECTURAL', 'STRUCTURAL', 'MEP', 'CIVIL', 'OTHER'] as const;

interface DrawingsTabProps {
  projectId: string;
}

export function DrawingsTab({ projectId }: DrawingsTabProps) {
  const { isDesktop, isTablet } = useViewport();
  const { t } = useTranslation();
  const canUpload = usePermission('drawing.upload');

  const [selectedDiscipline, setSelectedDiscipline] = useState<string | null>(null);
  const [activeDrawing, setActiveDrawing] = useState<Drawing | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);

  // New Drawing Form
  const [drawingNo, setDrawingNo] = useState('');
  const [title, setTitle] = useState('');
  const [discipline, setDiscipline] = useState<string>('ARCHITECTURAL');
  const [category, setCategory] = useState('');
  const [fileUrl, setFileUrl] = useState('');

  // Version Form
  const [versionLabel, setVersionLabel] = useState('');
  const [versionNotes, setVersionNotes] = useState('');
  const [versionFileUrl, setVersionFileUrl] = useState('');

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

  // Pins for active drawing (starts clean per drawing)
  const [pinsByDrawing, setPinsByDrawing] = useState<Record<string, DrawingPin[]>>({});
  const activePins = activeDrawing ? (pinsByDrawing[activeDrawing.id] ?? []) : [];

  const { data: listData, isLoading, refetch } = useDrawings({
    projectId,
    discipline: selectedDiscipline ?? undefined,
  });

  const createMut = useCreateDrawing();
  const versionMut = useAddDrawingVersion();
  const drawings = listData?.data ?? [];

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

      // If initial file URL provided, attach as Rev-01
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
    if (!activeDrawing) return;
    if (!versionLabel.trim()) {
      await alertAsync('Required field', 'Please enter a revision tag (e.g. Rev-02).');
      return;
    }

    try {
      await versionMut.mutateAsync({
        id: activeDrawing.id,
        versionLabel: versionLabel.trim(),
        fileUrl: versionFileUrl.trim() || 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=1200&q=80',
        notes: versionNotes.trim() || null,
      });

      closeVersionModal();
      await alertAsync('Success', 'New revision uploaded and marked as current.');
    } catch (e: unknown) {
      await alertAsync('Error', e instanceof Error ? e.message : 'Failed to upload revision');
    }
  };

  const handleAddPin = (pin: { xPct: number; yPct: number }) => {
    if (!activeDrawing) return;
    const newPin: DrawingPin = {
      id: `pin-${Date.now()}`,
      xPct: pin.xPct,
      yPct: pin.yPct,
      title: `Defect Pin at (${Math.round(pin.xPct)}%, ${Math.round(pin.yPct)}%)`,
      severity: 'HIGH',
      status: 'OPEN',
      assignee: 'Unassigned',
    };
    setPinsByDrawing((prev) => ({
      ...prev,
      [activeDrawing.id]: [...(prev[activeDrawing.id] ?? []), newPin],
    }));
    void alertAsync('Pin Placed', `Placed defect pin at ${Math.round(pin.xPct)}% X, ${Math.round(pin.yPct)}% Y.`);
  };

  const handleUpdatePin = (updatedPin: DrawingPin) => {
    if (!activeDrawing) return;
    setPinsByDrawing((prev) => ({
      ...prev,
      [activeDrawing.id]: (prev[activeDrawing.id] ?? []).map((p) =>
        p.id === updatedPin.id ? updatedPin : p,
      ),
    }));
  };

  const handleDeletePin = async (pinId: string) => {
    if (!activeDrawing) return;
    const ok = await confirmAsync('Delete Pin', 'Are you sure you want to remove this pin from the sheet?');
    if (!ok) return;
    setPinsByDrawing((prev) => ({
      ...prev,
      [activeDrawing.id]: (prev[activeDrawing.id] ?? []).filter((p) => p.id !== pinId),
    }));
  };

  if (activeDrawing) {
    return (
      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Button
            label="Back to Drawings"
            size="sm"
            variant="ghost"
            icon={<Ionicons name="arrow-back" size={16} color="#1E3A5F" />}
            onPress={() => setActiveDrawing(null)}
          />
          {canUpload ? (
            <Button
              label="+ Upload New Revision"
              size="sm"
              variant="secondary"
              onPress={openVersionModal}
            />
          ) : null}
        </View>

        <DrawingViewer
          drawing={activeDrawing}
          pins={activePins}
          onAddPin={handleAddPin}
          onUpdatePin={handleUpdatePin}
          onDeletePin={handleDeletePin}
        />

        {/* New Version Modal */}
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
              label="Blueprint Image / PDF URL"
              placeholder="https://..."
              value={versionFileUrl}
              onChangeText={setVersionFileUrl}
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
      {/* Header */}
      <View className="flex-row justify-between items-center">
        <View className="flex-1 pr-2">
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

      {/* Discipline filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-1.5">
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
      </ScrollView>

      {/* Drawings Grid / List */}
      {isLoading ? (
        <View className={isDesktop || isTablet ? 'grid grid-cols-2 lg:grid-cols-3 gap-3' : 'gap-2.5'}>
          <LoadingSkeleton className="h-20 rounded-xl" />
          <LoadingSkeleton className="h-20 rounded-xl" />
          <LoadingSkeleton className="h-20 rounded-xl" />
        </View>
      ) : drawings.length === 0 ? (
        <EmptyState
          title="No drawings uploaded"
          description="Archive GFC architectural, structural and MEP drawings with interactive revision controls using the button above."
        />
      ) : (
        <View className={isDesktop || isTablet ? 'grid grid-cols-2 lg:grid-cols-3 gap-3' : 'gap-2.5'}>
          {drawings.map((d: Drawing) => {
            const revCount = d._count?.versions ?? (d.versions?.length || 1);
            return (
              <Card key={d.id} className="p-3" onPress={() => setActiveDrawing(d)}>
                <View className="flex-row justify-between items-start">
                  <View className="flex-1 pr-2">
                    <View className="flex-row items-center gap-1.5 mb-1">
                      <Text className="text-xs font-bold text-primary">{d.drawingNo}</Text>
                      <Badge label={d.discipline} color="primary" />
                      <Badge label={d.status} color={d.status === 'APPROVED' ? 'success' : 'neutral'} />
                    </View>
                    <Text className="text-sm md:text-base font-semibold text-text" numberOfLines={1}>{d.title}</Text>
                    <Text className="text-[11px] text-muted mt-0.5">
                      Category: {d.category ?? 'General'} · {revCount} revision{revCount === 1 ? '' : 's'}
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

      {/* Upload Drawing Modal */}
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
              loading={createMut.isPending}
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-1.5">
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
            </ScrollView>
          </View>

          <Input
            label="Category / Sub-system"
            placeholder="e.g. Foundations, HVAC, Plumbing"
            value={category}
            onChangeText={setCategory}
          />
          <Input
            label="Initial Plan Image URL (Optional)"
            placeholder="https://..."
            value={fileUrl}
            onChangeText={setFileUrl}
          />
        </View>
      </AdaptiveSheet>
    </View>
  );
}
