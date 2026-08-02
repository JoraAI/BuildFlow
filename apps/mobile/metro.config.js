const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

let config = getDefaultConfig(projectRoot);

// Monorepo: watch and resolve from workspace root
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

// Apply NativeWind FIRST so its CSS transformer/resolver is registered,
// then layer our web-shim resolver on top (deferring to NativeWind for CSS).
config = withNativeWind(config, { input: './global.css' });

// Web shims: redirect native-only packages to no-op shims when bundling for web
const nativeWindResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    const webShims = {
      'react-native-maps': path.resolve(projectRoot, 'shims/react-native-maps.js'),
      'expo-location': path.resolve(projectRoot, 'shims/expo-location.js'),
      'expo-secure-store': path.resolve(projectRoot, 'shims/expo-secure-store.js'),
      'expo-file-system': path.resolve(projectRoot, 'shims/expo-file-system.js'),
      // FIX (NR-3): Register the NetInfo shim for web so the native package
      // isn't required when bundling for the web target.
      '@react-native-community/netinfo': path.resolve(projectRoot, 'shims/react-native-netinfo.ts'),
    };
    if (webShims[moduleName]) {
      return { type: 'sourceFile', filePath: webShims[moduleName] };
    }
  }
  if (nativeWindResolveRequest) {
    return nativeWindResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
