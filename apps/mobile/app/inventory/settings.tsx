/**
 * Inventory shell - Settings.
 *
 * Company profile, plan/limits, team invites (OWNER + INVENTORY_MANAGER only),
 * pending invites, and logout. Tally export entry point included.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Modal, Pressable, Linking } from 'react-native';
import {
  Card,
  Badge,
  Button,
  Input,
  Select,
  LoadingSkeleton,
  BusyOverlay,
  useBusy,
  CompanyLogo,
  toast,
} from '@/components/ui';
import { pickImage } from '@/utils/pick-image';
import { useAuthStore } from '@/stores/auth.store';
import { useViewport } from '@/hooks/useViewport';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useCompany,
  useUpdateCompany,
  useCompanyLogoUpload,
  useCreateSubscriptionCheckout,
  useScheduleSubscriptionInterval,
  useSubscription,
  useUsers,
  usePendingInvites,
  useCreateInvite,
  useRevokeInvite,
  useReportSettings,
  useUpdateReportSettings,
} from '@/services/settings.queries';
import { downloadTallyXml } from '@/services/report-download';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/constants/i18n';
import {
  PLAN_ANNUAL_INR,
  PLAN_PRICES_INR,
  INVENTORY_PROFILE_OPTIONS,
  INVENTORY_PROFILE_LABELS,
  INVENTORY_VERTICAL_VALUES,
  INVENTORY_VERTICAL_LABELS,
  gstinSchema,
  hasInventoryFeature,
  panSchema,
  phoneSchema,
  type InventoryBusinessProfile,
  type SubscriptionPlanKey,
} from '@buildflow/shared';
import { useSetInventoryVertical } from '@/services/settings.queries';
import { useInventoryLanguage } from '@/components/inventory/InventoryLanguageProvider';

export default function InventorySettingsScreen() {
  const { busy, run, clearBusy } = useBusy();
  const router = useRouter();
  const params = useLocalSearchParams<{ paid?: string }>();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const { translate } = useInventoryLanguage();
  const { data: company } = useCompany();
  const { data: reportSettings } = useReportSettings();
  const { data: subscription, refetch: refetchSubscription } = useSubscription();
  const checkout = useCreateSubscriptionCheckout();
  const scheduleInterval = useScheduleSubscriptionInterval();
  const { data: users } = useUsers();
  const { data: invites } = usePendingInvites();
  const createInvite = useCreateInvite();
  const revokeInvite = useRevokeInvite();
  const updateCompany = useUpdateCompany();
  const uploadLogo = useCompanyLogoUpload();
  const updateReportSettings = useUpdateReportSettings();
  const canEditLogo = user?.role === 'OWNER' || user?.role === 'INVENTORY_MANAGER';
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
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [bankBeneficiaryName, setBankBeneficiaryName] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [fssaiLicenceNo, setFssaiLicenceNo] = useState('');
  const [distributorDiscountPct, setDistributorDiscountPct] = useState('20');
  const [customerDiscountPct, setCustomerDiscountPct] = useState('10');

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

  useEffect(() => {
    if (!company) return;
    setGstin(company.gstin ?? '');
    setPan(company.pan ?? '');
  }, [company]);

  useEffect(() => {
    if (params.paid !== '1') return;
    void refetchSubscription();
    void refreshUser();
    toast.success('Payment received. Your plan will activate shortly.');
  }, [params.paid, refetchSubscription, refreshUser]);

  useEffect(() => {
    if (!reportSettings) return;
    setBankAccountNo(reportSettings.bankAccountNo ?? '');
    setBankBeneficiaryName(reportSettings.bankBeneficiaryName ?? '');
    setBankName(reportSettings.bankName ?? '');
    setBankBranch(reportSettings.bankBranch ?? '');
    setBankIfsc(reportSettings.bankIfsc ?? '');
    setCompanyPhone(reportSettings.companyPhone ?? '');
    setCompanyEmail(reportSettings.companyEmail ?? '');
    setFssaiLicenceNo(reportSettings.fssaiLicenceNo ?? '');
    if (reportSettings.distributorDiscountPct != null) {
      setDistributorDiscountPct(String(reportSettings.distributorDiscountPct));
    }
    if (reportSettings.customerDiscountPct != null) {
      setCustomerDiscountPct(String(reportSettings.customerDiscountPct));
    }
  }, [reportSettings]);

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

  /** OWNER vertical picker; GENERAL unlocks product library + batch/expiry. */
  const saveVertical = async () => {
    await run(async () => {
      try {
        const next = vertical || null;
        await setInventoryVertical.mutateAsync(next);
        await refreshUser();
        toast.success(
          next === 'GENERAL'
            ? 'General retail enabled — product library unlocked'
            : next
              ? `${INVENTORY_VERTICAL_LABELS[next as keyof typeof INVENTORY_VERTICAL_LABELS]} saved`
              : 'Shop vertical cleared',
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not save shop vertical');
      }
    });
  };

  const gstLiveError = gstin.trim()
    ? gstinSchema.safeParse(gstin).success
      ? undefined
      : 'Enter a valid 15-character GSTIN'
    : undefined;
  const panLiveError = pan.trim()
    ? panSchema.safeParse(pan).success
      ? undefined
      : 'Enter a valid 10-character PAN'
    : undefined;

  const payInventory = async (interval: 'MONTHLY' | 'YEARLY') => {
    const quote = subscription?.quotes?.[interval];
    if (quote && !quote.requiresPayment) {
      await run(async () => {
        try {
          await scheduleInterval.mutateAsync(interval);
          toast.success(quote.message);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Could not schedule billing change');
        }
      });
      return;
    }
    if (subscription?.billing && !subscription.billing.razorpay) {
      toast.error('Razorpay checkout is not configured yet.');
      return;
    }
    await run(async () => {
      try {
        const result = await checkout.mutateAsync({
          plan: 'INVENTORY',
          gateway: 'razorpay',
          interval,
        });
        if (result.scheduled) {
          toast.success(result.quote?.message ?? 'Monthly billing will start after this period.');
          await refetchSubscription();
          return;
        }
        if (!result.paymentUrl) {
          toast.success(result.quote?.message ?? 'Plan updated');
          await refetchSubscription();
          return;
        }
        if (typeof window !== 'undefined') {
          window.open(result.paymentUrl, '_blank');
        } else {
          const ok = await Linking.canOpenURL(result.paymentUrl);
          if (ok) await Linking.openURL(result.paymentUrl);
          else toast.error('Could not open Razorpay');
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not start Razorpay checkout');
      }
    });
  };

  const saveTaxIds = async () => {
    if (gstLiveError || panLiveError) {
      toast.error('Fix GSTIN / PAN before saving');
      return;
    }
    await run(async () => {
      try {
        await updateCompany.mutateAsync({
          gstin: gstin.trim().toUpperCase(),
          pan: pan.trim().toUpperCase(),
        });
        toast.success('GSTIN and PAN saved');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not save GSTIN / PAN');
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

  const pickAndUploadLogo = async () => {
    // Pick outside `run()` — on web, cancelling the file dialog must not leave
    // BusyOverlay stuck (expo-image-picker never resolves on cancel).
    try {
      const result = await pickImage({ allowsEditing: true, aspect: [1, 1] });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const filename = asset.fileName ?? `company-logo-${Date.now()}.jpg`;
      const contentType = asset.mimeType ?? 'image/jpeg';
      await run(async () => {
        try {
          const logoUrl = await uploadLogo.mutateAsync({
            uri: asset.uri,
            filename,
            contentType,
          });
          await updateCompany.mutateAsync({ logoUrl });
          await refreshUser();
          toast.success('Company logo updated — it will appear on invoices');
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Could not upload logo');
        }
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not open photo library');
    }
  };

  const clearLogo = async () => {
    await run(async () => {
      try {
        await updateCompany.mutateAsync({ logoUrl: null });
        await refreshUser();
        toast.success('Company logo removed');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not remove logo');
      }
    });
  };

  return (
    <View className="flex-1 bg-surface">
      <BusyOverlay visible={busy} title="Saving settings…" onDismiss={clearBusy} />
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
              label={subscription?.status ?? 'TRIAL'}
              color={subscription?.status === 'ACTIVE' ? 'success' : 'warning'}
            />
          </View>
          <Text className="text-xs text-muted mt-1">
            Inventory · ₹{PLAN_PRICES_INR.INVENTORY}/mo or ₹{PLAN_ANNUAL_INR.INVENTORY.toLocaleString('en-IN')}/yr
            (+18% GST)
            {subscription?.status === 'TRIAL' && subscription.daysRemaining != null
              ? ` · ${subscription.daysRemaining} day${subscription.daysRemaining === 1 ? '' : 's'} left in trial`
              : subscription?.status === 'ACTIVE'
                ? ` · ${subscription.billingInterval === 'YEARLY' ? 'yearly' : 'monthly'} until ${
                    subscription.trialEndsAt
                      ? new Date(subscription.trialEndsAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'renewal'
                  }`
                : ' · 14-day trial'}
          </Text>
          {subscription?.pendingBillingInterval === 'MONTHLY' ? (
            <Text className="text-[11px] text-muted mt-2">
              Switches to monthly after this yearly period. Unused yearly time is not refunded.
            </Text>
          ) : null}
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
          {user?.role === 'OWNER' ? (
            <View className="mt-4 gap-3">
              {(['MONTHLY', 'YEARLY'] as const).map((interval) => {
                const quote = subscription?.quotes?.[interval];
                const price =
                  interval === 'YEARLY' ? PLAN_ANNUAL_INR.INVENTORY : PLAN_PRICES_INR.INVENTORY;
                const label = !quote
                  ? interval === 'YEARLY'
                    ? `Pay ₹${price.toLocaleString('en-IN')}/year`
                    : `Pay ₹${price}/month`
                  : quote.mode === 'schedule'
                    ? 'Switch to monthly after this period'
                    : quote.mode === 'extend'
                      ? `Extend ${interval === 'YEARLY' ? 'yearly' : 'monthly'} · ₹${quote.amountInr.toLocaleString('en-IN')}`
                      : `Pay ₹${quote.amountInr.toLocaleString('en-IN')} ${interval === 'YEARLY' ? '/year' : '/month'}`;
                return (
                  <View key={interval}>
                    <Button
                      label={label}
                      variant={interval === 'YEARLY' ? 'accent' : 'secondary'}
                      size="sm"
                      loading={checkout.isPending || scheduleInterval.isPending}
                      onPress={() => void payInventory(interval)}
                    />
                    {quote?.message ? (
                      <Text className="text-[11px] text-muted mt-1">{quote.message}</Text>
                    ) : null}
                  </View>
                );
              })}
              {subscription?.pendingBillingInterval ? (
                <Button
                  label="Keep yearly billing"
                  variant="ghost"
                  size="sm"
                  loading={scheduleInterval.isPending}
                  onPress={() => {
                    void run(async () => {
                      await scheduleInterval.mutateAsync(null);
                      toast.success('Yearly billing kept');
                    });
                  }}
                />
              ) : null}
              <Text className="text-[11px] text-muted">
                Pay BuildFlow on Razorpay. Switching monthly → yearly mid-cycle credits unused days.
                Switching yearly → monthly waits until this period ends.
              </Text>
            </View>
          ) : null}
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
        {/* Shop vertical — OWNER + RETAIL/WHOLESALE. GENERAL = library+FEFO; EVENTS = quote copy. */}
        {user?.role === 'OWNER' && kiranaEnabled ? (
          <Card className="p-5 mb-4">
            <Text className="text-base font-bold text-text mb-1">Shop vertical</Text>
            <Text className="text-xs text-muted mb-3">
              General retail fits grocery, medical, pharmacy, hardware and similar shops — product
              library plus batch/expiry tracking. Events & lighting unlocks event-quote wording.
              Ice cream manufacturer adds recipes, production batches, and Jora Trade (buyer) orders.
              Leave as None to manage your own item list.
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
        {kiranaEnabled && company?.inventoryVertical === 'GENERAL' ? (
          <Card className="p-5 mb-4">
            <Text className="text-base font-bold text-text mb-1">Product library</Text>
            <Text className="text-xs text-muted mb-3">
              Items is your shop’s master list. Add from suggested products or create your
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
            users.map((u: { id: string; name: string; email: string; phone?: string | null; role: string }) => (
              <View
                key={u.id}
                className="flex-row items-center justify-between py-2 border-b border-border/60"
              >
                <View className="flex-1 min-w-0 mr-2">
                  <Text className="text-sm font-semibold text-text" numberOfLines={1}>
                    {u.name}
                  </Text>
                  <Text className="text-xs text-muted">{u.phone || u.email}</Text>
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
            invites.map((inv: { id: string; name?: string | null; email?: string | null; phone?: string | null; role: string }) => (
              <View
                key={inv.id}
                className="flex-row items-center justify-between py-2 border-b border-border/60"
              >
                <View className="flex-1 min-w-0 mr-2">
                  <Text className="text-sm text-text" numberOfLines={1}>
                    {inv.name || inv.phone || inv.email || 'Pending invite'}
                  </Text>
                  <Text className="text-xs text-muted">
                    {[inv.role, inv.phone || inv.email].filter(Boolean).join(' · ')}
                  </Text>
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

        {/* Company + logo (shown top-right on Tax Invoice PDFs) */}
        <Card className="p-5 mb-4">
          <Text className="text-base font-bold text-text mb-2">Company</Text>
          <View className="flex-row items-center gap-4 mb-3">
            <CompanyLogo
              name={company?.name ?? user?.companyName ?? 'Company'}
              logoUrl={company?.logoDisplayUrl ?? null}
              size={80}
            />
            <View className="flex-1 min-w-0">
              <Text className="text-sm text-text" numberOfLines={2}>
                {company?.name ?? user?.companyName}
              </Text>
              <Text className="text-xs text-muted mt-1">State: {company?.state ?? '-'}</Text>
              <Text className="text-[11px] text-muted mt-2">
                Logo appears on the top-right of Tax Invoice PDFs.
              </Text>
            </View>
          </View>
          {canEditLogo ? (
            <View className="flex-row flex-wrap gap-2 mb-4">
              <Button
                label={company?.logoDisplayUrl ? 'Change logo' : 'Upload logo'}
                variant="secondary"
                size="sm"
                loading={uploadLogo.isPending || updateCompany.isPending}
                onPress={() => void pickAndUploadLogo()}
              />
              {company?.logoDisplayUrl || company?.logoUrl ? (
                <Button
                  label="Remove"
                  variant="ghost"
                  size="sm"
                  loading={updateCompany.isPending}
                  onPress={() => void clearLogo()}
                />
              ) : null}
            </View>
          ) : null}
          <Input
            label="GSTIN"
            value={gstin}
            onChangeText={(v) => setGstin(v.toUpperCase())}
            autoCapitalize="characters"
            maxLength={15}
            editable={canEditLogo}
            error={gstLiveError}
            helper="15 characters. Leave blank if you do not have one yet."
          />
          <Input
            label="PAN"
            value={pan}
            onChangeText={(v) => setPan(v.toUpperCase())}
            autoCapitalize="characters"
            maxLength={10}
            editable={canEditLogo}
            error={panLiveError}
            helper="10 characters. Leave blank if you do not have one yet."
          />
          {canEditLogo ? (
            <View className="mt-3">
              <Button
                label="Save GSTIN & PAN"
                variant="secondary"
                size="sm"
                loading={updateCompany.isPending}
                onPress={() => void saveTaxIds()}
              />
            </View>
          ) : null}
        </Card>

        <Card className="p-5 mb-4">
          <Text className="text-base font-bold text-text mb-1">Invoice / bank details</Text>
          <Text className="text-xs text-muted mb-3">
            Shown on Tax Invoice PDFs only when filled. Leave blank to hide that row.
          </Text>
          <Input label="Company phone (optional)" value={companyPhone} onChangeText={setCompanyPhone} />
          <View className="h-2" />
          <Input label="Company email (optional)" value={companyEmail} onChangeText={setCompanyEmail} autoCapitalize="none" />
          <View className="h-2" />
          <Input label="FSSAI licence no (optional)" value={fssaiLicenceNo} onChangeText={setFssaiLicenceNo} />
          <View className="h-2" />
          <Input label="Account no (optional)" value={bankAccountNo} onChangeText={setBankAccountNo} />
          <View className="h-2" />
          <Input label="Beneficiary name (optional)" value={bankBeneficiaryName} onChangeText={setBankBeneficiaryName} />
          <View className="h-2" />
          <Input label="Bank name (optional)" value={bankName} onChangeText={setBankName} />
          <View className="h-2" />
          <Input label="Branch (optional)" value={bankBranch} onChangeText={setBankBranch} />
          <View className="h-2" />
          <Input label="IFSC (optional)" value={bankIfsc} onChangeText={setBankIfsc} autoCapitalize="characters" />
          <View className="mt-3">
            <Button
              label="Save invoice details"
              variant="secondary"
              loading={updateReportSettings.isPending}
              onPress={() => {
                void run(async () => {
                  await updateReportSettings.mutateAsync({
                    bankAccountNo: bankAccountNo.trim() || null,
                    bankBeneficiaryName: bankBeneficiaryName.trim() || null,
                    bankName: bankName.trim() || null,
                    bankBranch: bankBranch.trim() || null,
                    bankIfsc: bankIfsc.trim() || null,
                    companyPhone: companyPhone.trim() || null,
                    companyEmail: companyEmail.trim() || null,
                    fssaiLicenceNo: fssaiLicenceNo.trim() || null,
                  });
                  toast.success('Invoice details saved');
                });
              }}
            />
          </View>
        </Card>

        {(company?.inventoryVertical ?? user?.inventoryVertical) === 'ICE_CREAM' ? (
          <Card className="p-5 mb-4">
            <Text className="text-base font-bold text-text mb-1">B2B trade discounts</Text>
            <Text className="text-xs text-muted mb-3">
              Default % off MRP for buyer app catalog and role-based pricing. Per-party override wins;
              explicit price-list rates win over both.
            </Text>
            <Input
              label="Distributor discount %"
              value={distributorDiscountPct}
              onChangeText={setDistributorDiscountPct}
              keyboardType="decimal-pad"
            />
            <View className="h-2" />
            <Input
              label="Customer discount %"
              value={customerDiscountPct}
              onChangeText={setCustomerDiscountPct}
              keyboardType="decimal-pad"
            />
            {user?.role === 'OWNER' || user?.role === 'INVENTORY_MANAGER' ? (
              <View className="mt-3">
                <Button
                  label="Save trade discounts"
                  variant="secondary"
                  loading={updateReportSettings.isPending}
                  onPress={() => {
                    void run(async () => {
                      const d = Number(distributorDiscountPct);
                      const c = Number(customerDiscountPct);
                      if (!Number.isFinite(d) || d < 0 || d > 100 || !Number.isFinite(c) || c < 0 || c > 100) {
                        toast.error('Enter discount % between 0 and 100');
                        return;
                      }
                      await updateReportSettings.mutateAsync({
                        distributorDiscountPct: d,
                        customerDiscountPct: c,
                      });
                      toast.success('Trade discounts saved');
                    });
                  }}
                />
              </View>
            ) : null}
          </Card>
        ) : null}

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
        onSubmit={async (input) => {
          await run(async () => {
            await createInvite.mutateAsync(input);
            toast.success('Invite ready. They can Sign in with this mobile and OTP to join this shop.');
            setInviteOpen(false);
          });
        }}
      />
    </View>
  );
}


function digitsIndiaMobile(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length > 10) digits = digits.slice(2);
  return digits.slice(0, 10);
}

function InviteModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: { name?: string; phone: string; role: string }) => Promise<void>;
}) {
  const { isDesktop } = useViewport();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('INVENTORY_MANAGER');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) {
      setError('Enter a 10-digit Indian mobile number.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim() || undefined,
        phone: parsed.data,
        role,
      });
      setName('');
      setPhone('');
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
              Invite an owner or inventory manager by mobile. They Sign in with this number and OTP
              and join this shop directly — no email.
            </Text>
            <Input
              label="Name (optional)"
              value={name}
              onChangeText={setName}
              placeholder="Hari Reddy"
            />
            <View className="h-3" />
            <Input
              label="Mobile number"
              value={phone}
              onChangeText={(v) => setPhone(digitsIndiaMobile(v))}
              keyboardType="phone-pad"
              placeholder="9876543210"
              maxLength={10}
              leftIcon={
                <Text className="text-sm font-semibold text-text pr-2 mr-2 border-r border-border">
                  +91
                </Text>
              }
              helper="10-digit Indian mobile number"
            />
            <View className="h-3" />
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

