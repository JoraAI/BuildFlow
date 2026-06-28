/**
 * Sign up hub — start trial or join with invite.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthScreenShell } from '@/components/auth/AuthScreenShell';
import { Card } from '@/components/ui';

export default function SignupHubScreen() {
  const router = useRouter();

  return (
    <AuthScreenShell
      heroHeadline="Get started with BuildFlow"
      heroSubline="Register your company or join your team with an invite."
      backHref="/"
    >
      <Text className="text-2xl font-bold text-text mb-1">Sign up</Text>
      <Text className="text-sm text-muted mb-6">Choose how you want to join BuildFlow</Text>

      <SignupOption
        icon="business-outline"
        title="Start free trial"
        description="Register your construction company and create the owner account."
        onPress={() => router.push('/signup/company')}
      />

      <View className="h-4" />

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
