import React from 'react';
import { View, Text } from 'react-native';
import { Card } from '@/components/ui';
import { TermHint } from '@/components/ui/TermHint';

export function AccountingExplainer() {
  return (
    <Card className="border-primary/20 bg-primary/5 mb-4">
      <Text className="text-sm font-bold text-text mb-2">Money in vs money out</Text>
      <View className="gap-2">
        <View className="flex-row items-start gap-2">
          <TermHint term="INVOICE" />
          <Text className="text-xs text-muted flex-1">
            <Text className="font-semibold text-text">Invoices</Text> — bill your client (revenue coming in)
          </Text>
        </View>
        <View className="flex-row items-start gap-2">
          <TermHint term="BILL" />
          <Text className="text-xs text-muted flex-1">
            <Text className="font-semibold text-text">Bills</Text> — pay vendors and subcontractors (cost going out).
            Subcontract bills are also created from measurement sheet approval.
          </Text>
        </View>
      </View>
    </Card>
  );
}
