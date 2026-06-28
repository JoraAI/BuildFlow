/**
 * BuildFlow - React Query hooks for chat (BuildFlow Assistant) + notifications.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------
export interface ChatMessage {
  id: string;
  message: string;
  isBot: boolean;
  messageType: 'TEXT' | 'IMAGE' | 'FILE';
  createdAt: string;
}

export function useChatHistory(projectId?: string) {
  const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  return useQuery({
    queryKey: ['chat', 'history', projectId ?? 'global'] as const,
    queryFn: () => apiFetch<ChatMessage[]>(`/chatbot/history${qs}`),
    refetchInterval: false,
  });
}

export function useSendChatMessage(projectId?: string) {
  const qc = useQueryClient();
  const key = ['chat', 'history', projectId ?? 'global'] as const;
  return useMutation({
    mutationFn: (message: string) =>
      apiFetch<{ reply: string; userMessageId: string; botMessageId: string }>(`/chatbot/message`, {
        method: 'POST',
        body: JSON.stringify({ message, projectId }),
      }),
    // Optimistic: append user message immediately
    onMutate: async (message: string) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<ChatMessage[]>(key);
      const optimistic: ChatMessage = {
        id: `tmp-${Date.now()}`,
        message,
        isBot: false,
        messageType: 'TEXT',
        createdAt: new Date().toISOString(),
      };
      qc.setQueryData<ChatMessage[]>(key, (old = []) => [...old, optimistic]);
      return { prev };
    },
    onError: (_err, _msg, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSuccess: (data) => {
      qc.setQueryData<ChatMessage[]>(key, (old = []) => [
        ...old,
        {
          id: data.botMessageId,
          message: data.reply,
          isBot: true,
          messageType: 'TEXT',
          createdAt: new Date().toISOString(),
        },
      ]);
    },
  });
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  referenceId?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationList {
  items: AppNotification[];
  unreadCount: number;
}

export function useNotifications(unreadOnly = false) {
  return useQuery({
    queryKey: ['notifications', 'list', unreadOnly] as const,
    queryFn: () => apiFetch<NotificationList>(`/notifications?unreadOnly=${unreadOnly}`),
    refetchInterval: 30_000, // poll for new notifications
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'] as const,
    queryFn: () => apiFetch<NotificationList>(`/notifications?unreadOnly=true`),
    refetchInterval: 30_000,
    select: (d) => d.unreadCount,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ updated: number }>(`/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ updated: number }>(`/notifications/read-all`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Razorpay payment link
// ---------------------------------------------------------------------------
export function useCreatePaymentLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId: string) =>
      apiFetch<{ linkId: string; shortUrl: string; amount: number }>(`/invoices/${invoiceId}/payment-link`, {
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}