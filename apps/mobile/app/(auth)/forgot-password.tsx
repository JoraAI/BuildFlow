/**
 * Forgot password - Phase 1 stub (shows confirmation message).
 */
import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Input } from '@/components/ui';
import { AuthScreenShell } from '@/components/auth/AuthScreenShell';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  return (
    <AuthScreenShell
      heroHeadline="Reset your password"
      heroSubline="We'll send a reset link to your email."
      backHref="/login"
    >
      <Text className="text-2xl font-bold text-text mb-2">Reset Password</Text>
      <Text className="text-sm text-text-muted mb-6">
        Enter your email and we'll send you a reset link.
      </Text>

      {sent ? (
        <View className="bg-success/10 rounded-lg p-4 mb-4">
          <Text className="text-success text-sm">
            If an account exists for {email}, a reset link has been sent. (Password reset is fully
            implemented in a later phase.)
          </Text>
        </View>
      ) : null}

      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@company.com"
        keyboardType="email-address"
      />

      <View className="h-4" />
      <Button label="Send Reset Link" onPress={() => setSent(true)} fullWidth />

      <View className="h-3" />
      <Button label="Back to Login" variant="ghost" onPress={() => router.push('/login')} fullWidth />
    </AuthScreenShell>
  );
}
