/**
 * Auth layout wrapper - split desktop / stacked mobile.
 */
import React from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useViewport } from '@/hooks/useViewport';
import { AuthHeroPanel } from '@/components/auth/AuthHeroPanel';
import { AuthFormHeader } from '@/components/auth/AuthFormHeader';
import { NavBackButton } from '@/components/layout/NavBackButton';
import { navigateAuthBack } from '@/utils/navigation';
import type { Ionicons } from '@expo/vector-icons';

type HeroBenefit = { icon: keyof typeof Ionicons.glyphMap; label: string };

export function AuthScreenShell({
  children,
  heroHeadline,
  heroSubline,
  heroBenefits,
  backHref,
  formWidth = 'default',
  formTitle,
  formSubtitle,
  footer,
}: {
  children: React.ReactNode;
  heroHeadline?: string;
  heroSubline?: string;
  heroBenefits?: HeroBenefit[];
  backHref?: string;
  formWidth?: 'default' | 'wide';
  formTitle?: string;
  formSubtitle?: string;
  footer?: React.ReactNode;
}) {
  const { isDesktop } = useViewport();
  const panelWidth = formWidth === 'wide' ? 'w-[640px]' : 'w-[480px]';

  if (isDesktop) {
    return (
      <View className="flex-1 flex-row bg-surface min-h-screen">
        <View className="flex-1 relative min-w-0">
          <AuthHeroPanel
            headline={heroHeadline}
            subline={heroSubline}
            benefits={heroBenefits}
          />
        </View>
        <View className={`${panelWidth} shrink-0 flex-col bg-card border-l border-border max-h-screen`}>
          {backHref ? (
            <AuthFormHeader
              backHref={backHref}
              title={formTitle}
              subtitle={formSubtitle}
            />
          ) : null}
          <ScrollView
            className="flex-1"
            contentContainerClassName="px-8 py-6"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            {children}
          </ScrollView>
          {footer ? (
            <View className="px-8 py-4 border-t border-border bg-card shrink-0">{footer}</View>
          ) : null}
        </View>
      </View>
    );
  }

  const mobileHeader = backHref ? (
    <View className="px-6 pt-2 pb-4 border-b border-border bg-surface">
      <NavBackButton
        onPress={() => navigateAuthBack(backHref)}
        label="Back"
        variant="ghost"
        size="sm"
      />
      {formTitle ? <Text className="text-2xl font-bold text-text mt-3">{formTitle}</Text> : null}
      {formSubtitle ? <Text className="text-sm text-muted mt-1">{formSubtitle}</Text> : null}
    </View>
  ) : null;

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['bottom']}>
      {mobileHeader}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="px-6 py-6"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
        >
          {children}
        </ScrollView>
        {footer ? <View className="px-6 py-4 border-t border-border bg-surface">{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
