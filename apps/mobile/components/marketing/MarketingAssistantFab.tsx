/**
 * Pre-login BuildFlow Product Guide: marketing assistant (no auth).
 * Same right-edge handle as the logged-in assistant - not a floating FAB.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Animated,
  Platform,
  useWindowDimensions,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '@/lib/api-client';
import { useViewport } from '@/hooks/useViewport';
import { useVisualViewportFrame } from '@/hooks/useVisualViewportFrame';
import { AssistantEdgeHandle } from '@/components/assistant/AssistantEdgeHandle';

interface LocalMsg {
  id: string;
  text: string;
  isBot: boolean;
}

const PUBLIC_CHIPS = [
  'What is BuildFlow?',
  'Pricing plans',
  'GST & invoicing',
  'Daily site reports',
  'How do I sign up?',
];

export function MarketingAssistantFab() {
  const insets = useSafeAreaInsets();
  const { isDesktop } = useViewport();
  const frame = useVisualViewportFrame();
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<LocalMsg[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [chipsDismissed, setChipsDismissed] = useState(false);
  const panelWidth = useMemo(
    () => Math.min(isDesktop ? 420 : Math.round(width * 0.92), width),
    [isDesktop, width],
  );
  const slideX = useRef(new Animated.Value(420)).current;

  useEffect(() => {
    if (open) {
      slideX.setValue(panelWidth);
      Animated.timing(slideX, { toValue: 0, duration: 280, useNativeDriver: true }).start();
    } else {
      slideX.setValue(panelWidth);
    }
  }, [open, panelWidth, slideX]);

  const showChips = !chipsDismissed && messages.length === 0 && !loading && !text.trim();
  const composerPad = Math.max(insets.bottom, frame.chromeBottom, Platform.OS === 'web' ? 24 : 8);

  const close = () => {
    Animated.timing(slideX, { toValue: panelWidth, duration: 220, useNativeDriver: true }).start(
      ({ finished }) => {
        if (finished) setOpen(false);
      },
    );
  };

  const send = async (content: string) => {
    const msg = content.trim();
    if (!msg || loading) return;
    setText('');
    setChipsDismissed(true);
    const userId = `u-${Date.now()}`;
    setMessages((m) => [...m, { id: userId, text: msg, isBot: false }]);
    setLoading(true);
    try {
      const res = await apiFetch<{ reply: string }>('/chatbot/public/message', {
        method: 'POST',
        body: JSON.stringify({ message: msg }),
      });
      setMessages((m) => [...m, { id: `b-${Date.now()}`, text: res.reply, isBot: true }]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: `b-${Date.now()}`,
          text: 'BuildFlow helps Indian contractors manage estimates, BOQ, site reports, and GST accounting. Visit Pricing or Sign up to get started.',
          isBot: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!open ? (
        <AssistantEdgeHandle
          onPress={() => setOpen(true)}
          accessibilityLabel="Ask about BuildFlow"
        />
      ) : null}

      <Modal visible={open} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
        <View style={styles.root}>
          <Pressable
            style={styles.backdrop}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close assistant"
          />
          <Animated.View
            style={[
              styles.panel,
              {
                width: panelWidth,
                top: Platform.OS === 'web' ? frame.offsetTop : 0,
                height: Platform.OS === 'web' && frame.height > 0 ? frame.height : '100%',
                transform: [{ translateX: slideX }],
              },
            ]}
          >
            <View style={styles.header}>
              <View style={styles.headerIcon}>
                <Ionicons name="chatbubble-ellipses" size={20} color="#1E3A5F" />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.headerTitle}>BuildFlow Guide</Text>
                <Text style={styles.headerSubtitle}>Product info · log in for company data</Text>
              </View>
              <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" style={styles.headerBtn}>
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </Pressable>
            </View>

            <ScrollView className="flex-1 px-4 py-3" contentContainerClassName="gap-3 pb-4">
              {messages.length === 0 && (
                <Text className="text-sm text-muted text-center py-6">
                  Ask about features, pricing, or how BuildFlow works for construction firms in India.
                </Text>
              )}
              {messages.map((m) => (
                <View
                  key={m.id}
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                    m.isBot ? 'bg-card border border-border self-start' : 'bg-primary self-end'
                  }`}
                >
                  <Text className={`text-sm ${m.isBot ? 'text-text' : 'text-white'}`}>{m.text}</Text>
                </View>
              ))}
              {loading && <ActivityIndicator color="#1E3A5F" />}
            </ScrollView>

            {showChips ? (
              <View className="flex-row flex-wrap px-3 pb-2 gap-2">
                {PUBLIC_CHIPS.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => send(c)}
                    className="px-3 py-1.5 rounded-full bg-white border border-border"
                  >
                    <Text className="text-xs font-semibold text-primary">{c}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View
              className="flex-row items-end px-3 pt-2 border-t border-border bg-white gap-2"
              style={{ paddingBottom: 10 + composerPad }}
            >
              <TextInput
                className="flex-1 min-h-[42px] max-h-24 px-4 py-2.5 rounded-full bg-surface text-text text-sm"
                value={text}
                onChangeText={(value) => {
                  setText(value);
                  if (value.trim()) setChipsDismissed(true);
                }}
                placeholder="Ask about BuildFlow…"
                multiline
              />
              <Pressable
                onPress={() => send(text)}
                disabled={!text.trim() || loading}
                className="w-[42px] h-[42px] rounded-full bg-primary items-center justify-center active:opacity-80"
                accessibilityRole="button"
                accessibilityLabel="Send"
              >
                <Ionicons name="send" size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  panel: {
    position: 'absolute',
    right: 0,
    bottom: undefined,
    backgroundColor: '#F1F5F9',
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '-16px 0 40px rgba(15, 23, 42, 0.22)' },
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
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  headerText: { flex: 1, marginLeft: 10, marginRight: 8 },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  headerSubtitle: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
