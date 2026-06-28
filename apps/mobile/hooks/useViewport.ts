import { Platform, useWindowDimensions } from 'react-native';

export const BREAKPOINTS = {
  tablet: 768,
  desktop: 1024,
  wide: 1280,
} as const;

export function useViewport() {
  const { width, height } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';

  return {
    width,
    height,
    isWeb,
    isMobile: !isWeb || width < BREAKPOINTS.tablet,
    isTablet: isWeb && width >= BREAKPOINTS.tablet && width < BREAKPOINTS.desktop,
    isDesktop: isWeb && width >= BREAKPOINTS.tablet,
    isWideDesktop: isWeb && width >= BREAKPOINTS.desktop,
    isUltraWide: isWeb && width >= BREAKPOINTS.wide,
    /** Heavy marketing layouts — 1024px+ only. */
    isMarketingDesktop: isWeb && width >= BREAKPOINTS.desktop,
    columns: isWeb && width >= BREAKPOINTS.wide ? 3 : isWeb && width >= BREAKPOINTS.desktop ? 2 : 1,
  };
}
