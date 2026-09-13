/**
 * Accept team invite — OTP only (email or phone locked on invite).
 */
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Input, Card, Badge } from '@/components/ui';
import { AuthScreenShell } from '@/components/auth/AuthScreenShell';
import { useAuthStore } from '@/stores/auth.store';
import { useViewport } from '@/hooks/useViewport';
import { ApiError } from '@/lib/api-client';
import { fetchInvitePreview, sendInviteOtpRequest } from '@/services/auth.queries';
import { ROLE_LABELS, type Role } from '@buildflow/shared';

export default function SignupInviteScreen() {
  const router = useRouter();
  const { isDesktop } = useViewport();
  const { token: tokenParam } = useLocalSearchParams<{ token?: string }>();
  const acceptInvite = useAuthStore((s) => s.acceptInvite);

  const [token, setToken] = useState(tokenParam ?? '');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [preview, setPreview] = useState<{
    email: string | null;
    phone: string | null;
    role: string;
    companyName: string;
    inviteChannel: 'email' | 'phone';
  } | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token.trim()) return;
    setPreviewError('');
    fetchInvitePreview(token.trim())
      .then((p) => {
        setPreview(p);
        setOtpSent(false);
        setOtpHint(null);
        setOtp('');
      })
      .catch((e: ApiError) => {
        setPreview(null);
        setPreviewError(e.message || 'Invalid or expired invite');
      });
  }, [token]);

  const onSendOtp = async () => {
    setError('');
    if (!token.trim()) {
      setError('Invite token is required');
      return;
    }
    setSendingOtp(true);
    try {
      const res = await sendInviteOtpRequest(token.trim());
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

  const onSubmit = async () => {
    setError('');
    if (!token.trim()) {
      setError('Please enter your invite token or use the link from your invite');
      return;
    }
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!otp.trim()) {
      setError(
        preview?.inviteChannel === 'email'
          ? 'Enter the OTP sent to your email'
          : 'Enter the OTP sent to your mobile',
      );
      return;
    }

    setLoading(true);
    try {
      await acceptInvite({
        token: token.trim(),
        name: name.trim(),
        otp: otp.trim(),
      });
      const productMode = useAuthStore.getState().user?.productMode;
      router.replace(productMode === 'inventory' ? '/inventory' : '/dashboard');
    } catch (err) {
      setError((err as ApiError).message || 'Could not accept invite');
    } finally {
      setLoading(false);
    }
  };

  const joinButton = (
    <Button
      label="Join company"
      onPress={onSubmit}
      loading={loading}
      disabled={!preview}
      fullWidth
    />
  );

  const contactHint =
    preview?.inviteChannel === 'phone'
      ? 'Your mobile is locked to this invite — verify with OTP to join'
      : 'Your email is locked to this invite — verify with OTP to join';

  return (
    <AuthScreenShell
      heroHeadline="Join your team on BuildFlow"
      backHref="/signup"
      formWidth="wide"
      formTitle="Accept invite"
      formSubtitle={preview ? contactHint : 'Open your invite link, then verify with OTP'}
      footer={isDesktop ? joinButton : undefined}
    >
      {!tokenParam && (
        <>
          <Input
            label="Invite token"
            value={token}
            onChangeText={setToken}
            placeholder="Paste token from invite link"
            autoCapitalize="none"
          />
          <View className="h-4" />
        </>
      )}

      {preview ? (
        <Card className="mb-4 bg-primary/5 border-primary/20">
          <Text className="text-sm text-muted mb-1">You're joining</Text>
          <Text className="text-lg font-bold text-text">{preview.companyName}</Text>
          <View className="mt-2">
            <Badge label={ROLE_LABELS[preview.role as Role] ?? preview.role} color="primary" />
          </View>
        </Card>
      ) : previewError ? (
        <View className="bg-danger/10 rounded-lg px-3 py-2 mb-4 border border-danger/20">
          <Text className="text-danger text-sm">{previewError}</Text>
        </View>
      ) : token.trim() ? (
        <Text className="text-sm text-muted mb-4">Validating invite…</Text>
      ) : null}

      {preview?.inviteChannel === 'email' && preview.email ? (
        <>
          <Input label="Email" value={preview.email} onChangeText={() => undefined} editable={false} />
          <View className="h-3" />
        </>
      ) : null}

      {preview?.inviteChannel === 'phone' && preview.phone ? (
        <>
          <Input label="Mobile" value={preview.phone} onChangeText={() => undefined} editable={false} />
          <View className="h-3" />
        </>
      ) : null}

      <Input label="Your name" value={name} onChangeText={setName} />
      <View className="h-3" />

      <Button
        label={sendingOtp ? 'Sending…' : otpSent ? 'Resend OTP' : 'Send OTP'}
        variant="secondary"
        onPress={onSendOtp}
        loading={sendingOtp}
        disabled={!preview}
        fullWidth
      />
      {otpHint ? <Text className="text-xs text-muted mt-2 mb-1">{otpHint}</Text> : null}
      {__DEV__ && preview ? (
        <Text className="text-xs text-muted mt-1 mb-1">
          Seed/dev: OTP 111111 is accepted until SMS/email delivery is configured.
        </Text>
      ) : null}
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
          {joinButton}
        </>
      )}
    </AuthScreenShell>
  );
}
