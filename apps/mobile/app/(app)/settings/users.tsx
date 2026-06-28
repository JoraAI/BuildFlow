/**
 * BuildFlow — Users & Roles settings screen.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
  Share,
  TextInput,
} from 'react-native';
import { Card, Avatar, Badge, Button, LoadingSkeleton, EmptyState } from '@/components/ui';
import { SettingsPageLayout } from '@/components/layout/SettingsPageLayout';
import { useViewport } from '@/hooks/useViewport';
import {
  useUsers,
  useUpdateUser,
  usePendingInvites,
  useCreateInvite,
  useRevokeInvite,
  useResendInvite,
  type UserRow,
  type InviteCreated,
  type PendingInvite,
} from '@/services/settings.queries';

const ROLES = ['OWNER', 'PM', 'SUPERVISOR', 'ACCOUNTANT'] as const;
const INVITE_ROLES = ['PM', 'SUPERVISOR', 'ACCOUNTANT'] as const;
type Role = (typeof ROLES)[number];
type InviteRole = (typeof INVITE_ROLES)[number];

export default function UsersScreen() {
  const { isDesktop } = useViewport();
  const { data: users, isLoading, refetch, isFetching } = useUsers();
  const { data: invites, refetch: refetchInvites } = usePendingInvites();
  const updateUser = useUpdateUser();
  const createInvite = useCreateInvite();
  const revokeInvite = useRevokeInvite();
  const resendInvite = useResendInvite();

  const [editing, setEditing] = useState<UserRow | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<InviteRole>('PM');
  const [lastInvite, setLastInvite] = useState<InviteCreated | null>(null);

  const onSaveRole = (role: Role) => {
    if (!editing) return;
    updateUser.mutate(
      { userId: editing.id, data: { role } },
      {
        onSuccess: () => setEditing(null),
        onError: (e: Error) => Alert.alert('Error', e.message),
      },
    );
  };

  const onToggleActive = (user: UserRow) => {
    updateUser.mutate(
      { userId: user.id, data: { isActive: !user.isActive } },
      { onError: (e: Error) => Alert.alert('Error', e.message) },
    );
  };

  const onInvite = () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Email required', 'Enter the team member email address.');
      return;
    }
    createInvite.mutate(
      { email: inviteEmail.trim().toLowerCase(), role: inviteRole },
      {
        onSuccess: (result) => {
          setLastInvite(result);
          setInviteEmail('');
          Alert.alert('Invite created', 'Share the invite link with your team member.');
        },
        onError: (e: Error) => Alert.alert('Error', e.message),
      },
    );
  };

  const shareInviteLink = async (url: string) => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      Alert.alert('Copied', 'Invite link copied to clipboard.');
      return;
    }
    await Share.share({ message: `Join BuildFlow: ${url}`, url });
  };

  const refreshAll = () => {
    refetch();
    refetchInvites();
  };

  const inviteAction = (
    <Button label="Invite" size="sm" onPress={() => setInviteOpen(true)} />
  );

  const content = isLoading ? (
    <View className="gap-3">
      <LoadingSkeleton className="h-16" />
      <LoadingSkeleton className="h-16" />
      <LoadingSkeleton className="h-16" />
    </View>
  ) : (
    <View className={isDesktop ? 'flex-row gap-6 items-start' : ''}>
      {(invites?.length ?? 0) > 0 && (
        <View className={isDesktop ? 'flex-1 min-w-[300px]' : 'mb-6'}>
          <Text className="text-sm font-bold text-text mb-3 uppercase tracking-wide">
            Pending invites
          </Text>
          {invites!.map((inv: PendingInvite) => (
            <Card key={inv.id} className="mb-3">
              <View className="flex-row justify-between items-start">
                <View className="flex-1 mr-2">
                  <Text className="text-base font-semibold text-text">{inv.email}</Text>
                  <Text className="text-xs text-muted mt-1">
                    Role: {inv.role} · Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </Text>
                </View>
                <Badge label="Pending" color="warning" />
              </View>
              <View className="flex-row gap-2 mt-3 pt-3 border-t border-border">
                <TouchableOpacity
                  onPress={() =>
                    resendInvite.mutate(inv.id, {
                      onSuccess: (r) => shareInviteLink(r.inviteUrl),
                      onError: (e: Error) => Alert.alert('Error', e.message),
                    })
                  }
                  className="px-3 py-1.5 rounded-md bg-primary/10"
                >
                  <Text className="text-primary text-xs font-semibold">Resend link</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    Alert.alert('Revoke invite?', inv.email, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Revoke',
                        style: 'destructive',
                        onPress: () =>
                          revokeInvite.mutate(inv.id, {
                            onError: (e: Error) => Alert.alert('Error', e.message),
                          }),
                      },
                    ])
                  }
                  className="px-3 py-1.5 rounded-md bg-border"
                >
                  <Text className="text-text text-xs font-semibold">Revoke</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </View>
      )}

      <View className={isDesktop ? 'flex-[2] min-w-[360px]' : ''}>
        <Text className="text-sm font-bold text-text mb-3 uppercase tracking-wide">
          Team members
        </Text>

        {!users || users.length === 0 ? (
          <EmptyState
            title="No users yet"
            description="Invite your team to get started."
            action={<Button label="Invite user" onPress={() => setInviteOpen(true)} />}
          />
        ) : (
          <View className={isDesktop ? 'flex-row flex-wrap gap-3' : ''}>
            {users.map((u: UserRow) => (
              <Card
                key={u.id}
                className={`mb-3 ${isDesktop ? 'w-[48%] min-w-[280px] flex-1 mb-0' : ''}`}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <Avatar name={u.name} size={44} />
                    <View className="ml-3 flex-1">
                      <Text className="text-base font-bold text-text">{u.name}</Text>
                      <Text className="text-xs text-text-muted">{u.email}</Text>
                    </View>
                  </View>
                  <Badge label={u.role} color={u.role === 'OWNER' ? 'primary' : 'neutral'} />
                </View>

                <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-border">
                  <Text
                    className={`text-xs font-semibold ${u.isActive ? 'text-success' : 'text-danger'}`}
                  >
                    {u.isActive ? '● Active' : '○ Deactivated'}
                  </Text>
                  <View className="flex-row">
                    <TouchableOpacity
                      onPress={() => setEditing(u)}
                      className="px-3 py-1.5 rounded-md bg-primary/10 mr-2"
                    >
                      <Text className="text-primary text-xs font-semibold">Change Role</Text>
                    </TouchableOpacity>
                    {u.role !== 'OWNER' && (
                      <TouchableOpacity
                        onPress={() => onToggleActive(u)}
                        className="px-3 py-1.5 rounded-md bg-border"
                      >
                        <Text className="text-text text-xs font-semibold">
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  return (
    <>
      <SettingsPageLayout
        title="Users & Roles"
        subtitle="Invite team members and manage access"
        actions={inviteAction}
        refreshing={isFetching}
        onRefresh={refreshAll}
      >
        {content}
      </SettingsPageLayout>

      <Modal visible={inviteOpen} transparent animationType="slide" onRequestClose={() => setInviteOpen(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className={`bg-card rounded-t-2xl p-5 ${isDesktop ? 'self-center w-full max-w-lg rounded-2xl mb-8' : ''}`}>
            <Text className="text-lg font-bold text-text mb-1">Invite team member</Text>
            <Text className="text-sm text-muted mb-4">
              Only company owners can invite users. They will join via a secure link.
            </Text>

            <Text className="text-sm font-semibold text-text mb-1">Email</Text>
            <TextInput
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="colleague@company.com"
              keyboardType="email-address"
              autoCapitalize="none"
              className="border border-border rounded-lg px-3 py-2.5 text-text mb-4 bg-surface"
            />

            <Text className="text-sm font-semibold text-text mb-2">Role</Text>
            {INVITE_ROLES.map((r) => (
              <TouchableOpacity
                key={r}
                onPress={() => setInviteRole(r)}
                className={`py-3 px-4 rounded-lg mb-2 ${inviteRole === r ? 'bg-primary' : 'bg-surface'}`}
              >
                <Text className={`font-semibold ${inviteRole === r ? 'text-white' : 'text-text'}`}>
                  {r}
                </Text>
              </TouchableOpacity>
            ))}

            {lastInvite ? (
              <View className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
                <Text className="text-xs text-muted mb-2">Latest invite link</Text>
                <Text className="text-xs text-text mb-3" numberOfLines={2}>
                  {lastInvite.inviteUrl}
                </Text>
                <Button
                  label="Copy / Share link"
                  size="sm"
                  variant="secondary"
                  onPress={() => shareInviteLink(lastInvite.inviteUrl)}
                />
              </View>
            ) : null}

            <View className="mt-4 gap-2">
              <Button
                label={createInvite.isPending ? 'Sending…' : 'Send invite'}
                onPress={onInvite}
                loading={createInvite.isPending}
                fullWidth
              />
              <Button label="Close" variant="ghost" onPress={() => setInviteOpen(false)} fullWidth />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className={`bg-card rounded-t-2xl p-5 ${isDesktop ? 'self-center w-full max-w-md rounded-2xl mb-8' : ''}`}>
            <Text className="text-lg font-bold text-text mb-1">Change Role</Text>
            <Text className="text-sm text-text-muted mb-4">
              {editing?.name} · {editing?.email}
            </Text>
            {ROLES.map((r) => (
              <TouchableOpacity
                key={r}
                onPress={() => onSaveRole(r)}
                className={`py-3.5 px-4 rounded-lg mb-2 ${editing?.role === r ? 'bg-primary' : 'bg-surface'}`}
              >
                <Text className={`text-base font-semibold ${editing?.role === r ? 'text-white' : 'text-text'}`}>
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
            <Button label="Cancel" variant="ghost" onPress={() => setEditing(null)} fullWidth />
          </View>
        </View>
      </Modal>
    </>
  );
}
