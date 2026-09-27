/**
 * BuildFlow - Drawing & Blueprint Plan Viewer with Interactive Pins (Module 4).
 *
 * Pin % coords are relative to the *displayed image* (letterboxed contain),
 * not the full canvas chrome — so placement survives aspect-ratio letterboxing.
 * Zoom is applied around the image box; presses are mapped in image space.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  LayoutChangeEvent,
  ImageLoadEventData,
  NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button, Badge, Input } from '@/components/ui';
import { AdaptiveSheet } from '@/components/layout/AdaptiveSheet';
import { useViewport } from '@/hooks/useViewport';
import { alertAsync } from '@/utils/confirm';
import type { Drawing, DrawingPin, DrawingVersion } from '@/services/drawing.queries';

export type { DrawingPin };

interface DrawingViewerProps {
  drawing: Drawing;
  onAddPin?: (pin: { xPct: number; yPct: number }) => void;
  onSelectPin?: (pin: DrawingPin) => void;
  onUpdatePin?: (pin: DrawingPin) => void;
  onDeletePin?: (pinId: string) => void;
  pins?: DrawingPin[];
  onUploadRevision?: () => void;
}

/** Contained (letterboxed) image rect inside a canvas box. */
function containRect(
  boxW: number,
  boxH: number,
  naturalW: number,
  naturalH: number,
): { x: number; y: number; w: number; h: number } {
  if (boxW <= 0 || boxH <= 0 || naturalW <= 0 || naturalH <= 0) {
    return { x: 0, y: 0, w: boxW, h: boxH };
  }
  const scale = Math.min(boxW / naturalW, boxH / naturalH);
  const w = naturalW * scale;
  const h = naturalH * scale;
  return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h };
}

