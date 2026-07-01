import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui';
import { useProjectEstimates } from '@/services/estimate.queries';
import { useBoq } from '@/services/boq.queries';
import { useWorkOrders, useRequisitions } from '@/services/expansion.queries';
import { useInvoices } from '@/services/accounting.queries';
import { useTasks } from '@/services/project.queries';
import { useReports } from '@/services/report.queries';
import { useOnboardingStore } from '@/stores/onboarding.store';
import { PROJECT_SETUP_STEPS, type ProjectTabId } from '@/constants/project-workflow';

interface ProjectSetupChecklistProps {
  projectId: string;
  onGoToTab: (tab: ProjectTabId) => void;
}

export function ProjectSetupChecklist({ projectId, onGoToTab }: ProjectSetupChecklistProps) {
  const dismissKey = `project-setup-${projectId}`;
  const loaded = useOnboardingStore((s) => s.loaded);
  const dismissed = useOnboardingStore((s) => s.isDismissed(dismissKey));
  const dismiss = useOnboardingStore((s) => s.dismiss);

  const estimatesQ = useProjectEstimates(projectId);
  const boqQ = useBoq(projectId);
  const woQ = useWorkOrders(projectId);
  const reqQ = useRequisitions(projectId);
  const invQ = useInvoices(projectId);
  const tasksQ = useTasks(projectId);
  const reportsQ = useReports(projectId);

  const completed = useMemo(() => {
    const estimates = estimatesQ.data ?? [];
    const hasApprovedEstimate = estimates.some((e: { status: string }) => e.status === 'APPROVED');
    const hasBoq = (boqQ.data?.items?.length ?? 0) > 0;
    const hasSchedule = (tasksQ.data?.length ?? 0) > 0;
    const hasReports = (reportsQ.data?.length ?? 0) > 0;
    const hasProcurement = (reqQ.data?.length ?? 0) > 0;
    const hasSubcontracts = (woQ.data?.length ?? 0) > 0;
    const hasInvoices = (invQ.data?.length ?? 0) > 0;

    return {
      estimate: hasApprovedEstimate,
      boq: hasBoq,
      schedule: hasSchedule,
      reports: hasReports,
      procurement: hasProcurement,
      subcontracts: hasSubcontracts,
      invoices: hasInvoices,
    };
  }, [estimatesQ.data, boqQ.data, tasksQ.data, reportsQ.data, reqQ.data, woQ.data, invQ.data]);

  const steps = PROJECT_SETUP_STEPS.map((s) => ({
    ...s,
    done: completed[s.id as keyof typeof completed] ?? false,
  }));

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  if (!loaded || dismissed || allDone) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <View className="flex-row justify-between items-start mb-3 gap-2">
        <View className="flex-1">
          <Text className="text-sm font-bold text-text">Project setup guide</Text>
          <Text className="text-xs text-muted mt-0.5">
            {doneCount} of {steps.length} steps done — follow this path for a new project
          </Text>
        </View>
        <Pressable onPress={() => void dismiss(dismissKey)} hitSlop={8}>
          <Ionicons name="close" size={20} color="#64748B" />
        </Pressable>
      </View>
      <View className="gap-2">
        {steps.map((step) => (
          <Pressable
            key={step.id}
            onPress={() => onGoToTab(step.tab)}
            className={`flex-row items-center gap-3 p-2 rounded-lg border ${
              step.done ? 'border-success/30 bg-success/5' : 'border-border bg-card'
            } active:opacity-80`}
          >
            <Ionicons
              name={step.done ? 'checkmark-circle' : 'ellipse-outline'}
              size={20}
              color={step.done ? '#16A34A' : '#94A3B8'}
            />
            <View className="flex-1 min-w-0">
              <Text className={`text-sm font-medium ${step.done ? 'text-muted line-through' : 'text-text'}`}>
                {step.label}
              </Text>
              <Text className="text-xs text-muted" numberOfLines={1}>
                {step.hint}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
          </Pressable>
        ))}
      </View>
    </Card>
  );
}
