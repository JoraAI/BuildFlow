/**
 * BuildFlow - Party create/edit modal (INVENTORY_HORIZONTAL_PLATFORM Phase 1.1).
 * Shared by the inventory Parties screen. Phone: bottom sheet. Desktop: centered.
 */
import React, { useState } from 'react';
import { View, Text, Modal, ScrollView, Pressable } from 'react-native';
import { Button, Input, Select } from '@/components/ui';
import { useViewport } from '@/hooks/useViewport';
import type { PartyRow, PartyInput } from '@/services/party.queries';

type Kind = 'customer' | 'vendor';

const PAYMENT_TERMS = [
  { title: 'Immediate', value: 'Immediate' },
  { title: 'Net 7', value: 'Net 7' },
  { title: 'Net 15', value: 'Net 15' },
  { title: 'Net 30', value: 'Net 30' },
  { title: 'Net 45', value: 'Net 45' },
  { title: 'Net 60', value: 'Net 60' },
];

export function PartyModal({
  kind,
  editing,
  onClose,
  onSave,
}: {
  kind: Kind;
  editing: PartyRow | null;
  onClose: () => void;
  onSave: (input: PartyInput) => Promise<void>;
}) {
  const { isPhone } = useViewport();
  const [name, setName] = useState(editing?.name ?? '');
  const [businessName, setBusinessName] = useState(editing?.businessName ?? '');
  const [gstin, setGstin] = useState(editing?.gstin ?? '');
  const [pan, setPan] = useState(editing?.pan ?? '');
  const [phone, setPhone] = useState(editing?.phone ?? '');
  const [email, setEmail] = useState(editing?.email ?? '');
  const [billingAddress, setBillingAddress] = useState(editing?.billingAddress ?? '');
  const [shippingAddress, setShippingAddress] = useState(editing?.shippingAddress ?? '');
  const [paymentTerms, setPaymentTerms] = useState(editing?.paymentTerms ?? '');
  const [creditLimit, setCreditLimit] = useState(
    editing?.creditLimit != null ? String(Number(editing.creditLimit)) : '',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        businessName: businessName.trim() || undefined,
        gstin: gstin.trim() || undefined,
        pan: pan.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        billingAddress: billingAddress.trim() || undefined,
        shippingAddress: shippingAddress.trim() || undefined,
        paymentTerms: paymentTerms || undefined,
        ...(kind === 'customer' ? { creditLimit: creditLimit === '' ? 0 : Number(creditLimit) } : {}),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={true} animationType={isPhone ? 'slide' : 'fade'} transparent onRequestClose={saving ? undefined : onClose}>
      <Pressable
        className={`flex-1 bg-black/40 ${isPhone ? 'justify-end' : 'items-center justify-center p-4'}`}
        onPress={saving ? undefined : onClose}
      >
        <Pressable
          className={`bg-card w-full ${isPhone ? 'rounded-t-2xl max-h-[92%] p-4' : 'rounded-2xl max-w-lg max-h-[85%] p-4'}`}
          onPress={(e) => e.stopPropagation()}
        >
          <Text className="text-lg font-bold text-text mb-1">{editing ? `Edit ${kind}` : `New ${kind}`}</Text>
          <Text className="text-sm text-muted mb-3">Saved to your {kind} master and reusable on invoices/bills.</Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Input label="Name *" value={name} onChangeText={setName} />
            <Input label="Business name (optional)" value={businessName} onChangeText={setBusinessName} />
            <Input label="GSTIN (optional)" value={gstin} onChangeText={setGstin} autoCapitalize="characters" />
            <Input label="PAN (optional)" value={pan} onChangeText={setPan} autoCapitalize="characters" />
            <Input label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <Input label="Email (optional)" value={email} onChangeText={setEmail} keyboardType="email-address" />
            <Input label="Billing address (optional)" value={billingAddress} onChangeText={setBillingAddress} multiline />
            <Input label="Shipping address (optional)" value={shippingAddress} onChangeText={setShippingAddress} multiline />
            <Select
              label="Payment terms"
              value={paymentTerms || undefined}
              onChange={(v) => v && setPaymentTerms(v)}
              options={PAYMENT_TERMS}
              placeholder="Not set"
            />
            {kind === 'customer' ? (
              <Input
                label="Credit limit ₹ (optional)"
                value={creditLimit}
                onChangeText={setCreditLimit}
                keyboardType="decimal-pad"
                placeholder="0 = upfront only"
              />
            ) : null}
            {error ? <Text className="text-sm text-danger mt-2">{error}</Text> : null}
            <View className="flex-row flex-wrap gap-2 mt-4 mb-4">
              <Button label="Cancel" variant="secondary" className="flex-1 min-w-[120px]" disabled={saving} onPress={onClose} />
              <Button label={saving ? 'Saving…' : 'Save'} variant="accent" className="flex-1 min-w-[120px]" loading={saving} onPress={submit} />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
