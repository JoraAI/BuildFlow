import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Avatar, Badge, CompanyLogo, Button } from '@/components/ui';

export type SettingsIconName = keyof typeof Ionicons.glyphMap;

export type SettingsLinkItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: SettingsIconName;
  ownerOnly?: boolean;
};

export type SettingsGroup = {
  id: string;
  title: string;
  subtitle?: string;
  icon: SettingsIconName;
  accent: 'primary' | 'accent' | 'success' | 'warning';
  items: SettingsLinkItem[];
};

const ACCENT_ICON_BG: Record<SettingsGroup['accent'], string> = {
  primary: 'bg-primary/10',
  accent: 'bg-accent/20',
  success: 'bg-success/10',
  warning: 'bg-warning/10',
};

const ACCENT_ICON_COLOR: Record<SettingsGroup['accent'], string> = {
  primary: '#1E3A5F',
  accent: '#B8860B',
  success: '#059669',
  warning: '#D97706',
};

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  PM: 'Project Manager',
  ENGINEER: 'Site Engineer',
  ACCOUNTANT: 'Accountant',
  WORKER: 'Worker',
};

export function formatRoleLabel(role?: string | null): string {
  if (!role) return '';
  return ROLE_LABELS[role] ?? role.replace(/_/g, ' ');
}

export function SettingsLinkRow({
  label,
  description,
  icon,
  accent = 'primary',
  onPress,
  isLast = false,
}: {
  label: string;
  description: string;
  icon: SettingsIconName;
  accent?: SettingsGroup['accent'];
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-3 py-3.5 active:opacity-80 ${isLast ? '' : 'border-b border-border'}`}
      accessibilityRole="button"
    >
      <View className={`w-10 h-10 rounded-xl items-center justify-center shrink-0 ${ACCENT_ICON_BG[accent]}`}>
        <Ionicons name={icon} size={20} color={ACCENT_ICON_COLOR[accent]} />
      </View>
      <View className="flex-1 min-w-0">
        <Text className="text-base font-semibold text-text">{label}</Text>
        <Text className="text-xs text-muted mt-0.5" numberOfLines={2}>
          {description}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
    </Pressable>
  );
}

export function SettingsGroupCard({
  title,
  subtitle,
  icon,
  accent,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  icon: SettingsIconName;
  accent: SettingsGroup['accent'];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`h-full ${className}`}>
      <View className="flex-row items-start gap-3 mb-3 pb-3 border-b border-border">
        <View className={`w-9 h-9 rounded-lg items-center justify-center shrink-0 ${ACCENT_ICON_BG[accent]}`}>
          <Ionicons name={icon} size={18} color={ACCENT_ICON_COLOR[accent]} />
        </View>
        <View className="flex-1 min-w-0">
          <Text className="text-base font-bold text-text">{title}</Text>
          {subtitle ? <Text className="text-xs text-muted mt-0.5">{subtitle}</Text> : null}
        </View>
      </View>
      {children}
    </Card>
  );
}

export function SettingsMobileRow({
  label,
  description,
  onPress,
  isLast = false,
}: {
  label: string;
  description?: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable onPress={onPress} className="active:opacity-80">
      <View
        className={`flex-row items-center justify-between py-3.5 ${isLast ? '' : 'border-b border-border'}`}
      >
        <View className="flex-1 mr-3">
          <Text className="text-base text-text font-medium">{label}</Text>
          {description ? <Text className="text-xs text-muted mt-0.5">{description}</Text> : null}
        </View>
        <Text className="text-primary text-xl">›</Text>
      </View>
    </Pressable>
  );
}

export function SettingsMobileSection({
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

export function SettingsMobileProfileCard({
  name,
  email,
  phone,
  role,
  companyName,
  logoUrl,
}: {
  name: string;
  email: string;
  phone?: string | null;
  role?: string | null;
  companyName: string;
  logoUrl?: string | null;
}) {
  return (
    <Card className="mb-4">
      <View className="flex-row items-center mb-4">
        <CompanyLogo name={companyName} logoUrl={logoUrl} size={48} />
        <View className="mx-3">
          <Avatar name={name} size={48} />
        </View>
        <View className="flex-1">
          <Text className="text-lg font-bold text-text">{name}</Text>
          <Text className="text-sm text-muted">{email}</Text>
          <View className="mt-1">
            {role ? <Badge label={formatRoleLabel(role)} color="primary" /> : null}
          </View>
        </View>
      </View>
      <Text className="text-sm font-medium text-text">{companyName}</Text>
      {phone ? <Text className="text-xs text-muted mt-0.5">{phone}</Text> : null}
    </Card>
  );
}

export function SettingsProfileHero({
  name,
  email,
  phone,
  role,
  companyName,
  logoUrl,
  compact = false,
  onEditProfile,
  onSignOut,
}: {
  name: string;
  email: string;
  phone?: string | null;
  role?: string | null;
  companyName: string;
  logoUrl?: string | null;
  compact?: boolean;
  onEditProfile: () => void;
  onSignOut: () => void;
}) {
  const avatarSize = compact ? 56 : 64;

  return (
    <Card className="overflow-hidden p-0">
      <View className="h-16 bg-primary" />
      <View className={`${compact ? 'px-4 pb-4' : 'px-5 pb-5'} -mt-8`}>
        <View className="flex-row items-end gap-3">
          <View className="rounded-2xl border-4 border-card bg-card overflow-hidden">
            <Avatar name={name} size={avatarSize} />
          </View>
          <View className="mb-1">
            <CompanyLogo name={companyName} logoUrl={logoUrl} size={compact ? 40 : 44} />
          </View>
        </View>

        <Text className={`font-bold text-text mt-4 ${compact ? 'text-lg' : 'text-xl'}`}>{name}</Text>
        <Text className="text-sm text-muted mt-0.5">{email}</Text>
        {phone ? <Text className="text-xs text-muted mt-1">{phone}</Text> : null}

        <View className="flex-row flex-wrap items-center gap-2 mt-3">
          {role ? <Badge label={formatRoleLabel(role)} color="primary" /> : null}
          <Badge label={companyName} color="neutral" />
        </View>

        <View className={`gap-2 ${compact ? 'mt-4' : 'mt-5'}`}>
          <Button
            label="Edit profile"
            variant="secondary"
            size="sm"
            fullWidth
            onPress={onEditProfile}
            icon={<Ionicons name="create-outline" size={16} color="#1E3A5F" />}
          />
          <Button
            label="Sign out"
            variant="ghost"
            size="sm"
            fullWidth
            onPress={onSignOut}
            icon={<Ionicons name="log-out-outline" size={16} color="#DC2626" />}
            className="border border-danger/20"
          />
        </View>
      </View>
    </Card>
  );
}

export function SettingsVersionFooter({ className = '' }: { className?: string }) {
  return (
    <Text className={`text-xs text-muted ${className}`}>BuildFlow v2.0.0 · by Jora AI</Text>
  );
}