export function DrawingViewer({
  drawing,
  onAddPin,
  onSelectPin,
  onUpdatePin,
  onDeletePin,
  pins = [],
  onUploadRevision,
}: DrawingViewerProps) {
  const { isDesktop, isTablet } = useViewport();
  const wide = isDesktop || isTablet;
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedVersion, setSelectedVersion] = useState<DrawingVersion | null>(
    drawing.currentVersion ?? null,
  );
  const [activePin, setActivePin] = useState<DrawingPin | null>(null);
  const [pinMode, setPinMode] = useState(false);
  const [editingPin, setEditingPin] = useState<DrawingPin | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSeverity, setEditSeverity] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  const [editStatus, setEditStatus] = useState<'OPEN' | 'RESOLVED' | 'CLOSED'>('OPEN');
  const [editAssignee, setEditAssignee] = useState('');
  const [canvasLayout, setCanvasLayout] = useState<{ width: number; height: number }>({
    width: 600,
    height: 320,
  });
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);

  const currentFileUrl = selectedVersion?.fileUrl || drawing.currentVersion?.fileUrl || null;
  const versions = drawing.versions ?? [];

  useEffect(() => {
    if (drawing.currentVersion) {
      setSelectedVersion(drawing.currentVersion);
    } else if (drawing.versions?.length) {
      setSelectedVersion(drawing.versions[0] ?? null);
    }
  }, [drawing.id, drawing.currentVersionId, drawing.currentVersion?.id]);

  useEffect(() => {
    setNaturalSize(null);
    if (!currentFileUrl) return;
    Image.getSize(
      currentFileUrl,
      (width, height) => {
        if (width > 0 && height > 0) setNaturalSize({ width, height });
      },
      () => {
        /* onLoad may still set size */
      },
    );
  }, [currentFileUrl]);

  const imageRect = useMemo(
    () =>
      containRect(
        canvasLayout.width,
        canvasLayout.height,
        naturalSize?.width ?? canvasLayout.width,
        naturalSize?.height ?? canvasLayout.height,
      ),
    [canvasLayout, naturalSize],
  );

  const handleCanvasLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setCanvasLayout({ width, height });
    }
  };

  const handleImageLoad = (e: NativeSyntheticEvent<ImageLoadEventData>) => {
    const src = e.nativeEvent.source;
    if (src?.width && src?.height) {
      setNaturalSize({ width: src.width, height: src.height });
    }
  };

  const handleCanvasPress = (e: { nativeEvent: { locationX: number; locationY: number } }) => {
    if (!pinMode || !currentFileUrl) return;
    const { locationX, locationY } = e.nativeEvent;
    // Presses are on the unscaled Pressable; visual content is zoomed — un-zoom first.
    const x = locationX / zoomLevel;
    const y = locationY / zoomLevel;
    const { x: ox, y: oy, w, h } = imageRect;
    if (w <= 0 || h <= 0) return;
    if (x < ox || x > ox + w || y < oy || y > oy + h) {
      void alertAsync('Outside plan', 'Tap on the drawing sheet area to drop a pin.');
      return;
    }
    const xPct = Math.min(99, Math.max(1, ((x - ox) / w) * 100));
    const yPct = Math.min(99, Math.max(1, ((y - oy) / h) * 100));
    setPinMode(false);
    if (onAddPin) {
      onAddPin({ xPct, yPct });
    }
  };

  const openEditModal = (pin: DrawingPin) => {
    setEditingPin(pin);
    setEditTitle(pin.title);
    setEditSeverity(pin.severity);
    setEditStatus(pin.status);
    setEditAssignee(pin.assignee ?? '');
  };

  const savePinEdit = () => {
    if (!editingPin || !onUpdatePin) return;
    const updated: DrawingPin = {
      ...editingPin,
      title: editTitle.trim() || editingPin.title,
      severity: editSeverity,
      status: editStatus,
      assignee: editAssignee.trim() || undefined,
    };
    onUpdatePin(updated);
    if (activePin?.id === editingPin.id) {
      setActivePin(updated);
    }
    setEditingPin(null);
  };

  const canvasControls = (
    <View className="absolute bottom-3 left-3 right-3 flex-row justify-between items-center z-20">
      <View className="flex-row gap-1.5 bg-black/50 rounded-lg p-1">
        <Pressable
          onPress={() => setZoomLevel((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))}
          className="w-8 h-8 items-center justify-center rounded bg-white/10"
        >
          <Ionicons name="remove" size={16} color="#fff" />
        </Pressable>
        <Text className="text-xs text-white self-center px-1">{Math.round(zoomLevel * 100)}%</Text>
        <Pressable
          onPress={() => setZoomLevel((z) => Math.min(3, Math.round((z + 0.25) * 100) / 100))}
          className="w-8 h-8 items-center justify-center rounded bg-white/10"
        >
          <Ionicons name="add" size={16} color="#fff" />
        </Pressable>
      </View>
      <View className="flex-row gap-2">
        {onUploadRevision ? (
          <Button label="Upload Rev" size="sm" variant="secondary" onPress={onUploadRevision} />
        ) : null}
        <Button
          label={!currentFileUrl ? 'Upload Plan to Pin' : pinMode ? 'Tap plan to drop' : '+ Drop Pin'}
          size="sm"
          variant={pinMode ? 'primary' : 'secondary'}
          icon={
            <Ionicons
              name="pin"
              size={14}
              color={!currentFileUrl ? '#94A3B8' : pinMode ? '#fff' : '#1E3A5F'}
            />
          }
          onPress={() => {
            if (!currentFileUrl) {
              void alertAsync(
                'No Drawing Sheet',
                'Please upload a blueprint or drawing sheet first before placing defect pins.',
              );
              return;
            }
            setPinMode(!pinMode);
          }}
        />
      </View>
    </View>
  );

  const canvasView = (
    <View
      onLayout={handleCanvasLayout}
      className="relative rounded-2xl overflow-hidden bg-slate-900 border border-border min-h-[260px] md:min-h-[360px] h-64 md:h-80"
    >
      <Pressable
        onPress={handleCanvasPress}
        className="w-full h-full min-h-[260px] md:min-h-[360px] relative overflow-hidden"
        style={{ width: '100%', height: '100%' }}
      >
        <View
          style={{
            transform: [{ scale: zoomLevel }],
            transformOrigin: 'top left' as never,
            width: canvasLayout.width || '100%',
            height: canvasLayout.height || 320,
          }}
          className="relative"
        >
          {currentFileUrl ? (
            <Image
              source={{ uri: currentFileUrl }}
              onLoad={handleImageLoad}
              style={{
                position: 'absolute',
                left: imageRect.x,
                top: imageRect.y,
                width: imageRect.w,
                height: imageRect.h,
              }}
              resizeMode="stretch"
            />
          ) : (
            <View className="w-full h-full items-center justify-center px-4">
              <Ionicons name="document-text-outline" size={48} color="#94A3B8" />
              <Text className="text-sm font-semibold text-slate-300 mt-2 text-center">
                No plan drawing uploaded yet
              </Text>
              <Text className="text-xs text-slate-400 mt-0.5 text-center">
                Upload a revision sheet to view blueprint background
              </Text>
            </View>
          )}

          {pins.map((pin) => {
            const isSelected = activePin?.id === pin.id;
            const pinColor =
              pin.severity === 'CRITICAL' ? '#EF4444' : pin.severity === 'HIGH' ? '#F59E0B' : '#3B82F6';
            const left = imageRect.x + (pin.xPct / 100) * imageRect.w;
            const top = imageRect.y + (pin.yPct / 100) * imageRect.h;

            return (
              <Pressable
                key={pin.id}
                onPress={() => {
                  setActivePin(pin);
                  if (onSelectPin) onSelectPin(pin);
                }}
                style={{
                  position: 'absolute',
                  left,
                  top,
                  transform: [{ translateX: -12 }, { translateY: -24 }],
                }}
                className="z-10 items-center"
              >
                <View
                  style={{ backgroundColor: pinColor }}
                  className={`w-7 h-7 rounded-full items-center justify-center shadow-lg border-2 border-white ${
                    isSelected ? 'scale-125' : ''
                  }`}
                >
                  <Ionicons name="alert" size={14} color="#FFFFFF" />
                </View>
              </Pressable>
            );
          })}
        </View>
      </Pressable>

      {canvasControls}

      {versions.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="absolute top-3 left-3 right-3 z-20"
          contentContainerClassName="flex-row gap-1.5"
        >
          {versions.map((v) => {
            const isCurrent = (selectedVersion?.id ?? drawing.currentVersionId) === v.id;
            return (
              <Pressable
                key={v.id}
                onPress={() => setSelectedVersion(v)}
                className={`px-2.5 py-1 rounded-full border ${
                  isCurrent ? 'bg-primary border-primary' : 'bg-black/50 border-white/20'
                }`}
              >
                <Text className={`text-[11px] font-semibold ${isCurrent ? 'text-white' : 'text-slate-200'}`}>
                  {v.versionLabel}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );

  const pinsSidebar = (
    <Card className="flex-1 min-w-[280px]">
      <View className="flex-row items-center justify-between mb-3 pb-2 border-b border-border">
        <Text className="text-sm font-bold text-text">
          Linked Defect Pins ({pins.length})
        </Text>
        <Badge label={`${pins.filter((p) => p.status === 'OPEN').length} Open`} color="warning" />
      </View>

      <ScrollView className="max-h-[380px]" showsVerticalScrollIndicator={false}>
        <View className="gap-2">
          {pins.length === 0 ? (
            <Text className="text-xs text-muted text-center py-6">
              No pins dropped on this sheet yet. Click "+ Drop Pin" above.
            </Text>
          ) : (
            pins.map((p) => {
              const isSelected = activePin?.id === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setActivePin(p)}
                  className={`p-2.5 rounded-xl border ${
                    isSelected ? 'bg-primary/5 border-primary' : 'bg-surface border-border'
                  }`}
                >
                  <View className="flex-row justify-between items-start">
                    <Text className="text-xs font-bold text-text flex-1 mr-2" numberOfLines={1}>
                      {p.title}
                    </Text>
                    <Badge
                      label={p.severity}
                      color={
                        p.severity === 'CRITICAL' ? 'danger' : p.severity === 'HIGH' ? 'warning' : 'neutral'
                      }
                    />
                  </View>
                  <Text className="text-[11px] text-muted mt-1">
                    Status: <Text className="font-semibold text-text">{p.status}</Text> ·{' '}
                    {p.assignee ?? 'Unassigned'}
                  </Text>
                  <View className="flex-row items-center justify-end gap-2 mt-2 pt-1.5 border-t border-border/50">
                    <Pressable
                      onPress={() => openEditModal(p)}
                      className="flex-row items-center gap-1 px-2 py-1 bg-surface border border-border rounded"
                    >
                      <Ionicons name="create-outline" size={12} color="#1E3A5F" />
                      <Text className="text-[10px] font-semibold text-primary">Edit</Text>
                    </Pressable>
                    {onDeletePin ? (
                      <Pressable
                        onPress={() => onDeletePin(p.id)}
                        className="flex-row items-center gap-1 px-2 py-1 bg-rose-500/10 border border-rose-500/20 rounded"
                      >
                        <Ionicons name="trash-outline" size={12} color="#EF4444" />
                        <Text className="text-[10px] font-semibold text-rose-600">Delete</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>

      {activePin ? (
        <View className="mt-3 p-3 bg-primary/10 rounded-xl border border-primary/20">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-bold text-primary flex-1 mr-2" numberOfLines={1}>
              {activePin.title}
            </Text>
            <Pressable onPress={() => openEditModal(activePin)}>
              <Text className="text-[11px] font-bold text-primary underline">Edit Details</Text>
            </Pressable>
          </View>
          <Text className="text-[11px] text-text mt-1">
            Position: {Math.round(activePin.xPct)}% X, {Math.round(activePin.yPct)}% Y · Severity:{' '}
            {activePin.severity}
          </Text>
        </View>
      ) : null}
    </Card>
  );

  return (
    <View className="gap-3">
      {wide ? (
        <View className="flex-row gap-3 items-stretch">
          <View className="flex-[7]">{canvasView}</View>
          <View className="flex-[3]">{pinsSidebar}</View>
        </View>
      ) : (
        <View className="gap-3">
          {canvasView}
          {pinsSidebar}
        </View>
      )}

      <AdaptiveSheet
        visible={!!editingPin}
        onClose={() => setEditingPin(null)}
        title="Edit Pin"
        subtitle={
          editingPin
            ? `Position (${Math.round(editingPin.xPct)}%, ${Math.round(editingPin.yPct)}%)`
            : ''
        }
        footer={
          <View className="flex-row gap-2">
            <Button label="Cancel" variant="secondary" className="flex-1" onPress={() => setEditingPin(null)} />
            <Button label="Save" className="flex-1" onPress={savePinEdit} />
          </View>
        }
      >
        <View className="gap-3">
          <Input label="Title" value={editTitle} onChangeText={setEditTitle} />
          <Input label="Assignee" value={editAssignee} onChangeText={setEditAssignee} />
          <View className="flex-row flex-wrap gap-2">
            {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((s) => (
              <Pressable
                key={s}
                onPress={() => setEditSeverity(s)}
                className={`px-3 py-1.5 rounded-lg border ${
                  editSeverity === s ? 'bg-primary border-primary' : 'bg-card border-border'
                }`}
              >
                <Text className={`text-xs font-medium ${editSeverity === s ? 'text-white' : 'text-muted'}`}>
                  {s}
                </Text>
              </Pressable>
            ))}
          </View>
          <View className="flex-row flex-wrap gap-2">
            {(['OPEN', 'RESOLVED', 'CLOSED'] as const).map((s) => (
              <Pressable
                key={s}
                onPress={() => setEditStatus(s)}
                className={`px-3 py-1.5 rounded-lg border ${
                  editStatus === s ? 'bg-primary border-primary' : 'bg-card border-border'
                }`}
              >
                <Text className={`text-xs font-medium ${editStatus === s ? 'text-white' : 'text-muted'}`}>
                  {s}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </AdaptiveSheet>
    </View>
  );
}
