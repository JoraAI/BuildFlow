/**
 * BuildFlow brand mark — same asset as the web favicon / app icon.
 */
import React from 'react';
import { Image, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';

// Same source as apps/mobile/assets/favicon.png (generated from icon.png).
const brandMark = require('../../assets/favicon.png');

type BuildFlowMarkProps = {
  size?: number;
  /** Soft rounded tile behind the mark (default true). */
  framed?: boolean;
  /** Use amber tile (construction chrome) vs plain. */
  variant?: 'plain' | 'accent' | 'navy';
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
};

export function BuildFlowMark({
  size = 32,
  framed = true,
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
          width: framed ? size * 0.72 : size,
          height: framed ? size * 0.72 : size,
          resizeMode: 'contain',
        },
        imageStyle,
      ]}
    />
  );

  if (!framed) {
    return <View style={style}>{img}</View>;
  }

  const bg =
    variant === 'accent' ? '#F59E0B' : variant === 'navy' ? '#1E3A5F' : 'transparent';

  return (
    <View
      className="items-center justify-center rounded-lg overflow-hidden"
      style={[
        {
          width: size,
          height: size,
          backgroundColor: bg === 'transparent' ? undefined : bg,
        },
        variant === 'plain' ? { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' } : null,
        style,
      ]}
    >
      {img}
    </View>
  );
}
