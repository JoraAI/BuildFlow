import type { ConfigContext, ExpoConfig } from 'expo/config';

type Variant = 'construction' | 'inventory' | 'web';

function resolveVariant(): Variant {
  const raw = (process.env.EXPO_PUBLIC_APP_VARIANT ?? '').trim().toLowerCase();
  if (raw === 'inventory' || raw === 'construction') return raw;
  return 'web';
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = resolveVariant();
  const isInventory = variant === 'inventory';

  const name = isInventory ? 'BuildFlow Inventory' : 'BuildFlow';
  const slug = isInventory ? 'buildflow-inventory' : 'buildflow';
  const scheme = isInventory ? 'buildflow-inventory' : 'buildflow';
  const androidPackage = isInventory ? 'com.jora.buildflow.inventory' : 'com.jora.buildflow';
  const iosBundle = isInventory ? 'com.jora.buildflow.inventory' : 'com.jora.buildflow';
  const cameraCopy = isInventory
    ? 'BuildFlow Inventory uses the camera to scan barcodes and capture invoice photos.'
    : 'BuildFlow uses the camera to scan barcodes and capture invoice or site photos.';
  const photosCopy = isInventory
    ? 'BuildFlow Inventory uses your photos for item images and invoices.'
    : 'BuildFlow uses your photos for item images, invoices, and site reports.';

  return {
    ...config,
    name,
    slug,
    version: config.version ?? '2.0.0',
    orientation: 'portrait',
    scheme,
    userInterfaceStyle: config.userInterfaceStyle ?? 'automatic',
    splash: config.splash ?? {
      resizeMode: 'contain',
      backgroundColor: '#1E3A5F',
    },
    icon: config.icon ?? './assets/icon.png',
    ios: {
      ...config.ios,
      supportsTablet: true,
      bundleIdentifier: iosBundle,
      infoPlist: {
        ...(config.ios?.infoPlist ?? {}),
        NSCameraUsageDescription: cameraCopy,
        NSPhotoLibraryUsageDescription: photosCopy,
      },
    },
    android: {
      ...config.android,
      adaptiveIcon: {
        foregroundImage: './assets/icon.png',
        backgroundColor: isInventory ? '#1E3A5F' : '#F59E0B',
      },
      package: androidPackage,
      permissions: ['android.permission.CAMERA'],
    },
    web: config.web ?? {
      bundler: 'metro',
      output: 'single',
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-router',
      ['expo-camera', { cameraPermission: cameraCopy }],
      [
        'expo-image-picker',
        {
          photosPermission: photosCopy,
          cameraPermission: cameraCopy,
        },
      ],
    ],
    experiments: { typedRoutes: true },
    extra: {
      ...(typeof config.extra === 'object' && config.extra ? config.extra : {}),
      appVariant: variant,
    },
  };
};
