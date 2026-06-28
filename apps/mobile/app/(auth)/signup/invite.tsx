/**
 * Accept team invite — set name and password.
 */
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Input, Card, Badge } from '@/components/ui';
import { AuthScreenShell } from '@/components/auth/AuthScreenShell';
import { useAuthStore } from '@/stores/auth.store';
import { useViewport } from '@/hooks/useViewport';
import { ApiError } from '@/lib/api-client';
import { fetchInvitePreview } from '@/services/auth.queries';

export default function SignupInviteScreen() {
  const router = useRouter();
  const { isDesktop } = useViewport();
  const { token: tokenParam } = useLocalSearchParams<{ token?: string }>();
  const acceptInvite = useAuthStore((s) => s.acceptInvite);

  const [token, setToken] = useState(tokenParam ?? '');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [preview, setPreview] = useState<{
    email: string;
    role: string;
    companyName: string;
  } | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token.trim()) return;
    setPreviewError('');
    fetchInvitePreview(token.trim())
      .then(setPreview)
      .catch((e: ApiError) => {
        setPreview(null);
        setPreviewError(e.message || 'Invalid or expired invite');
      });
  }, [token]);

  const onSubmit = async () => {
    setError('');
    if (!token.trim()) {
      setError('Please enter your invite token or use the link from your email');
      return;
    }
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await acceptInvite({ token: token.trim(), name: name.trim(), password });
      router.replace('/dashboard');
    } catch (err) {
      setError((err as ApiError).message || 'Could not accept invite');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreenShell
      heroHeadline="Join your team on BuildFlow"
      backHref="/signup"
      formWidth="wide"
      formTitle="Accept invite"
      formSubtitle="Enter the invite link or token from your company owner"
      footer={
        isDesktop ? (
          <Button
            label="Join company"
            onPress={onSubmit}
            loading={loading}
            disabled={!preview}
            fullWidth
          />
        ) : undefined
      }
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
          <Text className="text-sm text-muted mt-2">{preview.email}</Text>
          <View className="mt-2">
            <Badge label={preview.role} color="primary" />
          </View>
        </Card>
      ) : previewError ? (
        <View className="bg-danger/10 rounded-lg px-3 py-2 mb-4 border border-danger/20">
          <Text className="text-danger text-sm">{previewError}</Text>
        </View>
      ) : token.trim() ? (
        <Text className="text-sm text-muted mb-4">Validating invite…</Text>
      ) : null}

      <Input label="Your name" value={name} onChangeText={setName} />
      <View className="h-3" />
      <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <View className="h-3" />
      <Input label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />

      {error ? (
        <View className="bg-danger/10 rounded-lg px-3 py-2 mt-4 border border-danger/20">
          <Text className="text-danger text-sm">{error}</Text>
        </View>
      ) : null}

      {!isDesktop && (
        <>
          <View className="h-4" />
          <Button
            label="Join company"
            onPress={onSubmit}
            loading={loading}
            disabled={!preview}
            fullWidth
          />
        </>
      )}
    </AuthScreenShell>
  );
}
