/**
 * Visible SMS consent control for Twilio A2P / carrier review.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

type Props = {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
};

export function SmsConsentCheckbox({ checked, onCheckedChange }: Props) {
  return (
    <View className="mt-3 rounded-lg border border-border bg-surface px-3 py-3">
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={() => onCheckedChange(!checked)}
        className="flex-row items-start gap-3"
      >
        <View
          className={`mt-0.5 h-5 w-5 rounded border items-center justify-center ${
            checked ? 'bg-primary border-primary' : 'border-border bg-background'
          }`}
        >
          {checked ? <Text className="text-white text-xs font-bold">✓</Text> : null}
        </View>
        <View className="flex-1">
          <Text className="text-xs text-text leading-relaxed">
            I agree to receive transactional SMS one-time passcodes from StaffingPros / Jora AI
            (BuildFlow) for account login and invite verification. Msg frequency varies. Msg & data
            rates may apply. Reply STOP to opt out; reply HELP for help.
          </Text>
          <Text className="text-xs text-muted leading-relaxed mt-2">
            See{' '}
            <Text className="text-primary font-semibold" onPress={() => router.push('/privacy')}>
              Privacy Policy
            </Text>
            {' · '}
            <Text className="text-primary font-semibold" onPress={() => router.push('/terms')}>
              Terms
            </Text>
            {' · '}
            <Text className="text-primary font-semibold" onPress={() => router.push('/sms-opt-in')}>
              SMS opt-in
            </Text>
            .
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
