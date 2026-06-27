// Web shim for expo-secure-store — backed by localStorage (not secure, browser only)
const PREFIX = 'buildflow_secure_';

function key(k) {
  return PREFIX + k;
}

export const AFTER_FIRST_UNLOCK = 'AfterFirstUnlock';
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 'AfterFirstUnlockThisDeviceOnly';
export const ALWAYS = 'Always';
export const ALWAYS_THIS_DEVICE_ONLY = 'AlwaysThisDeviceOnly';
export const WHEN_UNLOCKED = 'WhenUnlocked';
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 'WhenUnlockedThisDeviceOnly';
export const WHEN_PASSCODE_SET_THIS_DEVICE_ONLY = 'WhenPasscodeSetThisDeviceOnly';

export async function getItemAsync(k) {
  try {
    return localStorage.getItem(key(k));
  } catch {
    return null;
  }
}

export function getItem(k) {
  try {
    return localStorage.getItem(key(k));
  } catch {
    return null;
  }
}

export async function setItemAsync(k, value) {
  try {
    localStorage.setItem(key(k), value);
  } catch {
    /* ignore quota errors */
  }
}

export function setItem(k, value) {
  try {
    localStorage.setItem(key(k), value);
  } catch {
    /* ignore quota errors */
  }
}

export async function deleteItemAsync(k) {
  try {
    localStorage.removeItem(key(k));
  } catch {
    /* ignore */
  }
}

export function deleteItem(k) {
  try {
    localStorage.removeItem(key(k));
  } catch {
    /* ignore */
  }
}

export async function isAvailableAsync() {
  return typeof localStorage !== 'undefined';
}

export function canUseBiometricAuthentication() {
  return false;
}

export default {
  AFTER_FIRST_UNLOCK,
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  ALWAYS,
  ALWAYS_THIS_DEVICE_ONLY,
  WHEN_UNLOCKED,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
  getItemAsync,
  getItem,
  setItemAsync,
  setItem,
  deleteItemAsync,
  deleteItem,
  isAvailableAsync,
  canUseBiometricAuthentication,
};