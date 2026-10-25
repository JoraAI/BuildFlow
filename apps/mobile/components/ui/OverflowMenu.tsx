/**
 * Single overflow (⋯) control that lists actions without crowding a row.
 * Phone: bottom sheet. Tablet/desktop: anchored popover so it stays on-screen.
 */
import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useViewport } from '@/hooks/useViewport';

export type OverflowMenuItem = {
  key: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  tone?: 'default' | 'accent' | 'danger';
  hidden?: boolean;
};

type Anchor = { x: number; y: number; w: number; h: number };

const MENU_WIDTH = 260;
const NAVY = '#1E3A5F';
const DANGER = '#DC2626';
const ACCENT = '#D97706';

function visibleItems(items: OverflowMenuItem[]): OverflowMenuItem[] {
  return items.filter((item) => !item.hidden);
}

function itemColor(tone: OverflowMenuItem['tone']): string {
  if (tone === 'danger') return DANGER;
  if (tone === 'accent') return ACCENT;
  return NAVY;
}

export function OverflowMenu({
  items,
  title = 'Actions',
  accessibilityLabel = 'More actions',
  align = 'right',
  trigger = 'ghost',
}: {
  items: OverflowMenuItem[];
  title?: string;
  accessibilityLabel?: string;
  align?: 'left' | 'right';
  trigger?: 'ghost' | 'outline';
}) {
  const { isPhone } = useViewport();
  const { width: winW, height: winH } = useWindowDimensions();
  const triggerRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const rows = useMemo(() => visibleItems(items), [items]);
  if (rows.length === 0) return null;

  const openMenu = () => {
    triggerRef.current?.measureInWindow((x, y, w, h) => {
      setAnchor({ x, y, w, h });
      setOpen(true);
    });
  };

  const close = () => setOpen(false);

  const run = (item: OverflowMenuItem) => {
    close();
    item.onPress();
  };

  const popoverStyle = (() => {
    const fallback = { top: 24, left: Math.max(12, winW - MENU_WIDTH - 12) };
    if (!anchor) return fallback;
    const menuH = Math.min(rows.length * 48 + 56, Math.max(180, winH * 0.55));
    let left = align === 'right' ? anchor.x + anchor.w - MENU_WIDTH : anchor.x;
    left = Math.min(Math.max(12, left), Math.max(12, winW - MENU_WIDTH - 12));
    const below = anchor.y + anchor.h + 8;
    const above = anchor.y - menuH - 8;
    const top = below + menuH <= winH - 12 ? below : Math.max(12, above);
    return { top, left };
  })();

  return (
    <View ref={triggerRef} collapsable={false}>
      <Pressable
        onPress={openMenu}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        className={`w-10 h-10 rounded-full items-center justify-center ${
          trigger === 'outline' ? 'bg-card border border-border' : 'bg-transparent'
        } ${Platform.OS === 'web' ? 'hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary/40' : 'active:bg-primary/10'}`}
      >
        <Ionicons name="ellipsis-vertical" size={20} color={NAVY} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType={isPhone ? 'slide' : 'fade'}
        onRequestClose={close}
      >
        <Pressable className="flex-1 bg-black/40" onPress={close}>
          {isPhone ? (
            <Pressable
              onPress={(e) => e.stopPropagation()}
              className="absolute left-0 right-0 bottom-0 bg-card rounded-t-2xl border-t border-border"
            >
              <View className="items-center pt-2 pb-1">
                <View className="w-10 h-1 rounded-full bg-border" />
              </View>
              <Text className="px-5 pt-1 pb-2 text-sm font-bold text-text">{title}</Text>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 20 }}
              >
                {rows.map((item) => (
                  <MenuRow key={item.key} item={item} onPress={() => run(item)} />
                ))}
                <Pressable
                  onPress={close}
                  className="mx-2 mt-1 mb-2 rounded-xl bg-surface border border-border py-3 items-center active:opacity-80"
                >
                  <Text className="text-sm font-semibold text-muted">Cancel</Text>
                </Pressable>
              </ScrollView>
            </Pressable>
          ) : (
            <Pressable
              onPress={(e) => e.stopPropagation()}
              className="absolute bg-card rounded-2xl border border-border shadow-lg overflow-hidden"
              style={{
                width: MENU_WIDTH,
                maxHeight: Math.min(rows.length * 48 + 56, winH * 0.6),
                ...popoverStyle,
              }}
            >
              <Text className="px-4 pt-3 pb-2 text-[11px] font-bold uppercase tracking-wide text-muted">
                {title}
              </Text>
              <ScrollView keyboardShouldPersistTaps="handled">
                {rows.map((item) => (
                  <MenuRow key={item.key} item={item} onPress={() => run(item)} />
                ))}
              </ScrollView>
            </Pressable>
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

function MenuRow({ item, onPress }: { item: OverflowMenuItem; onPress: () => void }) {
  const color = itemColor(item.tone);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      className={`mx-1 mb-0.5 flex-row items-center gap-3 rounded-xl px-3 py-3 ${
        Platform.OS === 'web' ? 'hover:bg-primary/10' : 'active:bg-primary/10'
      }`}
    >
      <View
        className="w-9 h-9 rounded-full items-center justify-center"
        style={{ backgroundColor: `${color}14` }}
      >
        <Ionicons name={item.icon ?? 'ellipse-outline'} size={18} color={color} />
      </View>
      <Text
        className="flex-1 text-sm font-semibold"
        style={{ color }}
        numberOfLines={1}
      >
        {item.label}
      </Text>
    </Pressable>
  );
}
