/**
 * BuildFlow - Viewport hook.
 *
 * FIX (UI-C1/NR-2): Form-factor flags are now WIDTH-DRIVEN, not platform-driven.
 * Previously `isTablet` and `isDesktop` were gated on `Platform.OS === 'web'`,
 * so native iPads never received the tablet/desktop layout even at 1024px+.
 * Now a native iPad in landscape gets the sidebar, grids, and dialogs.
 *
 * `isWeb` is still exposed for genuinely web-only rendering (hover states,
 * scroll indicators), but it no longer gates layout tier.
 */
import { Platform, useWindowDimensions } from 'react-native';

export const BREAKPOINTS = {
  tablet: 768,
  desktop: 1024,
  wide: 1280,
} as const;

export function useViewport() {
  const { width, height } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';

  // FIX (UI-C1): isPhone / isTablet / isDesktop are purely width-based so a
  // native iPad (Platform.OS === 'ios') at >=768px gets the tablet/desktop tier.
  const isPhone = width < BREAKPOINTS.tablet; // < 768
  const isTablet = width >= BREAKPOINTS.tablet && width < BREAKPOINTS.desktop; // 768–1023
  const isDesktop = width >= BREAKPOINTS.desktop; // >= 1024

  return {
    width,
    height,
    isWeb,
    isPhone,
    isTablet,
    isDesktop,
    // Backwards-compatible aliases used throughout the codebase.
    isMobile: isPhone,
    isWideDesktop: width >= BREAKPOINTS.wide,
    isUltraWide: width >= BREAKPOINTS.wide,
    /** Heavy marketing layouts - 1024px+ only. */
    isMarketingDesktop: isDesktop,
    /** Responsive card grid columns: 1 phone, 2 tablet+, 3 ultra-wide. */
    gridColumns: width >= BREAKPOINTS.wide ? 3 : width >= BREAKPOINTS.tablet ? 2 : 1,
    /** @deprecated Use gridColumns */
    columns: width >= BREAKPOINTS.wide ? 3 : width >= BREAKPOINTS.desktop ? 2 : 1,
  };
}