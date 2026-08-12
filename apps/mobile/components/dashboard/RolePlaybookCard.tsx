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
      'Create client invoices',
    ],
  },
  SUPERVISOR: {
    title: 'Supervisor - typical tasks',
    tasks: [
      'Submit daily site reports with photos',
      'Draft subcontract measurement sheets',
      'Create material indents for site needs',
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
