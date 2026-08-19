import type { ViewStyle } from 'react-native';

/** Shared positioning for screen action FABs vs the global Assistant FAB. */
export const MOBILE_TAB_BAR_HEIGHT = 64;
export const ASSISTANT_FAB_HEIGHT = 56;
export const FAB_GAP = 12;
export const FAB_EDGE = 16;

export const APP_TOP_BAR_HEIGHT = 64;
export const APP_DESKTOP_FOOTER_HEIGHT = 40;
export const DESKTOP_PANEL_WIDTH = 400;
export const DESKTOP_PANEL_EDGE = 24;
export const DESKTOP_PANEL_TOP_GAP = 12;

/**
 * Bottom padding for the mobile tab bar so labels sit above the iOS home
 * indicator / mobile-browser toolbar. Web uses a larger floor because
 * `insets.bottom` is often 0 in Safari/Chrome.
 */
export function tabBarPaddingBottom(safeBottom: number, isWeb: boolean, chromeBottom = 0): number {
  // Mobile Safari/Chrome overlay ~5–10% of the screen; 56px is a safe web floor
  // when visualViewport chrome is under-reported.
  return Math.max(safeBottom, chromeBottom, isWeb ? 56 : 8);
}

/** Bottom offset for the desktop Assistant FAB. Phone uses the right-edge handle. */
export function assistantFabBottom(safeBottom: number, isDesktop: boolean): number {
  if (isDesktop) return DESKTOP_PANEL_EDGE;
  return Math.max(safeBottom, 8) + MOBILE_TAB_BAR_HEIGHT;
}

/** Bottom offset for a screen-level action FAB. */
export function screenFabBottom(safeBottom: number, isDesktop: boolean): number {
  if (isDesktop) return DESKTOP_PANEL_EDGE;
  // Mobile: screen FAB sits on the opposite corner from Assistant - same row, no stacking.
  return assistantFabBottom(safeBottom, false);
}

export function fabRight(isDesktop: boolean): number {
  return isDesktop ? DESKTOP_PANEL_EDGE : FAB_EDGE;
}

export function fabLeft(): number {
  return FAB_EDGE;
}

/** Extra scroll padding on desktop so content clears the app footer + assistant FAB. */
export function desktopContentBottomPadding(): number {
  return APP_DESKTOP_FOOTER_HEIGHT + DESKTOP_PANEL_EDGE + ASSISTANT_FAB_HEIGHT / 2;
}
export function desktopAssistantPanelStyle(): ViewStyle {
  return {
    position: 'absolute',
    top: APP_TOP_BAR_HEIGHT + DESKTOP_PANEL_TOP_GAP,
    bottom: DESKTOP_PANEL_EDGE,
    right: DESKTOP_PANEL_EDGE,
    width: DESKTOP_PANEL_WIDTH,
  };
}

/** Extra list padding so content clears the tab bar (and a screen FAB if present). */
export function mobileListBottomPadding(hasScreenFab = false): number {
  const base = MOBILE_TAB_BAR_HEIGHT + FAB_GAP + 20;
  return hasScreenFab ? base + ASSISTANT_FAB_HEIGHT : base;
}
