import React, { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname, useGlobalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  TAB_CONFIG,
  getActiveTabFromPath,
  getMobileOverflowTabs,
  getAppLinksForRole,
  MOBILE_PRIMARY_TABS,
  type TabName,
} from '@/constants/navigation';
import { parseReturnTo } from '@/utils/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useAssistantStore } from '@/stores/assistant.store';

interface AppTabBarProps extends BottomTabBarProps {
  allowedTabs: TabName[];
}

export function AppTabBar({ allowedTabs }: AppTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ returnTo?: string }>();
  const returnTo = parseReturnTo(params.returnTo);
  const user = useAuthStore((s) => s.user);
  const [menuOpen, setMenuOpen] = useState(false);

  const activeTab = getActiveTabFromPath(pathname, returnTo);
  const primaryTabs = MOBILE_PRIMARY_TABS.filter((t) => allowedTabs.includes(t));
  const overflowTabs = user ? getMobileOverflowTabs(user.role) : [];
  const appLinks = user ? getAppLinksForRole(user.role) : [];
  const isOverflowActive =
    overflowTabs.includes(activeTab as TabName) || appLinks.some((l) => l.href === pathname);

  const navigate = (href: string) => {
    setMenuOpen(false);
    if (href === '/chat') {
      useAssistantStore.getState().open();
      return;
    }
    router.push(href as never);
  };

  return (
    <>
      <View
        className="bg-card border-t border-border"
        style={{ paddingBottom: Math.max(insets.bottom, 8) }}
      >
        <View className="flex-row items-stretch px-1 pt-1.5">
          {primaryTabs.map((tabName) => {
            const config = TAB_CONFIG[tabName];
            const isActive = activeTab === tabName;
            return (
              <Pressable
                key={tabName}
                onPress={() => navigate(config.href)}
                className="flex-1 items-center py-2 active:opacity-70"
                accessibilityRole="button"
                accessibilityLabel={config.label}
                accessibilityState={{ selected: isActive }}
              >
                <View
                  className={`w-10 h-7 items-center justify-center rounded-full mb-0.5 ${
                    isActive ? 'bg-primary/10' : ''
                  }`}
                >
                  <Ionicons
                    name={config.icon}
                    size={22}
                    color={isActive ? '#1E3A5F' : '#64748B'}
                  />
                </View>
                <Text
                  className={`text-[10px] font-semibold ${
                    isActive ? 'text-primary' : 'text-muted'
                  }`}
                  numberOfLines={1}
                >
                  {config.label}
                </Text>
                {isActive && (
                  <View className="w-1 h-1 rounded-full bg-accent mt-0.5" />
                )}
              </Pressable>
            );
          })}

          {(overflowTabs.length > 0 || appLinks.length > 0) && (
            <Pressable
              onPress={() => setMenuOpen(true)}
              className="flex-1 items-center py-2 active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel="More"
              accessibilityState={{ selected: isOverflowActive }}
            >
              <View
                className={`w-10 h-7 items-center justify-center rounded-full mb-0.5 ${
                  isOverflowActive ? 'bg-primary/10' : ''
                }`}
              >
                <Ionicons
                  name={isOverflowActive ? 'menu' : 'menu-outline'}
                  size={22}
                  color={isOverflowActive ? '#1E3A5F' : '#64748B'}
                />
              </View>
              <Text
                className={`text-[10px] font-semibold ${
                  isOverflowActive ? 'text-primary' : 'text-muted'
                }`}
              >
                More
              </Text>
              {isOverflowActive && (
                <View className="w-1 h-1 rounded-full bg-accent mt-0.5" />
              )}
            </Pressable>
          )}
        </View>
      </View>

      <Modal
        visible={menuOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/40 justify-end"
          onPress={() => setMenuOpen(false)}
        >
          <Pressable
            className="bg-card rounded-t-2xl border-t border-border"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="items-center pt-3 pb-2">
              <View className="w-10 h-1 rounded-full bg-border" />
            </View>
            <Text className="text-base font-bold text-text px-5 pb-3">More</Text>
            <ScrollView className="max-h-80 px-3">
              {overflowTabs.map((tabName) => {
                const config = TAB_CONFIG[tabName];
                const isActive = activeTab === tabName;
                return (
                  <Pressable
                    key={tabName}
                    onPress={() => navigate(config.href)}
                    className={`flex-row items-center px-4 py-3.5 mb-1 rounded-xl ${
                      isActive ? 'bg-primary/8' : 'active:bg-surface'
                    }`}
                  >
                    <View
                      className={`w-10 h-10 rounded-xl items-center justify-center ${
                        isActive ? 'bg-primary' : 'bg-surface'
                      }`}
                    >
                      <Ionicons
                        name={config.icon}
                        size={20}
                        color={isActive ? '#FFFFFF' : '#1E3A5F'}
                      />
                    </View>
                    <Text
                      className={`ml-3 text-base font-semibold ${
                        isActive ? 'text-primary' : 'text-text'
                      }`}
                    >
                      {config.label}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color="#94A3B8"
                      style={{ marginLeft: 'auto' }}
                    />
                  </Pressable>
                );
              })}
              {appLinks.map((link) => {
                const isActive = pathname.startsWith(link.href);
                return (
                  <Pressable
                    key={link.href}
                    onPress={() => navigate(link.href)}
                    className={`flex-row items-center px-4 py-3.5 mb-1 rounded-xl ${
                      isActive ? 'bg-primary/8' : 'active:bg-surface'
                    }`}
                  >
                    <View
                      className={`w-10 h-10 rounded-xl items-center justify-center ${
                        isActive ? 'bg-primary' : 'bg-surface'
                      }`}
                    >
                      <Ionicons
                        name={link.icon}
                        size={20}
                        color={isActive ? '#FFFFFF' : '#1E3A5F'}
                      />
                    </View>
                    <Text
                      className={`ml-3 text-base font-semibold ${
                        isActive ? 'text-primary' : 'text-text'
                      }`}
                    >
                      {link.label}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color="#94A3B8"
                      style={{ marginLeft: 'auto' }}
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
