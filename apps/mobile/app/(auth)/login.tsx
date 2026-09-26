/**
 * Login screen - email/mobile + OTP only.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Button, Input } from '@/components/ui';
import { AuthScreenShell } from '@/components/auth/AuthScreenShell';
import { useAuthStore } from '@/stores/auth.store';
import { useViewport } from '@/hooks/useViewport';
import { ApiError } from '@/lib/api-client';
import { sendLoginOtpRequest } from '@/services/auth.queries';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const { isDesktop } = useViewport();

  const handleSendOtp = async () => {
    setError('');
    if (!email.trim()) {
      setError('Enter email or mobile to receive an OTP');
      return;
    }
    setSendingOtp(true);
    try {
      const res = await sendLoginOtpRequest(email.trim());
      setOtpHint(
        res.devCode
          ? `Code sent (dev): ${res.devCode}`
          : `Code sent to ${res.destinationMasked ?? res.phoneMasked}`,
      );
    } catch (err) {
      setError((err as ApiError).message || 'Could not send OTP');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleLogin = async () => {
    setError('');
    if (!email.trim()) {
      setError('Please enter email or mobile');
      return;
    }
    if (!otp.trim()) {
      setError('Please enter the OTP');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), otp.trim());
      const productMode = useAuthStore.getState().user?.productMode;
      router.replace(productMode === 'inventory' ? '/inventory' : '/dashboard');
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const signInButton = (
    <Button label="Sign In" onPress={handleLogin} loading={loading} fullWidth />
  );

  return (
    <AuthScreenShell
      heroHeadline="Welcome back"
      heroSubline="Sign in to Construction ERP or Inventory - stock profiles, warehouses, sales & GST."
      backHref="/"
      formTitle="Sign in"
      formSubtitle="Enter your email or mobile and the OTP we send you"
      footer={
        isDesktop ? (
          <>
            {signInButton}
            <Text className="text-center text-xs text-muted mt-4">
              BuildFlow v2.0 - Built for the field, designed for the boardroom.
            </Text>
          </>
        ) : undefined
      }
    >
      <Input
        label="Email or mobile"
        value={email}
        onChangeText={setEmail}
        placeholder="you@company.com or 9876543210"
        keyboardType="default"
        autoCapitalize="none"
      />

      <View className="h-3" />

      <Button
        label={sendingOtp ? 'Sending…' : 'Send OTP'}
        variant="secondary"
        onPress={handleSendOtp}
        loading={sendingOtp}
        fullWidth
      />
      {otpHint ? <Text className="text-xs text-muted mt-2">{otpHint}</Text> : null}

      <View className="h-3" />

      <Input
        label="OTP"
        value={otp}
        onChangeText={setOtp}
        placeholder="6-digit code"
        keyboardType="number-pad"
        maxLength={6}
      />

      {error ? (
        <View className="bg-danger/10 rounded-lg px-3 py-2 mt-4 border border-danger/20">
          <Text className="text-danger text-sm">{error}</Text>
        </View>
      ) : null}

      {!isDesktop && (
        <>
          <View className="h-4" />
          {signInButton}
        </>
      )}

      <TouchableOpacity onPress={() => router.push('/signup')} className="mt-6 self-center">
        <Text className="text-muted text-sm">
          Don&apos;t have an account?{' '}
          <Text className="text-primary font-semibold">Sign up</Text>
        </Text>
      </TouchableOpacity>

      <View className="mt-6 rounded-lg border border-border bg-surface px-3 py-3">
        <Text className="text-[11px] font-semibold text-text mb-1">Products</Text>
        <Text className="text-[11px] text-muted leading-relaxed">
          Construction ERP for projects & estimates. Inventory for stock businesses - retail, wholesale,
          distribution, trading, material supply, equipment, or general - with warehouses, sales, and GST.
        </Text>
        {__DEV__ ? (
          <Text className="text-[11px] text-muted leading-relaxed mt-2">
            Seed demos (OTP 111111): owner@reddyconst.com · owner@luminalighting.com · owner@hydmaterials.com ·
            owner@cityhardware.com · owner@deccanwholesale.com · owner@southdistro.com ·
            owner@apextrading.com · owner@forgeequip.com · owner@generalstore.com · owner@kirana-demo.com
          </Text>
        ) : null}
      </View>
    </AuthScreenShell>
  );
}
