/**
 * BuildFlow - Settings hub.
 */
import React, { useMemo } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui';
import { useMyProfile } from '@/services/settings.queries';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { PageHeader, StatChip } from '@/components/layout/PageHeader';
import { MobileScreenHeader } from '@/components/layout/ScreenHeader';
import { ResponsiveGrid } from '@/components/layout/ResponsiveGrid';
import { mobileListBottomPadding } from '@/components/layout/fab-layout';
import { useViewport } from '@/hooks/useViewport';
import { useAuthStore } from '@/stores/auth.store';
import {
  SettingsGroupCard,
  SettingsLinkRow,
  SettingsMobileProfileCard,
  SettingsMobileRow,
  SettingsMobileSection,
  SettingsProfileHero,
  SettingsVersionFooter,
  formatRoleLabel,
  type SettingsGroup,
} from '@/components/settings/SettingsHubUI';

const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    id: 'account',
    title: 'Account',
    subtitle: 'Your profile & support',
    icon: 'person-circle-outline',
    accent: 'primary',
    items: [
      {
        id: 'profile',
        label: 'My Profile',
        description: 'Name, phone & personal details',
        href: '/(app)/settings/profile',
        icon: 'person-outline',
      },
      {
        id: 'tickets',
        label: 'Support requests',
        description: 'Submit or track change requests',
        href: '/(app)/settings/tickets',
        icon: 'help-circle-outline',
      },
      {
        id: 'help',
        label: 'How BuildFlow works',
        description: 'Beginner guides and workflow help',
        href: '/(app)/settings/help',
        icon: 'book-outline',
      },
    ],
  },
  {
    id: 'company',
    title: 'Company',
    subtitle: 'Team, billing & catalog',
    icon: 'business-outline',
    accent: 'accent',
    items: [
      {
        id: 'company-profile',
        label: 'Company Profile',
        description: 'Name, GSTIN, PAN, address',
        href: '/(app)/settings/company',
        icon: 'storefront-outline',
      },
      {
        id: 'users',
        label: 'Users & Roles',
        description: 'Invite team and manage access',
        href: '/(app)/settings/users',
        icon: 'people-outline',
        ownerOnly: true,
      },
      {
        id: 'billing',
        label: 'Billing & plan',
        description: 'Trial status and subscription',
        href: '/(app)/settings/billing',
        icon: 'card-outline',
        ownerOnly: true,
      },
      {
        id: 'material-prices',
        label: 'Material Prices',
        description: 'Company-wide resource catalog',
        href: '/(app)/settings/material-prices',
        icon: 'cube-outline',
      },
      {
        id: 'rate-regions',
        label: 'Rate Regions',
        description: 'Regional material rate books',
        href: '/(app)/settings/rate-regions',
        icon: 'map-outline',
        ownerOnly: true,
      },
      {
        id: 'rate-analysis',
        label: 'Rate Analysis Library',
        description: 'BOQ rate templates',
        href: '/(app)/estimation/rate-analysis?from=settings',
        icon: 'analytics-outline',
      },
    ],
  },
  {
    id: 'integrations',
    title: 'Integrations',
    subtitle: 'Payments, SMS & accounting',
    icon: 'extension-puzzle-outline',
    accent: 'success',
    items: [
      {
        id: 'integrations',
        label: 'Manage Integrations',
        description: 'Razorpay, Twilio, Tally, Maps',
        href: '/(app)/settings/integrations',
        icon: 'link-outline',
        ownerOnly: true,
      },
    ],
  },
  {
    id: 'general',
    title: 'General',
    subtitle: 'Alerts, audit & exports',
    icon: 'options-outline',
    accent: 'warning',
    items: [
      {
        id: 'notifications',
        label: 'Notifications',
        description: 'Alerts and activity',
        href: '/(app)/notifications',
        icon: 'notifications-outline',
      },
      {
        id: 'audit',
        label: 'Audit Log',
        description: 'Company activity history',
        href: '/(app)/settings/audit',
        icon: 'shield-checkmark-outline',
        ownerOnly: true,
      },
      {
        id: 'export',
        label: 'Data Export',
        description: 'Backup company data',
        href: '/(app)/settings/export',
        icon: 'download-outline',
        ownerOnly: true,
      },
    ],
  },
];

