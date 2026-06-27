/**
 * Forgot password — Phase 1 stub (shows confirmation message).
 */
import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button, Input } from '@/components/ui';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  return (
    <SafeAreaView className="flex-1 bg-primary">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <View className="flex-1 bg-surface rounded-t-3xl px-6 pt-8">
          <Text className="text-2xl font-bold text-text mb-2">Reset Password</Text>
          <Text className="text-sm text-text-muted mb-6">
            Enter your email and we'll send you a reset link.
          </Text>

          {sent ? (
            <View className="bg-success/10 rounded-lg p-4 mb-4">
              <Text className="text-success text-sm">
                If an account exists for {email}, a reset link has been sent. (Password reset is fully implemented in a later phase.)
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

          <Button label="Send Reset Link" onPress={() => setSent(true)} fullWidth />

          <Button label="Back to Login" variant="ghost" onPress={() => router.back()} fullWidth />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}