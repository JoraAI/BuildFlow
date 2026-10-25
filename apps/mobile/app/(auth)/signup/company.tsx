/**
 * Company + owner registration (free trial).
 * Supports Construction ERP and Inventory (?product=inventory).
 * Owner can register with email or mobile + password.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  emailSchema,
  gstinSchema,
  getPasswordFormatError,
  isPasswordValid,
  panSchema,
  PASSWORD_RULES,
  phoneSchema,
  registerCompanySchema,
} from '@buildflow/shared';
import { Button, Input, Card } from '@/components/ui';
import { AuthScreenShell } from '@/components/auth/AuthScreenShell';
import { useAuthStore } from '@/stores/auth.store';
import { useViewport } from '@/hooks/useViewport';
import { FreeTrialBadge } from '@/components/marketing/FreeTrialBadge';
import { TRIAL_HERO_BENEFITS } from '@/constants/auth';
import { ApiError } from '@/lib/api-client';
import { fetchAuthConfig } from '@/services/auth.queries';
import {
  formatApiErrorMessage,
  formatValidationSummary,
  validationFieldErrors,
} from '@/utils/validation-errors';

type ContactMethod = 'email' | 'phone';
type FormKey =
  | 'companyName'
  | 'gstin'
  | 'pan'
  | 'state'
  | 'address'
  | 'ownerName'
  | 'ownerEmail'
  | 'ownerPhone'
  | 'password'
  | 'confirmPassword';

export default function SignupCompanyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ product?: string }>();
  // INVENTORY_PRODUCT: ?product=inventory → inventory signup path.
  const product: 'inventory' | 'construction' =
    params.product === 'inventory' ? 'inventory' : 'construction';
  const isInventorySignup = product === 'inventory';
  const registerCompany = useAuthStore((s) => s.registerCompany);
  const { isDesktop } = useViewport();

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FormKey | string, string>>>({});
  const [contactMethod, setContactMethod] = useState<ContactMethod>(
    isInventorySignup ? 'phone' : 'email',
  );

  const [form, setForm] = useState({
    companyName: '',
    gstin: '',
    pan: '',
    state: '',
    address: '',
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    fetchAuthConfig()
      .then((c) => setAllowed(c.allowPublicCompanyRegistration))
      .catch(() => setAllowed(true));
  }, []);

  useEffect(() => {
    if (isInventorySignup) setContactMethod('phone');
  }, [isInventorySignup]);

  const set = (key: FormKey, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key] && !prev._form) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const passwordLiveError = form.password ? getPasswordFormatError(form.password) : undefined;
  const confirmLiveError = form.confirmPassword
    ? getPasswordFormatError(form.confirmPassword) ??
      (form.confirmPassword !== form.password ? 'Passwords do not match' : undefined)
    : undefined;
  const phoneLiveError =
    (isInventorySignup || contactMethod === 'phone') && form.ownerPhone
      ? phoneSchema.safeParse(form.ownerPhone).success
        ? undefined
        : 'Enter a valid mobile number'
      : undefined;
  const emailLiveError =
    !isInventorySignup && contactMethod === 'email' && form.ownerEmail
      ? emailSchema.safeParse(form.ownerEmail).success
        ? undefined
        : 'Enter a valid email address'
      : undefined;
  const gstLiveError = form.gstin.trim()
    ? gstinSchema.safeParse(form.gstin).success
      ? undefined
      : 'GSTIN must be 15 characters (e.g. 36AABCR1234A1Z5)'
    : undefined;
  const panLiveError = form.pan.trim()
    ? panSchema.safeParse(form.pan).success
      ? undefined
      : 'PAN must be 10 characters (e.g. AABCR1234A)'
    : undefined;

  const canSubmit = useMemo(() => {
    const companyOk = form.companyName.trim().length >= 2 && form.state.trim().length >= 2;
    const ownerOk = form.ownerName.trim().length >= 2;
    const contactOk = isInventorySignup || contactMethod === 'phone'
      ? phoneSchema.safeParse(form.ownerPhone).success
      : emailSchema.safeParse(form.ownerEmail).success;
    const gstOk = !form.gstin.trim() || gstinSchema.safeParse(form.gstin).success;
    const panOk = !form.pan.trim() || panSchema.safeParse(form.pan).success;
    const passwordOk = isPasswordValid(form.password);
    const confirmOk = form.confirmPassword === form.password && isPasswordValid(form.confirmPassword);
    return companyOk && ownerOk && contactOk && gstOk && panOk && passwordOk && confirmOk;
  }, [form, isInventorySignup, contactMethod]);

  const applyZodIssues = (issues: { path: (string | number)[]; message: string }[]) => {
    const details = issues.map((i) => ({
      field: i.path.map(String).join('.') || undefined,
      message: i.message,
    }));
    setFieldErrors(validationFieldErrors(details));
    setError(formatValidationSummary(details));
  };

  const onSubmit = async () => {
    setError('');
    setFieldErrors({});

    if (!canSubmit) return;

    if (form.password !== form.confirmPassword) {
      setFieldErrors({ confirmPassword: 'Passwords do not match' });
      setError('Confirm password: Passwords do not match');
      return;
    }
    if ((isInventorySignup || contactMethod === 'phone') && !form.ownerPhone.trim()) {
      setFieldErrors({ ownerPhone: 'Enter your mobile number' });
      setError('Mobile number: Enter your mobile number');
      return;
    }
    if (!isInventorySignup && contactMethod === 'email' && !form.ownerEmail.trim()) {
      setFieldErrors({ ownerEmail: 'Enter your email address' });
      setError('Email: Enter your email address');
      return;
    }

    const usePhone = isInventorySignup || contactMethod === 'phone';
    const payload = {
      companyName: form.companyName,
      gstin: form.gstin,
      pan: form.pan,
      state: form.state,
      address: form.address || undefined,
      ownerName: form.ownerName,
      ...(usePhone
        ? { ownerPhone: form.ownerPhone.trim() }
        : { ownerEmail: form.ownerEmail.trim().toLowerCase() }),
      password: form.password,
      product,
    };

    const local = registerCompanySchema.safeParse(payload);
    if (!local.success) {
      applyZodIssues(local.error.issues);
      return;
    }

    setLoading(true);
    try {
      await registerCompany(local.data);
      router.replace(isInventorySignup ? '/inventory' : '/dashboard');
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.details?.length) {
        setFieldErrors(validationFieldErrors(apiErr.details));
        setError(formatApiErrorMessage(apiErr, 'Registration failed'));
      } else {
        setError(apiErr.message || 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const submitFooter = (
    <Button
      label={isInventorySignup ? 'Create inventory account' : 'Create account'}
      onPress={onSubmit}
      loading={loading}
      disabled={!canSubmit}
      fullWidth
    />
  );

  const companyFields = isDesktop ? (
    <View className="gap-3">
      <View className="flex-row gap-3">
        <View className="flex-1 min-w-0">
          <Input
            label="Company name"
            value={form.companyName}
            onChangeText={(v) => set('companyName', v)}
            error={fieldErrors.companyName}
          />
        </View>
        <View className="flex-1 min-w-0">
          <Input
            label="GSTIN"
            value={form.gstin}
            onChangeText={(v) => set('gstin', v.toUpperCase())}
            autoCapitalize="characters"
            error={fieldErrors.gstin ?? gstLiveError}
            helper="15 characters, or leave blank"
          />
        </View>
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1 min-w-0">
          <Input
            label="PAN"
            value={form.pan}
            onChangeText={(v) => set('pan', v.toUpperCase())}
            autoCapitalize="characters"
            error={fieldErrors.pan ?? panLiveError}
            helper="10 characters, or leave blank"
          />
        </View>
        <View className="flex-1 min-w-0">
          <Input
            label="State"
            value={form.state}
            onChangeText={(v) => set('state', v)}
            error={fieldErrors.state}
          />
        </View>
      </View>
      <Input
        label="Address (optional)"
        value={form.address}
        onChangeText={(v) => set('address', v)}
        multiline
        error={fieldErrors.address}
      />
    </View>
  ) : (
    <View>
      <Input
        label="Company name"
        value={form.companyName}
        onChangeText={(v) => set('companyName', v)}
        error={fieldErrors.companyName}
      />
      <View className="h-3" />
      <Input
        label="GSTIN"
        value={form.gstin}
        onChangeText={(v) => set('gstin', v.toUpperCase())}
        autoCapitalize="characters"
        error={fieldErrors.gstin ?? gstLiveError}
        helper="15 characters, or leave blank"
      />
      <View className="h-3" />
      <Input
        label="PAN"
        value={form.pan}
        onChangeText={(v) => set('pan', v.toUpperCase())}
        autoCapitalize="characters"
        error={fieldErrors.pan ?? panLiveError}
        helper="10 characters, or leave blank"
      />
      <View className="h-3" />
      <Input
        label="State"
        value={form.state}
        onChangeText={(v) => set('state', v)}
        error={fieldErrors.state}
      />
      <View className="h-3" />
      <Input
        label="Address (optional)"
        value={form.address}
        onChangeText={(v) => set('address', v)}
        multiline
        error={fieldErrors.address}
      />
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
      heroHeadline={isInventorySignup ? 'Start your inventory trial' : 'Start your free trial'}
      heroSubline={
        isInventorySignup
          ? '14 days of full access to stock, procurement, invoicing & Tally - no credit card required.'
          : '14 days of full access - no credit card required.'
      }
      heroBenefits={TRIAL_HERO_BENEFITS}
      backHref="/"
      formWidth="wide"
      formTitle={isInventorySignup ? 'Register your store' : 'Register company'}
      formSubtitle={
        isInventorySignup
          ? 'Create your inventory business and owner account (₹499/month after trial)'
          : 'Create your company and owner account'
      }
      footer={isDesktop ? submitFooter : undefined}
    >
      <FreeTrialBadge className="mb-5" />

      <Card className="mb-4">
        <Text className="text-sm font-bold text-text mb-3">Company</Text>
        {companyFields}
      </Card>

      <Card className="mb-4">
        <Text className="text-sm font-bold text-text mb-3">Owner account</Text>
        <Input
          label="Your name"
          value={form.ownerName}
          onChangeText={(v) => set('ownerName', v)}
          error={fieldErrors.ownerName}
        />
        <View className="h-3" />

        {!isInventorySignup ? (
          <View className="flex-row gap-2 mb-3">
            {(['email', 'phone'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => setContactMethod(m)}
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

        {isInventorySignup || contactMethod === 'phone' ? (
          <Input
            label="Mobile number"
            value={form.ownerPhone}
            onChangeText={(v) => set('ownerPhone', v)}
            keyboardType="phone-pad"
            placeholder="9876543210 or +919876543210"
            error={fieldErrors.ownerPhone ?? phoneLiveError}
          />
        ) : (
          <Input
            label="Email"
            value={form.ownerEmail}
            onChangeText={(v) => set('ownerEmail', v)}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="you@company.com"
            error={fieldErrors.ownerEmail ?? emailLiveError}
          />
        )}

        <View className="h-3" />
        <Input
          label="Password"
          value={form.password}
          onChangeText={(v) => set('password', v)}
          secureTextEntry
          passwordToggle
          error={fieldErrors.password ?? passwordLiveError}
          helper={form.password ? undefined : 'Min 8 characters, with upper, lower, and a number'}
        />
        {form.password ? (
          <View className="mb-3 gap-1">
            {PASSWORD_RULES.filter((r) => r.id !== 'max' || !r.test(form.password)).map((rule) => {
              const ok = rule.test(form.password);
              return (
                <Text key={rule.id} className={`text-xs ${ok ? 'text-muted' : 'text-danger'}`}>
                  {ok ? '✓' : '•'} {rule.label}
                </Text>
              );
            })}
          </View>
        ) : null}
        <Input
          label="Confirm password"
          value={form.confirmPassword}
          onChangeText={(v) => set('confirmPassword', v)}
          secureTextEntry
          passwordToggle
          error={fieldErrors.confirmPassword ?? confirmLiveError}
        />
        {form.confirmPassword ? (
          <View className="mb-1">
            <Text
              className={`text-xs ${
                form.confirmPassword === form.password && isPasswordValid(form.confirmPassword)
                  ? 'text-muted'
                  : 'text-danger'
              }`}
            >
              {form.confirmPassword === form.password && isPasswordValid(form.confirmPassword)
                ? '✓ Passwords match'
                : '• Must match the password and meet the same format'}
            </Text>
          </View>
        ) : null}
      </Card>

      {error ? (
        <View className="mb-4 px-3 py-2 rounded-lg bg-danger/10 border border-danger/30">
          <Text className="text-sm font-semibold text-danger mb-1">Please fix the following</Text>
          {error.split('\n').map((line) => (
            <Text key={line} className="text-sm text-danger">
              • {line}
            </Text>
          ))}
        </View>
      ) : null}

      {!isDesktop && submitFooter}
    </AuthScreenShell>
  );
}
