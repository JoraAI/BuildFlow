import React from 'react';
import { View, Text } from 'react-native';
import { Card } from '@/components/ui';

const ROLE_TASKS: Record<string, { title: string; tasks: string[] }> = {
  OWNER: {
    title: 'Owner - typical tasks',
    tasks: [
      'Approve estimates and variations',
      'Convert approved estimates to BOQ',
      'Review company dashboard and finances',
      'Invite team and manage settings',
    ],
  },
  PM: {
    title: 'Project Manager - typical tasks',
    tasks: [
      'Submit and track material indents',
      'Approve measurement sheets and indents',
      'Monitor schedule and daily reports',
      'Review invoices and bills in Accounting',
    ],
  },
  DPM: {
    title: 'Deputy PM - typical tasks',
    tasks: [
      'Create and submit estimates',
      'Record BOQ measurements and site snags',
      'Create variations for Owner approval',
      'Log petty cash and review procurement',
    ],
  },
  SITE_SUPERVISOR: {
    title: 'Site Supervisor - typical tasks',
    tasks: [
      'Submit daily site reports with photos',
      'Log snags and upload drawings',
      'Record gang muster and petty cash',
    ],
  },
  SUPERVISOR: {
    title: 'Supervisor - typical tasks',
    tasks: [
      'Submit daily site reports with photos',
      'Log snags and upload drawings',
      'Record gang muster and petty cash',
    ],
  },
  QC: {
    title: 'QC - typical tasks',
    tasks: [
      'Record BOQ measurements',
      'Upload and manage drawings',
      'Create and rectify snags / NCRs',
    ],
  },
  STORE_INCHARGE: {
    title: 'Store Incharge - typical tasks',
    tasks: [
      'Create material indents',
      'Record GRNs and manage stock',
      'Log store petty cash when needed',
    ],
  },
  WEIGHBRIDGE_INCHARGE: {
    title: 'Weighbridge - typical tasks',
    tasks: [
      'Record goods receipts (GRN)',
      'Submit daily weighbridge reports',
      'View procurement and stock levels',
    ],
  },
  ACCOUNTANT: {
    title: 'Accountant - typical tasks',
    tasks: [
      'Approve and pay vendor bills',
      'Record client invoice payments',
      'Export GST/TDS and Tally reports',
    ],
  },
};

export function RolePlaybookCard({ role }: { role: string }) {
  const playbook = ROLE_TASKS[role] ?? ROLE_TASKS.PM;

  return (
    <Card className="border-border">
      <Text className="text-sm font-bold text-text mb-2">{playbook.title}</Text>
      <View className="gap-1.5">
        {playbook.tasks.map((task) => (
          <View key={task} className="flex-row gap-2">
            <Text className="text-xs text-primary">•</Text>
            <Text className="text-xs text-muted flex-1">{task}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
