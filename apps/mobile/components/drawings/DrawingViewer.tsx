/**
 * BuildFlow - Drawing & Blueprint Plan Viewer with Interactive Pins (Module 4).
 *
 * Features:
 *  - Pan & Zoom canvas with double-tap and zoom controls
 *  - Revision switcher (Rev-C, Rev-B, Rev-A) with status badges
 *  - Interactive Pinning (tap plan to place/inspect defect pins)
 *  - Desktop split view (Canvas 70% <-> Linked Defects 30%)
 */
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  Dimensions,
  Platform,
  LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button, Badge, Input } from '@/components/ui';
import { AdaptiveSheet } from '@/components/layout/AdaptiveSheet';
import { useViewport } from '@/hooks/useViewport';
import { alertAsync } from '@/utils/confirm';
import type { Drawing, DrawingVersion } from '@/services/drawing.queries';

export interface DrawingPin {
  id: string;
  xPct: number; // 0 - 100
  yPct: number; // 0 - 100
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'RESOLVED' | 'CLOSED';
  assignee?: string;
  photoUrl?: string;
}

interface DrawingViewerProps {
  drawing: Drawing;
  onAddPin?: (pin: { xPct: number; yPct: number }) => void;
  onSelectPin?: (pin: DrawingPin) => void;
  onUpdatePin?: (pin: DrawingPin) => void;
  onDeletePin?: (pinId: string) => void;
  pins?: DrawingPin[];
  onUploadRevision?: () => void;
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
  const { isDesktop } = useViewport();
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

  const currentFileUrl = selectedVersion?.fileUrl || drawing.currentVersion?.fileUrl || null;
  const versions = drawing.versions ?? [];

