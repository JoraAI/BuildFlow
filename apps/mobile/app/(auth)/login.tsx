/**
 * Login screen - email/mobile + OTP only.
 * Inventory: Indian mobile (+91) only. Construction / web: mobile or email.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Button, Input } from '@/components/ui';
import { AuthScreenShell } from '@/components/auth/AuthScreenShell';
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

type ContactMethod = 'email' | 'phone';

/** 10-digit Indian mobile, stripping pasted +91 / leading 0. */
function digitsIndiaMobile(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length > 10) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.replace(/^0+/, '');
  return digits.slice(0, 10);
}

function sanitizeEmail(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9.@_+-]/g, '');
}

function sanitizeOtp(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, OTP_DIGITS);
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const { isDesktop } = useViewport();
  const variant = getAppVariant();
  const phoneOnly = variant === 'inventory';
  const [contactMethod, setContactMethod] = useState<ContactMethod>(
    phoneOnly ? 'phone' : 'email',
  );
  const emailMode = !phoneOnly && contactMethod === 'email';
  const canSendOtp = emailMode ? Boolean(email.trim()) : email.length === 10;
  const heroSubline =
    variant === 'inventory'
      ? 'Sign in with your Inventory workspace account.'
      : variant === 'construction'
        ? 'Sign in with your Construction ERP account.'
        : 'Sign in to Construction ERP or Inventory - stock profiles, warehouses, sales & GST.';
  const formSubtitle = phoneOnly
    ? "Enter your mobile number — we'll send a one-time code."
    : "Mobile number or email — we'll send a one-time code.";
  const productsBlurb =
    variant === 'inventory'
      ? `This install is ${appDisplayName()}. Construction ERP accounts need the ${otherProductAppName()} app.`
      : variant === 'construction'
        ? `This install is ${appDisplayName()}. Inventory accounts need the ${otherProductAppName()} app.`
        : 'Construction ERP for projects & estimates. Inventory for stock businesses - retail, wholesale, distribution, trading, material supply, equipment, or general - with warehouses, sales, and GST.';

  const handleSendOtp = async () => {
    setError('');
    if (emailMode) {
      if (!email.trim()) {
        setError('Enter your email to receive an OTP');
        return;
      }
    } else if (email.length !== 10) {
      setError('Enter a valid 10-digit mobile number');
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

  const clearOtpStep = () => {
    if (otpSent || otp || otpHint) {
      setOtp('');
      setOtpHint(null);
      setOtpSent(false);
    }
  };

  const onIdentifierChange = (value: string) => {
    setEmail(emailMode ? sanitizeEmail(value) : digitsIndiaMobile(value));
    clearOtpStep();
  };

  const switchContactMethod = (method: ContactMethod) => {
    if (method === contactMethod) return;
    setContactMethod(method);
    setEmail('');
    setError('');
    clearOtpStep();
  };

  const handleLogin = async () => {
    setError('');
    if (emailMode) {
      if (!email.trim()) {
        setError('Please enter your email');
        return;
      }
    } else if (email.length !== 10) {
      setError('Please enter a valid 10-digit mobile number');
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
      formSubtitle={formSubtitle}
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
      {!phoneOnly ? (
        <View className="flex-row gap-2 mb-3">
          {(['email', 'phone'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => switchContactMethod(m)}
              className={`flex-1 py-2.5 rounded-lg items-center ${
                contactMethod === m ? 'bg-primary' : 'bg-surface'
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  contactMethod === m ? 'text-white' : 'text-text'
                }`}
              >
                {m === 'email' ? 'Email' : 'Mobile'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {emailMode ? (
        <Input
          label="Email"
          value={email}
          onChangeText={onIdentifierChange}
          placeholder="you@company.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
      ) : (
        <Input
          label="Mobile number"
          value={email}
          onChangeText={onIdentifierChange}
          placeholder="9876543210"
          keyboardType="phone-pad"
          autoCapitalize="none"
          autoComplete="tel"
          maxLength={10}
          leftIcon={
            <Text className="text-sm font-semibold text-text pr-2 mr-2 border-r border-border">
              +91
            </Text>
          }
        />
      )}

      <View className="h-3" />

      <Button
        label={sendingOtp ? 'Sending…' : otpSent ? 'Resend OTP' : 'Send OTP'}
        variant="secondary"
        onPress={handleSendOtp}
        loading={sendingOtp}
        disabled={!canSendOtp}
        fullWidth
      />

      {otpSent ? (
        <>
          {otpHint ? <Text className="text-xs text-muted mt-2">{otpHint}</Text> : null}
          <View className="h-3" />
          <Input
            label="OTP"
            value={otp}
            onChangeText={(v) => setOtp(sanitizeOtp(v))}
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
