/**
 * Environment variable type declarations for Expo public vars.
 * Avoids pulling in full @types/node into the React Native bundle.
 */
declare const process: {
  env: {
    EXPO_PUBLIC_API_URL?: string;
    /** `construction` | `inventory` on native EAS builds; unset on web. */
    EXPO_PUBLIC_APP_VARIANT?: string;
    NODE_ENV?: 'development' | 'production' | 'test';
  };
};