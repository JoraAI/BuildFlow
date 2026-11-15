/**
 * Auditor desk — GST pack inbox + multi-shop switcher.
 */
import React from 'react';
import { View, Text, Pressable, ScrollView, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/auth.store';
import { useAuditorInbox, type GstPackSummary } from '@/services/auditor.queries';
import { useViewport } from '@/hooks/useViewport';
import { Badge, Button } from '@/components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuditorShopSwitcher } from '@/components/auditor/AuditorShopSwitcher';
import { BuildFlowMark } from '@/components/brand/BuildFlowMark';

function statusBadge(status: string): 'primary' | 'warning' | 'success' | 'neutral' {
  if (status === 'SENT') return 'primary';
  if (status === 'IN_PROGRESS') return 'warning';
  if (status === 'FILED') return 'success';
  return 'neutral';
}

export default function AuditorInboxScreen() {
  const user = useAuthStore((s) => s.user);
  const { isDesktop, isPhone } = useViewport();
  const inbox = useAuditorInbox();
  const memberships = user?.auditorMemberships ?? [];
  const pad = isDesktop ? 24 : 12;
  const packCount = (inbox.data ?? []).length;

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      {/* Single compact toolbar — maximizes pack list height */}
      <View
        className="border-b border-border bg-surface shrink-0"
        style={{ zIndex: 20, elevation: 3, paddingHorizontal: pad, paddingVertical: 8 }}
      >
        <View
          className={
            isDesktop
              ? 'flex-row items-center justify-between gap-4 max-w-[1100px] w-full self-center'
              : 'gap-2'
          }
        >
          <View className="flex-row items-center gap-2 flex-1 min-w-0">
            <BuildFlowMark size={24} />
            <View className="flex-1 min-w-0">
              <Text className="text-base font-bold text-text" numberOfLines={1}>
                GST handoff
              </Text>
              <Text className="text-[11px] text-muted" numberOfLines={1}>
                {packCount} pack{packCount === 1 ? '' : 's'}
                {user?.companyName ? ` · ${user.companyName}` : ''}
                {memberships.length > 1 ? ` · ${memberships.length} shops` : ''}
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
          <View className={isDesktop ? 'w-[280px] shrink-0' : undefined}>
            <AuditorShopSwitcher compact onSwitched={() => inbox.refetch()} />
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1 bg-surface"
        contentContainerStyle={{
          paddingHorizontal: pad,
          paddingTop: 12,
          paddingBottom: isPhone ? 24 : 32,
          maxWidth: 1100,
          width: '100%',
          alignSelf: 'center',
        }}
        refreshControl={
          <RefreshControl refreshing={inbox.isFetching} onRefresh={() => inbox.refetch()} />
        }
      >
        {packCount === 0 ? (
          <View className="bg-card border border-border rounded-xl px-4 py-8 items-center">
            <Text className="text-base font-semibold text-text mb-1">No packs yet</Text>
            <Text className="text-sm text-muted text-center max-w-md">
              When the owner sends a GST period pack for this shop, it will appear here.
              {memberships.length > 1 ? ' Switch shops above to check another business.' : ''}
            </Text>
          </View>
        ) : (
          <View className="gap-2">
            {(inbox.data ?? []).map((pack: GstPackSummary) => (
              <Pressable
                key={pack.id}
                onPress={() => router.push(`/inventory/auditor/${pack.id}`)}
                className="bg-card border border-border rounded-xl px-3.5 py-3 active:opacity-90"
                accessibilityRole="button"
                accessibilityLabel={`Open pack ${pack.label}`}
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1 min-w-0">
                    <Text className="text-base font-bold text-text" numberOfLines={1}>
                      {pack.label}
                    </Text>
                    <Text className="text-xs text-muted mt-0.5">
                      {pack.periodStart} → {pack.periodEnd}
                      {pack.sentAt
                        ? ` · Sent ${new Date(pack.sentAt).toLocaleDateString('en-IN')}`
                        : ''}
                    </Text>
                  </View>
                  <Badge label={pack.status.replace('_', ' ')} color={statusBadge(pack.status)} />
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {isPhone ? (
          <View className="mt-6">
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
