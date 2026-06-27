import React from 'react';
import { View, Text, TextInput } from 'react-native';

interface InputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  helper?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  multiline?: boolean;
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  helper,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'none',
  leftIcon,
  rightIcon,
  multiline = false,
}: InputProps) {
  return (
    <View className="mb-4">
      {label && <Text className="text-sm font-semibold text-text mb-1.5">{label}</Text>}
      <View className={`flex-row items-center rounded-lg border bg-card ${error ? 'border-danger' : 'border-border'} px-3`}>
        {leftIcon}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          multiline={multiline}
          className={`flex-1 text-text py-3 ${leftIcon ? 'ml-2' : ''} ${multiline ? 'min-h-[80px] text-top' : ''}`}
          placeholderTextColor="#94A3B8"
        />
        {rightIcon}
      </View>
      {error && <Text className="text-xs text-danger mt-1">{error}</Text>}
      {helper && !error && <Text className="text-xs text-text-muted mt-1">{helper}</Text>}
    </View>
  );
}
