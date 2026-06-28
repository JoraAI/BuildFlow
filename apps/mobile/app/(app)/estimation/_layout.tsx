import { Stack } from 'expo-router';

/** Hidden stack for estimate builder, compare, and rate analysis routes. */
export default function EstimationLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
