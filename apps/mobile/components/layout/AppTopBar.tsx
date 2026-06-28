import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth.store';
import { useProject } from '@/services/project.queries';
import { getBreadcrumbs, getProjectIdFromPath } from '@/constants/navigation';
import { CompanyLogo } from '@/components/ui/Avatar';
import { ProjectSearchField } from '@/components/layout/ProjectSearchField';

export function AppTopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  const projectId = getProjectIdFromPath(pathname);
  const { data: project } = useProject(projectId ?? '');
  const breadcrumbs = getBreadcrumbs(pathname, project?.name);

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <View
      className="h-16 bg-card border-b border-border px-6 flex-row items-center justify-between shrink-0"
      style={{ zIndex: 100, elevation: 8, overflow: 'visible' }}
    >
      <View className="flex-row items-center gap-4 flex-1 mr-4 min-w-0">
        <Pressable
          onPress={() => router.push('/dashboard' as never)}
          className="flex-row items-center gap-2 shrink-0 active:opacity-80"
        >
          <View className="w-8 h-8 rounded-lg bg-primary items-center justify-center">
            <Ionicons name="construct" size={18} color="#F59E0B" />
          </View>
          <Text className="text-sm font-bold text-text">BuildFlow</Text>
        </Pressable>

        {user?.companyName ? (
          <View className="flex-row items-center bg-surface rounded-lg px-3 py-1.5 border border-border shrink max-w-[200px] gap-2">
            <CompanyLogo name={user.companyName} logoUrl={user.companyLogoUrl} size={28} />
            <View className="flex-1 min-w-0">
              <Text className="text-[10px] text-muted uppercase tracking-wide">Company</Text>
              <Text className="text-sm font-semibold text-text" numberOfLines={1}>
                {user.companyName}
              </Text>
            </View>
          </View>
        ) : null}

        <View className="flex-row items-center gap-2 flex-1 min-w-0">
          {breadcrumbs.slice(1).map((crumb, index) => {
            const isLast = index === breadcrumbs.slice(1).length - 1;
            return (
              <React.Fragment key={`${crumb.label}-${index}`}>
                {index > 0 && <Ionicons name="chevron-forward" size={12} color="#94A3B8" />}
                {crumb.href && !isLast ? (
                  <Pressable onPress={() => router.push(crumb.href as never)}>
                    <Text className="text-sm text-muted hover:text-primary">{crumb.label}</Text>
                  </Pressable>
                ) : (
                  <Text
                    className={`text-sm ${isLast ? 'font-semibold text-text' : 'text-muted'}`}
                    numberOfLines={1}
                  >
                    {crumb.label}
                  </Text>
                )}
              </React.Fragment>
            );
          })}
        </View>
      </View>

      <View className="flex-row items-center gap-3 shrink-0">
        <ProjectSearchField />

        <Text className="text-xs text-muted">{today}</Text>

        <Pressable
          onPress={() => router.push('/notifications' as never)}
          className="w-9 h-9 rounded-lg bg-surface border border-border items-center justify-center active:bg-border/50"
        >
          <Ionicons name="notifications-outline" size={18} color="#1E3A5F" />
        </Pressable>

        {user && (
          <Pressable
            onPress={() => router.push('/settings' as never)}
            className="flex-row items-center gap-2 pl-2 border-l border-border active:opacity-80"
          >
            <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
              <Text className="text-white text-xs font-bold">
                {user.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="max-w-[140px]">
              <Text className="text-sm font-semibold text-text" numberOfLines={1}>
                {user.name}
              </Text>
              <Text className="text-[10px] text-muted" numberOfLines={1}>
                {user.companyName}
              </Text>
            </View>
          </Pressable>
        )}
      </View>
    </View>
  );
}
