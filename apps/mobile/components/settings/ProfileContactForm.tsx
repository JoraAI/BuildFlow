/**
 * Shared self-serve profile form (Construction + Inventory).
 * Name always editable; email/phone changes require OTP to the new contact.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import {
  OTP_DIGITS,
  emailSchema,
  isSyntheticPhoneEmail,
  phoneSchema,
} from '@buildflow/shared';
import { Card, Input, Button, Badge } from '@/components/ui';
import { Avatar, CompanyLogo } from '@/components/ui/Avatar';
import { useViewport } from '@/hooks/useViewport';
import {
  useSendProfileContactOtp,
  useUpdateMyProfile,
  type MyProfile,
} from '@/services/settings.queries';
import { useAuthStore } from '@/stores/auth.store';
import { alertAsync } from '@/utils/confirm';

function digitsIndiaMobile(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length > 10) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.replace(/^0+/, '');
  return digits.slice(0, 10);
}

function displayEmail(email: string): string {
  return isSyntheticPhoneEmail(email) ? '' : email;
}

function toE164India(digits10: string): string {
  return `+91${digits10}`;
}

function phoneDigitsFromStored(phone: string | null): string {
  if (!phone) return '';
  return digitsIndiaMobile(phone);
}

export function ProfileContactForm({ profile }: { profile: MyProfile }) {
  const { isPhone } = useViewport();
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const update = useUpdateMyProfile();
  const sendOtp = useSendProfileContactOtp();

  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(displayEmail(profile.email));
  const [phoneDigits, setPhoneDigits] = useState(phoneDigitsFromStored(profile.phone));
  const [emailOtp, setEmailOtp] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [emailOtpHint, setEmailOtpHint] = useState<string | null>(null);
  const [phoneOtpHint, setPhoneOtpHint] = useState<string | null>(null);
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setName(profile.name);
    setEmail(displayEmail(profile.email));
    setPhoneDigits(phoneDigitsFromStored(profile.phone));
    setEmailOtp('');
    setPhoneOtp('');
    setEmailOtpHint(null);
    setPhoneOtpHint(null);
    setEmailCodeSent(false);
    setPhoneCodeSent(false);
  }, [profile]);

  const currentEmail = displayEmail(profile.email);
  const currentPhoneDigits = phoneDigitsFromStored(profile.phone);

  const emailDirty = email.trim().toLowerCase() !== currentEmail.toLowerCase();
  const phoneDirty = phoneDigits !== currentPhoneDigits;
  const nameDirty = name.trim() !== profile.name;

  const emailLiveError = useMemo(() => {
    if (!email.trim()) return undefined;
    return emailSchema.safeParse(email.trim()).success ? undefined : 'Enter a valid email address';
  }, [email]);

  const phoneLiveError = useMemo(() => {
    if (!phoneDigits) return undefined;
    if (phoneDigits.length !== 10) return 'Enter a valid 10-digit mobile number';
    return phoneSchema.safeParse(toE164India(phoneDigits)).success
      ? undefined
      : 'Enter a valid 10-digit mobile number';
  }, [phoneDigits]);

  const emailNeedsOtp = emailDirty && Boolean(email.trim());
  const phoneNeedsOtp = phoneDirty && phoneDigits.length === 10;
  const emailReady = !emailNeedsOtp || (emailCodeSent && emailOtp.trim().length >= 4);
  const phoneReady =
    !phoneNeedsOtp ||
    (phoneDirty && !phoneDigits) ||
    (phoneCodeSent && phoneOtp.trim().length >= 4);

  const canSave =
    (nameDirty || emailDirty || phoneDirty) &&
    !emailLiveError &&
    !phoneLiveError &&
    emailReady &&
    phoneReady &&
    !(emailDirty && !email.trim() && !phoneDigits) &&
    !(phoneDirty && !phoneDigits && isSyntheticPhoneEmail(profile.email) && !email.trim());

  const onSendEmailOtp = async () => {
    setFormError(null);
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) {
      setFormError('Enter a valid email address');
      return;
    }
    try {
      const res = await sendOtp.mutateAsync({
        channel: 'email',
        destination: parsed.data,
      });
      setEmailOtp('');
      setEmailCodeSent(true);
      setEmailOtpHint(
        res.devCode
          ? `Code sent (dev): ${res.devCode}`
          : `Code sent to ${res.destinationMasked}`,
      );
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not send email OTP');
    }
  };

  const onSendPhoneOtp = async () => {
    setFormError(null);
    if (phoneDigits.length !== 10) {
      setFormError('Enter a valid 10-digit mobile number');
      return;
    }
    try {
      const res = await sendOtp.mutateAsync({
        channel: 'sms',
        destination: toE164India(phoneDigits),
      });
      setPhoneOtp('');
      setPhoneCodeSent(true);
      setPhoneOtpHint(
        res.devCode
          ? `Code sent (dev): ${res.devCode}`
          : `Code sent to ${res.destinationMasked}`,
      );
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not send SMS OTP');
    }
  };

  const onSave = () => {
    setFormError(null);
    if (!canSave) {
      setFormError('Send and enter OTP for any new email or mobile before saving.');
      return;
    }
    if (emailDirty && !email.trim() && !phoneDigits) {
      setFormError('Keep a mobile number or add an email so you can sign in.');
      return;
    }
    if (phoneDirty && !phoneDigits && isSyntheticPhoneEmail(profile.email) && !email.trim()) {
      setFormError('Add an email before removing your mobile number.');
      return;
    }

    update.mutate(
      {
        ...(nameDirty ? { name: name.trim() } : {}),
        ...(emailDirty ? { email: email.trim().toLowerCase(), emailOtp: emailOtp.trim() } : {}),
        ...(phoneDirty
          ? {
              phone: phoneDigits ? toE164India(phoneDigits) : null,
              ...(phoneDigits ? { phoneOtp: phoneOtp.trim() } : {}),
            }
          : {}),
      },
      {
        onSuccess: async () => {
          await refreshUser();
          await alertAsync('Saved', 'Profile updated.');
        },
        onError: async (e: Error) => {
          setFormError(e.message);
          await alertAsync('Error', e.message);
        },
      },
    );
  };

  return (
    <View className={isPhone ? '' : 'max-w-lg'}>
      <Card className="mb-4 p-4">
        <View className="flex-row items-center gap-4 mb-4">
          <CompanyLogo name={profile.companyName} logoUrl={profile.companyLogoUrl} size={56} />
          <View className="flex-1 min-w-0">
            <Text className="text-sm font-semibold text-text" numberOfLines={1}>
              {profile.companyName}
            </Text>
            <Text className="text-xs text-muted">Company</Text>
          </View>
          <Avatar name={profile.name} size={48} imageUrl={null} />
        </View>

        <Input label="Full name" value={name} onChangeText={setName} />
        <View className="h-4" />

        <Input
          label="Email"
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setEmailCodeSent(false);
            setEmailOtpHint(null);
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="you@company.com"
          helper={
            isSyntheticPhoneEmail(profile.email) && !email.trim()
              ? 'Add an email to also sign in with email'
              : undefined
          }
          error={emailLiveError}
        />
        {emailNeedsOtp ? (
          <View className="mt-2 gap-2">
            <Button
              label={sendOtp.isPending ? 'Sending…' : 'Send email code'}
              variant="secondary"
              size="sm"
              disabled={sendOtp.isPending || Boolean(emailLiveError) || !email.trim()}
              loading={sendOtp.isPending}
              onPress={() => void onSendEmailOtp()}
            />
            {emailOtpHint ? <Text className="text-xs text-muted">{emailOtpHint}</Text> : null}
            <Input
              label="Email OTP"
              value={emailOtp}
              onChangeText={(v) => setEmailOtp(v.replace(/\D/g, '').slice(0, OTP_DIGITS))}
              keyboardType="number-pad"
              placeholder={`${OTP_DIGITS}-digit code`}
              maxLength={OTP_DIGITS}
            />
          </View>
        ) : null}

        <View className="h-4" />

        <Input
          label="Mobile number"
          value={phoneDigits}
          onChangeText={(v) => {
            setPhoneDigits(digitsIndiaMobile(v));
            setPhoneCodeSent(false);
            setPhoneOtpHint(null);
          }}
          keyboardType="phone-pad"
          placeholder="9876543210"
          maxLength={10}
          leftIcon={
            <Text className="text-sm font-semibold text-text pr-2 mr-2 border-r border-border">
              +91
            </Text>
          }
          helper="10-digit Indian mobile number"
          error={phoneLiveError}
        />
        {phoneNeedsOtp ? (
          <View className="mt-2 gap-2">
            <Button
              label={sendOtp.isPending ? 'Sending…' : 'Send SMS code'}
              variant="secondary"
              size="sm"
              disabled={sendOtp.isPending || Boolean(phoneLiveError) || phoneDigits.length !== 10}
              loading={sendOtp.isPending}
              onPress={() => void onSendPhoneOtp()}
            />
            {phoneOtpHint ? <Text className="text-xs text-muted">{phoneOtpHint}</Text> : null}
            <Input
              label="SMS OTP"
              value={phoneOtp}
              onChangeText={(v) => setPhoneOtp(v.replace(/\D/g, '').slice(0, OTP_DIGITS))}
              keyboardType="number-pad"
              placeholder={`${OTP_DIGITS}-digit code`}
              maxLength={OTP_DIGITS}
            />
          </View>
        ) : null}

        <View className="mt-3">
          <Badge label={profile.role} color="primary" />
        </View>
      </Card>

      {formError ? (
        <View className="mb-3 px-3 py-2 rounded-lg bg-danger/10 border border-danger/30">
          <Text className="text-sm text-danger">{formError}</Text>
        </View>
      ) : null}

      <Button
        label={update.isPending ? 'Saving…' : 'Save changes'}
        onPress={onSave}
        disabled={update.isPending || !canSave}
        loading={update.isPending}
        fullWidth
      />
      <Text className="text-xs text-muted mt-2">
        Changing email or mobile sends a one-time code to the new contact before it is saved.
      </Text>
    </View>
  );
}
