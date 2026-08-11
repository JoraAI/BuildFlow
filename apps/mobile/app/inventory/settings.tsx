/**
 * Inventory shell - Settings.
 *
 * Company profile, plan/limits, team invites (OWNER + INVENTORY_MANAGER only),
 * pending invites, and logout. Tally export entry point included.
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, Modal, Pressable } from 'react-native';
import { Card, Badge, Button, Input, Select, LoadingSkeleton } from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';
import { useViewport } from '@/hooks/useViewport';
import {
  useCompany,
  useSubscription,
  useUsers,
  usePendingInvites,
  useCreateInvite,
  useRevokeInvite,
} from '@/services/settings.queries';
import { downloadTallyXml } from '@/services/report-download';
import { toast } from '@/components/ui';
import { PLAN_PRICES_INR } from '@buildflow/shared';

export default function InventorySettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { data: company } = useCompany();
  const { data: subscription } = useSubscription();
  const { data: users } = useUsers();
  const { data: invites } = usePendingInvites();
  const createInvite = useCreateInvite();
  const revokeInvite = useRevokeInvite();
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <View className="flex-1 bg-surface">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Text className="text-2xl font-bold text-text mb-1">Settings</Text>
        <Text className="text-sm text-muted mb-4">Inventory account · {user?.companyName}</Text>

        {/* Plan card */}
        <Card className="p-5 mb-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-bold text-text">Plan</Text>
            <Badge
              label={subscription?.plan ?? user?.subscriptionPlan ?? 'INVENTORY'}
              color="success"
            />
          </View>
          <Text className="text-xs text-muted mt-1">
            {subscription?.status ?? 'TRIAL'} · ₹{PLAN_PRICES_INR.INVENTORY}/month (+18% GST) · 14-day
            trial
          </Text>
          <View className="flex-row gap-6 mt-4">
            <View>
              <Text className="text-xs text-muted">Stores</Text>
              <Text className="text-lg font-bold text-primary">
                {subscription?.usage?.projectCount ?? 1} / {subscription?.usage?.maxProjects ?? 1}
              </Text>
            </View>
            <View>
              <Text className="text-xs text-muted">Users</Text>
              <Text className="text-lg font-bold text-primary">
                {subscription?.usage?.userCount ?? 0} / {subscription?.usage?.maxUsers ?? 10}
              </Text>
            </View>
          </View>
        </Card>
        {/* Team */}
        <Card className="p-5 mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-base font-bold text-text">Team</Text>
            <Button label="Invite" variant="accent" size="sm" onPress={() => setInviteOpen(true)} />
          </View>
          {users ? (
            users.map((u: { id: string; name: string; email: string; role: string }) => (
              <View
                key={u.id}
                className="flex-row items-center justify-between py-2 border-b border-border/60"
              >
                <View className="flex-1 min-w-0 mr-2">
                  <Text className="text-sm font-semibold text-text" numberOfLines={1}>
                    {u.name}
                  </Text>
                  <Text className="text-xs text-muted">{u.email}</Text>
                </View>
                <Badge label={String(u.role)} />
              </View>
            ))
          ) : (
            <LoadingSkeleton className="rounded-lg h-10" />
          )}
        </Card>

        {/* Pending invites */}
        <Card className="p-5 mb-4">
          <Text className="text-sm font-bold text-text mt-4 mb-2">Pending invites</Text>
          {invites && invites.length > 0 ? (
            invites.map((inv: { id: string; email: string; role: string }) => (
              <View
                key={inv.id}
                className="flex-row items-center justify-between py-2 border-b border-border/60"
              >
                <View className="flex-1 min-w-0 mr-2">
                  <Text className="text-sm text-text" numberOfLines={1}>
                    {inv.email}
                  </Text>
                  <Text className="text-xs text-muted">{inv.role}</Text>
                </View>
                <Button
                  size="sm"
                  variant="secondary"
                  label="Revoke"
                  onPress={() =>
                    revokeInvite.mutate(inv.id, {
                      onSuccess: () => toast.success('Invite revoked'),
                      onError: (e) => toast.error(e.message),
                    })
                  }
                />
              </View>
            ))
          ) : (
            <Text className="text-sm text-muted">No pending invites.</Text>
          )}
        </Card>

        {/* Company */}
        <Card className="p-5 mb-4">
          <Text className="text-base font-bold text-text mb-2">Company</Text>
          <Text className="text-sm text-text">{company?.name ?? user?.companyName}</Text>
          <Text className="text-xs text-muted mt-1">GSTIN: {company?.gstin ?? '—'}</Text>
          <Text className="text-xs text-muted mt-0.5">State: {company?.state ?? '—'}</Text>
        </Card>


        <Card className="p-5 mb-6">
          <Text className="text-sm font-bold text-text mb-1">Tally</Text>
          <Text className="text-xs text-muted mb-3">
            Exporting to Tally generates a Tally Prime XML of your sales + purchase vouchers
            against your store ledger. This is the only data export in the inventory product —
            it is not a full data backup.
          </Text>
          <Button
            label="Export to Tally (XML)"
            variant="secondary"
            onPress={() => {
              if (user?.defaultProjectId) void downloadTallyXml(user.defaultProjectId);
            }}
          />
        </Card>

        <Button label="Log out" variant="danger" onPress={() => void logout()} fullWidth />
      </ScrollView>

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSubmit={async (email, role) => {
          await createInvite.mutateAsync({ email, role });
          toast.success('Invite sent');
          setInviteOpen(false);
        }}
      />
    </View>
  );
}


function InviteModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (email: string, role: string) => Promise<void>;
}) {
  const { isDesktop } = useViewport();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('INVENTORY_MANAGER');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!email) {
      setError('Enter an email address.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit(email.trim().toLowerCase(), role);
      setEmail('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send invite');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40 items-center justify-center p-4" onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className={`bg-card rounded-2xl w-full ${isDesktop ? 'max-w-lg' : ''}`}
        >
          <View className="px-5 pt-4 pb-3 border-b border-border flex-row items-center justify-between">
            <Text className="text-base font-bold text-text">Invite team member</Text>
            <Pressable onPress={onClose} className="p-1">
              <Text className="text-muted text-xl">×</Text>
            </Pressable>
          </View>
          <View className="p-5">
            <Text className="text-xs text-muted mb-3">
              Inventory accounts can only invite OWNER or INVENTORY_MANAGER roles.
            </Text>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
            />
            <Select
              label="Role"
              value={role}
              onChange={(v) => v && setRole(v)}
              options={[
                { title: 'Inventory Manager', value: 'INVENTORY_MANAGER' },
                { title: 'Owner / MD', value: 'OWNER' },
              ]}
            />
            {error ? <Text className="text-danger text-sm mt-2">{error}</Text> : null}
            <View className="h-4" />
            <Button label="Send invite" onPress={submit} loading={saving} fullWidth />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

