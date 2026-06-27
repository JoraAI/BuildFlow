// Web shim for expo-location — no-op for browser builds
export const requestForegroundPermissionsAsync = async () => ({ status: 'denied' });
export const getCurrentPositionAsync = async () => ({
  coords: { latitude: 0, longitude: 0, accuracy: 0 },
});
export const watchPositionAsync = async () => ({ remove: () => {} });
export const Accuracy = { Balanced: 3, High: 4, Highest: 5, Low: 2, Lowest: 1, BestForNavigation: 6 };
export const hasServicesEnabledAsync = async () => false;
export default {
  requestForegroundPermissionsAsync,
  getCurrentPositionAsync,
  watchPositionAsync,
  Accuracy,
  hasServicesEnabledAsync,
};