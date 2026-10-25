/**
 * Company + owner registration (free trial).
 * Supports Construction ERP and Inventory (?product=inventory).
 * Signup is OTP-only for inventory and construction (no password).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  emailSchema,
  gstinSchema,
  panSchema,
  phoneSchema,
  registerCompanySchema,
  INDIAN_STATES,
  INDIA_COUNTRY,
  INVENTORY_VERTICAL_HINTS,
  INVENTORY_VERTICAL_LABELS,
  INVENTORY_VERTICAL_VALUES,
  OTP_DIGITS,
  type InventoryVertical,
} from '@buildflow/shared';
import { Button, Input, Card, Select } from '@/components/ui';
import { AuthScreenShell } from '@/components/auth/AuthScreenShell';
import { SmsConsentCheckbox } from '@/components/auth/SmsConsentCheckbox';
import { sendLoginOtpRequest } from '@/services/auth.queries';
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

function digitsIndiaMobile(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length > 10) digits = digits.slice(2);
  return digits.slice(0, 10);
}

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
  | 'inventoryVertical';

export default function SignupCompanyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ product?: string }>();
  // INVENTORY_PRODUCT: ?product=inventory → inventory signup path.
  const product: 'inventory' | 'construction' =
    params.product === 'inventory' ? 'inventory' : 'construction';
  const isInventorySignup = product === 'inventory';
  const registerCompany = useAuthStore((s) => s.registerCompany);
  const login = useAuthStore((s) => s.login);
  const { isDesktop } = useViewport();

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FormKey | string, string>>>({});
  const [contactMethod, setContactMethod] = useState<ContactMethod>(
    isInventorySignup ? 'phone' : 'email',
  );
  const [smsConsent, setSmsConsent] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [otpDestination, setOtpDestination] = useState('');
  const [otp, setOtp] = useState('');
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);

  const [form, setForm] = useState({
    companyName: '',
    gstin: '',
    pan: '',
    state: '',
    address: '',
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    inventoryVertical: '' as InventoryVertical | '',
  });
  const usesPhoneSignup = isInventorySignup || contactMethod === 'phone';

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

  const phoneLiveError =
    usesPhoneSignup && form.ownerPhone
      ? phoneSchema.safeParse(form.ownerPhone).success
        ? undefined
        : 'Enter a valid 10-digit mobile number'
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
    const companyOk =
      form.companyName.trim().length >= 2 &&
      INDIAN_STATES.some((s) => s.name === form.state);
    const ownerOk = form.ownerName.trim().length >= 2;
    const contactOk = isInventorySignup || contactMethod === 'phone'
      ? phoneSchema.safeParse(form.ownerPhone).success
      : emailSchema.safeParse(form.ownerEmail).success;
    const gstOk = !form.gstin.trim() || gstinSchema.safeParse(form.gstin).success;
    const panOk = !form.pan.trim() || panSchema.safeParse(form.pan).success;
    const verticalOk = !isInventorySignup || Boolean(form.inventoryVertical);
    const consentOk = !usesPhoneSignup || smsConsent;
    return companyOk && ownerOk && contactOk && gstOk && panOk && verticalOk && consentOk;
  }, [form, isInventorySignup, contactMethod, smsConsent, usesPhoneSignup]);

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

    if (usesPhoneSignup && !form.ownerPhone.trim()) {
      setFieldErrors({ ownerPhone: 'Enter your mobile number' });
      setError('Mobile number: Enter your mobile number');
      return;
    }
    if (!isInventorySignup && contactMethod === 'email' && !form.ownerEmail.trim()) {
      setFieldErrors({ ownerEmail: 'Enter your email address' });
      setError('Email: Enter your email address');
      return;
    }

    const payload = {
      companyName: form.companyName,
      gstin: form.gstin,
      pan: form.pan,
      state: form.state,
      address: form.address || undefined,
      ownerName: form.ownerName,
      ...(usesPhoneSignup
        ? { ownerPhone: form.ownerPhone.trim() }
        : { ownerEmail: form.ownerEmail.trim().toLowerCase() }),
      product,
      ...(isInventorySignup && form.inventoryVertical
        ? { inventoryVertical: form.inventoryVertical }
        : {}),
    };

    const local = registerCompanySchema.safeParse(payload);
    if (!local.success) {
      applyZodIssues(local.error.issues);
      return;
    }

    setLoading(true);
    try {
      const result = await registerCompany(local.data);
      const destination =
        result.destination ||
        result.phone ||
        (usesPhoneSignup ? form.ownerPhone.trim() : form.ownerEmail.trim().toLowerCase());
      setOtpDestination(destination);
      setOtpHint(
        result.otp?.devCode
          ? `Code sent (dev): ${result.otp.devCode}`
          : `Code sent to ${result.otp?.destinationMasked ?? destination}`,
      );
      setOtp('');
      setOtpStep(true);
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

  const onResendOtp = async () => {
    setError('');
    if (!otpDestination.trim()) return;
    setSendingOtp(true);
    try {
      const res = await sendLoginOtpRequest(otpDestination.trim());
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

  const onVerifyOtp = async () => {
    setError('');
    if (otp.trim().length !== OTP_DIGITS) {
      setError(`Enter the ${OTP_DIGITS}-digit OTP we sent you`);
      return;
    }
    setLoading(true);
    try {
      await login(otpDestination.trim(), otp.trim());
      router.replace(isInventorySignup ? '/inventory' : '/dashboard');
    } catch (err) {
      setError((err as ApiError).message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const submitFooter = otpStep ? (
    <Button
      label="Verify OTP & sign in"
      onPress={onVerifyOtp}
      loading={loading}
      disabled={otp.trim().length !== OTP_DIGITS}
      fullWidth
    />
  ) : (
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
          <Select
            label="Country"
            value={INDIA_COUNTRY.code}
            options={[{ value: INDIA_COUNTRY.code, title: INDIA_COUNTRY.name }]}
            onChange={() => undefined}
            disabled
            helper="India only for now"
          />
        </View>
        <View className="flex-1 min-w-0">
          <Select
            label="State"
            value={form.state || undefined}
            onChange={(v) => set('state', v ?? '')}
            placeholder="Select state"
            title="State"
            options={INDIAN_STATES.map((s) => ({ value: s.name, title: s.name }))}
          />
          {fieldErrors.state ? (
            <Text className="text-xs text-danger -mt-2 mb-2">{fieldErrors.state}</Text>
          ) : null}
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
      <Select
        label="Country"
        value={INDIA_COUNTRY.code}
        options={[{ value: INDIA_COUNTRY.code, title: INDIA_COUNTRY.name }]}
        onChange={() => undefined}
        disabled
        helper="India only for now"
      />
      <Select
        label="State"
        value={form.state || undefined}
        onChange={(v) => set('state', v ?? '')}
        placeholder="Select state"
        title="State"
        options={INDIAN_STATES.map((s) => ({ value: s.name, title: s.name }))}
      />
      {fieldErrors.state ? (
        <Text className="text-xs text-danger -mt-2 mb-2">{fieldErrors.state}</Text>
      ) : null}
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
      formTitle={
        otpStep
          ? 'Verify OTP'
          : isInventorySignup
            ? 'Register your store'
            : 'Register company'
      }
      formSubtitle={
        otpStep
          ? `Enter the ${OTP_DIGITS}-digit code we sent you to finish sign-in`
          : isInventorySignup
            ? 'Create your inventory business and owner account (₹799/month after trial)'
            : 'Create your company and owner account'
      }
      footer={isDesktop ? submitFooter : undefined}
    >
      <FreeTrialBadge className="mb-5" />

      {otpStep ? (
        <Card className="mb-4">
          <Text className="text-sm font-bold text-text mb-2">OTP check</Text>
          <Text className="text-xs text-muted mb-3">
            We sent a one-time code to your email or mobile. Sign-in completes only after this check.
          </Text>
          <Button
            label={sendingOtp ? 'Sending…' : 'Resend OTP'}
            variant="secondary"
            onPress={onResendOtp}
            loading={sendingOtp}
            fullWidth
          />
          {otpHint ? <Text className="text-xs text-muted mt-2">{otpHint}</Text> : null}
          <View className="h-3" />
          <Input
            label="OTP"
            value={otp}
            onChangeText={setOtp}
            placeholder={`${OTP_DIGITS}-digit code`}
            keyboardType="number-pad"
            maxLength={OTP_DIGITS}
          />
        </Card>
      ) : (
        <>
      <Card className="mb-4">
        <Text className="text-sm font-bold text-text mb-3">Company</Text>
        {companyFields}
        {isInventorySignup ? (
          <>
            <View className="h-3" />
            <Select
              label="Inventory vertical"
              value={form.inventoryVertical || undefined}
              onChange={(v) => set('inventoryVertical', (v ?? '') as InventoryVertical | '')}
              placeholder="Select your inventory type"
              title="Inventory vertical"
              options={INVENTORY_VERTICAL_VALUES.map((value) => ({
                value,
                title: INVENTORY_VERTICAL_LABELS[value],
                subtitle: INVENTORY_VERTICAL_HINTS[value],
              }))}
            />
            {fieldErrors.inventoryVertical ? (
              <Text className="text-xs text-danger mt-1">{fieldErrors.inventoryVertical}</Text>
            ) : null}
          </>
        ) : null}
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

        {usesPhoneSignup ? (
          <>
            <Input
              label="Mobile number"
              value={form.ownerPhone}
              onChangeText={(v) => set('ownerPhone', digitsIndiaMobile(v))}
              keyboardType="phone-pad"
              placeholder="9876543210"
              maxLength={10}
              leftIcon={
                <Text className="text-sm font-semibold text-text pr-2 mr-2 border-r border-border">
                  +91
                </Text>
              }
              error={fieldErrors.ownerPhone ?? phoneLiveError}
              helper="10-digit Indian mobile number"
            />
            <SmsConsentCheckbox checked={smsConsent} onCheckedChange={setSmsConsent} />
          </>
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
      </Card>
        </>
      )}

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
