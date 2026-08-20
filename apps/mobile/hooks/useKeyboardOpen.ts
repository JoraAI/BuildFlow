import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * True while soft keyboard is open (native) or a text field is focused (web).
 * Used to hide the inventory bottom tab bar so it does not cover the focused input.
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, () => setOpen(true));
    const hideSub = Keyboard.addListener(hideEvt, () => setOpen(false));

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const isTextField = (el: EventTarget | null): boolean => {
        if (!el || !(el instanceof HTMLElement)) return false;
        const tag = el.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
      };
      const onFocusIn = (e: FocusEvent) => {
        if (isTextField(e.target)) setOpen(true);
      };
      const onFocusOut = () => {
        setTimeout(() => {
          if (!isTextField(document.activeElement)) setOpen(false);
        }, 80);
      };
      document.addEventListener('focusin', onFocusIn);
      document.addEventListener('focusout', onFocusOut);
      return () => {
        showSub.remove();
        hideSub.remove();
        document.removeEventListener('focusin', onFocusIn);
        document.removeEventListener('focusout', onFocusOut);
      };
    }

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return open;
}
