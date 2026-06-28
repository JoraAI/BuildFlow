/**
 * BuildFlow - Create Invoice
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
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Card, Button, Input, DateField } from '@/components/ui';
import { FormScreenHeader } from '@/components/layout/ScreenHeader';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ActionBar } from '@/components/layout/ActionBar';
import { useViewport } from '@/hooks/useViewport';
import { dismissTo, DISMISS } from '@/utils/navigation';
import { alertAsync } from '@/utils/confirm';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { useCreateInvoice, type InvoiceType } from '@/services/accounting.queries';
import { useProjects, type ProjectListItem } from '@/services/project.queries';
import { useBoq, type BoqItem } from '@/services/boq.queries';
import { formatINR } from '@/utils/format';

interface DraftLineItem {
  id: string;
  boqItemId?: string;
  description: string;
  quantity: string;
  unit: string;
  rate: string;
  gstRate: string;
  previousQty: string;
  currentQty: string;
  cumulativeQty: string;
}

function makeEmptyLine(): DraftLineItem {
  return {
    id: Math.random().toString(36).slice(2),
    description: '',
    quantity: '1',
    unit: 'Nos',
    rate: '0',
    gstRate: '18',
    previousQty: '0',
    currentQty: '0',
    cumulativeQty: '0',
  };
}

function boqToLine(item: BoqItem): DraftLineItem {
  const billable = item.billableQty ?? 0;
  const billed = item.billedCumulativeQty ?? 0;
  const previousQty = String(billed);
  const currentQty = billable > 0 ? String(billable) : '0';
  return {
    id: Math.random().toString(36).slice(2),
    boqItemId: item.id,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    rate: item.rate,
    gstRate: '18',
    previousQty,
    currentQty,
    cumulativeQty: String(billed + (billable > 0 ? billable : 0)),
  };
}

export default function CreateInvoiceScreen() {
  const router = useRouter();
  const { isDesktop } = useViewport();
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
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('STANDARD');
  const [retentionPct, setRetentionPct] = useState('0');
  const [milestoneLabel, setMilestoneLabel] = useState('');
  const [lines, setLines] = useState<DraftLineItem[]>([makeEmptyLine()]);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: boq } = useBoq(projectId);

  // Auto-fill client from project
  const selectedProject = projects?.find((p: ProjectListItem) => p.id === projectId);
  const effectiveClientName = clientName || selectedProject?.clientName || '';

  // Live preview computation
  const preview = useMemo(() => {
    const subtotal = lines.reduce((sum, l) => {
      const qty =
        invoiceType === 'RUNNING_ACCOUNT'
          ? parseFloat(l.currentQty) || 0
          : parseFloat(l.quantity) || 0;
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
    const retention = invoiceType === 'RUNNING_ACCOUNT' ? (parseFloat(retentionPct) || 0) : 0;
    const retentionAmount = (subtotal * retention) / 100;
    const total = subtotal + cgst + sgst + igst - tdsAmount - retentionAmount;
    return { subtotal, gst, gstAmount, cgst, sgst, igst, tdsRate, tdsAmount, retentionAmount, total };
  }, [lines, gstRate, clientState, tdsEnabled, invoiceType, retentionPct]);

  const loadBoqLines = async () => {
    if (!boq?.items.length) {
      setFormError('This project has no BOQ items. Add BOQ first or use manual entry.');
      await alertAsync('No BOQ', 'This project has no BOQ items. Add BOQ first or use manual entry.');
      return;
    }
    setFormError(null);
    setLines(boq.items.map(boqToLine));
  };

  const updateLine = (id: string, field: keyof DraftLineItem, value: string) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const addLine = () => setLines((prev) => [...prev, makeEmptyLine()]);
  const removeLine = (id: string) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((l) => l.id !== id)));

  const onSave = (send: boolean) => {
    setFormError(null);
    if (!projectId) {
      setFormError('Please choose a project for this invoice.');
      return;
    }
    if (!invoiceNumber.trim()) {
      setFormError('Please enter an invoice number.');
      return;
    }
    if (!effectiveClientName.trim()) {
      setFormError('Please enter the client name.');
      return;
    }
    const validLines = lines.filter((l) => {
      if (!l.description.trim()) return false;
      if (invoiceType === 'RUNNING_ACCOUNT') {
        return parseFloat(l.currentQty) > 0;
      }
      return parseFloat(l.quantity) > 0;
    });
    if (validLines.length === 0) {
      setFormError('Please add at least one line item with a description.');
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
        invoiceType,
        retentionPct: invoiceType === 'RUNNING_ACCOUNT' ? parseFloat(retentionPct) || 0 : undefined,
        milestoneLabel: invoiceType === 'MILESTONE' ? milestoneLabel.trim() || undefined : undefined,
        lineItems: validLines.map((l) => {
          const base = {
            boqItemId: l.boqItemId,
            description: l.description.trim(),
            unit: l.unit.trim() || 'Nos',
            rate: parseFloat(l.rate) || 0,
            gstRate: parseFloat(l.gstRate) || 0,
          };
          if (invoiceType === 'RUNNING_ACCOUNT') {
            const currentQty = parseFloat(l.currentQty) || 0;
            const previousQty = parseFloat(l.previousQty) || 0;
            return {
              ...base,
              quantity: currentQty,
              previousQty,
              currentQty,
              cumulativeQty: previousQty + currentQty,
            };
          }
          return {
            ...base,
            quantity: parseFloat(l.quantity) || 0,
          };
        }),
      },
      {
        onSuccess: async (invoice) => {
          await alertAsync(
            'Success',
            `Invoice ${invoice.invoiceNumber} created as ${invoice.status}.`,
          );
          dismissTo(DISMISS.accounting);
        },
        onError: async (e: unknown) => {
          const message = e instanceof Error ? e.message : 'Failed to create invoice';
          setFormError(message);
          await alertAsync('Error', message);
        },
      },
    );
  };

  const summaryCard = (
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
        {preview.retentionAmount > 0 && (
          <PreviewRow label="Retention" value={`- ${formatINR(preview.retentionAmount)}`} danger />
        )}
        <View className="h-px bg-border my-1" />
        <View className="flex-row justify-between">
          <Text className="text-base font-bold text-text">Net Payable</Text>
          <Text className="text-base font-bold text-primary">{formatINR(preview.total)}</Text>
        </View>
      </View>
    </Card>
  );

  const formFields = (
    <>
      <Card>
        <Text className="text-sm font-bold text-text mb-2">Project</Text>
        {!preselected && projects ? (
          <View className={`gap-1 ${isDesktop ? 'flex-row flex-wrap' : ''}`}>
            {projects.map((p: ProjectListItem) => (
              <Pressable
                key={p.id}
                onPress={() => {
                  setProjectId(p.id);
                  setClientName(p.clientName);
                }}
                className={`p-2 rounded-lg border ${isDesktop ? 'flex-1 min-w-[200px]' : ''} ${projectId === p.id ? 'bg-primary/10 border-primary' : 'border-border'}`}
              >
                <Text className="text-sm text-text">{p.name}</Text>
                <Text className="text-xs text-muted">{p.clientName}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text className="text-sm text-muted">{selectedProject?.name ?? projectId}</Text>
        )}
      </Card>

      <Card>
        <Text className="text-sm font-bold text-text mb-2">Invoice Type</Text>
        <View className={`flex-row flex-wrap gap-2 ${isDesktop ? '' : ''}`}>
          {(['STANDARD', 'RUNNING_ACCOUNT', 'MILESTONE'] as InvoiceType[]).map((type) => (
            <Pressable
              key={type}
              onPress={() => setInvoiceType(type)}
              className={`px-3 py-2 rounded-lg border ${
                invoiceType === type ? 'bg-primary border-primary' : 'border-border'
              }`}
            >
              <Text className={`text-xs font-semibold ${invoiceType === type ? 'text-white' : 'text-text'}`}>
                {type === 'RUNNING_ACCOUNT' ? 'Running Account' : type.charAt(0) + type.slice(1).toLowerCase()}
              </Text>
            </Pressable>
          ))}
        </View>
        {invoiceType === 'RUNNING_ACCOUNT' && (
          <View className="mt-3 gap-2">
            <Input
              label="Retention %"
              value={retentionPct}
              onChangeText={setRetentionPct}
              keyboardType="numeric"
              placeholder="5"
            />
            <Button label="Load from BOQ" variant="secondary" size="sm" onPress={loadBoqLines} />
          </View>
        )}
        {invoiceType === 'MILESTONE' && (
          <View className="mt-3">
            <Input
              label="Milestone label"
              value={milestoneLabel}
              onChangeText={setMilestoneLabel}
              placeholder="e.g. Foundation complete"
            />
          </View>
        )}
      </Card>

      <Card>
        <Text className="text-sm font-bold text-text mb-2">Invoice Details</Text>
        <View className={isDesktop ? 'flex-row gap-4' : ''}>
          <View className={isDesktop ? 'flex-1' : undefined}>
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
          </View>
          <View className={isDesktop ? 'flex-1' : undefined}>
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
              <View className={isDesktop ? 'flex-1' : 'w-32'}>
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
                <DateField label="Invoice Date" value={invoiceDate} onChange={setInvoiceDate} />
              </View>
              <View className="flex-1">
                <DateField label="Due Date" value={dueDate} onChange={setDueDate} minimumDate={invoiceDate} />
              </View>
            </View>
          </View>
        </View>
        <View className="flex-row gap-2 mt-2">
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
              <View
                className={`w-5 h-5 rounded border-2 items-center justify-center ${tdsEnabled ? 'bg-primary border-primary' : 'border-border'}`}
              >
                {tdsEnabled && <Text className="text-white text-xs">✓</Text>}
              </View>
              <Text className="text-sm text-text">TDS 2% (194C)</Text>
            </Pressable>
          </View>
        </View>
      </Card>

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
            {invoiceType === 'RUNNING_ACCOUNT' ? (
              <View className="flex-row gap-1 mb-2">
                <View className="flex-1">
                  <Text className="text-[10px] text-muted mb-0.5">Previous</Text>
                  <TextInput
                    className="border border-border rounded-lg p-2 text-xs text-text"
                    value={line.previousQty}
                    onChangeText={(v) => updateLine(line.id, 'previousQty', v)}
                    keyboardType="numeric"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] text-muted mb-0.5">Current</Text>
                  <TextInput
                    className="border border-border rounded-lg p-2 text-xs text-text"
                    value={line.currentQty}
                    onChangeText={(v) => updateLine(line.id, 'currentQty', v)}
                    keyboardType="numeric"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] text-muted mb-0.5">Cumulative</Text>
                  <TextInput
                    className="border border-border rounded-lg p-2 text-xs text-text bg-surface"
                    value={String(
                      (parseFloat(line.previousQty) || 0) + (parseFloat(line.currentQty) || 0),
                    )}
                    editable={false}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] text-muted mb-0.5">Rate</Text>
                  <TextInput
                    className="border border-border rounded-lg p-2 text-xs text-text"
                    value={line.rate}
                    onChangeText={(v) => updateLine(line.id, 'rate', v)}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            ) : (
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
            )}
            <View className="flex-row justify-between items-center mt-1">
              <TextInput
                className="w-24 border border-border rounded-lg p-2 text-xs text-text"
                placeholder="GST %"
                value={line.gstRate}
                onChangeText={(v) => updateLine(line.id, 'gstRate', v)}
                keyboardType="numeric"
              />
              <Text className="text-sm font-semibold text-text">
                {formatINR(
                  (invoiceType === 'RUNNING_ACCOUNT'
                    ? parseFloat(line.currentQty) || 0
                    : parseFloat(line.quantity) || 0) * (parseFloat(line.rate) || 0),
                )}
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

      {!isDesktop && summaryCard}
    </>
  );

  const formErrorBanner = formError ? (
    <View className="mb-2 px-3 py-2 rounded-lg bg-danger/10 border border-danger/30">
      <Text className="text-sm text-danger">{formError}</Text>
    </View>
  ) : null;

  const saveBar = (
    <Button
      label="Save Draft"
      variant="secondary"
      onPress={() => onSave(false)}
      loading={createInvoice.isPending}
      disabled={createInvoice.isPending}
    />
  );

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={isDesktop ? [] : ['bottom']}>
      <OfflineBanner />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {isDesktop ? (
          <ScreenContainer scrollable={false} constrained>
            <FormScreenHeader title="New Invoice" onCancel={() => dismissTo(DISMISS.accounting)} />
            <View className="flex-1 flex-row gap-6 items-start">
              <ScrollView className="flex-[2]" contentContainerClassName="gap-4 pb-6" showsVerticalScrollIndicator={false}>
                {formFields}
              </ScrollView>
              <View className="flex-1 max-w-sm">{summaryCard}</View>
            </View>
            <ActionBar>
              {formErrorBanner}
              {saveBar}
            </ActionBar>
          </ScreenContainer>
        ) : (
          <>
            <FormScreenHeader title="New Invoice" onCancel={() => dismissTo(DISMISS.accounting)} />
            <ScrollView contentContainerClassName="px-4 pb-32 pt-2 gap-4">{formFields}</ScrollView>
            <View className="absolute bottom-0 left-0 right-0 bg-card border-t border-border p-4">
              {formErrorBanner}
              {saveBar}
            </View>
          </>
        )}
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