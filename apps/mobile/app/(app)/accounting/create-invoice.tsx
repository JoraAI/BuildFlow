/**
 * BuildFlow — Create Invoice
 * Route: /accounting/create-invoice?projectId=<id>
 *
 * Source toggle: Manual entry (BOQ/Estimate sourcing is a future enhancement;
 * for now we support a manual line-item builder with live GST + TDS preview).
 */
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Card, Button, Input, Badge } from '@/components/ui';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { useCreateInvoice } from '@/services/accounting.queries';
import { useProjects, type ProjectListItem } from '@/services/project.queries';
import { formatINR } from '@/utils/format';

interface DraftLineItem {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  rate: string;
  gstRate: string;
}

function makeEmptyLine(): DraftLineItem {
  return {
    id: Math.random().toString(36).slice(2),
    description: '',
    quantity: '1',
    unit: 'Nos',
    rate: '0',
    gstRate: '18',
  };
}

export default function CreateInvoiceScreen() {
  const router = useRouter();
  const { projectId: preselected } = useLocalSearchParams<{ projectId?: string }>();
  const { data: projects } = useProjects();
  const createInvoice = useCreateInvoice();

  const [projectId, setProjectId] = useState(preselected ?? '');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientGstin, setClientGstin] = useState('');
  const [clientState, setClientState] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
  const [gstRate, setGstRate] = useState('18');
  const [tdsEnabled, setTdsEnabled] = useState(false);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLineItem[]>([makeEmptyLine()]);

  // Auto-fill client from project
  const selectedProject = projects?.find((p: ProjectListItem) => p.id === projectId);
  const effectiveClientName = clientName || selectedProject?.clientName || '';

  // Live preview computation
  const preview = useMemo(() => {
    const subtotal = lines.reduce((sum, l) => {
      const qty = parseFloat(l.quantity) || 0;
      const rate = parseFloat(l.rate) || 0;
      return sum + qty * rate;
    }, 0);

    const gst = parseFloat(gstRate) || 0;
    const intraState = clientState.toUpperCase() === 'TELANGANA';
    const gstAmount = (subtotal * gst) / 100;
    const cgst = intraState ? gstAmount / 2 : 0;
    const sgst = intraState ? gstAmount / 2 : 0;
    const igst = intraState ? 0 : gstAmount;
    const tdsRate = tdsEnabled ? 2 : 0;
    const tdsAmount = tdsEnabled ? (subtotal * 2) / 100 : 0;
    const total = subtotal + cgst + sgst + igst - tdsAmount;
    return { subtotal, gst, gstAmount, cgst, sgst, igst, tdsRate, tdsAmount, total };
  }, [lines, gstRate, clientState, tdsEnabled]);

  const updateLine = (id: string, field: keyof DraftLineItem, value: string) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const addLine = () => setLines((prev) => [...prev, makeEmptyLine()]);
  const removeLine = (id: string) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((l) => l.id !== id)));

  const onSave = (send: boolean) => {
    if (!projectId) {
      Alert.alert('Select project', 'Please choose a project for this invoice.');
      return;
    }
    if (!invoiceNumber.trim()) {
      Alert.alert('Invoice number required', 'Please enter an invoice number.');
      return;
    }
    if (!effectiveClientName.trim()) {
      Alert.alert('Client name required', 'Please enter the client name.');
      return;
    }
    const validLines = lines.filter((l) => l.description.trim() && parseFloat(l.quantity) > 0);
    if (validLines.length === 0) {
      Alert.alert('Add line items', 'Please add at least one line item with a description.');
      return;
    }

    createInvoice.mutate(
      {
        projectId,
        invoiceNumber: invoiceNumber.trim(),
        clientName: effectiveClientName.trim(),
        clientGstin: clientGstin.trim() || undefined,
        clientState: clientState.trim() || undefined,
        invoiceDate,
        dueDate,
        gstRate: parseFloat(gstRate) || 0,
        tdsEnabled,
        notes: notes.trim() || undefined,
        lineItems: validLines.map((l) => ({
          description: l.description.trim(),
          quantity: parseFloat(l.quantity) || 0,
          unit: l.unit.trim() || 'Nos',
          rate: parseFloat(l.rate) || 0,
          gstRate: parseFloat(l.gstRate) || 0,
        })),
      },
      {
        onSuccess: (invoice) => {
          Alert.alert(
            'Success',
            `Invoice ${invoice.invoiceNumber} created as ${invoice.status}.`,
            [{ text: 'OK', onPress: () => router.back() }],
          );
        },
        onError: (e: unknown) => {
          const message = e instanceof Error ? e.message : 'Failed to create invoice';
          Alert.alert('Error', message);
        },
      },
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <OfflineBanner />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView contentContainerClassName="px-4 pb-32 pt-4 gap-4">
          <View className="flex-row items-center justify-between">
            <Pressable onPress={() => router.back()}>
              <Text className="text-primary text-base font-medium">‹ Cancel</Text>
            </Pressable>
            <Text className="text-lg font-bold text-text">New Invoice</Text>
            <View style={{ width: 50 }} />
          </View>

          {/* Project picker */}
          <Card>
            <Text className="text-sm font-bold text-text mb-2">Project</Text>
            {!preselected && projects ? (
              <View className="gap-1">
                {projects.map((p: ProjectListItem) => (
                  <Pressable
                    key={p.id}
                    onPress={() => {
                      setProjectId(p.id);
                      setClientName(p.clientName);
                    }}
                    className={`p-2 rounded-lg border ${projectId === p.id ? 'bg-primary/10 border-primary' : 'border-border'}`}
                  >
                    <Text className="text-sm text-text">{p.name}</Text>
                    <Text className="text-xs text-muted">{p.clientName}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text className="text-sm text-muted">
                {selectedProject?.name ?? projectId}
              </Text>
            )}
          </Card>

          {/* Invoice details */}
          <Card>
            <Text className="text-sm font-bold text-text mb-2">Invoice Details</Text>
            <Input
              label="Invoice Number"
              value={invoiceNumber}
              onChangeText={setInvoiceNumber}
              placeholder="INV-2025-001"
            />
            <Input
              label="Client Name"
              value={effectiveClientName}
              onChangeText={setClientName}
              placeholder="Client name"
            />
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Input
                  label="Client GSTIN"
                  value={clientGstin}
                  onChangeText={setClientGstin}
                  placeholder="36ABCDE1234F1Z5"
                  autoCapitalize="characters"
                />
              </View>
              <View className="w-32">
                <Input
                  label="Client State"
                  value={clientState}
                  onChangeText={setClientState}
                  placeholder="Telangana"
                  autoCapitalize="characters"
                />
              </View>
            </View>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Input
                  label="Invoice Date"
                  value={invoiceDate}
                  onChangeText={setInvoiceDate}
                  placeholder="YYYY-MM-DD"
                />
              </View>
              <View className="flex-1">
                <Input
                  label="Due Date"
                  value={dueDate}
                  onChangeText={setDueDate}
                  placeholder="YYYY-MM-DD"
                />
              </View>
            </View>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Input
                  label="GST Rate (%)"
                  value={gstRate}
                  onChangeText={setGstRate}
                  keyboardType="numeric"
                  placeholder="18"
                />
              </View>
              <View className="flex-1 justify-end pb-2">
                <Pressable
                  onPress={() => setTdsEnabled((v) => !v)}
                  className={`flex-row items-center gap-2 p-3 rounded-lg border ${tdsEnabled ? 'border-primary bg-primary/5' : 'border-border'}`}
                >
                  <View className={`w-5 h-5 rounded border-2 items-center justify-center ${tdsEnabled ? 'bg-primary border-primary' : 'border-border'}`}>
                    {tdsEnabled && <Text className="text-white text-xs">✓</Text>}
                  </View>
                  <Text className="text-sm text-text">TDS 2% (194C)</Text>
                </Pressable>
              </View>
            </View>
          </Card>

          {/* Line items */}
          <Card>
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-sm font-bold text-text">Line Items</Text>
              <Pressable onPress={addLine}>
                <Text className="text-primary text-sm font-semibold">+ Add</Text>
              </Pressable>
            </View>

            {lines.map((line, idx) => (
              <View key={line.id} className="border-b border-border pb-3 mb-3">
                <View className="flex-row justify-between items-center mb-1">
                  <Text className="text-xs text-muted">Item {idx + 1}</Text>
                  {lines.length > 1 && (
                    <Pressable onPress={() => removeLine(line.id)}>
                      <Text className="text-danger text-xs">Remove</Text>
                    </Pressable>
                  )}
                </View>
                <TextInput
                  className="border border-border rounded-lg p-2 text-sm text-text mb-2"
                  placeholder="Description (e.g. RCC M25 work)"
                  value={line.description}
                  onChangeText={(v) => updateLine(line.id, 'description', v)}
                  multiline
                />
                <View className="flex-row gap-2">
                  <TextInput
                    className="flex-1 border border-border rounded-lg p-2 text-sm text-text"
                    placeholder="Qty"
                    value={line.quantity}
                    onChangeText={(v) => updateLine(line.id, 'quantity', v)}
                    keyboardType="numeric"
                  />
                  <TextInput
                    className="w-20 border border-border rounded-lg p-2 text-sm text-text"
                    placeholder="Unit"
                    value={line.unit}
                    onChangeText={(v) => updateLine(line.id, 'unit', v)}
                  />
                  <TextInput
                    className="flex-1 border border-border rounded-lg p-2 text-sm text-text"
                    placeholder="Rate"
                    value={line.rate}
                    onChangeText={(v) => updateLine(line.id, 'rate', v)}
                    keyboardType="numeric"
                  />
                </View>
                <View className="flex-row justify-between items-center mt-1">
                  <TextInput
                    className="w-24 border border-border rounded-lg p-2 text-xs text-text"
                    placeholder="GST %"
                    value={line.gstRate}
                    onChangeText={(v) => updateLine(line.id, 'gstRate', v)}
                    keyboardType="numeric"
                  />
                  <Text className="text-sm font-semibold text-text">
                    {formatINR((parseFloat(line.quantity) || 0) * (parseFloat(line.rate) || 0))}
                  </Text>
                </View>
              </View>
            ))}
          </Card>

          <Input
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional notes / terms"
            multiline
          />

          {/* Live preview */}
          <Card>
            <Text className="text-sm font-bold text-text mb-2">Summary Preview</Text>
            <View className="gap-1.5">
              <PreviewRow label="Subtotal" value={formatINR(preview.subtotal)} />
              {preview.cgst > 0 && <PreviewRow label="CGST" value={formatINR(preview.cgst)} muted />}
              {preview.sgst > 0 && <PreviewRow label="SGST" value={formatINR(preview.sgst)} muted />}
              {preview.igst > 0 && <PreviewRow label="IGST" value={formatINR(preview.igst)} muted />}
              {preview.tdsAmount > 0 && (
                <PreviewRow label={`TDS (${preview.tdsRate}%)`} value={`- ${formatINR(preview.tdsAmount)}`} danger />
              )}
              <View className="h-px bg-border my-1" />
              <View className="flex-row justify-between">
                <Text className="text-base font-bold text-text">Net Payable</Text>
                <Text className="text-base font-bold text-primary">{formatINR(preview.total)}</Text>
              </View>
            </View>
          </Card>
        </ScrollView>

        {/* Sticky save bar */}
        <View className="absolute bottom-0 left-0 right-0 bg-card border-t border-border p-4 flex-row gap-2">
          <View className="flex-1">
            <Button
              label={createInvoice.isPending ? 'Saving...' : 'Save Draft'}
              variant="secondary"
              onPress={() => onSave(false)}
              disabled={createInvoice.isPending}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PreviewRow({
  label,
  value,
  muted,
  danger,
}: {
  label: string;
  value: string;
  muted?: boolean;
  danger?: boolean;
}) {
  return (
    <View className="flex-row justify-between">
      <Text className={`text-sm ${muted ? 'text-muted' : 'text-text'}`}>{label}</Text>
      <Text className={`text-sm ${danger ? 'text-danger' : muted ? 'text-muted' : 'text-text'}`}>
        {value}
      </Text>
    </View>
  );
}