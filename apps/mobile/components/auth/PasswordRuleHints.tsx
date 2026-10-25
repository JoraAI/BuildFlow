import React from 'react';
import { Text, View } from 'react-native';
import { isPasswordValid, PASSWORD_RULES } from '@buildflow/shared';

type Props = {
  password: string;
  /** True after the user moves into the confirm-password field. */
  confirmActive: boolean;
};

export function PasswordRuleHints({ password, confirmActive }: Props) {
  if (!password) return null;

  const formatOk = isPasswordValid(password);
  if (confirmActive && formatOk) {
    return (
      <Text className="text-xs text-success mb-3">✓ Password format is valid</Text>
    );
  }

  return (
    <View className="mb-3 gap-1">
      {PASSWORD_RULES.filter((r) => r.id !== 'max' || !r.test(password)).map((rule) => {
        const ok = rule.test(password);
        return (
          <Text key={rule.id} className={`text-xs ${ok ? 'text-success' : 'text-danger'}`}>
            {ok ? '✓' : '•'} {rule.label}
          </Text>
        );
      })}
    </View>
  );
}
