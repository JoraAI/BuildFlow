/**
 * BuildFlow Assistant - chat UI (messages, chips, composer).
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useChatHistory, useSendChatMessage, type ChatMessage } from '@/services/chat.queries';
import { useAuthStore } from '@/stores/auth.store';
import { useAssistantStore } from '@/stores/assistant.store';
import { formatTime } from '@/utils/format';

const CONSTRUCTION_CHIPS = [
  'Project Status',
  'Pending Bills',
  'Estimate vs Actual',
  'GST Summary',
  'Overdue Tasks',
  'Explain subcontract billing',
  'What is GRN?',
  'Invoice vs bill?',
];

const INVENTORY_CHIPS = [
  'Low stock',
  'Pending bills',
  'Stock health',
  'GST Summary',
  'What is GRN?',
  'Invoice vs bill?',
];

export function AssistantChatContent({ projectId }: { projectId?: string }) {
  const { data: messages, isLoading } = useChatHistory(projectId);
  const sendMsg = useSendChatMessage(projectId);
  const [text, setText] = useState('');
  const [chipsDismissed, setChipsDismissed] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const isOpen = useAssistantStore((s) => s.isOpen);
  const conversationNonce = useAssistantStore((s) => s.conversationNonce);
  const productMode = useAuthStore((s) => s.user?.productMode);
  const isInventory = productMode === 'inventory';
  const chips = isInventory ? INVENTORY_CHIPS : CONSTRUCTION_CHIPS;

  const list = messages ?? [];

  // Re-opening an empty chat box restores chips. Existing history keeps them hidden.
  useEffect(() => {
    if (isOpen) setChipsDismissed(false);
  }, [isOpen]);

  // New chat: clear the composer and restore chips.
  useEffect(() => {
    setChipsDismissed(false);
    setText('');
  }, [conversationNonce]);

  useEffect(() => {
    if (list.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [list.length]);

  const handleSend = (value?: string) => {
    const content = (value ?? text).trim();
    if (!content || sendMsg.isPending) return;
    setChipsDismissed(true);
    sendMsg.mutate(content);
    setText('');
  };

  const showChips =
    !isLoading && !chipsDismissed && list.length === 0 && !sendMsg.isPending && !text.trim();

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isUser = !item.isBot;
    return (
      <View style={[styles.row, isUser ? styles.rowUser : styles.rowBot]}>
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
          <Text style={[styles.msgText, isUser ? styles.msgTextUser : styles.msgTextBot]}>
            {item.message}
          </Text>
          <Text style={[styles.time, isUser ? styles.timeUser : styles.timeBot]}>
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1E3A5F" />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={list}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>How can I help?</Text>
              <Text style={styles.emptyBody}>
                {isInventory
                  ? 'Ask about stock, POs, GRNs, invoices, or vendor bills. I fetch live data for anything your role can access.'
                  : projectId
                    ? 'Ask about this project - status, bills, estimates, BOQ, or overdue tasks. I can fetch live data when you have permission.'
                    : 'Ask about project status, estimates, bills, GST, or overdue tasks. I can list and update items you are permitted to access.'}
              </Text>
            </View>
          }
        />
      )}

      {sendMsg.isPending && (
        <View style={[styles.row, styles.rowBot]}>
          <View style={[styles.bubble, styles.bubbleBot]}>
            <View style={styles.typingDots}>
              <ActivityIndicator size="small" color="#64748B" />
            </View>
          </View>
        </View>
      )}

      {showChips ? (
        <View style={styles.chipsRow}>
          {chips.map((chip) => (
            <TouchableOpacity
              key={chip}
              style={styles.chip}
              onPress={() => handleSend(chip)}
              disabled={sendMsg.isPending}
            >
              <Text style={styles.chipText}>{chip}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={(value) => {
            setText(value);
            if (value.trim()) setChipsDismissed(true);
          }}
          placeholder="Ask anything…"
          placeholderTextColor="#94A3B8"
          multiline
          maxLength={2000}
          editable={!sendMsg.isPending}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sendMsg.isPending) && styles.sendBtnDisabled]}
          onPress={() => handleSend()}
          disabled={!text.trim() || sendMsg.isPending}
        >
          <Text style={styles.sendBtnText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, paddingBottom: 8, flexGrow: 1 },
  empty: { padding: 32, alignItems: 'center', marginTop: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1E3A5F', marginBottom: 8 },
  emptyBody: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },
  row: { flexDirection: 'row', marginBottom: 10 },
  rowUser: { justifyContent: 'flex-end' },
  rowBot: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: '#F59E0B', borderBottomRightRadius: 4 },
  bubbleBot: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  msgText: { fontSize: 15, lineHeight: 21 },
  msgTextUser: { color: '#FFFFFF' },
  msgTextBot: { color: '#0F172A' },
  time: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  timeUser: { color: 'rgba(255,255,255,0.8)' },
  timeBot: { color: '#94A3B8' },
  typingDots: { paddingVertical: 2 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingBottom: 6 },
  chip: {
    backgroundColor: '#E0E7EF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    margin: 3,
  },
  chipText: { fontSize: 12, color: '#1E3A5F', fontWeight: '500' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    minHeight: 56,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 15,
    color: '#0F172A',
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    marginRight: 8,
  },
  sendBtn: {
    backgroundColor: '#1E3A5F',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
});
