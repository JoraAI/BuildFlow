/**
 * BuildFlow — Project Accounting (Invoices + Bills for one project)
 * Route: /accounting/project/[id]?tab=invoices|bills
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FAB, Button } from '@/components/ui';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { FormScreenHeader, FilterChip, FilterChipRow } from '@/components/layout/ScreenHeader';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProjectInvoicesList, ProjectBillsList } from '@/components/accounting/InvoiceBillLists';
import { dismissTo, DISMISS } from '@/utils/navigation';
import { useViewport } from '@/hooks/useViewport';
import { useProject } from '@/services/project.queries';

export default function ProjectAccountingScreen() {
  const { id: projectId, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const [tab, setTab] = useState<'invoices' | 'bills'>(initialTab === 'bills' ? 'bills' : 'invoices');
  const router = useRouter();
  const { isDesktop } = useViewport();
  const { data: project } = useProject(projectId ?? '');

  const createPath = `/accounting/${tab === 'invoices' ? 'create-invoice' : 'create-bill'}?projectId=${projectId}`;

  const tabChips = (
    <FilterChipRow>
      <FilterChip label="Invoices" active={tab === 'invoices'} onPress={() => setTab('invoices')} />
      <FilterChip label="Bills" active={tab === 'bills'} onPress={() => setTab('bills')} />
    </FilterChipRow>
  );

  if (isDesktop) {
    return (
      <SafeAreaView className="flex-1 bg-surface" edges={[]}>
        <OfflineBanner />
        <ScreenContainer scrollable={false} constrained>
          <PageHeader
            title={project?.name ?? 'Project Accounting'}
            subtitle={project?.clientName ?? 'Invoices & vendor bills'}
            actions={
              <View className="flex-row gap-2">
                <Button
                  label="Back"
                  size="sm"
                  variant="secondary"
                  onPress={() => dismissTo(DISMISS.accounting)}
                  icon={<Ionicons name="arrow-back" size={16} color="#1E3A5F" />}
                />
                <Button
                  label={tab === 'invoices' ? 'New Invoice' : 'New Bill'}
                  size="sm"
                  onPress={() => router.push(createPath as never)}
                  icon={<Ionicons name="add" size={18} color="#fff" />}
                />
              </View>
            }
          />
          {tabChips}
          <View className="border border-border rounded-2xl overflow-hidden bg-card min-h-[480px]">
            {tab === 'invoices' ? (
              <ProjectInvoicesList projectId={projectId} embedded />
            ) : (
              <ProjectBillsList projectId={projectId} embedded />
            )}
          </View>
        </ScreenContainer>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <OfflineBanner />
      <FormScreenHeader
        title={project?.name ?? 'Project Accounting'}
        subtitle={project?.clientName}
        cancelLabel="Back"
        onCancel={() => dismissTo(DISMISS.accounting)}
      />
      {tabChips}
      {tab === 'invoices' ? <ProjectInvoicesList projectId={projectId} /> : <ProjectBillsList projectId={projectId} />}
      <FAB
        label={tab === 'invoices' ? 'Invoice' : 'Bill'}
        onPress={() => router.push(createPath as never)}
      />
    </SafeAreaView>
  );
}
