/**
 * Auditor desk — GST pack inbox + multi-shop switcher.
 */
import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/auth.store';
import { useAuditorInbox, type GstPackSummary } from '@/services/auditor.queries';
import { useViewport } from '@/hooks/useViewport';
import { Badge, Button, toast } from '@/components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';

function statusBadge(status: string): 'primary' | 'warning' | 'success' | 'neutral' {
  if (status === 'SENT') return 'primary';
  if (status === 'IN_PROGRESS') return 'warning';
  if (status === 'FILED') return 'success';
  return 'neutral';
}

function shopMeta(m: {
  inventoryVertical: string | null;
  inventoryProfile: string | null;
  openPackCount?: number;
}) {
  const bits = [
    m.inventoryVertical?.replace(/_/g, ' '),
    m.inventoryProfile,
    m.openPackCount ? `${m.openPackCount} open` : null,
  ].filter(Boolean);
  return bits.join(' · ');
}

export default function AuditorInboxScreen() {
  const user = useAuthStore((s) => s.user);
  const switchCompany = useAuthStore((s) => s.switchCompany);
  const { isDesktop, isPhone } = useViewport();
  const inbox = useAuditorInbox();
  const [switching, setSwitching] = useState(false);
  const memberships = user?.auditorMemberships ?? [];
  const pad = isDesktop ? 28 : 16;

  const onSwitch = async (companyId: string) => {
    if (companyId === user?.companyId) return;
    setSwitching(true);
    try {
      await switchCompany(companyId);
      toast.success('Switched shop');
      await inbox.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not switch shop');
    } finally {
      setSwitching(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: pad, paddingBottom: 48, maxWidth: 1100, width: '100%', alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={inbox.isFetching} onRefresh={() => inbox.refetch()} />}
      >
        <View className={isDesktop ? 'flex-row items-end justify-between mb-6 gap-4' : 'mb-5'}>
          <View className="flex-1 min-w-0">
            <Text className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">
              Auditor
            </Text>
            <Text className="text-2xl font-bold text-text">GST handoff desk</Text>
            <Text className="text-sm text-muted mt-1" numberOfLines={2}>
              Review packs sent by shop owners. Switch shops when you audit more than one business.
            </Text>
          </View>
          {!isPhone ? (
            <Button
              label="Sign out"
              variant="ghost"
              size="sm"
              onPress={() => useAuthStore.getState().logout()}
            />
          ) : null}
        </View>

        {memberships.length > 0 ? (
          <View className="mb-6">
            <Text className="text-xs font-semibold text-muted mb-2">
              {memberships.length > 1 ? 'Shops' : 'Shop'}
            </Text>
            <ScrollView
              horizontal={memberships.length > 1}
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0 }}
              contentContainerStyle={{ gap: 8, flexDirection: 'row', flexWrap: isDesktop ? 'wrap' : 'nowrap' }}
            >
              {memberships.map((m) => {
                const active = m.companyId === user?.companyId;
                return (
                  <Pressable
                    key={m.companyId}
                    disabled={switching || active}
                    onPress={() => onSwitch(m.companyId)}
                    className={`min-w-[160px] max-w-[240px] px-3.5 py-3 rounded-xl border ${
                      active ? 'bg-primary border-primary' : 'bg-card border-border'
                    }`}
                  >
                    <Text
                      className={`text-sm font-semibold ${active ? 'text-white' : 'text-text'}`}
                      numberOfLines={1}
                    >
                      {m.companyName}
                    </Text>
                    {shopMeta(m) ? (
                      <Text
                        className={`text-[11px] mt-0.5 ${active ? 'text-white/80' : 'text-muted'}`}
                        numberOfLines={1}
                      >
                        {shopMeta(m)}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-base font-bold text-text">Packs</Text>
          <Text className="text-xs text-muted">
            {(inbox.data ?? []).length} for {user?.companyName ?? 'this shop'}
          </Text>
        </View>

        {(inbox.data ?? []).length === 0 ? (
          <View className="bg-card border border-border rounded-2xl px-5 py-10 items-center">
            <Text className="text-base font-semibold text-text mb-1">No packs yet</Text>
            <Text className="text-sm text-muted text-center max-w-md">
              When the owner creates and sends a GST period pack, it will appear here for review and filing.
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {(inbox.data ?? []).map((pack: GstPackSummary) => (
              <Pressable
                key={pack.id}
                onPress={() => router.push(`/inventory/auditor/${pack.id}`)}
                className="bg-card border border-border rounded-2xl px-4 py-4 active:opacity-90"
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1 min-w-0">
                    <Text className="text-lg font-bold text-text" numberOfLines={1}>
                      {pack.label}
                    </Text>
                    <Text className="text-sm text-muted mt-1">
                      {pack.periodStart} → {pack.periodEnd}
                    </Text>
                    {pack.sentAt ? (
                      <Text className="text-[11px] text-muted mt-1">
                        Sent {new Date(pack.sentAt).toLocaleString('en-IN')}
                      </Text>
                    ) : null}
                  </View>
                  <Badge label={pack.status.replace('_', ' ')} color={statusBadge(pack.status)} />
                </View>
                <Text className="text-xs font-semibold text-primary mt-3">Open pack →</Text>
              </Pressable>
            ))}
          </View>
        )}

        {isPhone ? (
          <View className="mt-8">
            <Button
              label="Sign out"
              variant="secondary"
              onPress={() => useAuthStore.getState().logout()}
              fullWidth
            />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
