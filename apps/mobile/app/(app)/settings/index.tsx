/**
 * BuildFlow - Settings hub.
 */
import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Card, Avatar, Button, Badge, CompanyLogo } from '@/components/ui';
import { useMyProfile } from '@/services/settings.queries';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { MobileScreenHeader } from '@/components/layout/ScreenHeader';
import { ResponsiveGrid } from '@/components/layout/ResponsiveGrid';
import { useViewport } from '@/hooks/useViewport';
import { useAuthStore } from '@/stores/auth.store';

function SettingRow({
  label,
  description,
  value,
  onPress,
}: {
  label: string;
  description?: string;
  value?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} className="active:opacity-80">
      <View className="flex-row items-center justify-between py-3.5 border-b border-border">
        <View className="flex-1 mr-3">
          <Text className="text-base text-text font-medium">{label}</Text>
          {description ? (
            <Text className="text-xs text-muted mt-0.5">{description}</Text>
          ) : null}
        </View>
        <View className="flex-row items-center shrink-0">
          {value ? <Text className="text-sm text-muted mr-2">{value}</Text> : null}
          {onPress ? <Text className="text-primary text-xl">›</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

function SettingsSection({
  title,
  children,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`mb-4 ${className}`}>
      <Text className="text-base font-bold text-text mb-1">{title}</Text>
      {children}
    </Card>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { isDesktop } = useViewport();
  const isOwner = user?.role === 'OWNER';

  const { data: profile } = useMyProfile();
  const logoUrl = profile?.companyLogoUrl ?? user?.companyLogoUrl ?? null;

  const profileCard = (
    <Card className={isDesktop ? 'mb-0 h-full' : 'mb-4'}>
      <View className="flex-row items-center mb-4">
        <CompanyLogo name={user?.companyName ?? 'C'} logoUrl={logoUrl} size={isDesktop ? 56 : 48} />
        <View className="mx-3">
          <Avatar name={user?.name ?? 'U'} size={isDesktop ? 56 : 48} />
        </View>
        <View className="flex-1">
          <Text className={`font-bold text-text ${isDesktop ? 'text-xl' : 'text-lg'}`}>
            {user?.name}
          </Text>
          <Text className="text-sm text-muted">{user?.email}</Text>
          <View className="mt-1">
            <Badge label={user?.role ?? ''} color="primary" />
          </View>
        </View>
      </View>
      <Text className="text-sm font-medium text-text">{user?.companyName}</Text>
      {user?.phone ? <Text className="text-xs text-muted mt-0.5">{user.phone}</Text> : null}
    </Card>
  );

  const sections = (
    <>
      <SettingsSection title="Account">
        <SettingRow
          label="My Profile"
          description="Name, phone & personal details"
          onPress={() => router.push('/(app)/settings/profile')}
        />
        <SettingRow
          label="Support requests"
          description="Submit or track change requests"
          onPress={() => router.push('/(app)/settings/tickets')}
        />
      </SettingsSection>

      <SettingsSection title="Company">
        <SettingRow
          label="Company Profile"
          description="Name, GSTIN, PAN, address"
          onPress={() => router.push('/(app)/settings/company')}
        />
        {isOwner && (
          <SettingRow
            label="Users & Roles"
            description="Invite team and manage access"
            onPress={() => router.push('/(app)/settings/users')}
          />
        )}
        {isOwner && (
          <SettingRow
            label="Billing & plan"
            description="Trial status and subscription"
            onPress={() => router.push('/(app)/settings/billing')}
          />
        )}
        <SettingRow
          label="Material Prices"
          description="Resource library pricing"
          onPress={() => router.push('/(app)/settings/material-prices')}
        />
        {isOwner && (
          <SettingRow
            label="Rate Regions"
            description="Regional material rate books"
            onPress={() => router.push('/(app)/settings/rate-regions')}
          />
        )}
        <SettingRow
          label="Rate Analysis Library"
          description="BOQ rate templates"
          onPress={() => router.push('/(app)/estimation/rate-analysis?from=settings' as never)}
        />
      </SettingsSection>

      {isOwner && (
        <SettingsSection title="Integrations">
          <SettingRow
            label="Manage Integrations"
            description="Razorpay, Twilio, Tally, Maps"
            onPress={() => router.push('/(app)/settings/integrations')}
          />
        </SettingsSection>
      )}

      <SettingsSection title="General">
        <SettingRow
          label="Notifications"
          description="Alerts and activity"
          onPress={() => router.push('/(app)/notifications')}
        />
        {isOwner && (
          <SettingRow
            label="Audit Log"
            description="Company activity history"
            onPress={() => router.push('/(app)/settings/audit')}
          />
        )}
        {isOwner && (
          <SettingRow
            label="Data Export"
            description="Backup company data"
            onPress={() => router.push('/(app)/settings/export')}
          />
        )}
      </SettingsSection>
    </>
  );

  if (isDesktop) {
    return (
      <SafeAreaView className="flex-1 bg-surface" edges={[]}>
        <ScreenContainer scrollable constrained>
          <PageHeader title="Settings" subtitle="Company, users & preferences" />
          <View className="mb-4">{profileCard}</View>
          <ResponsiveGrid gap={16}>{sections}</ResponsiveGrid>
          <View className="max-w-md mt-4">
            <Button label="Sign Out" variant="danger" onPress={logout} fullWidth />
          </View>
          <Text className="text-xs text-muted mt-6">BuildFlow v2.0.0 - by Jora AI</Text>
        </ScreenContainer>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-6">
        <MobileScreenHeader title="Settings" subtitle="Company, users & preferences" />
        {profileCard}
        {sections}
        <Button label="Sign Out" variant="danger" onPress={logout} fullWidth />
        <Text className="text-center text-xs text-muted mt-6">BuildFlow v2.0.0 - by Jora AI</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
