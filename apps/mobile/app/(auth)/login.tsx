/**
 * Login screen — email + password, SecureStore JWT persistence.
 * Shows app branding and links to forgot-password.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input } from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';
import { ApiError } from '@/lib/api-client';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);

  const handleLogin = async () => {
    setError('');
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      // Auth store change triggers root layout to swap to (app)
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-primary">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {/* Header / Branding */}
          <View className="px-6 pt-12 pb-8">
            <Text className="text-3xl font-bold text-white">BuildFlow</Text>
            <Text className="text-base text-white/70 mt-1">
              Construction Project Planning & Accounting
            </Text>
          </View>

          {/* Form Card */}
          <View className="flex-1 bg-surface rounded-t-3xl px-6 pt-8 pb-6">
            <Text className="text-2xl font-bold text-text mb-1">Welcome back</Text>
            <Text className="text-sm text-text-muted mb-6">
              Sign in to manage your projects
            </Text>

            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@company.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
            />

            {error ? (
              <View className="bg-danger/10 rounded-lg px-3 py-2 mb-4">
                <Text className="text-danger text-sm">{error}</Text>
              </View>
            ) : null}

            <Button label="Sign In" onPress={handleLogin} loading={loading} fullWidth />

            <TouchableOpacity
              onPress={() => router.push('/(auth)/forgot-password')}
              className="mt-4 self-center"
            >
              <Text className="text-primary text-sm font-semibold">Forgot password?</Text>
            </TouchableOpacity>
          </View>

          <View className="bg-surface px-6 pb-6">
            <Text className="text-center text-xs text-text-muted">
              BuildFlow v2.0 — Built for the field, designed for the boardroom.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}