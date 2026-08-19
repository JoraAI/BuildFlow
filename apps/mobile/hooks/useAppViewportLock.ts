import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Pin the web app to the *visible* viewport so iOS/Android browser chrome
 * (URL bar, bottom toolbar) does not cover the bottom tab bar.
 *
 * `--app-height` is consumed by `global.css` on html/body/#root.
 */
export function useAppViewportLock() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const root = document.documentElement;

    const apply = () => {
      const vv = window.visualViewport;
      const height = vv?.height ?? window.innerHeight;
      const offsetTop = vv?.offsetTop ?? 0;
      const chromeBottom = Math.max(0, window.innerHeight - offsetTop - height);
      root.style.setProperty('--app-height', `${Math.round(height)}px`);
      root.style.setProperty('--app-top', `${Math.round(offsetTop)}px`);
      root.style.setProperty('--chrome-bottom', `${Math.round(chromeBottom)}px`);
    };

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
}
