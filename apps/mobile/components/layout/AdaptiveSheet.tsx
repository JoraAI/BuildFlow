import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useViewport } from '@/hooks/useViewport';

type SheetSize = 'sm' | 'md' | 'lg' | 'full';

const SIZE_CLASS: Record<SheetSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.6.1): viewport-filling workspace
  // for multi-line operational modals (checkout, bulk issue, PO/GRN, ...).
  full: 'w-full h-full',
};

interface AdaptiveSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  size?: SheetSize;
  /** Allow tapping backdrop to close (default true). */
  dismissOnBackdrop?: boolean;
  footer?: React.ReactNode;
  /** Wrap body in ScrollView (default true). */
  scrollable?: boolean;
}

function SheetHeader({ title, subtitle }: { title?: string; subtitle?: string }) {
  if (!title) return null;
  return (
    <View>
      <Text className="text-lg font-bold text-text">{title}</Text>
      {subtitle ? (
        <Text className="text-sm text-text-muted mt-0.5">{subtitle}</Text>
      ) : null}
    </View>
  );
}

/**
 * Mobile: bottom sheet (slide up). Desktop: centered dialog (fade in).
 */
export function AdaptiveSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  size = 'md',
  dismissOnBackdrop = true,
  footer,
  scrollable = true,
}: AdaptiveSheetProps) {
  // FIX (UI-M8): Use dialog presentation from tablet width up (≥768px), not
  // just desktop (≥1024px). Previously a native iPad at 768-1023px would show
  // a bottom sheet instead of a centered dialog - feeling like a phone app.
  const { isPhone } = useViewport();
  const useDialog = !isPhone; // tablet + desktop
  const bodyScrollable = scrollable || !!footer;
  const isFull = size === 'full';

  return (
    <Modal
      visible={visible}
      transparent
      animationType={useDialog ? 'fade' : 'slide'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <View
          className={`flex-1 bg-black/40 ${
            useDialog
              ? `justify-center items-center ${isFull ? '' : 'px-6'}`
              : 'justify-end'
          }`}
        >
          {dismissOnBackdrop ? (
            <Pressable
              className="absolute inset-0"
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
            />
          ) : null}

          <View
            className={`bg-card w-full ${SIZE_CLASS[size]} ${
              isFull
                ? useDialog
                  ? 'rounded-none'
                  : 'rounded-t-2xl'
                : useDialog
                  ? 'rounded-2xl shadow-elevated'
                  : 'rounded-t-2xl'
            } ${isFull ? '' : 'max-h-[90%]'}`}
          >
            {bodyScrollable ? (
              <ScrollView
                contentContainerClassName="p-4 gap-3"
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
              >
                <SheetHeader title={title} subtitle={subtitle} />
                {children}
              </ScrollView>
            ) : (
              <View className="p-4 gap-3">
                <SheetHeader title={title} subtitle={subtitle} />
                {children}
              </View>
            )}
            {footer ? (
              <View className="px-4 pb-4 pt-2 border-t border-border">{footer}</View>
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
