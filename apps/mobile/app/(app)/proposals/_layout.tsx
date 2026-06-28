import { Stack } from 'expo-router';

/** Stack for proposal create + detail (hidden from tab bar). */
export default function ProposalsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
