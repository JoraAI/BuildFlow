/**
 * BuildFlow - SearchBar UI primitive.
 */
import React from 'react';
import { View, TextInput, Text } from 'react-native';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
}

export function SearchBar({ value, onChangeText, placeholder = 'Search...', onSubmit }: SearchBarProps) {
  return (
    <View className="flex-row items-center bg-card border border-border rounded-lg px-3 py-2.5">
      <Text className="text-text-muted mr-2 text-base">🔍</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        onSubmitEditing={onSubmit}
        returnKeyType="search"
        className="flex-1 text-sm text-text"
      />
      {value.length > 0 && (
        <Text className="text-text-muted ml-2" onPress={() => onChangeText('')}>
          ✕
        </Text>
      )}
    </View>
  );
}