import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

export interface VisualViewportFrame {
  /** Pixels hidden/covered at the top of the layout viewport. */
  offsetTop: number;
  /** Visible viewport height (excludes overlapping browser chrome when reported). */
  height: number;
  /** Pixels of the layout viewport covered by the bottom browser/home bar. */
  chromeBottom: number;
}

const ZERO: VisualViewportFrame = { offsetTop: 0, height: 0, chromeBottom: 0 };

function readFrame(): VisualViewportFrame {
  if (typeof window === 'undefined') return ZERO;
  const vv = window.visualViewport;
  const height = vv?.height ?? window.innerHeight;
  const offsetTop = vv?.offsetTop ?? 0;
  const chromeBottom = Math.max(0, Math.round(window.innerHeight - offsetTop - height));
  return {
    offsetTop: Math.round(offsetTop),
    height: Math.round(height),
    chromeBottom,
  };
}

/**
 * Tracks the visible viewport vs overlapping mobile-browser chrome
 * (Safari/Chrome toolbar + iOS home indicator).
 */
export function useVisualViewportFrame(): VisualViewportFrame {
  const [frame, setFrame] = useState<VisualViewportFrame>(readFrame);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const apply = () => setFrame(readFrame());
    apply();
    window.visualViewport?.addEventListener('resize', apply);
    window.visualViewport?.addEventListener('scroll', apply);
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    return () => {
      window.visualViewport?.removeEventListener('resize', apply);
      window.visualViewport?.removeEventListener('scroll', apply);
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
    };
  }, []);

  return frame;
}
