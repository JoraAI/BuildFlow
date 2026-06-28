/**
 * Company + owner registration (free trial).
 */
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Input, Card } from '@/components/ui';
import { AuthScreenShell } from '@/components/auth/AuthScreenShell';
import { useAuthStore } from '@/stores/auth.store';
import { useViewport } from '@/hooks/useViewport';
import { FreeTrialBadge } from '@/components/marketing/FreeTrialBadge';
import { TRIAL_HERO_BENEFITS } from '@/constants/auth';
import { ApiError } from '@/lib/api-client';
import { fetchAuthConfig } from '@/services/auth.queries';

export default function SignupCompanyScreen() {
  const router = useRouter();
  const registerCompany = useAuthStore((s) => s.registerCompany);
  const { isDesktop } = useViewport();

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    companyName: '',
    gstin: '',
    pan: '',
    state: '',
    address: '',
    ownerName: '',
    ownerEmail: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    fetchAuthConfig()
      .then((c) => setAllowed(c.allowPublicCompanyRegistration))
      .catch(() => setAllowed(true));
  }, []);

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = async () => {
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await registerCompany({
        companyName: form.companyName,
        gstin: form.gstin,
        pan: form.pan,
        state: form.state,
        address: form.address || undefined,
        ownerName: form.ownerName,
        ownerEmail: form.ownerEmail,
        password: form.password,
      });
      router.replace('/dashboard');
    } catch (err) {
      setError((err as ApiError).message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const submitFooter = (
    <Button label="Create account" onPress={onSubmit} loading={loading} fullWidth />
  );

  const companyFields = isDesktop ? (
    <View className="gap-3">
      <View className="flex-row gap-3">
        <View className="flex-1 min-w-0">
          <Input label="Company name" value={form.companyName} onChangeText={(v) => set('companyName', v)} />
        </View>
        <View className="flex-1 min-w-0">
          <Input label="GSTIN" value={form.gstin} onChangeText={(v) => set('gstin', v.toUpperCase())} autoCapitalize="characters" />
        </View>
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1 min-w-0">
          <Input label="PAN" value={form.pan} onChangeText={(v) => set('pan', v.toUpperCase())} autoCapitalize="characters" />
        </View>
        <View className="flex-1 min-w-0">
          <Input label="State" value={form.state} onChangeText={(v) => set('state', v)} />
        </View>
      </View>
      <Input label="Address (optional)" value={form.address} onChangeText={(v) => set('address', v)} multiline />
    </View>
  ) : (
    <View>
      <Input label="Company name" value={form.companyName} onChangeText={(v) => set('companyName', v)} />
      <View className="h-3" />
      <Input label="GSTIN" value={form.gstin} onChangeText={(v) => set('gstin', v.toUpperCase())} autoCapitalize="characters" />
      <View className="h-3" />
      <Input label="PAN" value={form.pan} onChangeText={(v) => set('pan', v.toUpperCase())} autoCapitalize="characters" />
      <View className="h-3" />
      <Input label="State" value={form.state} onChangeText={(v) => set('state', v)} />
      <View className="h-3" />
      <Input label="Address (optional)" value={form.address} onChangeText={(v) => set('address', v)} multiline />
    </View>
  );

  if (allowed === null) {
    return (
      <AuthScreenShell backHref="/" formTitle="Register company">
        <Text className="text-muted">Loading…</Text>
      </AuthScreenShell>
    );
  }

  if (!allowed) {
    return (
      <AuthScreenShell heroHeadline="Contact us to get started" backHref="/" formTitle="Registration unavailable">
        <Text className="text-sm text-muted mb-6 leading-relaxed">
          Public company registration is currently disabled. Please contact our sales team to
          set up your BuildFlow account, or join an existing company with an invite link.
        </Text>
        <Button label="Join with invite" onPress={() => router.push('/signup/invite')} fullWidth />
      </AuthScreenShell>
    );
  }

  return (
    <AuthScreenShell
      heroHeadline="Start your free trial"
      heroSubline="14 days of full access - no credit card required."
      heroBenefits={TRIAL_HERO_BENEFITS}
      backHref="/"
      formWidth="wide"
      formTitle="Register company"
      formSubtitle="Create your company and owner account"
      footer={isDesktop ? submitFooter : undefined}
    >
      <FreeTrialBadge className="mb-5" />

      <Card className="mb-4">
        <Text className="text-sm font-bold text-text mb-3">Company</Text>
        {companyFields}
      </Card>

      <Card className="mb-4">
        <Text className="text-sm font-bold text-text mb-3">Owner account</Text>
        <Input label="Your name" value={form.ownerName} onChangeText={(v) => set('ownerName', v)} />
        <View className="h-3" />
        <Input
          label="Email"
          value={form.ownerEmail}
          onChangeText={(v) => set('ownerEmail', v)}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <View className="h-3" />
        <Input label="Password" value={form.password} onChangeText={(v) => set('password', v)} secureTextEntry />
        <View className="h-3" />
        <Input label="Confirm password" value={form.confirmPassword} onChangeText={(v) => set('confirmPassword', v)} secureTextEntry />
      </Card>

      {error ? (
        <View className="bg-danger/10 rounded-lg px-3 py-2 mb-4 border border-danger/20">
          <Text className="text-danger text-sm">{error}</Text>
        </View>
      ) : null}

      {!isDesktop && submitFooter}
    </AuthScreenShell>
  );
}
