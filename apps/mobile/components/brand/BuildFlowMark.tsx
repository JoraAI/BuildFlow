/**
 * BuildFlow brand mark — amber tile with crossed hammer/wrench
 * (same asset as app icon / favicon / owner deck logo).
 */
import React from 'react';
import { Image, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';

// Canonical mark (512px). Favicon is a 48px derivative of the same art.
const brandMark = require('../../assets/buildflow-mark.png');

type BuildFlowMarkProps = {
  size?: number;
  /**
   * Extra chrome behind the mark. Default false — the PNG already includes
   * the amber rounded tile; framing again looks like a double border.
   */
  framed?: boolean;
  /** Soft tile tint when framed (construction accent vs inventory navy). */
  variant?: 'plain' | 'accent' | 'navy';
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
};

export function BuildFlowMark({
  size = 32,
  framed = false,
  variant = 'plain',
  style,
  imageStyle,
}: BuildFlowMarkProps) {
  const img = (
    <Image
      source={brandMark}
      accessibilityLabel="BuildFlow"
      style={[
        {
          width: framed ? size * 0.78 : size,
          height: framed ? size * 0.78 : size,
          borderRadius: framed ? size * 0.12 : size * 0.22,
        },
        imageStyle,
      ]}
      resizeMode="contain"
    />
  );

  if (!framed) {
    return (
      <View style={[{ width: size, height: size }, style]} className="shrink-0">
        {img}
      </View>
    );
  }

  const bg =
    variant === 'accent' ? '#F59E0B' : variant === 'navy' ? '#1E3A5F' : '#F8FAFC';

  return (
    <View
      className="items-center justify-center rounded-lg overflow-hidden shrink-0"
      style={[
        {
          width: size,
          height: size,
          backgroundColor: bg,
          borderWidth: variant === 'plain' ? 1 : 0,
          borderColor: variant === 'plain' ? '#E2E8F0' : undefined,
        },
        style,
      ]}
    >
      {img}
    </View>
  );
}
