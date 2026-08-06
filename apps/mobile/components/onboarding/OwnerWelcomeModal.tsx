import React, { useEffect } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card } from '@/components/ui';
import { useOnboardingStore } from '@/stores/onboarding.store';

export function OwnerWelcomeModal() {
  const router = useRouter();
  const loaded = useOnboardingStore((s) => s.loaded);
  const seen = useOnboardingStore((s) => s.ownerWelcomeSeen);
  const load = useOnboardingStore((s) => s.load);
  const markSeen = useOnboardingStore((s) => s.markOwnerWelcomeSeen);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = loaded && !seen;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => void markSeen()}>
      <View className="flex-1 bg-black/50 items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <View className="flex-row items-center gap-2 mb-3">
            <Ionicons name="rocket-outline" size={24} color="#1E3A5F" />
            <Text className="text-lg font-bold text-text flex-1">Welcome to BuildFlow</Text>
            <Pressable onPress={() => void markSeen()} hitSlop={8}>
              <Ionicons name="close" size={22} color="#64748B" />
            </Pressable>
          </View>
          <Text className="text-sm text-muted leading-5 mb-4">
            Here is a quick path to get started with your construction projects:
          </Text>
          <View className="gap-2 mb-4">
            {[
              'Create or open a project',
              'Build and approve an estimate, then convert to BOQ',
              'Invite your team under Settings → Users',
              'Explore the NH-45 sample project for subcontracts demo',
            ].map((step, i) => (
              <View key={step} className="flex-row gap-2">
                <Text className="text-sm font-bold text-primary">{i + 1}.</Text>
                <Text className="text-sm text-text flex-1">{step}</Text>
              </View>
            ))}
          </View>
          <View className="gap-2">
            <Button
              label="Open setup guide"
              onPress={() => {
                void markSeen();
                router.push('/(app)/settings/help' as never);
              }}
              fullWidth
            />
            <Button label="Got it" variant="secondary" onPress={() => void markSeen()} fullWidth />
          </View>
        </Card>
      </View>
    </Modal>
  );
}
