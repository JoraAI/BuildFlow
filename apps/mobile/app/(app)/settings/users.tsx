/**
 * BuildFlow - Users & Roles settings screen.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Platform,
  Share,
  TextInput,
  ScrollView,
} from 'react-native';
import { Card, Avatar, Badge, Button, LoadingSkeleton, EmptyState } from '@/components/ui';
import { SettingsPageLayout } from '@/components/layout/SettingsPageLayout';
import { ResponsiveGrid } from '@/components/layout/ResponsiveGrid';
import { AdaptiveSheet } from '@/components/layout/AdaptiveSheet';
import { useViewport } from '@/hooks/useViewport';
import { useAuthStore } from '@/stores/auth.store';
import {
  INVITABLE_ROLES_BY_PRODUCT,
  ROLE_LABELS,
  type Role,
} from '@buildflow/shared';
import {
  useUsers,
  useUpdateUser,
  usePendingInvites,
  useCreateInvite,
  useCreateTeamUser,
  useRevokeInvite,
  useResendInvite,
  useDeleteUser,
  type UserRow,
  type InviteCreated,
  type PendingInvite,
} from '@/services/settings.queries';
import { alertAsync, confirmAsync } from '@/utils/confirm';

type InviteRole = Exclude<Role, 'OWNER' | 'SUPERVISOR'>;

export default function UsersScreen() {
  const { isDesktop } = useViewport();
  const productMode = useAuthStore((s) => s.user?.productMode) ?? 'construction';
  const inviteRoles = useMemo(
    () =>
      INVITABLE_ROLES_BY_PRODUCT[productMode === 'inventory' ? 'inventory' : 'construction'].filter(
        (r): r is InviteRole => r !== 'OWNER',
      ),
    [productMode],
  );
  const assignableRoles = inviteRoles;
  const defaultRole = (inviteRoles[0] ?? 'PM') as InviteRole;

  const { data: users, isLoading, refetch, isFetching } = useUsers();
  const { data: invites, refetch: refetchInvites } = usePendingInvites();
  const updateUser = useUpdateUser();
  const createInvite = useCreateInvite();
  const createTeamUser = useCreateTeamUser();
  const revokeInvite = useRevokeInvite();
  const resendInvite = useResendInvite();
  const deleteUser = useDeleteUser();

  const [editing, setEditing] = useState<UserRow | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteMode, setInviteMode] = useState<'email' | 'phone'>('email');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRole, setInviteRole] = useState<InviteRole>(defaultRole);
  const [lastInvite, setLastInvite] = useState<InviteCreated | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState<InviteRole>(defaultRole);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdCreds, setCreatedCreds] = useState<{ loginHint: string; password: string } | null>(
    null,
  );

  useEffect(() => {
    if (!inviteRoles.includes(inviteRole)) setInviteRole(defaultRole);
    if (!inviteRoles.includes(createRole)) setCreateRole(defaultRole);
  }, [inviteRoles, defaultRole, inviteRole, createRole]);

  const onSaveRole = (role: Role) => {
    if (!editing) return;
    updateUser.mutate(
      { userId: editing.id, data: { role } },
      {
        onSuccess: () => setEditing(null),
        onError: async (e: Error) => {
          await alertAsync('Error', e.message);
        },
      },
    );
  };

  const onToggleActive = (user: UserRow) => {
    updateUser.mutate(
      { userId: user.id, data: { isActive: !user.isActive } },
      { onError: async (e: Error) => void alertAsync('Error', e.message) },
    );
  };

  const onDeleteUser = async (user: UserRow) => {
    const ok = await confirmAsync(
      'Remove team member?',
      `${user.name} will be removed from this organisation. They can be invited elsewhere with a fresh signup.`,
    );
    if (!ok) return;
    deleteUser.mutate(user.id, {
      onError: async (e: Error) => {
        await alertAsync('Error', e.message);
      },
    });
  };

  const onInvite = () => {
    const email = inviteEmail.trim().toLowerCase();
    const phone = invitePhone.trim();
    if (inviteMode === 'email' && !email) {
      setFormError('Enter the team member email address.');
      void alertAsync('Email required', 'Enter the team member email address.');
      return;
    }
    if (inviteMode === 'phone' && !phone) {
      setFormError('Enter the team member mobile number.');
      void alertAsync('Mobile required', 'Enter the team member mobile number.');
      return;
    }
    setFormError(null);
    createInvite.mutate(
      {
        ...(inviteMode === 'email' ? { email } : { phone }),
        role: inviteRole,
      },
      {
        onSuccess: async (result) => {
          setLastInvite(result);
          setInviteEmail('');
          setInvitePhone('');
          await alertAsync('Invite created', 'Share the invite link with your team member.');
        },
        onError: async (e: Error) => {
          setFormError(e.message);
          await alertAsync('Error', e.message);
        },
      },
    );
  };

  const onCreateUser = () => {
    if (!createName.trim()) {
      setCreateError('Name is required.');
      return;
    }
    if (!createEmail.trim() && !createPhone.trim()) {
      setCreateError('Enter email or mobile number.');
      return;
    }
    if (!createPassword.trim()) {
      setCreateError('Password is required.');
      return;
    }
    setCreateError(null);
    createTeamUser.mutate(
      {
        name: createName.trim(),
        email: createEmail.trim() || undefined,
        phone: createPhone.trim() || undefined,
        password: createPassword,
        role: createRole,
      },
      {
        onSuccess: async (result) => {
          setCreatedCreds({ loginHint: result.loginHint, password: createPassword });
          setCreateName('');
          setCreateEmail('');
          setCreatePhone('');
          setCreatePassword('');
          await alertAsync(
            'User created',
            `Share login: ${result.loginHint} with the password you set.`,
          );
        },
        onError: async (e: Error) => {
          setCreateError(e.message);
          await alertAsync('Error', e.message);
        },
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

  const shareCredentials = async (loginHint: string, password: string) => {
    const message = `BuildFlow login\nUsername: ${loginHint}\nPassword: ${password}`;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(message);
      Alert.alert('Copied', 'Login details copied to clipboard.');
      return;
    }
    await Share.share({ message });
  };

  const refreshAll = () => {
    refetch();
    refetchInvites();
  };

  const inviteContactLabel = (inv: PendingInvite) =>
    inv.email || inv.phone || 'Unknown contact';

  const router = useRouter();
  const inviteAction = (
    <View className="flex-row items-center gap-2 flex-wrap">
      <Button
        label="Role Permissions"
        size="sm"
        variant="secondary"
        onPress={() => router.push('/(app)/settings/permissions' as never)}
      />
      <Button
        label="Create login"
        size="sm"
        variant="secondary"
        onPress={() => {
          setCreateOpen(true);
          setCreatedCreds(null);
          setCreateError(null);
        }}
      />
      <Button
        label="Invite"
        size="sm"
        onPress={() => {
          setInviteOpen(true);
          setFormError(null);
          setLastInvite(null);
        }}
      />
    </View>
  );

  const rolePicker = (
    roles: InviteRole[],
    selected: InviteRole,
    onSelect: (r: InviteRole) => void,
  ) => (
    <ScrollView className="max-h-64" nestedScrollEnabled>
      {roles.map((r) => (
        <TouchableOpacity
          key={r}
          onPress={() => onSelect(r)}
          className={`py-3 px-4 rounded-lg mb-2 ${selected === r ? 'bg-primary' : 'bg-surface'}`}
        >
          <Text className={`font-semibold ${selected === r ? 'text-white' : 'text-text'}`}>
            {ROLE_LABELS[r] ?? r}
          </Text>
          <Text className={`text-xs mt-0.5 ${selected === r ? 'text-white/80' : 'text-muted'}`}>
            {r}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
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
        <View className={isDesktop ? 'flex-1 min-w-0' : 'mb-6'}>
          <Text className="text-sm font-bold text-text mb-3 uppercase tracking-wide">
            Pending invites
          </Text>
          {invites!.map((inv: PendingInvite) => (
            <Card key={inv.id} className="mb-3">
              <View className="flex-row justify-between items-start">
                <View className="flex-1 mr-2">
                  <Text className="text-base font-semibold text-text">{inviteContactLabel(inv)}</Text>
                  <Text className="text-xs text-muted mt-1">
                    Role: {ROLE_LABELS[inv.role as Role] ?? inv.role} · Expires{' '}
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </Text>
                </View>
                <Badge label="Pending" color="warning" />
              </View>
              <View className="flex-row gap-2 mt-3 pt-3 border-t border-border">
                <TouchableOpacity
                  onPress={() =>
                    resendInvite.mutate(inv.id, {
                      onSuccess: (r) => shareInviteLink(r.inviteUrl),
                      onError: async (e: Error) => {
                        await alertAsync('Error', e.message);
                      },
                    })
                  }
                  className="px-3 py-1.5 rounded-md bg-primary/10"
                >
                  <Text className="text-primary text-xs font-semibold">Resend link</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    const ok = await confirmAsync('Revoke invite?', inviteContactLabel(inv));
                    if (!ok) return;
                    revokeInvite.mutate(inv.id, {
                      onError: async (e: Error) => {
                        await alertAsync('Error', e.message);
                      },
                    });
                  }}
                  className="px-3 py-1.5 rounded-md bg-border"
                >
                  <Text className="text-text text-xs font-semibold">Revoke</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </View>
      )}

      <View className={isDesktop ? 'flex-[2] min-w-0' : ''}>
        <Text className="text-sm font-bold text-text mb-3 uppercase tracking-wide">
          Team members
        </Text>

        {!users || users.length === 0 ? (
          <EmptyState
            title="No users yet"
            description="Invite your team or create a login for them."
            action={<Button label="Invite user" onPress={() => setInviteOpen(true)} />}
          />
        ) : (
          <ResponsiveGrid gap={12}>
            {users.map((u: UserRow) => (
              <Card key={u.id} className="h-full mb-0">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <Avatar name={u.name} size={44} />
                    <View className="ml-3 flex-1">
                      <Text className="text-base font-bold text-text">{u.name}</Text>
                      {u.email.endsWith('@phone.buildflow.local') ? null : (
                        <Text className="text-xs text-text-muted">{u.email}</Text>
                      )}
                      {u.phone ? (
                        <Text className="text-xs text-text-muted">{u.phone}</Text>
                      ) : null}
                    </View>
                  </View>
                  <Badge
                    label={ROLE_LABELS[u.role as Role] ?? u.role}
                    color={u.role === 'OWNER' ? 'primary' : 'neutral'}
                  />
                </View>

                <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-border">
                  <Text
                    className={`text-xs font-semibold ${u.isActive ? 'text-success' : 'text-danger'}`}
                  >
                    {u.isActive ? '● Active' : '○ Deactivated'}
                  </Text>
                  <View className="flex-row flex-wrap justify-end gap-1">
                    <TouchableOpacity
                      onPress={() => setEditing(u)}
                      className="px-3 py-1.5 rounded-md bg-primary/10"
                    >
                      <Text className="text-primary text-xs font-semibold">Change Role</Text>
                    </TouchableOpacity>
                    {u.role !== 'OWNER' && (
                      <>
                        <TouchableOpacity
                          onPress={() => onToggleActive(u)}
                          className="px-3 py-1.5 rounded-md bg-border"
                        >
                          <Text className="text-text text-xs font-semibold">
                            {u.isActive ? 'Deactivate' : 'Activate'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => void onDeleteUser(u)}
                          className="px-3 py-1.5 rounded-md bg-danger/10"
                        >
                          <Text className="text-danger text-xs font-semibold">Delete</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              </Card>
            ))}
          </ResponsiveGrid>
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

      <AdaptiveSheet
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite team member"
        subtitle="Send a secure link by email or mobile. They set their own password."
        size="md"
        footer={
          <View className="gap-2">
            <Button
              label={createInvite.isPending ? 'Sending…' : 'Send invite'}
              onPress={onInvite}
              loading={createInvite.isPending}
              fullWidth
            />
            <Button label="Close" variant="ghost" onPress={() => setInviteOpen(false)} fullWidth />
          </View>
        }
      >
        <View className="flex-row gap-2 mb-4">
          {(['email', 'phone'] as const).map((mode) => (
            <TouchableOpacity
              key={mode}
              onPress={() => setInviteMode(mode)}
              className={`flex-1 py-2.5 rounded-lg items-center ${
                inviteMode === mode ? 'bg-primary' : 'bg-surface'
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  inviteMode === mode ? 'text-white' : 'text-text'
                }`}
              >
                {mode === 'email' ? 'Email' : 'Mobile'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {inviteMode === 'email' ? (
          <>
            <Text className="text-sm font-semibold text-text mb-1">Email</Text>
            <TextInput
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="colleague@company.com"
              keyboardType="email-address"
              autoCapitalize="none"
              className="border border-border rounded-lg px-3 py-2.5 text-text mb-4 bg-surface"
            />
          </>
        ) : (
          <>
            <Text className="text-sm font-semibold text-text mb-1">Mobile number</Text>
            <TextInput
              value={invitePhone}
              onChangeText={setInvitePhone}
              placeholder="9876543210 or +919876543210"
              keyboardType="phone-pad"
              autoCapitalize="none"
              className="border border-border rounded-lg px-3 py-2.5 text-text mb-4 bg-surface"
            />
          </>
        )}

        {formError ? (
          <View className="mb-3 px-3 py-2 rounded-lg bg-danger/10 border border-danger/30">
            <Text className="text-sm text-danger">{formError}</Text>
          </View>
        ) : null}

        <Text className="text-sm font-semibold text-text mb-2">Role</Text>
        {rolePicker(inviteRoles, inviteRole, setInviteRole)}

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
      </AdaptiveSheet>

      <AdaptiveSheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create login"
        subtitle="Set name, contact, role and password. Share the credentials with your teammate."
        size="md"
        footer={
          <View className="gap-2">
            <Button
              label={createTeamUser.isPending ? 'Creating…' : 'Create user'}
              onPress={onCreateUser}
              loading={createTeamUser.isPending}
              fullWidth
            />
            <Button label="Close" variant="ghost" onPress={() => setCreateOpen(false)} fullWidth />
          </View>
        }
      >
        <Text className="text-sm font-semibold text-text mb-1">Full name</Text>
        <TextInput
          value={createName}
          onChangeText={setCreateName}
          placeholder="Team member name"
          className="border border-border rounded-lg px-3 py-2.5 text-text mb-3 bg-surface"
        />

        <Text className="text-sm font-semibold text-text mb-1">Email (optional if mobile set)</Text>
        <TextInput
          value={createEmail}
          onChangeText={setCreateEmail}
          placeholder="colleague@company.com"
          keyboardType="email-address"
          autoCapitalize="none"
          className="border border-border rounded-lg px-3 py-2.5 text-text mb-3 bg-surface"
        />

        <Text className="text-sm font-semibold text-text mb-1">Mobile (optional if email set)</Text>
        <TextInput
          value={createPhone}
          onChangeText={setCreatePhone}
          placeholder="9876543210"
          keyboardType="phone-pad"
          className="border border-border rounded-lg px-3 py-2.5 text-text mb-3 bg-surface"
        />

        <Text className="text-sm font-semibold text-text mb-1">Temporary password</Text>
        <TextInput
          value={createPassword}
          onChangeText={setCreatePassword}
          placeholder="Min 8 chars, upper, lower, number"
          secureTextEntry
          className="border border-border rounded-lg px-3 py-2.5 text-text mb-3 bg-surface"
        />

        {createError ? (
          <View className="mb-3 px-3 py-2 rounded-lg bg-danger/10 border border-danger/30">
            <Text className="text-sm text-danger">{createError}</Text>
          </View>
        ) : null}

        <Text className="text-sm font-semibold text-text mb-2">Role</Text>
        {rolePicker(assignableRoles, createRole, setCreateRole)}

        {createdCreds ? (
          <View className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
            <Text className="text-xs text-muted mb-2">Share these login details</Text>
            <Text className="text-sm text-text mb-1">Login: {createdCreds.loginHint}</Text>
            <Text className="text-sm text-text mb-3">Password: {createdCreds.password}</Text>
            <Button
              label="Copy / Share credentials"
              size="sm"
              variant="secondary"
              onPress={() => shareCredentials(createdCreds.loginHint, createdCreds.password)}
            />
          </View>
        ) : null}
      </AdaptiveSheet>

      <AdaptiveSheet
        visible={!!editing}
        onClose={() => setEditing(null)}
        title="Change Role"
        subtitle={editing ? `${editing.name} · ${editing.email}` : undefined}
        size="sm"
        footer={<Button label="Cancel" variant="ghost" onPress={() => setEditing(null)} fullWidth />}
      >
        {assignableRoles.map((r) => (
          <TouchableOpacity
            key={r}
            onPress={() => onSaveRole(r)}
            className={`py-3.5 px-4 rounded-lg mb-2 ${editing?.role === r ? 'bg-primary' : 'bg-surface'}`}
          >
            <Text
              className={`text-base font-semibold ${editing?.role === r ? 'text-white' : 'text-text'}`}
            >
              {ROLE_LABELS[r] ?? r}
            </Text>
          </TouchableOpacity>
        ))}
      </AdaptiveSheet>
    </>
  );
}
