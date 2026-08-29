import React from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useViewport } from '@/hooks/useViewport';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { FormScreenHeader } from '@/components/layout/ScreenHeader';
import { NavBackButton } from '@/components/layout/NavBackButton';
import { mobileListBottomPadding } from '@/components/layout/fab-layout';
import { goBackToSettings } from '@/utils/navigation';

/**
 * Shared layout for Settings index and nested settings pages.
 * Desktop + mobile: consistent NavBackButton via FormScreenHeader / PageHeader actions.
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
  showBack = true,
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
  /** Set false on settings hub only (hub uses its own layout). */
  showBack?: boolean;
}) {
  const { isDesktop } = useViewport();
  const contentMax = maxWidth === 'narrow' && isDesktop ? 'max-w-3xl w-full self-center' : '';
  const handleBack = onBack ?? goBackToSettings;
  const backControl = showBack ? (
    <NavBackButton onPress={handleBack} label={backLabel} size="sm" />
  ) : null;

  if (isDesktop) {
    return (
      <SafeAreaView className="flex-1 bg-surface" edges={[]}>
        <ScreenContainer scrollable constrained>
          <PageHeader
            title={title}
            subtitle={subtitle}
            onBack={showBack ? handleBack : undefined}
            backLabel={backLabel}
            actions={actions}
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
        showBack={showBack}
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
