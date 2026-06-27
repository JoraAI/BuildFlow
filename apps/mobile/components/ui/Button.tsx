import React from 'react';
import { Pressable, Text, ActivityIndicator } from 'react-native';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
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
}

const variants: Record<Variant, string> = {
  primary: 'bg-primary',
  secondary: 'bg-card border border-border',
  ghost: 'bg-transparent',
  danger: 'bg-danger',
};

const textColors: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-text',
  ghost: 'text-primary',
  danger: 'text-white',
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
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`rounded-lg flex-row items-center justify-center ${variants[variant]} ${sizes[size]} ${disabled ? 'opacity-50' : ''} ${fullWidth ? 'w-full' : ''}`}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'ghost' ? '#1E3A5F' : '#fff'} />
      ) : (
        <>
          {icon}
          <Text className={`font-sans font-semibold ${textColors[variant]} ${textSizes[size]} ${icon ? 'ml-2' : ''}`}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
