import React from 'react';
import { Pressable, Text, ActivityIndicator, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

const variants: Record<Variant, string> = {
  primary: 'bg-primary',
  secondary: 'bg-card border border-border',
  ghost: 'bg-transparent',
  danger: 'bg-danger',
  accent: 'bg-accent',
};

const textColors: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-text',
  ghost: 'text-primary',
  danger: 'text-white',
  accent: 'text-primary',
};

const loaderColors: Record<Variant, string> = {
  primary: '#fff',
  secondary: '#1E3A5F',
  ghost: '#1E3A5F',
  danger: '#fff',
  accent: '#1E3A5F',
};

const sizes: Record<Size, string> = {
  sm: 'px-3 py-2',
  md: 'px-4 py-3',
  lg: 'px-6 py-4',
};

const textSizes: Record<Size, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  className = '',
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`rounded-lg flex-row items-center justify-center ${variants[variant]} ${sizes[size]} ${disabled ? 'opacity-50' : 'active:opacity-90'} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {loading ? (
        <ActivityIndicator color={loaderColors[variant]} />
      ) : (
        <>
          {icon}
          <Text
            className={`font-sans font-semibold ${textColors[variant]} ${textSizes[size]} ${icon ? 'ml-2' : ''} ${variant === 'accent' ? 'font-bold' : ''}`}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
