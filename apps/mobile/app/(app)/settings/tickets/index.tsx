/**
 * BuildFlow — Support tickets (my requests + owner inbox).
 */
import React, { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Badge, Button, LoadingSkeleton, EmptyState } from '@/components/ui';
import { SettingsPageLayout } from '@/components/layout/SettingsPageLayout';
import {
  useMyTickets,
  useTicketInbox,
  useUpdateTicket,
  type SupportTicketRow,
} from '@/services/settings.queries';
import { useAuthStore } from '@/stores/auth.store';

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'neutral'> = {
  OPEN: 'primary',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
  REJECTED: 'danger',
  ESCALATED: 'warning',
};

function TicketCard({
  ticket,
  isOwner,
  onAction,
}: {
  ticket: SupportTicketRow;
  isOwner: boolean;
  onAction?: (action: 'resolve' | 'reject' | 'escalate') => void;
}) {
  return (
    <Card className="mb-3">
      <View className="flex-row justify-between items-start mb-2">
        <Text className="text-base font-semibold text-text flex-1 mr-2">{ticket.subject}</Text>
        <Badge label={ticket.status.replace('_', ' ')} color={STATUS_COLOR[ticket.status] ?? 'neutral'} />
      </View>
      <Text className="text-xs text-muted mb-1">
        {ticket.category.replace('_', ' ')} · {ticket.requesterName}
      </Text>
      <Text className="text-sm text-text-muted">{ticket.description}</Text>
      {ticket.resolutionNote ? (
        <Text className="text-xs text-muted mt-2 italic">Note: {ticket.resolutionNote}</Text>
      ) : null}
      {isOwner && onAction && ['OPEN', 'IN_PROGRESS'].includes(ticket.status) && ticket.scope === 'COMPANY' ? (
        <View className="flex-row flex-wrap gap-2 mt-3 pt-3 border-t border-border">
          <Button label="Approve" size="sm" onPress={() => onAction('resolve')} />
          <Button label="Reject" size="sm" variant="secondary" onPress={() => onAction('reject')} />
          <Button label="Escalate" size="sm" variant="ghost" onPress={() => onAction('escalate')} />
        </View>
      ) : null}
    </Card>
  );
}

export default function TicketsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'OWNER';
  const [tab, setTab] = useState<'mine' | 'inbox'>(isOwner ? 'inbox' : 'mine');
  const myQ = useMyTickets();
  const inboxQ = useTicketInbox();
  const update = useUpdateTicket();

  const tickets = tab === 'inbox' ? inboxQ.data : myQ.data;
  const isLoading = tab === 'inbox' ? inboxQ.isLoading : myQ.isLoading;

  const handleAction = (ticket: SupportTicketRow, action: 'resolve' | 'reject' | 'escalate') => {
    const status = action === 'resolve' ? 'RESOLVED' : action === 'reject' ? 'REJECTED' : 'ESCALATED';
    update.mutate(
      {
        ticketId: ticket.id,
        data: {
          status,
          applyChanges: action === 'resolve',
          resolutionNote:
            action === 'resolve'
              ? 'Approved by company owner'
              : action === 'reject'
                ? 'Rejected by company owner'
                : 'Escalated to BuildFlow support',
        },
      },
      { onError: (e: Error) => Alert.alert('Error', e.message) },
    );
  };

  return (
    <SettingsPageLayout
      title="Support requests"
      subtitle={isOwner ? 'Review team requests' : 'Your submitted requests'}
      actions={<Button label="New" size="sm" onPress={() => router.push('/(app)/settings/tickets/create' as never)} />}
    >
      {isOwner && (
        <View className="flex-row gap-2 mb-4">
          <Button label="Inbox" size="sm" variant={tab === 'inbox' ? 'primary' : 'secondary'} onPress={() => setTab('inbox')} />
          <Button label="My requests" size="sm" variant={tab === 'mine' ? 'primary' : 'secondary'} onPress={() => setTab('mine')} />
        </View>
      )}
      {isLoading ? (
        <LoadingSkeleton className="h-24 mb-3" />
      ) : !tickets?.length ? (
        <EmptyState
          title="No requests"
          description="Submit a request when you need a change you cannot make yourself."
          action={<Button label="Submit request" onPress={() => router.push('/(app)/settings/tickets/create' as never)} />}
        />
      ) : (
        tickets.map((t: SupportTicketRow) => (
          <TicketCard
            key={t.id}
            ticket={t}
            isOwner={isOwner && tab === 'inbox'}
            onAction={(action) => handleAction(t, action)}
          />
        ))
      )}
    </SettingsPageLayout>
  );
}
