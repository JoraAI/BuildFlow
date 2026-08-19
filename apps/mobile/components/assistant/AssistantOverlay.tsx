import React, { useEffect, useMemo, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAssistantStore } from '@/stores/assistant.store';
import { useAuthStore } from '@/stores/auth.store';
import { useClearChatHistory } from '@/services/chat.queries';
import { useViewport } from '@/hooks/useViewport';
import { AssistantChatContent } from '@/components/assistant/AssistantChatContent';

export function AssistantOverlay() {
  const isOpen = useAssistantStore((s) => s.isOpen);
  const projectId = useAssistantStore((s) => s.projectId);
  const close = useAssistantStore((s) => s.close);
  const restartConversation = useAssistantStore((s) => s.restartConversation);
  const productMode = useAuthStore((s) => s.user?.productMode);
  const isInventory = productMode === 'inventory';
  const clearHistory = useClearChatHistory(projectId);
  const { isDesktop } = useViewport();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelWidth = useMemo(
    () => Math.min(isDesktop ? 420 : Math.round(width * 0.92), width),
    [isDesktop, width],
  );
  const slideX = useRef(new Animated.Value(420)).current;

  useEffect(() => {
    if (isOpen) {
      slideX.setValue(panelWidth);
      Animated.timing(slideX, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }).start();
    } else {
      slideX.setValue(panelWidth);
    }
  }, [isOpen, panelWidth, slideX]);

  const handleNewChat = () => {
    if (clearHistory.isPending) return;
    clearHistory.mutate(undefined, {
      onSuccess: () => restartConversation(),
    });
  };

  const handleClose = () => {
    Animated.timing(slideX, {
      toValue: panelWidth,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) close();
    });
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close assistant"
        />

        <Animated.View
          style={[
            styles.panel,
            {
              width: panelWidth,
              paddingTop: Math.max(insets.top, 8),
              paddingBottom: insets.bottom,
              transform: [{ translateX: slideX }],
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="chatbubble-ellipses" size={20} color="#1E3A5F" />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>BuildFlow Assistant</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {isInventory
                  ? 'Stock, POs, GRNs, invoices & GST'
                  : 'Projects, bills, estimates & GST'}
              </Text>
            </View>
            <Pressable
              onPress={handleNewChat}
              disabled={clearHistory.isPending}
              accessibilityRole="button"
              accessibilityLabel="New chat"
              hitSlop={8}
              style={styles.headerBtn}
            >
              <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
            </Pressable>
            <Pressable
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Close assistant"
              hitSlop={8}
              style={styles.headerBtn}
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </Pressable>
          </View>

          <View style={styles.body}>
            <AssistantChatContent projectId={projectId} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F1F5F9',
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '-16px 0 40px rgba(15, 23, 42, 0.22)',
      },
      default: {
        elevation: 20,
        shadowColor: '#0F172A',
        shadowOffset: { width: -8, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#1E3A5F',
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  body: {
    flex: 1,
  },
});
