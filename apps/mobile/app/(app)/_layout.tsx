/**
 * (app) layout - role-aware navigation with sidebar (web) + bottom tab bar (mobile).
 */
import React, { useEffect, useRef } from 'react';
import { Redirect, Tabs, usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, ActivityIndicator } from 'react-native';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { AppSidebar } from '@/components/navigation/AppSidebar';
import { AppTabBar } from '@/components/navigation/AppTabBar';
import { AppTopBar } from '@/components/layout/AppTopBar';
import { AppDesktopFooter } from '@/components/layout/AppDesktopFooter';
import { AppMobileHeader } from '@/components/layout/AppMobileHeader';
import { useAuthStore } from '@/stores/auth.store';
import { useViewport } from '@/hooks/useViewport';
import { AssistantFab } from '@/components/navigation/AssistantFab';
import { AssistantOverlay } from '@/components/assistant/AssistantOverlay';
import { useAssistantStore } from '@/stores/assistant.store';
import {
  TAB_CONFIG,
  HIDDEN_TAB_SCREENS,
  OVERLAY_ONLY_TABS,
  getAllowedTabs,
  type TabName,
} from '@/constants/navigation';

const ALL_TAB_NAMES = Object.keys(TAB_CONFIG) as TabName[];
const OVERLAY_ONLY = new Set<string>(OVERLAY_ONLY_TABS);

export default function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { isDesktop } = useViewport();
  const pathname = usePathname();
  const router = useRouter();
  const prevPathRef = useRef(pathname);
  /** Global mobile chrome (logo, company, alerts) on every app screen — not just tab roots. */
  const showMobileHeader = !isDesktop;

  // Close assistant when navigating; /chat in history must not reopen the overlay.
  useEffect(() => {
    const normalized = pathname.replace(/\/$/, '') || '/dashboard';
    if (normalized === '/chat') {
      useAssistantStore.getState().close();
      router.replace('/dashboard');
      prevPathRef.current = '/dashboard';
      return;
    }
    if (prevPathRef.current !== normalized) {
      useAssistantStore.getState().close();
      prevPathRef.current = normalized;
    }
  }, [pathname, router]);

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  if (!user) {
    return (
      <View className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator size="large" color="#1E3A5F" />
      </View>
    );
  }

  const allowedTabs = getAllowedTabs(user.role);
  const allowedSet = new Set<string>(allowedTabs);

  return (
    <View className="flex-1 bg-surface min-h-0">
      <OfflineBanner />
      <View className="flex-1 flex-row min-h-0">
        {isDesktop && <AppSidebar allowedTabs={allowedTabs} />}

        <View className="flex-1 flex-col min-w-0 min-h-0 relative overflow-hidden">
          {isDesktop && <AppTopBar />}
          {showMobileHeader && <AppMobileHeader />}

          <View
            className="flex-1 min-h-0"
            style={{ position: 'relative', overflow: 'hidden', zIndex: 0 }}
          >
            <Tabs
              key={user.role}
              screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: '#1E3A5F',
                tabBarInactiveTintColor: '#64748B',
                tabBarStyle: { display: 'none' },
              }}
              tabBar={
                isDesktop
                  ? () => null
                  : (props) => <AppTabBar {...props} allowedTabs={allowedTabs} />
              }
            >
              {ALL_TAB_NAMES.map((tabName) => {
                const config = TAB_CONFIG[tabName];
                const isAllowed = allowedSet.has(tabName);
                const showInNav = isAllowed && !OVERLAY_ONLY.has(tabName);
                return (
                  <Tabs.Screen
                    key={tabName}
                    name={tabName}
                    options={{
                      title: config.label,
                      href: showInNav ? (config.href as never) : null,
                      tabBarIcon: ({ color, size }) => (
                        <Ionicons name={config.icon} size={size} color={color} />
                      ),
                    }}
                  />
                );
              })}

              {HIDDEN_TAB_SCREENS.map((screenName) => (
                <Tabs.Screen key={screenName} name={screenName} options={{ href: null }} />
              ))}
            </Tabs>
          </View>
          {isDesktop && <AppDesktopFooter />}
          <AssistantFab />
          <AssistantOverlay />
        </View>
      </View>
    </View>
  );
}
