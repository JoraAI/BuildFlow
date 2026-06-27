/**
 * (app) layout — role-aware tab navigator.
 *
 * Tabs shown depend on ROLE_TABS[user.role]:
 *   OWNER:      Dashboard | Projects | Estimation | Planning | Reports | Accounting | Settings
 *   PM:         Dashboard | Projects | Estimation | Planning | Reports | Accounting
 *   SUPERVISOR: Dashboard | Projects | Reports
 *   ACCOUNTANT: Dashboard | Accounting | Reports
 */
import React from 'react';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, View, Text, useWindowDimensions } from 'react-native';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { useAuthStore } from '@/stores/auth.store';
import { ROLE_TABS } from '@/constants';

const TAB_CONFIG: Record<
  string,
  { label: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  dashboard: { label: 'Home', icon: 'grid-outline' },
  projects: { label: 'Projects', icon: 'business-outline' },
  estimation: { label: 'Estimation', icon: 'calculator-outline' },
  planning: { label: 'Planning', icon: 'calendar-outline' },
  reports: { label: 'Reports', icon: 'document-text-outline' },
  accounting: { label: 'Accounts', icon: 'cash-outline' },
  settings: { label: 'Settings', icon: 'settings-outline' },
  chat: { label: 'Assistant', icon: 'chatbubble-ellipses-outline' },
  notifications: { label: 'Alerts', icon: 'notifications-outline' },
};

/** Tabs shown to every role, regardless of ROLE_TABS. */
const UNIVERSAL_TABS = ['chat', 'notifications'] as const;

export default function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isWebWide = Platform.OS === 'web' && width >= 768;

  if (!user) return null; // Safety — root layout guards this.

  const allowedTabs = [...(ROLE_TABS[user.role] ?? ['dashboard']), ...UNIVERSAL_TABS];

  // Determine active tab from the top-level path segment.
  const activeSegment = pathname.split('/').filter(Boolean)[0] ?? 'dashboard';

  return (
    <>
      <OfflineBanner />
      <View style={{ flex: 1, flexDirection: isWebWide ? 'row' : 'column' }}>
        {isWebWide && (
          <View style={{ width: 220, backgroundColor: '#1E3A5F' }}>
            {allowedTabs.map((tabName) => {
              const config = TAB_CONFIG[tabName];
              const isActive = activeSegment === tabName;
              return (
                <Pressable
                  key={tabName}
                  onPress={() => router.push('/' + tabName)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderLeftWidth: isActive ? 4 : 0,
                    borderLeftColor: '#F59E0B',
                    backgroundColor: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                  }}
                >
                  <Ionicons name={config.icon} size={20} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', marginLeft: 12, fontSize: 14, fontWeight: '600' }}>
                    {config.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={{ flex: 1 }}>
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarActiveTintColor: '#1E3A5F',
              tabBarInactiveTintColor: '#64748B',
              // Hide the bottom tab bar on wide web (sidebar is used instead).
              tabBarStyle: isWebWide
                ? { display: 'none' }
                : {
                    backgroundColor: '#FFFFFF',
                    borderTopColor: '#E2E8F0',
                    paddingBottom: 4,
                    height: 56,
                  },
              tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
            }}
          >
            {allowedTabs.map((tabName) => {
              const config = TAB_CONFIG[tabName];
              return (
                <Tabs.Screen
                  key={tabName}
                  name={tabName}
                  options={{
                    title: config.label,
                    tabBarIcon: ({ color, size }) => (
                      <Ionicons name={config.icon} size={size} color={color} />
                    ),
                  }}
                />
              );
            })}
          </Tabs>
        </View>
      </View>
    </>
  );
}
