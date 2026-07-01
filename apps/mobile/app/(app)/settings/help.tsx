/**
 * BuildFlow - In-app help center (beginner workflows).
 */
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { FormScreenHeader } from '@/components/layout/ScreenHeader';
import { useViewport } from '@/hooks/useViewport';
import { dismissTo, DISMISS } from '@/utils/navigation';
import { TermHint } from '@/components/ui/TermHint';
import { FlowHintCard } from '@/components/ui/FlowHintCard';

const WORKFLOWS = [
  {
    title: 'Run a project (end to end)',
    steps: [
      'Create a project with budget and dates',
      'Build and approve an estimate on the Estimate tab',
      'Owner converts the approved estimate to BOQ',
      'Plan tasks on the Schedule tab',
      'Supervisors submit daily site reports',
      'Raise client invoices and record vendor bills in Accounting',
    ],
  },
  {
    title: 'Procurement (materials)',
    steps: [
      'Create an indent (material request) on Procurement',
      'Submit the indent; PM or Owner approves it',
      'Create a purchase order (PO) from the approved indent',
      'When goods arrive, record a GRN — site stock and BOQ procured qty update',
      'Note: GRN does not certify subcontract work — that is a separate flow',
    ],
  },
  {
    title: 'Subcontractors',
    steps: [
      'Create a work order on the Subcontracts tab (or import from BOQ)',
      'Add a measurement sheet for work done in a period',
      'Submit the sheet; PM approves it — a linked bill is created automatically',
      'Accountant approves the bill and records payment',
      'When all work is certified, complete the work order to release retention',
    ],
  },
  {
    title: 'Invoices vs bills',
    steps: [
      'Invoices = money from your client (revenue in)',
      'Bills = money to vendors or subcontractors (cost out)',
      'Subcontract linked bills appear on Subcontracts and in Accounting → Bills',
    ],
  },
];

export default function HelpCenterScreen() {
  const { isDesktop } = useViewport();

  const body = (
    <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-10">
      <Card>
        <Text className="text-sm text-text leading-5">
          BuildFlow connects estimation, site operations, procurement, subcontracts, and accounting.
          Use this guide when you are new — or tap the <Text className="font-semibold">(i)</Text> icons
          next to terms like BOQ and GRN anywhere in the app.
        </Text>
      </Card>

      <Card>
        <Text className="text-sm font-bold text-text mb-3">Key terms</Text>
        <View className="flex-row flex-wrap gap-x-4 gap-y-2">
          <TermHint term="BOQ" label="BOQ" />
          <TermHint term="GRN" label="GRN" />
          <TermHint term="INDENT" label="Indent" />
          <TermHint term="WORK_ORDER" label="Work order" />
          <TermHint term="MEASUREMENT_SHEET" label="Measurement sheet" />
          <TermHint term="INVOICE" label="Invoice" />
          <TermHint term="BILL" label="Bill" />
          <TermHint term="VARIATION" label="Variation" />
        </View>
      </Card>

      {WORKFLOWS.map((wf) => (
        <FlowHintCard key={wf.title} title={wf.title} steps={wf.steps} />
      ))}

      <Card>
        <View className="flex-row items-center gap-2 mb-2">
          <Ionicons name="chatbubble-ellipses-outline" size={20} color="#1E3A5F" />
          <Text className="text-sm font-bold text-text">BuildFlow Assistant</Text>
        </View>
        <Text className="text-sm text-muted leading-5">
          Tap the assistant button (bottom-right) and ask: “Explain subcontract billing”, “What is GRN?”,
          or “What should I do next on this project?”
        </Text>
      </Card>
    </ScrollView>
  );

  if (isDesktop) {
    return (
      <SafeAreaView className="flex-1 bg-surface" edges={[]}>
        <ScreenContainer scrollable constrained>
          <FormScreenHeader title="How BuildFlow works" cancelLabel="Back" onCancel={() => dismissTo(DISMISS.settings)} />
          {body}
        </ScreenContainer>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['bottom']}>
      <FormScreenHeader title="How BuildFlow works" cancelLabel="Back" onCancel={() => dismissTo(DISMISS.settings)} />
      <View className="flex-1 px-4">{body}</View>
    </SafeAreaView>
  );
}
