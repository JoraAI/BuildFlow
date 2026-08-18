/**
 * Inventory shell - Settings.
 *
 * Company profile, plan/limits, team invites (OWNER + INVENTORY_MANAGER only),
 * pending invites, and logout. Tally export entry point included.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Modal, Pressable } from 'react-native';
import { Card, Badge, Button, Input, Select, LoadingSkeleton, BusyOverlay, useBusy } from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';
import { useViewport } from '@/hooks/useViewport';
import { useRouter } from 'expo-router';
import {
  useCompany,
  useUpdateCompany,
  useSubscription,
  useUsers,
  usePendingInvites,
  useCreateInvite,
  useRevokeInvite,
  useReportSettings,
  useUpdateReportSettings,
} from '@/services/settings.queries';
import { downloadTallyXml } from '@/services/report-download';
import { toast } from '@/components/ui';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/constants/i18n';
import {
  PLAN_PRICES_INR,
  INVENTORY_PROFILE_OPTIONS,
  INVENTORY_PROFILE_LABELS,
  INVENTORY_VERTICAL_VALUES,
  INVENTORY_VERTICAL_LABELS,
  hasInventoryFeature,
  type InventoryBusinessProfile,
  type SubscriptionPlanKey,
} from '@buildflow/shared';
import { useSetInventoryVertical } from '@/services/settings.queries';
import { useInventoryLanguage } from '@/components/inventory/InventoryLanguageProvider';

export default function InventorySettingsScreen() {
  const { busy, run } = useBusy();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const { translate } = useInventoryLanguage();
  const { data: company } = useCompany();
  const { data: reportSettings } = useReportSettings();
  const { data: subscription } = useSubscription();
  const { data: users } = useUsers();
  const { data: invites } = usePendingInvites();
  const createInvite = useCreateInvite();
  const revokeInvite = useRevokeInvite();
  const updateCompany = useUpdateCompany();
  const updateReportSettings = useUpdateReportSettings();
  /** INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.1): vertical starter catalog. */
  const kiranaEnabled = hasInventoryFeature(
    (user?.subscriptionPlan ?? 'INVENTORY') as SubscriptionPlanKey,
    'kirana_catalog',
  );
  const setInventoryVertical = useSetInventoryVertical();
  const [inviteOpen, setInviteOpen] = useState(false);
  /** INVENTORY_HORIZONTAL_PLATFORM (Phase 0): business profile picker (OWNER). */
  const [profile, setProfile] = useState<string>('GENERAL');
  /** INVENTORY_KIRANA_RETAIL_WHOLESALE (11.1.5b K2): shop vertical picker (OWNER). */
  const [vertical, setVertical] = useState<string>('');
  const [inventoryLanguage, setInventoryLanguage] = useState<SupportedLanguage>('en');
  /** INVENTORY_HORIZONTAL_PLATFORM (Phase 2.5): credit-limit policy (OWNER). */
  const [creditPolicy, setCreditPolicy] = useState<'ALLOW' | 'WARN' | 'BLOCK'>('WARN');
  /** INVENTORY_HORIZONTAL_PLATFORM (Phase 4.4): PO approval thresholds (OWNER). */
  const [poAutoApproveBelow, setPoAutoApproveBelow] = useState('');
  const [poOwnerApproveAbove, setPoOwnerApproveAbove] = useState('');

  useEffect(() => {
    if (company?.inventoryProfile) setProfile(company.inventoryProfile);
  }, [company?.inventoryProfile]);

  useEffect(() => {
    // K2 (11.1.5b): sync the vertical picker with the company state.
    if (company) setVertical(company.inventoryVertical ?? '');
  }, [company?.inventoryVertical]);

  useEffect(() => {
    if (company?.creditLimitPolicy) setCreditPolicy(company.creditLimitPolicy);
  }, [company?.creditLimitPolicy]);

  useEffect(() => {
    const code = reportSettings?.inventoryLanguage;
    if (SUPPORTED_LANGUAGES.some((lang) => lang.code === code)) {
      setInventoryLanguage(code as SupportedLanguage);
    } else {
      setInventoryLanguage('en');
    }
  }, [reportSettings?.inventoryLanguage]);

  useEffect(() => {
    if (company?.poAutoApproveBelow != null) setPoAutoApproveBelow(String(company.poAutoApproveBelow));
    if (company?.poOwnerApproveAbove != null) setPoOwnerApproveAbove(String(company.poOwnerApproveAbove));
  }, [company?.poAutoApproveBelow, company?.poOwnerApproveAbove]);

  const savePoApproval = async () => {
    await run(async () => {
      try {
        const below = poAutoApproveBelow === '' ? 0 : Number(poAutoApproveBelow);
        const above = poOwnerApproveAbove === '' ? 0 : Number(poOwnerApproveAbove);
        if (!Number.isFinite(below) || below < 0 || !Number.isFinite(above) || above < 0) {
          toast.error('Enter valid amounts (₹).');
          return;
        }
        await updateCompany.mutateAsync({ poAutoApproveBelow: below, poOwnerApproveAbove: above });
        toast.success('PO approval thresholds saved');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not save thresholds');
      }
    });
  };

  const saveProfile = async () => {
    await run(async () => {
      try {
        await updateCompany.mutateAsync({ inventoryProfile: profile });
        await refreshUser();
        toast.success('Business profile saved');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not save profile');
      }
    });
  };

  /** OWNER vertical picker; only Kirana currently unlocks a catalog. */
  const saveVertical = async () => {
    await run(async () => {
      try {
        const next = vertical || null;
        await setInventoryVertical.mutateAsync(next);
        await refreshUser();
        toast.success(
          next === 'KIRANA'
            ? 'Kirana vertical enabled - SKU library unlocked'
            : next
              ? `${INVENTORY_VERTICAL_LABELS[next as keyof typeof INVENTORY_VERTICAL_LABELS]} saved`
              : 'Shop vertical cleared',
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not save shop vertical');
      }
    });
  };

  const saveCreditPolicy = async () => {
    await run(async () => {
      try {
        await updateCompany.mutateAsync({ creditLimitPolicy: creditPolicy });
        toast.success('Credit limit policy saved');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not save credit policy');
      }
    });
  };

  const saveInventoryLanguage = async () => {
    await run(async () => {
      try {
        await updateReportSettings.mutateAsync({ inventoryLanguage });
        toast.success(translate('inventory.settings.language.saved', 'Inventory language saved'));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not save inventory language');
      }
    });
  };

  return (
    <View className="flex-1 bg-surface">
      <BusyOverlay visible={busy} title="Saving settings…" />
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Text className="text-2xl font-bold text-text mb-1">
          {translate('inventory.tab.settings', 'Settings')}
        </Text>
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
        {/* Business profile (INVENTORY_HORIZONTAL_PLATFORM Phase 0) */}
        <Card className="p-5 mb-4">
          <Text className="text-base font-bold text-text mb-1">
            {translate('inventory.settings.language.title', 'Language')}
          </Text>
          <Text className="text-xs text-muted mb-3">
            {translate(
              'inventory.settings.language.help',
              'Choose the inventory app language. This affects only the inventory system.',
            )}
          </Text>
          <Select
            label={translate('inventory.settings.language.label', 'App language')}
            value={inventoryLanguage}
            onChange={(v) => v && setInventoryLanguage(v as SupportedLanguage)}
            options={SUPPORTED_LANGUAGES.map((lang) => ({
              title: `${lang.flag} ${lang.label}`,
              value: lang.code,
            }))}
            disabled={user?.role !== 'OWNER'}
          />
          {user?.role === 'OWNER' ? (
            <View className="mt-3">
              <Button
                label={translate('inventory.settings.language.save', 'Save language')}
                variant="secondary"
                size="sm"
                loading={updateReportSettings.isPending}
                onPress={saveInventoryLanguage}
              />
            </View>
          ) : null}
        </Card>
        <Card className="p-5 mb-4">
          <Text className="text-base font-bold text-text mb-1">Business profile</Text>
          <Text className="text-xs text-muted mb-3">
            Tells BuildFlow how to label your items and which features to surface as they roll out.
            Material suppliers keep construction-style wording (“Materials” / “Indent”).
          </Text>
          <Select
            label="Profile"
            value={profile}
            onChange={(v) => v && setProfile(v)}
            options={INVENTORY_PROFILE_OPTIONS.map((o) => ({ title: o.label, value: o.value }))}
            disabled={user?.role !== 'OWNER'}
          />
          <Text className="text-[11px] text-muted mt-1">
            {INVENTORY_PROFILE_LABELS[profile as InventoryBusinessProfile] ?? 'General business'}
          </Text>
          {user?.role === 'OWNER' ? (
            <View className="mt-3">
              <Button
                label="Save profile"
                variant="secondary"
                size="sm"
                loading={updateCompany.isPending}
                onPress={saveProfile}
              />
            </View>
          ) : null}
        </Card>
        {/* Shop vertical - OWNER-only and RETAIL/WHOLESALE-only. Kirana currently
            unlocks a starter catalog; other verticals are classification-only. */}
        {user?.role === 'OWNER' &&
        kiranaEnabled &&
        (company?.inventoryProfile === 'RETAIL' || company?.inventoryProfile === 'WHOLESALE') ? (
          <Card className="p-5 mb-4">
            <Text className="text-base font-bold text-text mb-1">Shop vertical</Text>
            <Text className="text-xs text-muted mb-3">
              What kind of shop do you run? Kirana includes a suggested product library. Other
              verticals use your own item list and do not add any catalog products.
            </Text>
            <Select
              label="Vertical"
              value={vertical}
              onChange={(v) => v != null && setVertical(v)}
              options={[
                { title: 'None', value: '' },
                ...INVENTORY_VERTICAL_VALUES.map((value) => ({
                  title: INVENTORY_VERTICAL_LABELS[value],
                  value,
                })),
              ]}
            />
            <View className="mt-3">
              <Button
                label="Save vertical"
                variant="secondary"
                size="sm"
                loading={setInventoryVertical.isPending}
                onPress={saveVertical}
              />
            </View>
          </Card>
        ) : null}
        {/* Phase 11.5: selective SKU library replaces copying the full pack. */}
        {kiranaEnabled && company?.inventoryVertical === 'KIRANA' ? (
          <Card className="p-5 mb-4">
            <Text className="text-base font-bold text-text mb-1">Kirana products</Text>
            <Text className="text-xs text-muted mb-3">
              Items is your shop’s master list. Add from suggested Indian products or create your
              own item, then receive quantities separately from vendors.
            </Text>
            <Button label="Open items" variant="accent" size="sm" onPress={() => router.push('/inventory/materials' as never)} />
          </Card>
        ) : null}
        {/* Credit limit policy (INVENTORY_HORIZONTAL_PLATFORM Phase 2.5) */}
        <Card className="p-5 mb-4">
          <Text className="text-base font-bold text-text mb-1">Credit limit policy</Text>
          <Text className="text-xs text-muted mb-3">
            When a customer’s open invoices plus a new invoice exceed their credit limit: allow,
            warn (toast), or block the invoice.
          </Text>
          <Select
            label="Policy"
            value={creditPolicy}
            onChange={(v) => v && setCreditPolicy(v as 'ALLOW' | 'WARN' | 'BLOCK')}
            options={[
              { title: 'Allow (no check)', value: 'ALLOW' },
              { title: 'Warn (default)', value: 'WARN' },
              { title: 'Block over-limit invoices', value: 'BLOCK' },
            ]}
            disabled={user?.role !== 'OWNER'}
          />
          {user?.role === 'OWNER' ? (
            <View className="mt-3">
              <Button
                label="Save credit policy"
                variant="secondary"
                size="sm"
                loading={updateCompany.isPending}
                onPress={saveCreditPolicy}
              />
            </View>
          ) : null}
        </Card>
        {/* PO approval thresholds (INVENTORY_HORIZONTAL_PLATFORM Phase 4.4) */}
        <Card className="p-5 mb-4">
          <Text className="text-base font-bold text-text mb-1">Purchase order approvals</Text>
          <Text className="text-xs text-muted mb-3">
            Inventory purchase orders are auto-approved below the first threshold, need a manager's
            approval in the middle band, and only the owner can approve above the second threshold.
            Set both to 0 to keep every PO auto-approved.
          </Text>
          <View className="flex-row flex-wrap gap-3">
            <View className="flex-1 min-w-[140px]">
              <Input
                label="Auto-approve below (₹)"
                value={poAutoApproveBelow}
                onChangeText={setPoAutoApproveBelow}
                keyboardType="numeric"
                placeholder="e.g. 10000"
              />
            </View>
            <View className="flex-1 min-w-[140px]">
              <Input
                label="Owner approval above (₹)"
                value={poOwnerApproveAbove}
                onChangeText={setPoOwnerApproveAbove}
                keyboardType="numeric"
                placeholder="e.g. 100000"
              />
            </View>
          </View>
          {user?.role === 'OWNER' ? (
            <View className="mt-1">
              <Button
                label="Save thresholds"
                variant="secondary"
                size="sm"
                loading={updateCompany.isPending}
                onPress={savePoApproval}
              />
            </View>
          ) : null}
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
                    void run(async () => {
                      try {
                        await revokeInvite.mutateAsync(inv.id);
                        toast.success('Invite revoked');
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : 'Could not revoke invite');
                      }
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
          <Text className="text-xs text-muted mt-1">GSTIN: {company?.gstin ?? '-'}</Text>
          <Text className="text-xs text-muted mt-0.5">State: {company?.state ?? '-'}</Text>
        </Card>


        {/* INVENTORY_HORIZONTAL_PLATFORM (Phase 6): analytics reports entry. */}
        <Card className="p-5 mb-4">
          <Text className="text-sm font-bold text-text mb-1">Reports & analytics</Text>
          <Text className="text-xs text-muted mb-3">
            Dead/slow stock, per-warehouse value, sales margins (revenue − WAC) and last buy price vs
            current WAC.
          </Text>
          <Button label="Open reports" variant="secondary" onPress={() => router.push('/inventory/reports' as never)} />
        </Card>

        <Card className="p-5 mb-6">
          <Text className="text-sm font-bold text-text mb-1">Tally</Text>
          <Text className="text-xs text-muted mb-3">
            Exporting to Tally generates a Tally Prime XML of your sales + purchase vouchers
            against your store ledger. This is the only data export in the inventory product -
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
          await run(async () => {
            await createInvite.mutateAsync({ email, role });
            toast.success('Invite sent');
            setInviteOpen(false);
          });
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

