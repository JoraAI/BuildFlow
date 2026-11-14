import { Redirect } from 'expo-router';
import { usePermissions } from '@/hooks/usePermission';

/** Legacy route - Estimation tab is now Proposals for roles that can view them. */
export default function EstimationIndexRedirect() {
  const { hasPermission } = usePermissions();
  if (hasPermission('proposal.view')) {
    return <Redirect href="/proposals" />;
  }
  return <Redirect href="/projects" />;
}
