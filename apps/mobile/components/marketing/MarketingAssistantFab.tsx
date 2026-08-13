/**
 * Pre-login BuildFlow Product Guide: marketing assistant (no auth).
 */
import React, { useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NavBackButton } from '@/components/layout/NavBackButton';
import { apiFetch } from '@/lib/api-client';

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
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<LocalMsg[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [chipsDismissed, setChipsDismissed] = useState(false);

  const showChips = !chipsDismissed && messages.length === 0 && !loading && !text.trim();

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
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Ask about BuildFlow"
        className="absolute z-50 w-14 h-14 items-center justify-center rounded-full bg-primary shadow-lg active:opacity-90 border border-white/10"
        style={{ bottom: Math.max(insets.bottom, 16) + 8, right: 16 }}
      >
        <Ionicons name="chatbubble-ellipses" size={26} color="#F59E0B" />
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 bg-surface" style={{ paddingTop: insets.top }}>
          <View className="px-4 py-3 border-b border-border flex-row items-center gap-3">
            <NavBackButton onPress={() => setOpen(false)} label="Close" icon="close" />
            <View className="flex-1">
              <Text className="text-lg font-bold text-text">BuildFlow Guide</Text>
              <Text className="text-xs text-muted">Product info · log in for your company data</Text>
            </View>
          </View>

          <ScrollView className="flex-1 px-4 py-3" contentContainerClassName="gap-3 pb-4">
            {messages.length === 0 && (
              <Text className="text-sm text-muted text-center py-8">
                Ask about features, pricing, or how BuildFlow works for construction firms in India.
              </Text>
            )}
            {messages.map((m) => (
              <View
                key={m.id}
                className={`max-w-[85%] rounded-xl px-3 py-2 ${m.isBot ? 'bg-card border border-border self-start' : 'bg-primary self-end'}`}
              >
                <Text className={`text-sm ${m.isBot ? 'text-text' : 'text-white'}`}>{m.text}</Text>
              </View>
            ))}
            {loading && <ActivityIndicator color="#1E3A5F" />}
          </ScrollView>

          {showChips ? (
            <View className="flex-row flex-wrap px-3 pb-2 gap-2">
              {PUBLIC_CHIPS.map((c) => (
                <Pressable key={c} onPress={() => send(c)} className="px-3 py-1.5 rounded-full bg-primary/10">
                  <Text className="text-xs font-medium text-primary">{c}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View
            className="flex-row items-end px-3 py-2 border-t border-border bg-card gap-2"
            style={{ paddingBottom: Math.max(insets.bottom, 8) }}
          >
            <TextInput
              className="flex-1 min-h-[40px] max-h-24 px-3 py-2 rounded-xl bg-surface text-text text-sm"
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
              className="px-4 py-2.5 rounded-xl bg-primary active:opacity-80"
            >
              <Text className="text-white font-semibold text-sm">Send</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
