import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { MarketingContent } from '@/components/marketing/MarketingContent';

export function MarketingFooter() {
  const router = useRouter();

  return (
    <View className="w-full bg-primary border-t border-white/10">
      <MarketingContent className="py-10">
        <Text className="text-white text-xl font-bold mb-2">BuildFlow</Text>
        <Text className="text-white/60 text-sm mb-6 max-w-md">
          Construction project planning, estimation, and accounting - built for Indian contractors.
        </Text>
        <View className="flex-row flex-wrap gap-4 mb-6">
          <FooterLink label="About" onPress={() => router.push('/about')} />
          <FooterLink label="Pricing" onPress={() => router.push('/pricing')} />
          <FooterLink label="Login" onPress={() => router.push('/login')} />
          <FooterLink label="Sign Up" onPress={() => router.push('/signup')} />
        </View>
        <Text className="text-white/40 text-xs">BuildFlow v2.0 - by Jora AI</Text>
      </MarketingContent>
    </View>
  );
}

function FooterLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="active:opacity-70">
      <Text className="text-white/80 text-sm font-medium">{label}</Text>
    </Pressable>
  );
}
