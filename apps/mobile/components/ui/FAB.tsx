import React from 'react';
import { Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FABProps {
  label?: string;
  icon?: string;
  onPress?: () => void;
}

export function FAB({ label = '+', icon, onPress }: FABProps) {
  return (
    <Pressable
      onPress={onPress}
      className="absolute bottom-6 right-6 flex-row items-center rounded-full bg-accent px-5 py-4 shadow-lg active:bg-accent-dark z-50"
      style={{ elevation: 5 }}
    >
      {icon ? (
        <Ionicons name={icon as never} size={24} color="#fff" />
      ) : (
        <Text className="text-white text-2xl font-bold leading-none">{label}</Text>
      )}
      {label !== '+' && label && <Text className="text-white font-semibold ml-2">{label}</Text>}
    </Pressable>
  );
}
