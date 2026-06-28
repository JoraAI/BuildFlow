import { Stack } from 'expo-router';

export default function PortalLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[token]" />
    </Stack>
  );
}
