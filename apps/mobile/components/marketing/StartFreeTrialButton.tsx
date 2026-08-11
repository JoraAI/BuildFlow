import React, { useState, useRef, useEffect } from 'react';
import { Text, Pressable, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type StartFreeTrialButtonProps = {
  onPress: () => void;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  /** Outline style for secondary CTAs on dark backgrounds. */
  variant?: 'accent' | 'outline' | 'primary';
  /** Shown on hover (web): what the subscriber gets. */
  hoverTitle?: string;
  hoverBody?: string;
};

type TipPos = { top: number; left: number };

function TrialHoverTip({
  title,
  body,
  pos,
}: {
  title?: string;
  body?: string;
  pos: TipPos;
}) {
  const tip = (
    <View
      pointerEvents="none"
      style={{
        position: Platform.OS === 'web' ? ('fixed' as 'absolute') : 'absolute',
        top: pos.top,
        left: pos.left,
        width: 288,
        maxWidth: '90vw' as unknown as number,
        zIndex: 100000,
        elevation: 100,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        // @ts-expect-error web box-shadow
        boxShadow: Platform.OS === 'web' ? '0 12px 28px rgba(15,23,42,0.18)' : undefined,
      }}
    >
      {title ? <Text className="text-sm font-bold text-text mb-1">{title}</Text> : null}
      {body ? <Text className="text-xs text-muted leading-relaxed">{body}</Text> : null}
    </View>
  );

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createPortal } = require('react-dom') as typeof import('react-dom');
    return createPortal(tip, document.body);
  }
  return tip;
}

/** Marketing trial CTA with optional hover blurb (web). */
export function StartFreeTrialButton({
  onPress,
  fullWidth = false,
  size = 'lg',
  label = 'Start free trial',
  variant = 'accent',
  hoverTitle,
  hoverBody,
}: StartFreeTrialButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [tipPos, setTipPos] = useState<TipPos | null>(null);
  const wrapRef = useRef<View>(null);
  const showTip = Platform.OS === 'web' && hovered && !!(hoverTitle || hoverBody) && tipPos;

  const sizePad = size === 'lg' ? 'px-7 py-4' : size === 'md' ? 'px-5 py-3' : 'px-4 py-2.5';
  const textSize = size === 'lg' ? 'text-lg' : size === 'md' ? 'text-base' : 'text-sm';
  const iconSize = size === 'lg' ? 20 : 16;

  let containerClass = `flex-row items-center justify-center rounded-xl active:opacity-95 ${sizePad}`;
  let iconColor = '#1E3A5F';
  let textClass = `font-bold ml-2 text-primary ${textSize}`;
  let iconName: keyof typeof Ionicons.glyphMap = 'sparkles';

  if (variant === 'outline') {
    containerClass += ' bg-transparent border-2 border-white/50';
    iconColor = '#FFFFFF';
    textClass = `font-bold ml-2 text-white ${textSize}`;
    iconName = 'cube-outline';
  } else if (variant === 'primary') {
    containerClass += ' bg-primary';
    iconColor = '#F59E0B';
    textClass = `font-bold ml-2 text-white ${textSize}`;
    iconName = 'cube-outline';
  } else {
    containerClass += ' bg-accent';
  }

  if (fullWidth) containerClass += ' w-full';

  const measureTip = () => {
    if (Platform.OS !== 'web') return;
    const node = wrapRef.current as unknown as { getBoundingClientRect?: () => DOMRect } | null;
    // RN Web View forwards to DOM; measureInWindow is more reliable across versions.
    wrapRef.current?.measureInWindow((x, y, width, height) => {
      const left = Math.max(8, Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 400) - 296));
      setTipPos({ top: y + height + 8, left });
    });
    void node;
  };

  useEffect(() => {
    if (!hovered || Platform.OS !== 'web') {
      setTipPos(null);
      return;
    }
    measureTip();
    const onScroll = () => measureTip();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [hovered]);

  return (
    <View
      ref={wrapRef}
      className={`relative ${fullWidth ? 'w-full' : ''}`}
      style={showTip ? { zIndex: 9999, elevation: 40 } : undefined}
    >
      <Pressable
        onPress={onPress}
        onHoverIn={() => {
          setHovered(true);
          measureTip();
        }}
        onHoverOut={() => setHovered(false)}
        accessibilityLabel={hoverTitle ? `${label}. ${hoverTitle}. ${hoverBody ?? ''}` : label}
        accessibilityHint={hoverBody}
        className={containerClass}
      >
        <Ionicons name={iconName} size={iconSize} color={iconColor} />
        <Text className={textClass}>{label}</Text>
        <Ionicons
          name="arrow-forward"
          size={iconSize}
          color={iconColor}
          style={{ marginLeft: 8 }}
        />
      </Pressable>
      {showTip && tipPos ? (
        <TrialHoverTip title={hoverTitle} body={hoverBody} pos={tipPos} />
      ) : null}
    </View>
  );
}

/** Pricing-card CTA (no hover tips — homepage hero owns those). */
export function StartFreeTrialCardButton({
  onPress,
  highlighted = false,
  label = 'Start free trial',
  inventory = false,
}: {
  onPress: () => void;
  highlighted?: boolean;
  label?: string;
  inventory?: boolean;
}) {
  return (
    <StartFreeTrialButton
      onPress={onPress}
      fullWidth
      size={highlighted ? 'md' : 'sm'}
      label={label}
      variant={inventory ? 'primary' : 'accent'}
    />
  );
}
