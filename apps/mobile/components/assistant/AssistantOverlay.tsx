import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NavBackButton, NavIconButton } from '@/components/layout/NavBackButton';
import { useAssistantStore } from '@/stores/assistant.store';
import { useViewport } from '@/hooks/useViewport';
import { AssistantChatContent } from '@/components/assistant/AssistantChatContent';
import { desktopAssistantPanelStyle } from '@/components/layout/fab-layout';

export function AssistantOverlay() {
  const isOpen = useAssistantStore((s) => s.isOpen);
  const projectId = useAssistantStore((s) => s.projectId);
  const close = useAssistantStore((s) => s.close);
  const { isDesktop } = useViewport();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType={isDesktop ? 'fade' : 'slide'}
      onRequestClose={close}
      statusBarTranslucent
    >
      <View style={styles.root}>
        {isDesktop ? (
          <Pressable
            style={styles.backdrop}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close assistant"
          />
        ) : null}

        <View
          style={[
            isDesktop ? styles.desktopPanel : styles.mobilePanel,
            isDesktop ? desktopAssistantPanelStyle() : {
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="chatbubble-ellipses" size={22} color="#1E3A5F" />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>BuildFlow Assistant</Text>
              <Text style={styles.headerSubtitle}>Ask about projects, bills & GST</Text>
            </View>
            {isDesktop ? (
              <NavIconButton onPress={close} icon="close" accessibilityLabel="Close assistant" />
            ) : (
              <NavBackButton onPress={close} label="Close" icon="close" size="sm" />
            )}
          </View>

          <View style={styles.body}>
            <AssistantChatContent projectId={projectId} />
          </View>
        </View>
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
    flex: 1,
    backgroundColor: '#F8FAFC',
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
