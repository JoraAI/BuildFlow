import React from 'react';
import { View, Text, Pressable, ImageBackground, ScrollView } from 'react-native';
import { useRouter, usePathname, useGlobalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth.store';
import {
  TAB_CONFIG,
  BRAND_IMAGES,
  NAV_GROUPS,
  APP_LINKS,
  getActiveTabFromPath,
  type TabName,
} from '@/constants/navigation';
import { parseReturnTo } from '@/utils/navigation';

interface AppSidebarProps {
  allowedTabs: TabName[];
}

export function AppSidebar({ allowedTabs }: AppSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ returnTo?: string }>();
  const returnTo = parseReturnTo(params.returnTo);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const activeTab = getActiveTabFromPath(pathname, returnTo);
  const allowedSet = new Set<string>(allowedTabs);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <View className="w-[260px] bg-primary shrink-0 border-r border-white/10 self-stretch flex-col min-h-0">
      {/* Brand */}
      <ImageBackground
        source={{ uri: BRAND_IMAGES.sidebarTexture }}
        imageStyle={{ opacity: 0.2 }}
      >
        <View className="px-5 pt-7 pb-5 border-b border-white/10">
          <View className="flex-row items-center gap-3">
            <View className="w-11 h-11 rounded-xl bg-accent items-center justify-center shadow-lg">
              <Ionicons name="construct" size={24} color="#1E3A5F" />
            </View>
            <View className="flex-1">
              <Text className="text-white text-xl font-bold tracking-tight">BuildFlow</Text>
              <Text className="text-white/55 text-[11px] font-medium uppercase tracking-wider">
                Construction ERP
              </Text>
            </View>
          </View>
          {user?.companyName ? (
            <View className="mt-4 bg-white/8 rounded-lg px-3 py-2 border border-white/10">
              <Text className="text-white/50 text-[10px] uppercase tracking-wide">Company</Text>
              <Text className="text-white text-sm font-semibold mt-0.5" numberOfLines={1}>
                {user.companyName}
              </Text>
            </View>
          ) : null}
        </View>
      </ImageBackground>

      {/* Nav groups */}
      <ScrollView className="flex-1 min-h-0 py-4 px-3" showsVerticalScrollIndicator={false}>
        {NAV_GROUPS.map((group) => {
          const groupTabs = group.tabs.filter((t) => allowedSet.has(t));
          const groupLinks = (group.appLinks ?? []).filter((linkName) => {
            const link = APP_LINKS[linkName];
            return user?.role && (link.roles as readonly string[]).includes(user.role);
          });
          if (groupTabs.length === 0 && groupLinks.length === 0) return null;
          return (
            <View key={group.title} className="mb-5">
              <Text className="text-white/40 text-[10px] font-bold uppercase tracking-widest px-3 mb-2">
                {group.title}
              </Text>
              {groupTabs.map((tabName) => {
                const config = TAB_CONFIG[tabName];
                const isActive = activeTab === tabName;
                return (
                  <Pressable
                    key={tabName}
                    onPress={() => router.push(config.href as never)}
                    className={`flex-row items-center px-3 py-2.5 mb-0.5 rounded-xl ${
                      isActive ? 'bg-white/14' : 'active:bg-white/8'
                    }`}
                  >
                    {isActive && (
                      <View className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-accent" />
                    )}
                    <View
                      className={`w-8 h-8 rounded-lg items-center justify-center ${
                        isActive ? 'bg-accent' : 'bg-white/8'
                      }`}
                    >
                      <Ionicons
                        name={config.icon}
                        size={17}
                        color={isActive ? '#1E3A5F' : '#FFFFFF'}
                      />
                    </View>
                    <Text
                      className={`ml-3 text-[13px] font-semibold flex-1 ${
                        isActive ? 'text-white' : 'text-white/70'
                      }`}
                    >
                      {config.label}
                    </Text>
                  </Pressable>
                );
              })}
              {groupLinks.map((linkName) => {
                const link = APP_LINKS[linkName];
                const isActive = activeTab === linkName;
                return (
                  <Pressable
                    key={linkName}
                    onPress={() => router.push(link.href as never)}
                    className={`flex-row items-center px-3 py-2.5 mb-0.5 rounded-xl ${
                      isActive ? 'bg-white/14' : 'active:bg-white/8'
                    }`}
                  >
                    {isActive && (
                      <View className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-accent" />
                    )}
                    <View
                      className={`w-8 h-8 rounded-lg items-center justify-center ${
                        isActive ? 'bg-accent' : 'bg-white/8'
                      }`}
                    >
                      <Ionicons
                        name={link.icon}
                        size={17}
                        color={isActive ? '#1E3A5F' : '#FFFFFF'}
                      />
                    </View>
                    <Text
                      className={`ml-3 text-[13px] font-semibold flex-1 ${
                        isActive ? 'text-white' : 'text-white/70'
                      }`}
                    >
                      {link.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </ScrollView>

      {/* User + logout */}
      {user && (
        <View className="px-3 py-4 border-t border-white/10 shrink-0 mt-auto">
          <View className="flex-row items-center gap-3 px-2 mb-3">
            <View className="w-9 h-9 rounded-full bg-accent/25 border border-accent/40 items-center justify-center">
              <Text className="text-accent text-sm font-bold">
                {user.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-white text-sm font-semibold" numberOfLines={1}>
                {user.name}
              </Text>
              <Text className="text-white/45 text-xs">{user.role.replace('_', ' ')}</Text>
            </View>
          </View>
          <Pressable
            onPress={handleLogout}
            className="flex-row items-center px-3 py-2.5 rounded-xl active:bg-white/8"
          >
            <Ionicons name="log-out-outline" size={18} color="#FFFFFF99" />
            <Text className="ml-3 text-sm font-medium text-white/70">Sign out</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
