// Web shim for expo-file-system - downloads via browser Blob/blobs instead of native FS
export const documentDirectory = '/web-fs/';
export const cacheDirectory = '/web-fs/cache/';
export const bundleDirectory = '/web-fs/bundle/';

export const EncodingType = {
  UTF8: 'utf8',
  Base64: 'base64',
};

export async function writeAsStringAsync(fileUri, contents, _options) {
  // On web, the actual download is handled separately (browser Blob).
  // This shim just prevents the native call from throwing.
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('webfs_' + fileUri, contents.slice(0, 8192));
    }
  } catch {
    /* ignore */
  }
}

export async function readAsStringAsync(fileUri) {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('webfs_' + fileUri) || '';
    }
  } catch {
    /* ignore */
  }
  return '';
}

export async function deleteAsync(fileUri) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('webfs_' + fileUri);
    }
  } catch {
    /* ignore */
  }
}

export async function getInfoAsync(fileUri) {
  try {
    if (typeof localStorage !== 'undefined') {
      const val = localStorage.getItem('webfs_' + fileUri);
      return { exists: !!val, size: val ? val.length : 0, isDirectory: false };
    }
  } catch {
    /* ignore */
  }
  return { exists: false, size: 0, isDirectory: false };
}

export async function makeDirectoryAsync(_dirUri, _options) {
  /* no-op on web */
}

export async function downloadAsync(_uri, _fileUri, _options) {
  /* no-op on web */
}

export default {
  documentDirectory,
  cacheDirectory,
  bundleDirectory,
  EncodingType,
  writeAsStringAsync,
  readAsStringAsync,
  deleteAsync,
  getInfoAsync,
  makeDirectoryAsync,
  downloadAsync,
};