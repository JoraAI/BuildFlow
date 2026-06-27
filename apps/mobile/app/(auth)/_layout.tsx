/**
 * (auth) layout — unauthenticated screens (login, forgot password).
 */
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}