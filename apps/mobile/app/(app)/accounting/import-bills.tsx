/**
 * R9-B3: Bulk vendor bill import screen.
 *
 * Flow: Multi-file DocumentPicker → extract-batch → review table → bulk-create.
 * Gated by bill.create permission.
 */
import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FormScreenHeader } from '@/components/layout/ScreenHeader';
import { Card, Badge, Button, Input, EmptyState } from '@/components/ui';
import { usePermission } from '@/hooks/usePermission';
import { useExtractBillBatch, useBulkCreateBills, type BillExtractDraft } from '@/services/accounting.queries';
import { useProjects } from '@/services/project.queries';
import { dismissTo, DISMISS } from '@/utils/navigation';
import { alertAsync } from '@/utils/confirm';
import { formatINR } from '@/utils/format';

// R9-B3: File picker — uses expo-document-picker
async function pickInvoiceFiles(): Promise<Array<{ fileContent: string; filename: string; contentType: string }>> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getDocumentAsync } = require('expo-document-picker');
  const result = await getDocumentAsync({ multiple: true, type: ['application/pdf', 'image/*'] });
  if (result.canceled || !result.assets?.length) return [];
  const files: Array<{ fileContent: string; filename: string; contentType: string }> = [];
  for (const asset of result.assets) {
    try {
      const res = await fetch(asset.uri);
      const blob = await res.blob();
      const reader = new FileReader();
      const base64: string = await new Promise((resolve, reject) => {
        reader.onloadend = () => {
          const str = reader.result as string;
          const comma = str.indexOf(',');
          resolve(comma >= 0 ? str.slice(comma + 1) : str);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      files.push({
        fileContent: base64,
        filename: asset.name || 'invoice.pdf',
        contentType: asset.mimeType || 'application/pdf',
      });
    } catch {
      // skip unreadable files
    }
  }
  return files;
}

interface ReviewRow {
  draft: BillExtractDraft;
  include: boolean;
  vendorName: string;
  billNumber: string;
  subtotal: string;
  gstAmount: string;
  category: string;
}

export default function ImportBillsScreen() {
  const router = useRouter();
  const canCreate = usePermission('bill.create');
  const { data: projectsData } = useProjects();
  const projects = projectsData ?? [];
  const [projectId, setProjectId] = useState('');
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [extracting, setExtracting] = useState(false);

  const extractBatch = useExtractBillBatch(projectId);
  const bulkCreate = useBulkCreateBills(projectId);

  if (!canCreate) {
    return (
      <SafeAreaView className="flex-1 bg-surface" edges={['bottom']}>
        <FormScreenHeader title="Import vendor bills" onCancel={() => dismissTo(DISMISS.accounting)} />
        <View className="px-4 pt-4">
          <EmptyState title="No access" description="You need bill.create permission to import vendor bills." />
        </View>
      </SafeAreaView>
    );
  }

  const onPickFiles = async () => {
    if (!projectId) {
      void alertAsync('Select project', 'Pick a project first.');
      return;
    }
    setExtracting(true);
    try {
      const files = await pickInvoiceFiles();
      if (files.length === 0) return;
      const result = await extractBatch.mutateAsync(files);
      const rows: ReviewRow[] = result.drafts.map((draft) => ({
        draft,
        include: true,
        vendorName: draft.vendorName,
        billNumber: draft.billNumber ?? '',
        subtotal: String(draft.subtotal),
        gstAmount: String(draft.gstAmount),
        category: draft.category,
      }));
      setReviewRows(rows);
      if (rows.length === 0) {
        void alertAsync('No drafts', result.notes || 'AI could not extract any bills. Enter manually.');
      }
    } catch (e) {
      void alertAsync('Error', (e as Error).message);
    } finally {
      setExtracting(false);
    }
  };

  const onBulkCreate = () => {
    const included = reviewRows.filter((r) => r.include);
    if (included.length === 0) {
      void alertAsync('No rows', 'Select at least one invoice to create.');
      return;
    }
    const bills = included.map((r) => ({
      vendorName: r.vendorName,
      billNumber: r.billNumber || undefined,
      billDate: r.draft.billDate || new Date().toISOString().slice(0, 10),
      subtotal: parseFloat(r.subtotal) || 0,
      gstAmount: parseFloat(r.gstAmount) || 0,
      tdsAmount: 0,
      category: r.category as 'MATERIAL' | 'LABOUR' | 'EQUIPMENT' | 'SUBCONTRACTOR' | 'OTHER',
      notes: 'source:AI_EXTRACT',
      // R10-B4: Pass AI-extracted PO hint per row (service resolves to FK).
      poNumberHint: r.draft.poNumberHint,
      projectId,
    }));
    bulkCreate.mutate(bills, {
      onSuccess: (data) => {
        void alertAsync('Bills created', `${data.created} vendor bill(s) created as PENDING.`);
        router.back();
      },
      onError: (e: Error) => void alertAsync('Error', e.message),
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['bottom']}>
      {/* R10-B5: Screen chrome with title + back navigation. */}
      <FormScreenHeader title="Import vendor bills" onCancel={() => dismissTo(DISMISS.accounting)} />
      <ScrollView contentContainerClassName="px-4 pb-8 pt-2 gap-3">
      {/* Project picker */}
      <Text className="text-sm font-semibold text-text mb-1">Project</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 mb-3">
        {projects.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => setProjectId(p.id)}
            className={`px-3 py-1.5 rounded-full border ${projectId === p.id ? 'bg-primary border-primary' : 'border-border'}`}
          >
            <Text className={`text-xs ${projectId === p.id ? 'text-white' : 'text-muted'}`} numberOfLines={1}>
              {p.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Upload button */}
      <Button
        label="📎 Select invoice files (PDF/Image)"
        onPress={() => void onPickFiles()}
        loading={extracting}
        fullWidth
      />

      {/* AI notes */}
      {reviewRows.length > 0 && (
        <Text className="text-xs text-muted mt-2">
          Review each extracted invoice. Edit fields, deselect rows to skip, then create.
        </Text>
      )}

      {/* Review table */}
      {reviewRows.map((row, idx) => (
        <Card key={idx}>
          <View className="flex-row justify-between items-center mb-2">
            <View className="flex-1">
              <Text className="text-sm font-semibold text-text" numberOfLines={1}>
                {row.draft.filename || `Invoice ${idx + 1}`}
              </Text>
              <View className="flex-row gap-1.5 mt-0.5">
                <Badge
                  label={row.draft.confidence > 0.7 ? 'High confidence' : 'Low confidence'}
                  color={row.draft.confidence > 0.7 ? 'success' : 'warning'}
                />
              </View>
            </View>
            <Pressable
              onPress={() => setReviewRows((prev) => prev.map((r, i) => i === idx ? { ...r, include: !r.include } : r))}
              className={`w-6 h-6 rounded border ${row.include ? 'bg-primary border-primary' : 'border-border'}`}
            >
              {row.include ? <Text className="text-white text-center text-xs leading-6">✓</Text> : null}
            </Pressable>
          </View>
          <Input
            label="Vendor"
            value={row.vendorName}
            onChangeText={(v: string) => setReviewRows((prev) => prev.map((r, i) => i === idx ? { ...r, vendorName: v } : r))}
            fullWidth
          />
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Input
                label="Supplier inv no."
                value={row.billNumber}
                onChangeText={(v: string) => setReviewRows((prev) => prev.map((r, i) => i === idx ? { ...r, billNumber: v } : r))}
                fullWidth
              />
            </View>
            <View className="flex-1">
              <Input
                label="Subtotal (₹)"
                value={row.subtotal}
                onChangeText={(v: string) => setReviewRows((prev) => prev.map((r, i) => i === idx ? { ...r, subtotal: v } : r))}
                keyboardType="decimal-pad"
                fullWidth
              />
            </View>
          </View>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Input
                label="GST (₹)"
                value={row.gstAmount}
                onChangeText={(v: string) => setReviewRows((prev) => prev.map((r, i) => i === idx ? { ...r, gstAmount: v } : r))}
                keyboardType="decimal-pad"
                fullWidth
              />
            </View>
            <View className="flex-1">
              <Input
                label="Category"
                value={row.category}
                onChangeText={(v: string) => setReviewRows((prev) => prev.map((r, i) => i === idx ? { ...r, category: v } : r))}
                fullWidth
              />
            </View>
          </View>
          <Text className="text-xs text-muted text-right mt-1">
            Total: {formatINR((parseFloat(row.subtotal) || 0) + (parseFloat(row.gstAmount) || 0))}
          </Text>
        </Card>
      ))}

      {/* Create button */}
      {reviewRows.filter((r) => r.include).length > 0 && (
        <Button
          label={`Create ${reviewRows.filter((r) => r.include).length} bill(s)`}
          onPress={() => void onBulkCreate()}
          loading={bulkCreate.isPending}
          fullWidth
        />
      )}
      </ScrollView>
    </SafeAreaView>
  );
}
