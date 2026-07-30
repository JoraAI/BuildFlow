// Shim for @react-native-community/netinfo (web/test)
// The real package is used on native via Metro bundler.
export default {
  addEventListener: (_cb: (state: { isConnected: boolean; isInternetReachable: boolean | null }) => void) => {
    return () => {};
  },
  fetch: async () => ({ isConnected: true, isInternetReachable: true }),
};

export type NetInfoState = {
  isConnected: boolean;
  isInternetReachable: boolean | null;
};