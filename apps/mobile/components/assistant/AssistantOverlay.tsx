import React, { useEffect, useRef } from 'react';
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
import { NavBackButton, NavIconButton } from '@/components/layout/NavBackButton';
import { useAssistantStore } from '@/stores/assistant.store';
import { useAuthStore } from '@/stores/auth.store';
import { useClearChatHistory } from '@/services/chat.queries';
import { useViewport } from '@/hooks/useViewport';
import { AssistantChatContent } from '@/components/assistant/AssistantChatContent';
import { desktopAssistantPanelStyle } from '@/components/layout/fab-layout';

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
  const slideX = useRef(new Animated.Value(width)).current;

  useEffect(() => {
    if (isDesktop) return;
    if (isOpen) {
      slideX.setValue(width);
      Animated.timing(slideX, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }).start();
    } else {
      slideX.setValue(width);
    }
  }, [isOpen, isDesktop, width, slideX]);

  const handleNewChat = () => {
    if (clearHistory.isPending) return;
    clearHistory.mutate(undefined, {
      onSuccess: () => restartConversation(),
    });
  };

  const handleClose = () => {
    if (isDesktop) {
      close();
      return;
    }
    Animated.timing(slideX, {
      toValue: width,
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
      animationType={isDesktop ? 'fade' : 'none'}
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
            isDesktop ? styles.desktopPanel : styles.mobilePanel,
            isDesktop
              ? desktopAssistantPanelStyle()
              : {
                  paddingTop: insets.top,
                  paddingBottom: insets.bottom,
                  transform: [{ translateX: slideX }],
                },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="chatbubble-ellipses" size={22} color="#1E3A5F" />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>BuildFlow Assistant</Text>
              <Text style={styles.headerSubtitle}>
                {isInventory
                  ? 'Ask about stock, bills, invoices & GST'
                  : 'Ask about projects, bills & GST'}
              </Text>
            </View>
            <Pressable
              onPress={handleNewChat}
              disabled={clearHistory.isPending}
              accessibilityRole="button"
              accessibilityLabel="New chat"
              hitSlop={8}
              style={styles.newChatBtn}
            >
              <Ionicons name="refresh-outline" size={20} color="#1E3A5F" />
            </Pressable>
            {isDesktop ? (
              <NavIconButton onPress={handleClose} icon="close" accessibilityLabel="Close assistant" />
            ) : (
              <NavBackButton onPress={handleClose} label="Close" icon="close" size="sm" />
            )}
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
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  mobilePanel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '92%',
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '-12px 0 32px rgba(15, 23, 42, 0.18)',
      },
      default: {
        elevation: 16,
        shadowColor: '#0F172A',
        shadowOffset: { width: -8, height: 0 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
      },
    }),
  },
  desktopPanel: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 48px rgba(15, 23, 42, 0.18)',
      },
      default: {
        elevation: 16,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  newChatBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  body: {
    flex: 1,
  },
});
