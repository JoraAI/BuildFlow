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
      // FIX (UI-M11): Add hover and focus-visible states for web so the app
      // feels like a real web app and is keyboard-navigable. hitSlop ensures
      // 44px minimum touch target on phones (UI-M12).
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      className={`rounded-lg flex-row items-center justify-center ${variants[variant]} ${sizes[size]} ${disabled ? 'opacity-50' : 'active:opacity-90'} ${Platform.OS === 'web' ? 'hover:opacity-95 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none transition-opacity' : ''} ${fullWidth ? 'w-full' : ''} ${className}`}
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
