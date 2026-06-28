/**
 * Login screen — email + password, SecureStore JWT persistence.
 * Desktop: split-panel hero + form. Mobile: stacked layout.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ImageBackground,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input } from '@/components/ui';
import { AuthBackBar } from '@/components/auth/AuthBackBar';
import { useAuthStore } from '@/stores/auth.store';
import { useViewport } from '@/hooks/useViewport';
import { BRAND_IMAGES } from '@/constants/navigation';
import { ApiError } from '@/lib/api-client';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const { isDesktop } = useViewport();

  const handleLogin = async () => {
    setError('');
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      router.replace('/dashboard');
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const form = (
    <>
      <Text className={`font-bold text-text mb-1 ${isDesktop ? 'text-3xl' : 'text-2xl'}`}>
        Welcome back
      </Text>
      <Text className="text-sm text-muted mb-6">Sign in to manage your projects</Text>

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
        <View className="bg-danger/10 rounded-lg px-3 py-2 mb-4 border border-danger/20">
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

      <TouchableOpacity onPress={() => router.push('/signup')} className="mt-6 self-center">
        <Text className="text-muted text-sm">
          Don&apos;t have an account?{' '}
          <Text className="text-primary font-semibold">Sign up</Text>
        </Text>
      </TouchableOpacity>
    </>
  );

  if (isDesktop) {
    return (
      <View className="flex-1 flex-row bg-surface min-h-screen">
        {/* Left hero panel */}
        <View className="flex-1 relative">
          <AuthBackBar backHref="/" />
          <ImageBackground
            source={{ uri: BRAND_IMAGES.loginHero }}
            className="flex-1"
            resizeMode="cover"
          >
          <View className="flex-1 bg-primary/80 px-12 py-16 justify-between">
            <View>
              <View className="flex-row items-center gap-3 mb-10">
                <View className="w-12 h-12 rounded-xl bg-accent items-center justify-center">
                  <Ionicons name="construct" size={26} color="#1E3A5F" />
                </View>
                <View>
                  <Text className="text-white text-2xl font-bold">BuildFlow</Text>
                  <Text className="text-white/60 text-sm">Construction ERP</Text>
                </View>
              </View>
              <Text className="text-white text-4xl font-bold leading-tight max-w-md">
                Plan, estimate, and account — all in one platform.
              </Text>
              <Text className="text-white/70 text-lg mt-4 max-w-sm leading-relaxed">
                Built for contractors who need Tally-grade accounting with modern project
                management.
              </Text>
            </View>
            <View className="flex-row gap-6">
              <FeaturePill icon="calendar-outline" label="CPM Scheduling" />
              <FeaturePill icon="calculator-outline" label="BOQ & Estimation" />
              <FeaturePill icon="cash-outline" label="Integrated Accounting" />
            </View>
          </View>
        </ImageBackground>
        </View>

        {/* Right form panel */}
        <View className="w-[480px] shrink-0 justify-center px-12 py-16 bg-card border-l border-border">
          {form}
          <Text className="text-center text-xs text-muted mt-10">
            BuildFlow v2.0 — Built for the field, designed for the boardroom.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-primary">
      <AuthBackBar backHref="/" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View className="px-6 pt-12 pb-8">
            <Text className="text-3xl font-bold text-white">BuildFlow</Text>
            <Text className="text-base text-white/70 mt-1">
              Construction Project Planning & Accounting
            </Text>
          </View>

          <View className="flex-1 bg-surface rounded-t-3xl px-6 pt-8 pb-6">{form}</View>

          <View className="bg-surface px-6 pb-6">
            <Text className="text-center text-xs text-muted">
              BuildFlow v2.0 — Built for the field, designed for the boardroom.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FeaturePill({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View className="flex-row items-center bg-white/10 rounded-lg px-3 py-2 border border-white/15">
      <Ionicons name={icon} size={16} color="#F59E0B" />
      <Text className="text-white text-sm font-medium ml-2">{label}</Text>
    </View>
  );
}
