/**
 * BuildFlow Platform — admin login.
 */
import React, { useState } from 'react';
import { View, Text, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Input, Button, Card } from '@/components/ui';
import { usePlatformStore } from '@/stores/platform.store';

export default function PlatformLoginScreen() {
  const router = useRouter();
  const login = usePlatformStore((s) => s.login);
  const [email, setEmail] = useState('admin@buildflow.com');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace('/platform' as never);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center px-6"
      >
        <View className="max-w-md w-full self-center">
          <Text className="text-3xl font-bold text-text mb-1">BuildFlow Platform</Text>
          <Text className="text-muted mb-8">Internal admin console</Text>
          <Card>
            <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
            <View className="h-4" />
            <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry />
            {error ? <Text className="text-danger text-sm mt-2">{error}</Text> : null}
            <View className="h-4" />
            <Button label={loading ? 'Signing in...' : 'Sign in'} onPress={onSubmit} disabled={loading} fullWidth />
          </Card>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
