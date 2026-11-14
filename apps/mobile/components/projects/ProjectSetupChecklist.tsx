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
import { useDrawings } from '@/services/drawing.queries';
import { useSnagItems } from '@/services/snag.queries';
import { useRfis } from '@/services/rfi.queries';
import { usePettyCashEntries } from '@/services/petty-cash.queries';
import { useOnboardingStore } from '@/stores/onboarding.store';
import { usePermissions } from '@/hooks/usePermission';
import { PROJECT_SETUP_STEPS, type ProjectTabId } from '@/constants/project-workflow';

interface ProjectSetupChecklistProps {
  projectId: string;
  onGoToTab: (tab: ProjectTabId) => void;
  /** Tabs the current role may open — steps for other tabs are hidden. */
  allowedTabs?: ProjectTabId[];
}

const TAB_PERMISSION: Partial<Record<ProjectTabId, string>> = {
  estimate: 'estimate.view',
  schedule: 'planning.view',
  boq: 'boq.view',
  invoices: 'invoice.view',
  bills: 'bill.view',
  procurement: 'procurement.view',
  subcontracts: 'subcontract.view',
  pettyCash: 'petty_cash.view',
  drawings: 'drawing.view',
  snags: 'snag.view',
  rfis: 'rfi.view',
  reports: 'report.view',
};

export function ProjectSetupChecklist({
  projectId,
  onGoToTab,
  allowedTabs,
}: ProjectSetupChecklistProps) {
  const dismissKey = `project-setup-${projectId}`;
  const loaded = useOnboardingStore((s) => s.loaded);
  const dismissed = useOnboardingStore((s) => s.isDismissed(dismissKey));
  const dismiss = useOnboardingStore((s) => s.dismiss);
  const { hasPermission } = usePermissions();

  const canEstimate = hasPermission('estimate.view');
  const canBoq = hasPermission('boq.view');
  const canSchedule = hasPermission('planning.view');
  const canReports = hasPermission('report.view');
  const canProcurement = hasPermission('procurement.view');
  const canSubcontracts = hasPermission('subcontract.view');
  const canInvoices = hasPermission('invoice.view');
  const canDrawings = hasPermission('drawing.view');
  const canSnags = hasPermission('snag.view');
  const canRfis = hasPermission('rfi.view');
  const canPetty = hasPermission('petty_cash.view');

  const estimatesQ = useProjectEstimates(canEstimate ? projectId : '');
  const boqQ = useBoq(canBoq ? projectId : '');
  const woQ = useWorkOrders(canSubcontracts ? projectId : '');
  const reqQ = useRequisitions(canProcurement ? projectId : '');
  const invQ = useInvoices(canInvoices ? projectId : '');
  const tasksQ = useTasks(canSchedule ? projectId : '');
  const reportsQ = useReports(canReports ? projectId : '');
  const drawingsQ = useDrawings({ projectId, limit: 5, enabled: canDrawings });
  const snagsQ = useSnagItems({ projectId, limit: 5, enabled: canSnags });
  const rfisQ = useRfis({ projectId, enabled: canRfis });
  const pettyQ = usePettyCashEntries({ projectId, limit: 5, enabled: canPetty });

  const completed = useMemo(() => {
    const estimates = estimatesQ.data ?? [];
    const hasApprovedEstimate = estimates.some((e: { status: string }) => e.status === 'APPROVED');
    const hasBoq = (boqQ.data?.items?.length ?? 0) > 0;
    const hasSchedule = (tasksQ.data?.length ?? 0) > 0;
    const hasReports = (reportsQ.data?.length ?? 0) > 0;
    const hasProcurement = (reqQ.data?.length ?? 0) > 0;
    const hasSubcontracts = (woQ.data?.length ?? 0) > 0;
    const hasInvoices = (invQ.data?.length ?? 0) > 0;
    const hasDrawings = (drawingsQ.data?.data?.length ?? 0) > 0;
    const hasSnags = (snagsQ.data?.data?.length ?? 0) > 0;
    const hasRfis = (rfisQ.data?.data?.length ?? 0) > 0;
    const hasPetty = (pettyQ.data?.data?.length ?? 0) > 0;

    return {
      estimate: hasApprovedEstimate,
      boq: hasBoq,
      schedule: hasSchedule,
      drawings: hasDrawings,
      reports: hasReports,
      procurement: hasProcurement,
      subcontracts: hasSubcontracts,
      snags: hasSnags,
      rfis: hasRfis,
      pettyCash: hasPetty,
      invoices: hasInvoices,
    };
  }, [
    estimatesQ.data,
    boqQ.data,
    tasksQ.data,
    reportsQ.data,
    reqQ.data,
    woQ.data,
    invQ.data,
    drawingsQ.data,
    snagsQ.data,
    rfisQ.data,
    pettyQ.data,
  ]);

  const allowedSet = allowedTabs ? new Set(allowedTabs) : null;

  const steps = PROJECT_SETUP_STEPS.filter((s) => {
    if (allowedSet && !allowedSet.has(s.tab)) return false;
    const perm = TAB_PERMISSION[s.tab];
    if (perm && !hasPermission(perm as never)) return false;
    return true;
  }).map((s) => ({
    ...s,
    done: completed[s.id as keyof typeof completed] ?? false,
  }));

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = steps.length > 0 && doneCount === steps.length;

  if (!loaded || dismissed || steps.length === 0 || allDone) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <View className="flex-row justify-between items-start mb-3 gap-2">
        <View className="flex-1">
          <Text className="text-sm font-bold text-text">Project setup guide</Text>
          <Text className="text-xs text-muted mt-0.5">
            {doneCount} of {steps.length} steps done - follow this path for a new project
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
