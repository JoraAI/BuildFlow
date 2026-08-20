import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { useViewport } from '@/hooks/useViewport';

interface InputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  helper?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'decimal-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  multiline?: boolean;
  /** Stretch to container width on desktop (default: compact max-width). */
  fullWidth?: boolean;
  /** Accessible name for screen readers when `label` is blank. */
  accessibilityLabel?: string;
  /** Drop bottom margin (inline toolbars / sticky search rows). */
  compact?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
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
  fullWidth = false,
  accessibilityLabel,
  compact = false,
  onFocus,
  onBlur,
}: InputProps) {
  const { isDesktop } = useViewport();
  const widthClass =
    fullWidth || !isDesktop
      ? 'w-full'
      : multiline
        ? 'w-full max-w-xl self-start'
        : 'w-full max-w-md self-start';

  return (
    <View className={`${compact ? 'mb-0' : 'mb-4'} ${widthClass}`}>
      {label ? <Text className="text-sm font-semibold text-text mb-1.5">{label}</Text> : null}
      <View
        className={`flex-row items-center rounded-lg border bg-card ${
          error ? 'border-danger' : 'border-border'
        } px-3 ${multiline ? 'items-start py-2' : ''}`}
      >
        {leftIcon}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          multiline={multiline}
          accessibilityLabel={accessibilityLabel ?? label}
          // LTR so RN-web does not reverse typed characters in RTL locales / autofill quirks.
          style={{ direction: 'ltr', writingDirection: 'ltr', textAlign: 'left' } as object}
          className={`flex-1 text-text ${multiline ? 'min-h-[88px] py-2 text-top' : 'py-3'} ${
            leftIcon ? 'ml-2' : ''
          }`}
          placeholderTextColor="#94A3B8"
        />
        {rightIcon}
      </View>
      {error ? <Text className="text-xs text-danger mt-1">{error}</Text> : null}
      {helper && !error ? <Text className="text-xs text-muted mt-1">{helper}</Text> : null}
    </View>
  );
}
