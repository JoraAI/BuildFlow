/**
 * Owner invites a customer into Icecream-inventory-buyer with a short join code.
 */
import React, { useState } from 'react';
import { View, Text, Modal, Pressable, Platform, Share, Alert } from 'react-native';
import { Button, Input } from '@/components/ui';
import { useViewport } from '@/hooks/useViewport';
import {
  useInviteBuyer,
  useRegenerateBuyerInvite,
  type BuyerInviteCreated,
} from '@/services/ice-cream.queries';
import type { PartyRow } from '@/services/party.queries';

export function InviteBuyerModal({
  customer,
  onClose,
}: {
  customer: PartyRow;
  onClose: () => void;
}) {
  const { isPhone } = useViewport();
  const inviteBuyer = useInviteBuyer();
  const regenerate = useRegenerateBuyerInvite();
  const [email, setEmail] = useState(customer.email ?? '');
  const [name, setName] = useState(customer.name ?? '');
  const [phone, setPhone] = useState(customer.phone ?? '');
  const [result, setResult] = useState<BuyerInviteCreated | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const shareCode = async (code: string, expiresAt: string) => {
    const when = new Date(expiresAt).toLocaleString();
    const message = `Join BuildFlow Icecream-inventory-buyer with code ${code}. Expires ${when}.`;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(message);
      Alert.alert('Copied', 'Invite code copied. Share it with your customer.');
      return;
    }
    await Share.share({ message });
  };

  const create = async () => {
    setError('');
    setSaving(true);
    try {
      const data = await inviteBuyer.mutateAsync({
        customerId: customer.id,
        email: email.trim() || null,
        name: name.trim() || null,
        phone: phone.trim() || null,
        expiresInHours: 48,
      });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create invite');
    } finally {
      setSaving(false);
    }
  };

  const onRegenerate = async () => {
    if (!result) return;
    setError('');
    setSaving(true);
    try {
      const data = await regenerate.mutateAsync(result.inviteId);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to regenerate');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType={isPhone ? 'slide' : 'fade'} onRequestClose={onClose}>
      <Pressable
        className={`flex-1 bg-black/40 ${isPhone ? 'justify-end' : 'items-center justify-center p-4'}`}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className={`bg-card ${isPhone ? 'rounded-t-2xl' : 'rounded-2xl max-w-lg w-full'}`}
        >
          <View className="px-5 pt-4 pb-3 border-b border-border flex-row items-center justify-between">
            <Text className="text-base font-bold text-text">Invite buyer</Text>
            <Pressable onPress={onClose} className="p-1">
              <Text className="text-muted text-xl">×</Text>
            </Pressable>
          </View>
          <View className="p-5">
            <Text className="text-xs text-muted mb-3">
              Prefill details for {customer.name}. Customer joins Icecream-inventory-buyer with a
              short code (expires in 48 hours). They can edit details after joining. Later logins use
              email OTP.
            </Text>
            {!result ? (
              <>
                <Input label="Contact name (optional)" value={name} onChangeText={setName} />
                <View className="h-2" />
                <Input
                  label="Email (optional prefill)"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <View className="h-2" />
                <Input
                  label="Phone (optional)"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
                {error ? <Text className="text-danger text-sm mt-2">{error}</Text> : null}
                <View className="h-4" />
                <Button label="Generate invite code" onPress={() => void create()} loading={saving} fullWidth />
              </>
            ) : (
              <>
                <Text className="text-xs text-muted mb-1">Join code</Text>
                <Text className="text-3xl font-bold text-text tracking-widest mb-1">{result.code}</Text>
                <Text className="text-xs text-muted mb-3">
                  Expires {new Date(result.expiresAt).toLocaleString()}
                </Text>
                {error ? <Text className="text-danger text-sm mb-2">{error}</Text> : null}
                <Button
                  label="Share / copy code"
                  variant="accent"
                  onPress={() => void shareCode(result.code, result.expiresAt)}
                  fullWidth
                />
                <View className="h-2" />
                <Button
                  label="Regenerate code"
                  variant="secondary"
                  loading={saving}
                  onPress={() => void onRegenerate()}
                  fullWidth
                />
                <View className="h-2" />
                <Button label="Done" variant="secondary" onPress={onClose} fullWidth />
              </>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
