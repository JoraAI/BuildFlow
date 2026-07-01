import React, { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Card } from '@/components/ui';
import { TermHint } from '@/components/ui/TermHint';
import { Ionicons } from '@expo/vector-icons';

const STORAGE_KEY = 'accounting_explainer_dismissed';

export function AccountingExplainer() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val !== 'true') setVisible(true);
    });
  }, []);

  const dismiss = () => {
    setVisible(false);
    AsyncStorage.setItem(STORAGE_KEY, 'true');
  };

  if (!visible) return null;

  return (
    <Card className="border-primary/20 bg-primary/5 mb-4">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-sm font-bold text-text">Money in vs money out</Text>
        <Pressable onPress={dismiss} className="p-1">
          <Ionicons name="close" size={16} color="#64748B" />
        </Pressable>
      </View>
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