function useVisibleSettingsGroups(isOwner: boolean) {
  return useMemo(
    () =>
      SETTINGS_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => !item.ownerOnly || isOwner),
      })).filter((group) => group.items.length > 0),
    [isOwner],
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { isDesktop, isWideDesktop } = useViewport();
  const isOwner = user?.role === 'OWNER';

  const { data: profile } = useMyProfile();
  const logoUrl = profile?.companyLogoUrl ?? user?.companyLogoUrl ?? null;
  const groups = useVisibleSettingsGroups(isOwner);

  const navigate = (href: string) => router.push(href as never);

  const profileProps = {
    name: user?.name ?? 'User',
    email: user?.email ?? '',
    phone: user?.phone,
    role: user?.role,
    companyName: user?.companyName ?? 'Company',
    logoUrl,
    onEditProfile: () => navigate('/(app)/settings/profile'),
    onSignOut: logout,
  };

  const desktopSectionCards = groups.map((group) => (
    <SettingsGroupCard
      key={group.id}
      title={group.title}
      subtitle={group.subtitle}
      icon={group.icon}
      accent={group.accent}
    >
      {group.items.map((item, index) => (
        <SettingsLinkRow
          key={item.id}
          label={item.label}
          description={item.description}
          icon={item.icon}
          accent={group.accent}
          onPress={() => navigate(item.href)}
          isLast={index === group.items.length - 1}
        />
      ))}
    </SettingsGroupCard>
  ));

  const mobileSections = groups.map((group) => (
    <SettingsMobileSection key={group.id} title={group.title}>
      {group.items.map((item, index) => (
        <SettingsMobileRow
          key={item.id}
          label={item.label}
          description={item.description}
          onPress={() => navigate(item.href)}
          isLast={index === group.items.length - 1}
        />
      ))}
    </SettingsMobileSection>
  ));

  if (isDesktop) {
    return (
      <SafeAreaView className="flex-1 bg-surface" edges={[]}>
        <ScreenContainer scrollable constrained>
          <PageHeader
            title="Settings"
            subtitle="Manage your account, company, and workspace preferences"
            actions={
              <Button
                label="Edit profile"
                size="sm"
                variant="secondary"
                onPress={profileProps.onEditProfile}
                icon={<Ionicons name="create-outline" size={16} color="#1E3A5F" />}
              />
            }
            stats={
              <>
                <StatChip label="Role" value={formatRoleLabel(user?.role)} accent="primary" />
                <StatChip label="Company" value={user?.companyName ?? '-'} accent="warning" />
              </>
            }
          />

          {isWideDesktop ? (
            <View className="flex-row items-start gap-6">
              <View className="w-80 shrink-0">
                <SettingsProfileHero {...profileProps} />
                <SettingsVersionFooter className="mt-6 text-center" />
              </View>
              <View className="flex-1 min-w-0">
                <ResponsiveGrid gap={16} columns={2}>
                  {desktopSectionCards}
                </ResponsiveGrid>
              </View>
            </View>
          ) : (
            <>
              <View className="mb-6 max-w-md">
                <SettingsProfileHero {...profileProps} compact />
              </View>
              <ResponsiveGrid gap={16} columns={2}>
                {desktopSectionCards}
              </ResponsiveGrid>
              <SettingsVersionFooter className="mt-8" />
            </>
          )}
        </ScreenContainer>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={[]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-6"
        contentContainerStyle={{ paddingBottom: mobileListBottomPadding() }}
        showsVerticalScrollIndicator={false}
      >
        <MobileScreenHeader title="Settings" subtitle="Company, users & preferences" />
        <SettingsMobileProfileCard
          name={profileProps.name}
          email={profileProps.email}
          phone={profileProps.phone}
          role={profileProps.role}
          companyName={profileProps.companyName}
          logoUrl={logoUrl}
        />
        {mobileSections}
        <Button label="Sign Out" variant="danger" onPress={logout} fullWidth />
        <SettingsVersionFooter className="text-center mt-6" />
      </ScrollView>
    </SafeAreaView>
  );
}
