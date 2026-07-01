/**
 * Public subcontractor portal - no authentication required.
 * Route: /portal/sub/:token
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Card, Badge, EmptyState, Button, Input } from '@/components/ui';
import { useSubPortalData } from '@/services/expansion.queries';
import { formatINR, formatDate } from '@/utils/format';
import { API_BASE_URL } from '@/constants';
import { alertAsync } from '@/utils/confirm';

export default function SubPortalScreen() {
  const { token: tokenParam } = useLocalSearchParams<{ token: string }>();
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam ?? '';
  const { data, isLoading, isError, error, refetch } = useSubPortalData(token);

  const [periodLabel, setPeriodLabel] = useState('');
  const [desc, setDesc] = useState('');
  const [qty, setQty] = useState('1');
  const [rate, setRate] = useState('0');
  const [submitting, setSubmitting] = useState(false);

  const workOrder = data?.workOrder ?? data?.workOrders?.[0];

  const onSubmitMeasurement = async () => {
    if (!workOrder || !token) return;
    if (!periodLabel.trim() || !desc.trim()) {
      void alertAsync('Required', 'Period and description are required.');
      return;
    }
    setSubmitting(true);
    try {
      const createRes = await fetch(
        `${API_BASE_URL}/portal/sub/${token}/work-orders/${workOrder.id}/measurements`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            periodLabel: periodLabel.trim(),
            lines: [
              {
                description: desc.trim(),
                quantity: parseFloat(qty) || 1,
                unit: 'sqm',
                rate: parseFloat(rate) || 0,
              },
            ],
          }),
        },
      );
      const body = await createRes.json();
      if (!createRes.ok || !body.success) {
        throw new Error(body.error?.message ?? 'Could not create measurement');
      }
      const measId = body.data.id as string;
      const submitRes = await fetch(
        `${API_BASE_URL}/portal/sub/${token}/measurements/${measId}/submit`,
        { method: 'POST' },
      );
      const submitBody = await submitRes.json();
      if (!submitRes.ok || !submitBody.success) {
        throw new Error(submitBody.error?.message ?? 'Could not submit measurement');
      }
      setPeriodLabel('');
      setDesc('');
      await alertAsync('Submitted', 'Measurement sheet submitted for PM approval.');
      await refetch();
    } catch (e) {
      void alertAsync('Error', e instanceof Error ? e.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator size="large" color="#1E3A5F" />
        <Text className="text-muted mt-3">Loading subcontractor portal…</Text>
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <Stack.Screen options={{ title: 'Subcontractor Portal' }} />
        <EmptyState
          title="Invalid link"
          description={
            error instanceof Error ? error.message : 'This portal link is invalid or has expired.'
          }
        />
      </SafeAreaView>
    );
  }

  const canSubmit = data.scopes.includes('SUBMIT_MEASUREMENT');

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <Stack.Screen options={{ title: data.label }} />
      <ScrollView className="flex-1 p-4" contentContainerClassName="gap-3 pb-8">
        <Card>
          <Text className="text-lg font-bold text-text">{data.project.name}</Text>
          <Text className="text-sm text-muted">{data.subcontractor.name}</Text>
          <Text className="text-xs text-muted mt-1">Expires {formatDate(data.expiresAt)}</Text>
        </Card>

        {workOrder && (
          <Card>
            <View className="flex-row justify-between items-center">
              <Text className="text-sm font-semibold text-text">{workOrder.woNumber}</Text>
              <Badge label={workOrder.status} color="neutral" />
            </View>
            <Text className="text-xs text-muted mt-1">{workOrder.scope}</Text>
            <Text className="text-sm font-bold text-primary mt-2">
              {formatINR(parseFloat(workOrder.contractValue))}
            </Text>
          </Card>
        )}

        {data.payments && data.payments.length > 0 && (
          <Card>
            <Text className="text-sm font-bold text-text mb-2">Payments</Text>
            {data.payments.map((p) => (
              <View key={p.id} className="flex-row justify-between py-1">
                <Text className="text-xs text-text">{p.billNumber}</Text>
                <Text className="text-xs text-muted">
                  {formatINR(parseFloat(p.paidAmount))} / {formatINR(parseFloat(p.total))}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {canSubmit && workOrder && (
          <Card>
            <Text className="text-sm font-bold text-text mb-2">Submit measurement</Text>
            <Input label="Period" value={periodLabel} onChangeText={setPeriodLabel} placeholder="Jun 2025" />
            <TextInput
              className="border border-border rounded-lg p-2 text-sm text-text mb-2"
              placeholder="Work description"
              value={desc}
              onChangeText={setDesc}
              multiline
            />
            <View className="flex-row gap-2">
              <Input label="Qty" value={qty} onChangeText={setQty} keyboardType="numeric" />
              <Input label="Rate" value={rate} onChangeText={setRate} keyboardType="numeric" />
            </View>
            <Button
              label={submitting ? 'Submitting…' : 'Submit for approval'}
              onPress={onSubmitMeasurement}
              disabled={submitting}
            />
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
