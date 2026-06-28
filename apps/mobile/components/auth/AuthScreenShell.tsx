/**
 * Auth layout wrapper — split desktop / stacked mobile.
 */
import React from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useViewport } from '@/hooks/useViewport';
import { AuthHeroPanel } from '@/components/auth/AuthHeroPanel';
import { AuthBackBar } from '@/components/auth/AuthBackBar';
import { AuthFormHeader } from '@/components/auth/AuthFormHeader';
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
            {!formTitle && formSubtitle ? (
              <View className="mb-4">{/* title rendered in children */}</View>
            ) : null}
            {children}
          </ScrollView>
          {footer ? (
            <View className="px-8 py-4 border-t border-border bg-card shrink-0">{footer}</View>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      {backHref ? <AuthBackBar backHref={backHref} /> : null}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView contentContainerClassName="px-6 py-8" keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {footer ? <View className="px-6 py-4 border-t border-border bg-surface">{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
