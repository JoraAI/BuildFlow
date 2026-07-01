import { Alert, Platform } from 'react-native';

/** Cross-platform confirm - Alert buttons are unreliable on web. */
export function confirmAsync(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Confirm', onPress: () => resolve(true) },
    ]);
  });
}

export function alertAsync(title: string, message: string): Promise<void> {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [{ text: 'OK', onPress: () => resolve() }]);
  });
}

export type LinkApplyChoice = 'link_only' | 'apply_defaults' | 'cancel';

/** After picking a catalog item or rate analysis - link only vs apply unit/rate defaults. */
export function promptLinkApplyAsync(libraryName: string): Promise<LinkApplyChoice> {
  if (Platform.OS === 'web') {
    const apply = window.confirm(
      `Link to "${libraryName}"?\n\nOK = Apply unit & rate from library\nCancel = Link only (keep current description, qty, and rate)`,
    );
    return Promise.resolve(apply ? 'apply_defaults' : 'link_only');
  }
  return new Promise((resolve) => {
    Alert.alert(
      'Link to library item?',
      `"${libraryName}" - keep your current line fields or apply defaults from the library?`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve('cancel') },
        { text: 'Link only', onPress: () => resolve('link_only') },
        { text: 'Apply defaults', onPress: () => resolve('apply_defaults') },
      ],
    );
  });
}
