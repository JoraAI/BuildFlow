/**
 * Login screen - email/mobile + OTP only.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Button, Input } from '@/components/ui';
import { AuthScreenShell } from '@/components/auth/AuthScreenShell';
import { SmsConsentCheckbox } from '@/components/auth/SmsConsentCheckbox';
import { useAuthStore } from '@/stores/auth.store';
import { useViewport } from '@/hooks/useViewport';
import { ApiError } from '@/lib/api-client';
import { OTP_DIGITS } from '@buildflow/shared';
import { sendLoginOtpRequest } from '@/services/auth.queries';
import { homeHrefForProduct, isProductMismatch } from '@/utils/product-home';
import {
  appDisplayName,
  getAppVariant,
  otherProductAppName,
} from '@/constants/app-variant';

function looksLikePhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && !value.includes('@');
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const { isDesktop } = useViewport();
  const variant = getAppVariant();
  const heroSubline =
    variant === 'inventory'
      ? 'Sign in with your Inventory workspace account.'
      : variant === 'construction'
        ? 'Sign in with your Construction ERP account.'
        : 'Sign in to Construction ERP or Inventory - stock profiles, warehouses, sales & GST.';
  const productsBlurb =
    variant === 'inventory'
      ? `This install is ${appDisplayName()}. Construction ERP accounts need the ${otherProductAppName()} app.`
      : variant === 'construction'
        ? `This install is ${appDisplayName()}. Inventory accounts need the ${otherProductAppName()} app.`
        : 'Construction ERP for projects & estimates. Inventory for stock businesses - retail, wholesale, distribution, trading, material supply, equipment, or general - with warehouses, sales, and GST.';

  const handleSendOtp = async () => {
    setError('');
    if (!email.trim()) {
      setError('Enter email or mobile to receive an OTP');
      return;
    }
    if (looksLikePhone(email) && !smsConsent) {
      setError('Please agree to receive SMS authentication codes before sending OTP');
      return;
    }
    setSendingOtp(true);
    try {
      const res = await sendLoginOtpRequest(email.trim());
      setOtp('');
      setOtpSent(true);
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

  const onIdentifierChange = (value: string) => {
    setEmail(value);
    if (otpSent || otp || otpHint) {
      setOtp('');
      setOtpHint(null);
      setOtpSent(false);
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
      router.replace(isProductMismatch(productMode) ? '/' : homeHrefForProduct(productMode));
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const signInButton = (
    <Button
      label="Sign In"
      onPress={handleLogin}
      loading={loading}
      disabled={otp.trim().length !== OTP_DIGITS}
      fullWidth
    />
  );

  return (
    <AuthScreenShell
      heroHeadline="Welcome back"
      heroSubline={heroSubline}
      backHref="/"
      formTitle="Sign in"
      formSubtitle="Phone and laptop use the same mobile number. We text the OTP to that number. Construction accounts that signed up with email can enter that email instead."
      footer={
        isDesktop ? (
          <>
            {otpSent ? signInButton : null}
            <Text className="text-center text-xs text-muted mt-4">
              BuildFlow v2.0 - Built for the field, designed for the boardroom.
            </Text>
          </>
        ) : undefined
      }
    >
      <Input
        label="Mobile number"
        value={email}
        onChangeText={onIdentifierChange}
        placeholder="9876543210"
        keyboardType="default"
        autoCapitalize="none"
        autoComplete="off"
        helper={
          email.includes('@')
            ? 'This will email a code. If you signed in on the phone with a mobile number, type that same 10-digit number here to get an SMS.'
            : 'Same number you used on the phone. Tick the SMS box, then send the code.'
        }
      />

      {looksLikePhone(email) ? (
        <SmsConsentCheckbox checked={smsConsent} onCheckedChange={setSmsConsent} />
      ) : null}

      <View className="h-3" />

      <Button
        label={sendingOtp ? 'Sending…' : 'Send OTP'}
        variant="secondary"
        onPress={handleSendOtp}
        loading={sendingOtp}
        fullWidth
      />

      {otpSent ? (
        <>
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
      ) : null}

      {error ? (
        <View className="bg-danger/10 rounded-lg px-3 py-2 mt-4 border border-danger/20">
          <Text className="text-danger text-sm">{error}</Text>
        </View>
      ) : null}

      {otpSent && !isDesktop ? (
        <>
          <View className="h-4" />
          {signInButton}
        </>
      ) : null}

      <TouchableOpacity onPress={() => router.push('/signup')} className="mt-6 self-center">
        <Text className="text-muted text-sm">
          Don&apos;t have an account?{' '}
          <Text className="text-primary font-semibold">Sign up</Text>
        </Text>
      </TouchableOpacity>

      <View className="mt-6 rounded-lg border border-border bg-surface px-3 py-3">
        <Text className="text-[11px] font-semibold text-text mb-1">
          {variant === 'web' ? 'Products' : 'This app'}
        </Text>
        <Text className="text-[11px] text-muted leading-relaxed">
          {productsBlurb}
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
