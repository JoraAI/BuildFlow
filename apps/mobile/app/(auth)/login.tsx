/**
 * Login screen - email/mobile + password, or mobile + OTP.
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

type LoginMethod = 'password' | 'otp';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [method, setMethod] = useState<LoginMethod>('password');
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const { isDesktop } = useViewport();

  const looksLikePhone = !email.includes('@') && email.trim().length >= 8;

  const handleSendOtp = async () => {
    setError('');
    if (!looksLikePhone) {
      setError('Enter a mobile number to receive an OTP');
      return;
    }
    setSendingOtp(true);
    try {
      const res = await sendLoginOtpRequest(email.trim());
      setOtpHint(
        res.devCode
          ? `Code sent (dev): ${res.devCode}`
          : `Code sent to ${res.phoneMasked}`,
      );
    } catch (err) {
      setError((err as ApiError).message || 'Could not send OTP');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleLogin = async () => {
    setError('');
    if (!email) {
      setError('Please enter email or mobile');
      return;
    }
    if (method === 'password' && !password) {
      setError('Please enter password');
      return;
    }
    if (method === 'otp') {
      if (!looksLikePhone) {
        setError('OTP login requires a mobile number');
        return;
      }
      if (!otp.trim()) {
        setError('Please enter the OTP');
        return;
      }
    }
    setLoading(true);
    try {
      if (method === 'otp') {
        await login(email, undefined, otp.trim());
      } else {
        await login(email, password);
      }
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
      formSubtitle="Company account for ERP or Inventory (retail, wholesale, trading, materials & more)"
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

      <View className="flex-row gap-2 mt-3 mb-1">
        {(['password', 'otp'] as const).map((m) => (
          <TouchableOpacity
            key={m}
            onPress={() => setMethod(m)}
            className={`flex-1 py-2.5 rounded-lg items-center ${
              method === m ? 'bg-primary' : 'bg-surface'
            }`}
          >
            <Text className={`text-sm font-semibold ${method === m ? 'text-white' : 'text-text'}`}>
              {m === 'password' ? 'Password' : 'OTP'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View className="h-3" />

      {method === 'password' ? (
        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
        />
      ) : (
        <>
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
        </>
      )}

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

      <View className="mt-6 rounded-lg border border-border bg-surface px-3 py-3">
        <Text className="text-[11px] font-semibold text-text mb-1">Products</Text>
        <Text className="text-[11px] text-muted leading-relaxed">
          Construction ERP for projects & estimates. Inventory for stock businesses - retail, wholesale,
          distribution, trading, material supply, equipment, or general - with warehouses, sales, and GST.
        </Text>
        {__DEV__ ? (
          <Text className="text-[11px] text-muted leading-relaxed mt-2">
            Seed demos (password Test@1234): owner@reddyconst.com · owner@hydmaterials.com ·
            owner@cityhardware.com · owner@deccanwholesale.com · owner@southdistro.com ·
            owner@apextrading.com · owner@forgeequip.com · owner@generalstore.com
          </Text>
        ) : null}
      </View>
    </AuthScreenShell>
  );
}
