import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useViewport } from '@/hooks/useViewport';
import { NavBackButton } from '@/components/layout/NavBackButton';

export function AuthBackBar({
  backHref,
  backLabel = 'Back',
}: {
  backHref: string;
  backLabel?: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useViewport();

  return (
    <View
      className={isDesktop ? 'absolute top-0 left-0 z-10' : 'px-4'}
      style={
        isDesktop
          ? { top: Math.max(insets.top, 16), left: 16 }
          : { paddingTop: Math.max(insets.top, 8) }
      }
    >
      <NavBackButton
        onPress={() => router.push(backHref as never)}
        label={backLabel}
        variant={isDesktop ? 'inverse' : 'default'}
      />
    </View>
  );
}
