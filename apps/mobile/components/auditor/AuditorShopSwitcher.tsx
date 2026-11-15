/**
 * Auditor multi-shop switcher — select when 2+ shops, static chip when one.
 */
import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/stores/auth.store';
import { Select, toast } from '@/components/ui';
import { CompanyLogo } from '@/components/ui/Avatar';

function shopSubtitle(m: {
  inventoryVertical: string | null;
  inventoryProfile: string | null;
  openPackCount?: number;
}) {
  return [
    m.inventoryVertical?.replace(/_/g, ' '),
    m.inventoryProfile,
    m.openPackCount ? `${m.openPackCount} open pack${m.openPackCount === 1 ? '' : 's'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function AuditorShopSwitcher({
  onSwitched,
  compact = false,
}: {
  /** Called after a successful switch (e.g. refetch inbox / leave pack). */
  onSwitched?: () => unknown;
  compact?: boolean;
}) {
  const user = useAuthStore((s) => s.user);
  const switchCompany = useAuthStore((s) => s.switchCompany);
  const memberships = user?.auditorMemberships ?? [];
  const [switching, setSwitching] = useState(false);

  if (!user || user.role !== 'AUDITOR') return null;

  const onSwitch = async (companyId: string | undefined) => {
    if (!companyId || companyId === user.companyId) return;
    setSwitching(true);
    try {
      await switchCompany(companyId);
      toast.success('Switched shop');
      await onSwitched?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not switch shop');
    } finally {
      setSwitching(false);
    }
  };

  if (memberships.length === 0) {
    return (
      <View
        className={`flex-row items-center gap-2 rounded-xl border border-border bg-card ${
          compact ? 'px-2.5 py-1.5' : 'px-3 py-2.5'
        }`}
      >
        <CompanyLogo name={user.companyName} logoUrl={user.companyLogoUrl} size={compact ? 22 : 28} />
        <View className="flex-1 min-w-0">
          <Text className="text-[10px] font-semibold uppercase tracking-wide text-muted">Shop</Text>
          <Text className={`font-semibold text-text ${compact ? 'text-xs' : 'text-sm'}`} numberOfLines={1}>
            {user.companyName}
          </Text>
        </View>
      </View>
    );
  }

  if (memberships.length === 1) {
    const m = memberships[0]!;
    return (
      <View
        className={`flex-row items-center gap-2 rounded-xl border border-border bg-card ${
          compact ? 'px-2.5 py-1.5' : 'px-3 py-2.5'
        }`}
      >
        <CompanyLogo name={m.companyName} logoUrl={user.companyLogoUrl} size={compact ? 22 : 28} />
        <View className="flex-1 min-w-0">
          <Text className="text-[10px] font-semibold uppercase tracking-wide text-muted">Shop</Text>
          <Text className={`font-semibold text-text ${compact ? 'text-xs' : 'text-sm'}`} numberOfLines={1}>
            {m.companyName}
          </Text>
          {shopSubtitle(m) ? (
            <Text className="text-[11px] text-muted" numberOfLines={1}>
              {shopSubtitle(m)}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View className="relative">
      <Select
        label={compact ? undefined : 'Shop'}
        title="Switch shop"
        placeholder="Choose shop"
        searchPlaceholder="Search shops…"
        value={user.companyId}
        compact={compact}
        disabled={switching}
        options={memberships.map((m) => ({
          value: m.companyId,
          title: m.companyName,
          subtitle: shopSubtitle(m) || undefined,
          meta: m.companyId === user.companyId ? 'Current' : undefined,
        }))}
        onChange={(v) => void onSwitch(v)}
      />
      {switching ? (
        <View className="absolute inset-0 items-center justify-center rounded-xl bg-surface/70">
          <ActivityIndicator />
        </View>
      ) : null}
    </View>
  );
}

/** Compact header actions: shop + optional sign-out. */
export function AuditorDeskBar({
  onSwitched,
  showSignOut = false,
}: {
  onSwitched?: () => unknown;
  showSignOut?: boolean;
}) {
  return (
    <View className="gap-2">
      <AuditorShopSwitcher onSwitched={onSwitched} />
      {showSignOut ? (
        <Pressable
          onPress={() => useAuthStore.getState().logout()}
          className="self-start px-2 py-1"
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Text className="text-sm font-semibold text-primary">Sign out</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
