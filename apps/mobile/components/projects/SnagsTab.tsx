/**
 * BuildFlow - Snag List & Visual NCR Quality Hub (Module 5).
 * Features before/after inspection photos, severity filters, contractor assignment & 1-tap sign-off.
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
import * as ImagePicker from 'expo-image-picker';
import { Card, Button, Badge, LoadingSkeleton, EmptyState, Input } from '@/components/ui';
import { AdaptiveSheet } from '@/components/layout/AdaptiveSheet';
import { useViewport } from '@/hooks/useViewport';
import { useAuthStore } from '@/stores/auth.store';
import { usePermission } from '@/hooks/usePermission';
import { useTranslation } from '@/hooks/useTranslation';
import {
  useSnagItems,
  useCreateSnag,
  useUpdateSnag,
  useDeleteSnag,
  type SnagItem,
  type SnagPriority,
  type SnagStatus,
} from '@/services/snag.queries';
import { formatDate } from '@/utils/format';
import { alertAsync, confirmAsync } from '@/utils/confirm';

const PRIORITIES: { id: SnagPriority; label: string; color: 'danger' | 'warning' | 'neutral' }[] = [
  { id: 'CRITICAL', label: 'Critical NCR', color: 'danger' },
  { id: 'HIGH', label: 'High Priority', color: 'danger' },
  { id: 'MEDIUM', label: 'Medium', color: 'warning' },
  { id: 'LOW', label: 'Minor / Low', color: 'neutral' },
];

const STATUS_FILTERS: { id: SnagStatus | 'ALL'; label: string }[] = [
  { id: 'ALL', label: 'All Snags' },
  { id: 'OPEN', label: 'Open' },
  { id: 'IN_PROGRESS', label: 'In Progress' },
  { id: 'READY_FOR_REVIEW', label: 'Review Ready' },
  { id: 'CLOSED', label: 'Closed / Rectified' },
];

interface SnagsTabProps {
  projectId: string;
}

export function SnagsTab({ projectId }: SnagsTabProps) {
  const { isDesktop, isTablet } = useViewport();
  const { t } = useTranslation();
  const canCreate = usePermission('snag.create');
  const canRectify = usePermission('snag.rectify');

  const [filterStatus, setFilterStatus] = useState<SnagStatus | 'ALL'>('ALL');
  const [filterPriority, setFilterPriority] = useState<SnagPriority | 'ALL'>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [photoViewerUrls, setPhotoViewerUrls] = useState<string[] | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [priority, setPriority] = useState<SnagPriority>('HIGH');
  const [assignedTo, setAssignedTo] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const openNewSnagModal = () => {
    setTitle('');
    setDescription('');
    setLocation('');
    setPriority('HIGH');
    setAssignedTo('');
    setPhotos([]);
    setUploading(false);
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setTitle('');
    setDescription('');
    setLocation('');
    setAssignedTo('');
    setPhotos([]);
    setUploading(false);
  };

  const { data: listData, isLoading, refetch } = useSnagItems({
    projectId,
    status: filterStatus === 'ALL' ? undefined : filterStatus,
    priority: filterPriority === 'ALL' ? undefined : filterPriority,
  });

  const createMut = useCreateSnag();
  const updateMut = useUpdateSnag();
  const deleteMut = useDeleteSnag();
  const snags = listData?.data ?? [];

  const handlePickPhoto = async (useCamera: boolean) => {
    try {
      setUploading(true);
      const perm = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!perm.granted) {
        setUploading(false);
        await alertAsync('Permission required', 'Please allow camera/photos access in device settings.');
        return;
      }

      const res = useCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, base64: true });

      if (res.canceled) {
        setUploading(false);
        return;
      }

      if (res.assets && res.assets[0]?.base64) {
        const dataUrl = `data:image/jpeg;base64,${res.assets[0].base64}`;
        setPhotos((prev) => [...prev, dataUrl]);
      }
    } catch {
      await alertAsync('Error', 'Could not load photo.');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      await alertAsync('Required field', 'Please provide a defect / snag title.');
      return;
    }

    try {
      await createMut.mutateAsync({
        projectId,
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        priority,
        assignedTo: assignedTo.trim() || null,
        photos,
      });

      closeCreateModal();
      await alertAsync('Snag Logged', 'Quality defect recorded and added to punch list.');
    } catch (e: unknown) {
      await alertAsync('Error', e instanceof Error ? e.message : 'Failed to create snag');
    }
  };

  const handleStatusChange = async (snag: SnagItem, nextStatus: SnagStatus) => {
    try {
      await updateMut.mutateAsync({
        id: snag.id,
        status: nextStatus,
      });
    } catch (e: unknown) {
      await alertAsync('Error', e instanceof Error ? e.message : 'Failed to update status');
    }
  };

  const renderStatusButton = (snag: SnagItem) => {
    if (!canRectify) return null;
    if (snag.status === 'OPEN') {
      return (
        <Button
          label="Start Rectification"
          size="sm"
          variant="secondary"
          onPress={() => handleStatusChange(snag, 'IN_PROGRESS')}
        />
      );
    }
    if (snag.status === 'IN_PROGRESS') {
      return (
        <Button
          label="Mark Ready for Review"
          size="sm"
          variant="secondary"
          onPress={() => handleStatusChange(snag, 'READY_FOR_REVIEW')}
        />
      );
    }
    if (snag.status === 'READY_FOR_REVIEW') {
      return (
        <Button
          label="Sign-off & Close"
          size="sm"
          onPress={() => handleStatusChange(snag, 'CLOSED')}
          icon={<Ionicons name="checkmark" size={14} color="#fff" />}
        />
      );
    }
    return (
      <View className="flex-row items-center gap-1">
        <Ionicons name="checkmark-done-circle" size={16} color="#10B981" />
        <Text className="text-xs font-bold text-emerald-600">Rectified</Text>
      </View>
    );
  };

  return (
    <View className="gap-4">
      {/* Header */}
      <View className="flex-row justify-between items-center">
        <View>
          <Text className="text-xl font-bold text-text">{t('Snag List & Quality NCRs')}</Text>
          <Text className="text-xs text-muted mt-0.5">
            Defect tracking, before/after evidence photos, contractor rectification & sign-offs
          </Text>
        </View>
        {canCreate ? (
          <Button
            label={t('Log Snag / NCR')}
            size="sm"
            onPress={openNewSnagModal}
            icon={<Ionicons name="add" size={16} color="#fff" />}
          />
        ) : null}
      </View>

      {/* Filter Chips */}
      <View className="flex-row flex-wrap items-center gap-1.5">
        {STATUS_FILTERS.map((s) => {
          const active = filterStatus === s.id;
          return (
            <Pressable
              key={s.id}
              onPress={() => setFilterStatus(s.id)}
              className={`px-3 py-1.5 rounded-lg border ${
                active ? 'bg-primary border-primary' : 'bg-card border-border'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  active ? 'text-white' : 'text-text'
                }`}
              >
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Snags Feed */}
      {isLoading ? (
        <View className={isDesktop || isTablet ? 'grid grid-cols-2 lg:grid-cols-3 gap-3' : 'gap-2.5'}>
          <LoadingSkeleton className="h-20 rounded-xl" />
          <LoadingSkeleton className="h-20 rounded-xl" />
          <LoadingSkeleton className="h-20 rounded-xl" />
        </View>
      ) : snags.length === 0 ? (
        <EmptyState
          title="No snag items found"
          description="Record defects, finishing issues, honeycombing, or plumbing snags for sub-contractor action using the button above."
        />
      ) : (
        <View className={isDesktop || isTablet ? 'grid grid-cols-2 lg:grid-cols-3 gap-3' : 'gap-2.5'}>
          {snags.map((snag: SnagItem) => {
            const hasPhotos = Array.isArray(snag.photos) && snag.photos.length > 0;
            return (
              <Card key={snag.id} className="p-3.5">
                <View className="flex-row justify-between items-start mb-1.5">
                  <View className="flex-1 pr-2">
                    <View className="flex-row items-center gap-1.5 mb-1 flex-wrap">
                      <Badge
                        label={snag.priority}
                        color={snag.priority === 'CRITICAL' || snag.priority === 'HIGH' ? 'danger' : 'warning'}
                      />
                      <Badge
                        label={snag.status.replace(/_/g, ' ')}
                        color={snag.status === 'CLOSED' ? 'success' : snag.status === 'READY_FOR_REVIEW' ? 'warning' : 'neutral'}
                      />
                      {snag.location ? (
                        <Text className="text-[11px] text-muted font-medium">📍 {snag.location}</Text>
                      ) : null}
                    </View>
                    <Text className="text-sm md:text-base font-semibold text-text">{snag.title}</Text>
                    {snag.description ? (
                      <Text className="text-xs text-muted mt-0.5" numberOfLines={2}>{snag.description}</Text>
                    ) : null}
                  </View>
                </View>

                {/* Photo thumbnails */}
                {hasPhotos ? (
                  <View className="flex-row gap-1.5 my-1.5">
                    {snag.photos.slice(0, 3).map((url: string, idx: number) => (
                      <Pressable
                        key={idx}
                        onPress={() => setPhotoViewerUrls(snag.photos)}
                        className="w-14 h-14 rounded-lg overflow-hidden bg-black/5 border border-border"
                      >
                        <Image source={{ uri: url }} className="w-full h-full" resizeMode="cover" />
                      </Pressable>
                    ))}
                    {snag.photos.length > 3 ? (
                      <View className="w-14 h-14 rounded-lg bg-surface border border-border items-center justify-center">
                        <Text className="text-xs font-bold text-muted">+{snag.photos.length - 3}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {/* Footer and status action */}
                <View className="flex-row justify-between items-center mt-2.5 pt-2.5 border-t border-border">
                  <Text className="text-[11px] text-muted flex-1 mr-2" numberOfLines={1}>
                    Assigned: <Text className="font-semibold text-text">{snag.assignee?.name ?? 'Unassigned'}</Text> · {formatDate(snag.createdAt)}
                  </Text>
                  {renderStatusButton(snag)}
                </View>
              </Card>
            );
          })}
        </View>
      )}

      {/* Create Snag Modal */}
      <AdaptiveSheet
        visible={showCreateModal}
        onClose={closeCreateModal}
        title="Log Site Snag / Defect NCR"
        subtitle="Capture defect with priority & photo evidence"
        size="md"
        footer={
          <View className="flex-row gap-2">
            <Button label="Cancel" variant="ghost" className="flex-1" onPress={closeCreateModal} />
            <Button
              label="Submit Snag"
              className="flex-1"
              onPress={handleCreate}
              loading={createMut.isPending}
            />
          </View>
        }
      >
        <View className="gap-2.5">
          <Input
            label="Defect Title *"
            placeholder="e.g. Honeycombing in 2nd floor shear wall"
            value={title}
            onChangeText={setTitle}
          />
          <Input
            label="Location / Grid Ref"
            placeholder="e.g. Block-B, Grid C4-C5, Flat 302"
            value={location}
            onChangeText={setLocation}
          />
          <View>
            <Text className="text-xs font-semibold text-text mb-1">Severity Priority</Text>
            <View className="flex-row flex-wrap items-center gap-1.5">
              {PRIORITIES.map((p) => {
                const active = priority === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setPriority(p.id)}
                    className={`px-3 py-1.5 rounded-lg border ${
                      active ? 'bg-primary border-primary' : 'bg-surface border-border'
                    }`}
                  >
                    <Text className={`text-xs font-medium ${active ? 'text-white' : 'text-text'}`}>
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Input
            label="Description & Rectification Notes"
            placeholder="Method of rectification required..."
            value={description}
            onChangeText={setDescription}
            multiline
          />

          {/* Photo Attachment Section */}
          <View className="bg-surface p-3 rounded-xl border border-border">
            <Text className="text-xs font-semibold text-text mb-1.5">Evidence / Defect Photos</Text>
            {photos.length > 0 ? (
              <View className="flex-row flex-wrap gap-2 mb-2">
                {photos.map((p, i) => (
                  <View key={i} className="relative w-14 h-14 rounded-lg overflow-hidden border border-border">
                    <Image source={{ uri: p }} className="w-full h-full" resizeMode="cover" />
                    <Pressable
                      onPress={() => setPhotos((arr) => arr.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/70 items-center justify-center"
                    >
                      <Ionicons name="close" size={10} color="#fff" />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
            <View className="flex-row gap-2">
              <Button
                label="Snap Camera"
                size="sm"
                variant="secondary"
                icon={<Ionicons name="camera-outline" size={14} color="#1E3A5F" />}
                onPress={() => handlePickPhoto(true)}
                loading={uploading}
              />
              <Button
                label="Gallery"
                size="sm"
                variant="secondary"
                icon={<Ionicons name="image-outline" size={14} color="#1E3A5F" />}
                onPress={() => handlePickPhoto(false)}
                loading={uploading}
              />
            </View>
          </View>
        </View>
      </AdaptiveSheet>

      {/* Photo Viewer Modal */}
      <AdaptiveSheet
        visible={!!photoViewerUrls}
        onClose={() => setPhotoViewerUrls(null)}
        title="Evidence Photos"
        size="lg"
      >
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} className="h-64 md:h-80">
          {photoViewerUrls?.map((url, i) => (
            <View key={i} className="w-72 md:w-96 h-64 md:h-80 items-center justify-center bg-black/5 rounded-xl overflow-hidden mr-3">
              <Image source={{ uri: url }} className="w-full h-full" resizeMode="contain" />
            </View>
          ))}
        </ScrollView>
      </AdaptiveSheet>
    </View>
  );
}
