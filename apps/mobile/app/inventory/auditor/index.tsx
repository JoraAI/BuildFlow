/**
 * Auditor desk — inbox of GST packs sent by the current shop.
 */
import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/auth.store';
import { useAuditorInbox, type GstPackSummary } from '@/services/auditor.queries';
import { useViewport } from '@/hooks/useViewport';
import { Button, toast } from '@/components/ui';

function statusColor(status: string) {
  if (status === 'SENT') return 'text-primary';
  if (status === 'IN_PROGRESS') return 'text-warning';
  if (status === 'FILED') return 'text-success';
  return 'text-muted';
}

export default function AuditorInboxScreen() {
  const user = useAuthStore((s) => s.user);
  const switchCompany = useAuthStore((s) => s.switchCompany);
  const { isDesktop } = useViewport();
  const inbox = useAuditorInbox();
  const [switching, setSwitching] = useState(false);
  const memberships = user?.auditorMemberships ?? [];

  const onSwitch = async (companyId: string) => {
    if (companyId === user?.companyId) return;
    setSwitching(true);
    try {
      await switchCompany(companyId);
      toast.success('Switched shop');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not switch shop');
    } finally {
      setSwitching(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ padding: isDesktop ? 24 : 16, paddingBottom: 48 }}
      refreshControl={<RefreshControl refreshing={inbox.isFetching} onRefresh={() => inbox.refetch()} />}
    >
      <Text className="text-2xl font-bold text-text">Auditor desk</Text>
      <Text className="text-sm text-muted mt-1 mb-4">
        GST packs sent by {user?.companyName ?? 'this shop'}. Switch shops above when you work for more than one.
      </Text>

      {memberships.length > 1 ? (
        <View className="mb-5">
          <Text className="text-xs font-semibold text-muted mb-2">Your shops</Text>
          <View className={`flex-row flex-wrap gap-2 ${isDesktop ? '' : ''}`}>
            {memberships.map((m) => {
              const active = m.companyId === user?.companyId;
              return (
                <Pressable
                  key={m.companyId}
                  disabled={switching || active}
                  onPress={() => onSwitch(m.companyId)}
                  className={`px-3 py-2 rounded-xl border ${
                    active ? 'bg-primary border-primary' : 'bg-card border-border'
                  }`}
                >
                  <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-text'}`}>
                    {m.companyName}
                  </Text>
                  {m.inventoryVertical ? (
                    <Text className={`text-[10px] ${active ? 'text-white/80' : 'text-muted'}`}>
                      {m.inventoryVertical.replace(/_/g, ' ')}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {(inbox.data ?? []).length === 0 ? (
        <View className="bg-card border border-border rounded-2xl p-5">
          <Text className="text-sm text-muted">
            No packs yet. When the owner sends a GST period, it will show up here.
          </Text>
        </View>
      ) : (
        <View className={isDesktop ? 'flex-row flex-wrap gap-3' : 'gap-3'}>
          {(inbox.data ?? []).map((pack: GstPackSummary) => (
            <Pressable
              key={pack.id}
              onPress={() => router.push(`/inventory/auditor/${pack.id}`)}
              className={`bg-card border border-border rounded-2xl p-4 ${
                isDesktop ? 'w-[48%]' : 'w-full'
              }`}
            >
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-base font-bold text-text">{pack.label}</Text>
                <Text className={`text-xs font-semibold ${statusColor(pack.status)}`}>{pack.status}</Text>
              </View>
              <Text className="text-xs text-muted">
                {pack.periodStart} → {pack.periodEnd}
              </Text>
              {pack.sentAt ? (
                <Text className="text-[11px] text-muted mt-1">
                  Sent {new Date(pack.sentAt).toLocaleString('en-IN')}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}

      <View className="mt-6">
        <Button label="Sign out" variant="secondary" onPress={() => useAuthStore.getState().logout()} />
      </View>
    </ScrollView>
  );
}
