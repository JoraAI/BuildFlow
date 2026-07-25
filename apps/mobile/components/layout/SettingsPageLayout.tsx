import React from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useViewport } from '@/hooks/useViewport';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { FormScreenHeader } from '@/components/layout/ScreenHeader';
import { mobileListBottomPadding } from '@/components/layout/fab-layout';
import { goBackToSettings } from '@/utils/navigation';
import { Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/** Compact back button for desktop PageHeader actions. */
function BackButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-1 px-3 py-1.5 rounded-lg bg-surface border border-border active:opacity-70"
    >
      <Ionicons name="arrow-back" size={16} color="#475569" />
      <Text className="text-sm font-medium text-muted">{label}</Text>
    </Pressable>
  );
}

/**
 * Shared layout for Settings index and nested settings pages.
 * Desktop: centered content, PageHeader (no back - use top bar breadcrumbs).
 * Mobile: FormScreenHeader with reliable back via dismissTo (not router.back).
 */
export function SettingsPageLayout({
  title,
  subtitle,
  onBack,
  backLabel = 'Back',
  actions,
  children,
  refreshing,
  onRefresh,
  maxWidth = 'default',
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  maxWidth?: 'default' | 'narrow';
}) {
  const { isDesktop } = useViewport();
  const contentMax = maxWidth === 'narrow' && isDesktop ? 'max-w-3xl w-full self-center' : '';
  const handleBack = onBack ?? goBackToSettings;

  if (isDesktop) {
    // On desktop, PageHeader doesn't render a back button natively.
    // We prepend one to the actions area when onBack is provided.
    const backButton = onBack ? (
      <BackButton onPress={handleBack} label={backLabel} />
    ) : null;
    return (
      <SafeAreaView className="flex-1 bg-surface" edges={[]}>
        <ScreenContainer scrollable constrained>
          <PageHeader
            title={title}
            subtitle={subtitle}
            actions={
              backButton ? (
                <View className="flex-row items-center gap-2">
                  {backButton}
                  {actions}
                </View>
              ) : (
                actions
              )
            }
          />
          <View className={contentMax}>{children}</View>
        </ScreenContainer>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={[]}>
      <FormScreenHeader
        title={title}
        subtitle={subtitle}
        onCancel={handleBack}
        cancelLabel={backLabel}
        right={actions}
      />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-6"
        contentContainerStyle={{ paddingBottom: mobileListBottomPadding() }}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
