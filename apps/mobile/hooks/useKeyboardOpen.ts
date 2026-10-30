import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * True while the soft keyboard is actually covering the screen.
 *
 * Web: mobile browsers often leave the input focused after the keypad is
 * dismissed, so focus alone is not enough — we also watch visualViewport /
 * VirtualKeyboard. Native uses Keyboard show/hide events.
 */
const KEYBOARD_COVER_PX = 140;
const KEYBOARD_OPEN_GRACE_MS = 450;

function isTextField(el: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}

function viewportHeight(): number {
  return window.visualViewport?.height ?? window.innerHeight;
}

function virtualKeyboardHeight(): number {
  const vk = (
    navigator as Navigator & {
      virtualKeyboard?: { boundingRect: { height: number } };
    }
  ).virtualKeyboard;
  return vk?.boundingRect?.height ?? 0;
}

export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setOpen(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setOpen(false));
    const willShow = Keyboard.addListener('keyboardWillShow', () => setOpen(true));
    const willHide = Keyboard.addListener('keyboardWillHide', () => setOpen(false));

    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
      return () => {
        showSub.remove();
        hideSub.remove();
        willShow.remove();
        willHide.remove();
      };
    }

    let baseline = viewportHeight();
    let focusedAt = 0;
    let pollId: ReturnType<typeof setInterval> | null = null;

    const stopPoll = () => {
      if (pollId != null) {
        clearInterval(pollId);
        pollId = null;
      }
    };

    const startPoll = () => {
      if (pollId != null) return;
      pollId = setInterval(syncFromViewport, 200);
    };

    const keyboardCovering = (): boolean => {
      const h = viewportHeight();
      if (h > baseline) baseline = h;
      return virtualKeyboardHeight() >= KEYBOARD_COVER_PX || baseline - h >= KEYBOARD_COVER_PX;
    };

    const syncFromViewport = () => {
      if (keyboardCovering()) {
        setOpen(true);
        startPoll();
        return;
      }
      // Keypad animation can lag focus; don't bring the bar back in that window.
      if (isTextField(document.activeElement) && Date.now() - focusedAt < KEYBOARD_OPEN_GRACE_MS) {
        return;
      }
      // Viewport restored (or never shrank) — show the nav even if the field is still focused.
      setOpen(false);
      stopPoll();
    };

    const onFocusIn = (e: FocusEvent) => {
      if (!isTextField(e.target)) return;
      focusedAt = Date.now();
      setOpen(true);
      startPoll();
    };

    const onFocusOut = () => {
      window.setTimeout(() => {
        if (!isTextField(document.activeElement)) {
          setOpen(false);
          stopPoll();
          return;
        }
        syncFromViewport();
      }, 50);
    };

    window.visualViewport?.addEventListener('resize', syncFromViewport);
    window.visualViewport?.addEventListener('scroll', syncFromViewport);
    window.addEventListener('resize', syncFromViewport);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);

    const vk = (
      navigator as Navigator & {
        virtualKeyboard?: {
          addEventListener: (type: string, fn: () => void) => void;
          removeEventListener: (type: string, fn: () => void) => void;
        };
      }
    ).virtualKeyboard;
    vk?.addEventListener?.('geometrychange', syncFromViewport);

    return () => {
      showSub.remove();
      hideSub.remove();
      willShow.remove();
      willHide.remove();
      stopPoll();
      window.visualViewport?.removeEventListener('resize', syncFromViewport);
      window.visualViewport?.removeEventListener('scroll', syncFromViewport);
      window.removeEventListener('resize', syncFromViewport);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      vk?.removeEventListener?.('geometrychange', syncFromViewport);
    };
  }, []);

  return open;
}
