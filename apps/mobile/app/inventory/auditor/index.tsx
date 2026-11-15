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
  const pad = isDesktop ? 28 : 16;
  const packCount = (inbox.data ?? []).length;

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      {/* Fixed chrome — never scrolls under content */}
      <View
        className="border-b border-border bg-surface shrink-0"
        style={{ zIndex: 20, elevation: 4, paddingHorizontal: pad, paddingTop: 12, paddingBottom: 14 }}
      >
        <View
          className={
            isDesktop
              ? 'flex-row items-start justify-between gap-6 max-w-[1100px] w-full self-center'
              : 'gap-3'
          }
        >
          <View className="flex-1 min-w-0 gap-1">
            <View className="flex-row items-center gap-2 mb-1">
              <BuildFlowMark size={28} />
              <Text className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Auditor desk
              </Text>
            </View>
            <Text className={`font-bold text-text ${isPhone ? 'text-xl' : 'text-2xl'}`}>
              GST handoff
            </Text>
            <Text className="text-sm text-muted" numberOfLines={isPhone ? 2 : 3}>
              Review packs owners send for filing. Use the shop control to move between businesses.
            </Text>
          </View>

          <View className={isDesktop ? 'w-[320px] shrink-0 gap-2' : 'gap-2'}>
            <AuditorShopSwitcher onSwitched={() => inbox.refetch()} />
            {!isPhone ? (
              <Button
                label="Sign out"
                variant="ghost"
                size="sm"
                onPress={() => useAuthStore.getState().logout()}
              />
            ) : null}
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1 bg-surface"
        contentContainerStyle={{
          padding: pad,
          paddingBottom: 48,
          maxWidth: 1100,
          width: '100%',
          alignSelf: 'center',
        }}
        refreshControl={
          <RefreshControl refreshing={inbox.isFetching} onRefresh={() => inbox.refetch()} />
        }
      >
        <View className="flex-row items-center justify-between mb-3 gap-2">
          <View className="flex-1 min-w-0">
            <Text className="text-base font-bold text-text">Packs</Text>
            <Text className="text-xs text-muted mt-0.5" numberOfLines={1}>
              {packCount} for {user?.companyName ?? 'this shop'}
              {memberships.length > 1 ? ` · ${memberships.length} shops linked` : ''}
            </Text>
          </View>
        </View>

        {packCount === 0 ? (
          <View className="bg-card border border-border rounded-2xl px-5 py-10 items-center">
            <Text className="text-base font-semibold text-text mb-1">No packs yet</Text>
            <Text className="text-sm text-muted text-center max-w-md">
              When the owner creates and sends a GST period pack for this shop, it will appear here.
              {memberships.length > 1
                ? ' Try switching shops above if you audit more than one business.'
                : ''}
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {(inbox.data ?? []).map((pack: GstPackSummary) => (
              <Pressable
                key={pack.id}
                onPress={() => router.push(`/inventory/auditor/${pack.id}`)}
                className="bg-card border border-border rounded-2xl px-4 py-4 active:opacity-90"
                accessibilityRole="button"
                accessibilityLabel={`Open pack ${pack.label}`}
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
