import { Stack } from 'expo-router';

/** Stack for project list → detail / create (matches proposals nested pattern). */
export default function ProjectsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
