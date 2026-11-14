import { Redirect, Stack } from 'expo-router';
import { usePermissions } from '@/hooks/usePermission';

/** Stack for proposal create + detail (hidden from tab bar). */
export default function ProposalsLayout() {
  const { hasPermission } = usePermissions();

  // Roles without proposal.view (e.g. accountant, site roles) must not land here
  // via deep link, estimation redirect, or broken tab history.
  if (!hasPermission('proposal.view')) {
    return <Redirect href="/projects" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
