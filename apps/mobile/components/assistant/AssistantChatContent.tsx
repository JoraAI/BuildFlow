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

/* ------------------------------------------------------------------ */
/* D11: lightweight markdown for BOT bubbles (headings, bold, lists,   */
/* tables). User messages stay plain text. No heavy markdown WebView.  */
/* ------------------------------------------------------------------ */

type InlineSegment = { text: string; bold: boolean; code: boolean };

/** Split `**bold**` / `` `code` `` inline runs into styled segments. */
function inlineSegments(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      segments.push({ text: part.slice(2, -2), bold: true, code: false });
    } else if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      segments.push({ text: part.slice(1, -1), bold: false, code: true });
    } else {
      segments.push({ text: part, bold: false, code: false });
    }
  }
  return segments;
}

function InlineText({ text }: { text: string }) {
  return (
    <Text style={styles.mdInline}>
      {inlineSegments(text).map((seg, i) => (
        <Text
          key={i}
          style={[seg.bold && styles.mdBold, seg.code && styles.mdCode]}
        >
          {seg.text}
        </Text>
      ))}
    </Text>
  );
}

const isSeparatorRow = (cells: string[]) =>
  cells.every((c) => /^:?-{2,}:?$/.test(c));

function MarkdownBlocks({ content }: { content: string }) {
  const blocks = content.split(/\n\s*\n/);
  const out: React.ReactNode[] = [];
  let key = 0;

  for (const raw of blocks) {
    const block = raw.trim();
    if (!block) continue;

    // GFM table: consecutive | rows; separator row skipped.
    const lines = block.split('\n').map((l) => l.trim());
    if (lines.every((l) => l.startsWith('|')) && lines.length >= 2) {
      const rows = lines
        .map((l) => l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()))
        .filter((cells) => cells.length > 0 && !isSeparatorRow(cells));
      if (rows.length > 0) {
        out.push(
          <View key={key++} style={styles.mdTable}>
            {rows.map((cells, ri) => (
              <View key={ri} style={[styles.mdTableRow, ri === 0 && styles.mdTableHeaderRow]}>
                {cells.map((cell, ci) => (
                  <Text
                    key={ci}
                    style={[styles.mdTableCell, ri === 0 && styles.mdBold]}
                  >
                    <InlineText text={cell} />
                  </Text>
                ))}
              </View>
            ))}
          </View>,
        );
        continue;
      }
    }

    // Heading.
    const heading = block.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      out.push(
        <Text key={key++} style={styles.mdHeading}>
          <InlineText text={heading[2]} />
        </Text>,
      );
      continue;
    }

    // Unordered list (a block of `- ` / `* ` items).
    if (lines.every((l) => /^[-*]\s+/.test(l) || l.length === 0)) {
      const items = lines.filter((l) => /^[-*]\s+/.test(l));
      for (const item of items) {
        out.push(
          <Text key={key++} style={styles.mdList}>
            <Text style={styles.mdBullet}>• </Text>
            <InlineText text={item.replace(/^[-*]\s+/, '')} />
          </Text>,
        );
      }
      continue;
    }

    // Ordered list.
    if (lines.every((l) => /^\d+[.)]\s+/.test(l) || l.length === 0)) {
      for (const item of lines.filter((l) => /^\d+[.)]\s+/.test(l))) {
        const m = item.match(/^(\d+)[.)]\s+(.*)$/);
        out.push(
          <Text key={key++} style={styles.mdList}>
            <Text style={styles.mdBold}>{m?.[1]}. </Text>
            <InlineText text={m?.[2] ?? item} />
          </Text>,
        );
      }
      continue;
    }

    // Paragraph.
    out.push(
      <Text key={key++} style={styles.mdPara}>
        <InlineText text={block} />
      </Text>,
    );
  }

  return <>{out}</>;
}

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
          {isUser ? (
            <Text style={[styles.msgText, styles.msgTextUser]}>{item.message}</Text>
          ) : (
            // D11: bot answers render markdown (headings, bold, lists, tables).
            <View style={styles.mdBlock}>
              <MarkdownBlocks content={item.message} />
            </View>
          )}
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
  // D11: markdown block styles for bot bubbles.
  mdBlock: { marginBottom: 4 },
  mdInline: { fontSize: 15, lineHeight: 21, color: '#0F172A' },
  mdBold: { fontWeight: '700' },
  mdCode: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 3,
    borderRadius: 3,
    fontSize: 13,
  },
  mdHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E3A5F',
    marginTop: 2,
    marginBottom: 4,
    lineHeight: 22,
  },
  mdPara: { marginBottom: 6 },
  mdList: { flexDirection: 'row', marginBottom: 3, paddingLeft: 2 },
  mdBullet: { fontWeight: '700', color: '#1E3A5F' },
  mdTable: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    marginVertical: 6,
    overflow: 'hidden',
  },
  mdTableHeaderRow: { backgroundColor: '#F1F5F9' },
  mdTableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  mdTableCell: { flex: 1, paddingHorizontal: 6, paddingVertical: 4, fontSize: 13, lineHeight: 18 },
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
