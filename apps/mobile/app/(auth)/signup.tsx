/**
 * Sign up hub - start trial or join with invite.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthScreenShell } from '@/components/auth/AuthScreenShell';
import { Card } from '@/components/ui';
import { FreeTrialBadge } from '@/components/marketing/FreeTrialBadge';
import { StartFreeTrialButton } from '@/components/marketing/StartFreeTrialButton';
import { TRIAL_BENEFITS } from '@/constants/marketing';

export default function SignupHubScreen() {
  const router = useRouter();

  return (
    <AuthScreenShell
      heroHeadline="Get started with BuildFlow"
      heroSubline="Register your company or join your team with an invite."
      backHref="/"
      formTitle="Sign up"
      formSubtitle="Choose how you want to join BuildFlow"
    >
      <Card className="border-2 border-accent overflow-hidden p-0 mb-4">
        <View className="flex-row items-center justify-between px-4 py-2.5 bg-accent/10 border-b border-accent/20">
          <View className="flex-row items-center gap-2">
            <Ionicons name="star" size={14} color="#B45309" />
            <Text className="text-xs font-bold text-primary uppercase tracking-wide">
              Recommended for new companies
            </Text>
          </View>
          <FreeTrialBadge compact />
        </View>
        <View className="p-4">
          <View className="flex-row items-start gap-3 mb-4">
            <View className="w-12 h-12 rounded-xl bg-primary items-center justify-center">
              <Ionicons name="business" size={24} color="#F59E0B" />
            </View>
            <View className="flex-1 min-w-0">
              <Text className="text-lg font-bold text-text mb-1">Start your free trial</Text>
              <Text className="text-sm text-muted leading-relaxed">
                Register your construction company and create the owner account in minutes.
              </Text>
            </View>
          </View>
          {TRIAL_BENEFITS.map((benefit) => (
            <View key={benefit} className="flex-row items-center gap-2 mb-1.5 ml-1">
              <Ionicons name="checkmark-circle" size={15} color="#10B981" />
              <Text className="text-sm text-text flex-1">{benefit}</Text>
            </View>
          ))}
          <View className="mt-5">
            <StartFreeTrialButton
              fullWidth
              size="md"
              onPress={() => router.push('/signup/company')}
            />
          </View>
        </View>
      </Card>

      <SignupOption
        icon="mail-outline"
        title="Join with invite"
        description="Your company owner sent you a link. Accept the invite to create your account."
        onPress={() => router.push('/signup/invite')}
      />

      <Pressable onPress={() => router.push('/login')} className="mt-8 self-center">
        <Text className="text-primary text-sm font-semibold">
          Already have an account? Sign in
        </Text>
      </Pressable>
    </AuthScreenShell>
  );
}

function SignupOption({
  icon,
  title,
  description,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="active:opacity-90">
      <Card>
        <View className="flex-row items-start gap-3">
          <View className="w-11 h-11 rounded-xl bg-primary/10 items-center justify-center">
            <Ionicons name={icon} size={22} color="#1E3A5F" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-bold text-text mb-1">{title}</Text>
            <Text className="text-sm text-muted leading-relaxed">{description}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
        </View>
      </Card>
    </Pressable>
  );
}
