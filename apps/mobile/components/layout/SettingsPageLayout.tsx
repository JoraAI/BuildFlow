import React from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useViewport } from '@/hooks/useViewport';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { FormScreenHeader } from '@/components/layout/ScreenHeader';
import { goBackToSettings } from '@/utils/navigation';

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
    return (
      <SafeAreaView className="flex-1 bg-surface" edges={[]}>
        <ScreenContainer scrollable constrained>
          <PageHeader title={title} subtitle={subtitle} actions={actions} />
          <View className={contentMax}>{children}</View>
        </ScreenContainer>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
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