  const handleCanvasLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setCanvasLayout({ width, height });
    }
  };

  const handleCanvasPress = (e: { nativeEvent: { locationX: number; locationY: number } }) => {
    if (!pinMode || !currentFileUrl) return;
    const { locationX, locationY } = e.nativeEvent;
    const w = canvasLayout.width || 600;
    const h = canvasLayout.height || 320;
    const xPct = Math.min(96, Math.max(4, (locationX / w) * 100));
    const yPct = Math.min(96, Math.max(4, (locationY / h) * 100));
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
    <View className="flex-row items-center gap-1.5 bg-black/60 rounded-xl px-2 py-1 absolute bottom-4 right-4 z-20">
      <Pressable
        onPress={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
        className="w-8 h-8 rounded-lg items-center justify-center bg-white/10 active:bg-white/20"
      >
        <Ionicons name="add" size={18} color="#FFFFFF" />
      </Pressable>
      <Pressable
        onPress={() => setZoomLevel(1)}
        className="px-2 h-8 rounded-lg items-center justify-center bg-white/10 active:bg-white/20"
      >
        <Text className="text-white text-xs font-semibold">{Math.round(zoomLevel * 100)}%</Text>
      </Pressable>
      <Pressable
        onPress={() => setZoomLevel((z) => Math.max(0.75, z - 0.25))}
        className="w-8 h-8 rounded-lg items-center justify-center bg-white/10 active:bg-white/20"
      >
        <Ionicons name="remove" size={18} color="#FFFFFF" />
      </Pressable>
    </View>
  );

  const topBar = (
    <View className="flex-row flex-wrap items-center justify-between gap-3 bg-surface p-3 rounded-xl border border-border mb-3">
      <View className="flex-row items-center gap-2 flex-1 min-w-0">
        <View className="w-8 h-8 rounded-lg bg-primary/10 items-center justify-center">
          <Ionicons name="map-outline" size={18} color="#1E3A5F" />
        </View>
        <View className="flex-1 min-w-0">
          <Text className="text-sm font-bold text-text truncate" numberOfLines={1}>
            {drawing.drawingNo} · {drawing.title}
          </Text>
          <Text className="text-[11px] text-muted">{drawing.discipline} · {drawing.category ?? 'General'}</Text>
        </View>
      </View>

      {/* Revision pill selector */}
      <View className="flex-row items-center gap-2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-1.5">
            {versions.length > 0 ? (
              versions.map((v) => {
                const isCurrent = (selectedVersion?.id ?? drawing.currentVersionId) === v.id;
                return (
                  <Pressable
                    key={v.id}
                    onPress={() => setSelectedVersion(v)}
                    className={`px-2.5 py-1 rounded-md border flex-row items-center gap-1 ${
                      isCurrent ? 'bg-primary border-primary' : 'bg-card border-border'
                    }`}
                  >
                    <Text
                      className={`text-[11px] font-bold ${
                        isCurrent ? 'text-white' : 'text-text'
                      }`}
                    >
                      {v.versionLabel}
                    </Text>
                    {isCurrent ? (
                      <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                    ) : null}
                  </Pressable>
                );
              })
            ) : (
              <Badge label="Rev-01 (Current)" color="success" />
            )}
          </View>
        </ScrollView>

        <Button
          label={!currentFileUrl ? 'Upload Plan to Pin' : pinMode ? 'Tap plan to drop' : '+ Drop Pin'}
          size="sm"
          variant={pinMode ? 'primary' : 'secondary'}
          disabled={!currentFileUrl}
          icon={<Ionicons name="pin" size={14} color={!currentFileUrl ? '#94A3B8' : pinMode ? '#fff' : '#1E3A5F'} />}
          onPress={() => {
            if (!currentFileUrl) {
              void alertAsync('No Drawing Sheet', 'Please upload a blueprint or drawing sheet first before placing defect pins.');
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
      className="relative rounded-2xl overflow-hidden bg-slate-900 border border-border min-h-[260px] md:min-h-[360px] items-center justify-center"
    >
      <Pressable
        onPress={handleCanvasPress}
        className="w-full h-full min-h-[260px] md:min-h-[360px] items-center justify-center relative overflow-hidden"
      >
        <View style={{ transform: [{ scale: zoomLevel }] }} className="w-full h-full min-h-[260px] md:min-h-[360px] items-center justify-center">
          {currentFileUrl ? (
            <Image
              source={{ uri: currentFileUrl }}
              className="w-full h-64 md:h-80 rounded-xl"
              resizeMode="contain"
            />
          ) : (
            <View className="w-full h-64 md:h-80 items-center justify-center px-4">
              <Ionicons name="document-text-outline" size={48} color="#94A3B8" />
              <Text className="text-sm font-semibold text-slate-300 mt-2 text-center">
                No plan drawing uploaded yet
              </Text>
              <Text className="text-xs text-slate-400 mt-0.5 text-center">
                Upload a revision sheet to view blueprint background
              </Text>
            </View>
          )}

          {/* Interactive Pins Overlay */}
          {pins.map((pin) => {
            const isSelected = activePin?.id === pin.id;
            const pinColor =
              pin.severity === 'CRITICAL' ? '#EF4444' : pin.severity === 'HIGH' ? '#F59E0B' : '#3B82F6';

            return (
              <Pressable
                key={pin.id}
                onPress={() => {
                  setActivePin(pin);
                  if (onSelectPin) onSelectPin(pin);
                }}
                style={{
                  position: 'absolute',
                  left: `${pin.xPct}%`,
                  top: `${pin.yPct}%`,
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
                      color={p.severity === 'CRITICAL' ? 'danger' : p.severity === 'HIGH' ? 'warning' : 'neutral'}
                    />
                  </View>
                  <Text className="text-[11px] text-muted mt-1">
                    Status: <Text className="font-semibold text-text">{p.status}</Text> · {p.assignee ?? 'Unassigned'}
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
            Position: {Math.round(activePin.xPct)}% X, {Math.round(activePin.yPct)}% Y · Severity: {activePin.severity}
          </Text>
        </View>
      ) : null}
    </Card>
  );

  return (
    <View className="gap-3">
      {topBar}
      {isDesktop ? (
        <View className="flex-row gap-4 items-start">
          <View className="flex-[2.5]">{canvasView}</View>
          <View className="flex-1">{pinsSidebar}</View>
        </View>
      ) : (
        <View className="gap-3">
          {canvasView}
          {pinsSidebar}
        </View>
      )}

      {/* Edit Pin Modal */}
      <AdaptiveSheet
        visible={!!editingPin}
        onClose={() => setEditingPin(null)}
        title="Edit Defect Pin"
        subtitle={editingPin ? `Position (${Math.round(editingPin.xPct)}%, ${Math.round(editingPin.yPct)}%)` : ''}
        footer={
          <View className="flex-row gap-3">
            <Button
              label="Cancel"
              variant="secondary"
              className="flex-1"
              onPress={() => setEditingPin(null)}
            />
            <Button
              label="Save Pin"
              className="flex-1"
              onPress={savePinEdit}
            />
          </View>
        }
      >
        <View className="gap-3.5">
          <Input
            label="Pin Title / Observation"
            value={editTitle}
            onChangeText={setEditTitle}
            placeholder="e.g. Honeycombing on column C2"
          />

          <View className="gap-1.5">
            <Text className="text-xs font-semibold text-text">Severity</Text>
            <View className="flex-row gap-2">
              {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((sev) => (
                <Pressable
                  key={sev}
                  onPress={() => setEditSeverity(sev)}
                  className={`flex-1 py-2 rounded-lg border items-center ${
                    editSeverity === sev ? 'bg-primary border-primary' : 'bg-surface border-border'
                  }`}
                >
                  <Text className={`text-xs font-semibold ${editSeverity === sev ? 'text-white' : 'text-text'}`}>
                    {sev}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="gap-1.5">
            <Text className="text-xs font-semibold text-text">Status</Text>
            <View className="flex-row gap-2">
              {(['OPEN', 'RESOLVED', 'CLOSED'] as const).map((st) => (
                <Pressable
                  key={st}
                  onPress={() => setEditStatus(st)}
                  className={`flex-1 py-2 rounded-lg border items-center ${
                    editStatus === st ? 'bg-primary border-primary' : 'bg-surface border-border'
                  }`}
                >
                  <Text className={`text-xs font-semibold ${editStatus === st ? 'text-white' : 'text-text'}`}>
                    {st}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Input
            label="Assignee (Contractor / Engineer)"
            value={editAssignee}
            onChangeText={setEditAssignee}
            placeholder="e.g. Rajesh (Civil Contractor)"
          />
        </View>
      </AdaptiveSheet>
    </View>
  );
}
