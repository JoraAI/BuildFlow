/**
 * Image pick with reliable web cancel.
 *
 * expo-image-picker on web only listens for `change` on a hidden file input —
 * cancelling the dialog never resolves the promise, which leaves BusyOverlay /
 * edit modals stuck until a hard refresh. This helper handles the `cancel`
 * event and a window-focus fallback, and cleans up the input node.
 */
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export type PickImageOptions = {
  fromCamera?: boolean;
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
};

const CANCELED: ImagePicker.ImagePickerResult = { canceled: true, assets: null };

export async function pickImage(
  options: PickImageOptions = {},
): Promise<ImagePicker.ImagePickerResult> {
  const {
    fromCamera = false,
    allowsEditing = false,
    aspect,
    quality = 0.85,
  } = options;

  if (Platform.OS === 'web') {
    return pickImageWeb({ fromCamera });
  }

  const perm = fromCamera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    return CANCELED;
  }

  return fromCamera
    ? ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality,
        allowsEditing,
        aspect,
      })
    : ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality,
        allowsEditing,
        aspect,
      });
}

function pickImageWeb(opts: { fromCamera: boolean }): Promise<ImagePicker.ImagePickerResult> {
  // Remove orphaned inputs left by a prior cancelled expo-image-picker call.
  document
    .querySelectorAll('input[type="file"][data-bf-image-picker="1"]')
    .forEach((el) => el.parentNode?.removeChild(el));

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    input.setAttribute('data-bf-image-picker', '1');
    if (opts.fromCamera) {
      input.setAttribute('capture', 'environment');
    }
    document.body.appendChild(input);

    let settled = false;
    let focusTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      input.removeEventListener('change', onChange);
      input.removeEventListener('cancel', onCancel);
      window.removeEventListener('focus', onWindowFocus);
      if (focusTimer) clearTimeout(focusTimer);
      if (input.parentNode) input.parentNode.removeChild(input);
    };

    const finish = (result: ImagePicker.ImagePickerResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const onCancel = () => finish(CANCELED);

    const onChange = () => {
      const file = input.files?.[0];
      if (!file) {
        finish(CANCELED);
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => finish(CANCELED);
      reader.onload = () => {
        const uri = typeof reader.result === 'string' ? reader.result : '';
        if (!uri) {
          finish(CANCELED);
          return;
        }
        const image = new Image();
        image.onload = () => {
          finish({
            canceled: false,
            assets: [
              {
                uri,
                width: image.naturalWidth || image.width || 0,
                height: image.naturalHeight || image.height || 0,
                mimeType: file.type || 'image/jpeg',
                fileName: file.name,
              },
            ],
          });
        };
        image.onerror = () => {
          finish({
            canceled: false,
            assets: [
              {
                uri,
                width: 0,
                height: 0,
                mimeType: file.type || 'image/jpeg',
                fileName: file.name,
              },
            ],
          });
        };
        image.src = uri;
      };
      reader.readAsDataURL(file);
    };

    // Browsers that omit the `cancel` event: dialog close refocuses the window.
    const onWindowFocus = () => {
      if (focusTimer) clearTimeout(focusTimer);
      focusTimer = setTimeout(() => {
        if (!settled) finish(CANCELED);
      }, 500);
    };

    input.addEventListener('change', onChange);
    input.addEventListener('cancel', onCancel);
    window.addEventListener('focus', onWindowFocus);
    input.click();
  });
}
