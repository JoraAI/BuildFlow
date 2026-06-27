import React from 'react';
import { View, Text } from 'react-native';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-6 py-12">
      {icon && <View className="mb-4 opacity-40">{icon}</View>}
      <Text className="text-lg font-bold text-text mb-1 text-center">{title}</Text>
      {description && <Text className="text-sm text-text-muted text-center mb-6">{description}</Text>}
      {action}
    </View>
  );
}
